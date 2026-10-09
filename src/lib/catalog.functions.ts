import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Database, Json } from '@/integrations/supabase/types';
import { allowedCategories, categoryDataSchema, productDataSchema, contactSchema, type CatalogData } from '@/data/catalog';

export const getCatalog = createServerFn({method:'GET'}).handler(async ():Promise<CatalogData>=>{
 const url=process.env['SUPABASE_URL']; const key=process.env['SUPABASE_PUBLISHABLE_KEY'];
 if(!url||!key) throw new Error('Catálogo indisponível.');
 const db=createClient<Database>(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{const h=new Headers(init?.headers);if(key.startsWith('sb_')&&h.get('Authorization')===`Bearer ${key}`)h.delete('Authorization');h.set('apikey',key);return fetch(input,{...init,headers:h});}}});
 return readCatalog(db,false);
});

async function readCatalog(db:ReturnType<typeof createClient<Database>>,admin:boolean):Promise<CatalogData>{
 const [cats,ps,cs]=await Promise.all([db.from('catalog_categories').select('*'),db.from('catalog_products').select('*'),db.from('contact_settings').select('data').eq('id',1).single()]);
 if(cats.error||ps.error||cs.error) throw new Error('Não foi possível carregar o catálogo.');
 const sign=async(path:string)=>{if(!path)return '';const r=await db.storage.from('catalog-images').createSignedUrl(path,3600);if(r.error)throw new Error('Não foi possível carregar a fotografia.'); const signed=r.data.signedUrl;const browserUrl=import.meta.env.VITE_SUPABASE_URL; return browserUrl?signed.replace(process.env['SUPABASE_URL']??'',browserUrl):signed;};
 const categories=await Promise.all((cats.data??[]).filter(r=>admin||allowedCategories.some(s=>s===r.slug)).map(async r=>{const data=categoryDataSchema.parse(r.data);return {...data,slug:r.slug,active:r.active,image:await sign(data.imagePath)};}));
 const products=await Promise.all((ps.data??[]).filter(r=>admin||categories.some(c=>c.slug===r.category&&c.active)).map(async r=>{const data=productDataSchema.parse(r.data);return {...data,slug:r.slug,category:r.category,active:r.active,image:await sign(data.imagePath)};}));
 return {categories:categories.sort((a,b)=>a.number.localeCompare(b.number)),products:products.sort((a,b)=>a.order-b.order),config:contactSchema.parse(cs.data?.data)};
}

const adminMiddleware= requireSupabaseAuth;
export const getAdminCatalog=createServerFn({method:'GET'}).middleware([adminMiddleware]).handler(async({context})=>{
 const role=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});
 if(role.error||!role.data)throw new Error('Acesso restrito a administradores.');
 const [catalog,quotes]=await Promise.all([readCatalog(context.supabase,true),context.supabase.from('quote_requests').select('*').order('created_at',{ascending:false}).limit(100)]);
 if(quotes.error)throw new Error('Não foi possível carregar os orçamentos.');
 return {catalog,quotes:quotes.data};
});
const slug=z.string().regex(/^[a-z0-9-]{1,120}$/);
export const saveCatalogItem=createServerFn({method:'POST'}).middleware([adminMiddleware]).inputValidator((v:unknown)=>z.discriminatedUnion('kind',[
 z.object({kind:z.literal('product'),slug,category:z.enum(allowedCategories),active:z.boolean(),data:productDataSchema}),
 z.object({kind:z.literal('category'),slug:z.enum(allowedCategories),active:z.boolean(),data:categoryDataSchema}),
 z.object({kind:z.literal('contact'),data:contactSchema})
]).parse(v)).handler(async({data,context})=>{
 const role=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});
 if(role.error||!role.data)throw new Error('Acesso restrito a administradores.');
 const r=data.kind==='contact'?await context.supabase.from('contact_settings').upsert({id:1,data:data.data as Json}):data.kind==='category'?await context.supabase.from('catalog_categories').upsert({slug:data.slug,active:data.active,data:data.data as Json}):await context.supabase.from('catalog_products').upsert({slug:data.slug,category:data.category,active:data.active,data:data.data as Json});
 if(r.error)throw new Error('Não foi possível salvar.'); return {ok:true};
});
export const saveQuote=createServerFn({method:'POST'}).inputValidator((v:unknown)=>z.object({requestKey:z.string().uuid(),contact:z.object({nome:z.string().trim().min(1).max(100),empresa:z.string().trim().min(1).max(100),cidade:z.string().trim().min(1).max(100)}),items:z.array(z.object({slug,name:z.string().min(1).max(120),quantity:z.string().trim().min(1).max(100)})).min(1).max(100)}).parse(v)).handler(async({data})=>{
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const r=await supabaseAdmin.from('quote_requests').upsert({request_key:data.requestKey,contact:data.contact,items:data.items},{onConflict:'request_key',ignoreDuplicates:true});
 if(r.error)throw new Error('Não foi possível registrar sua solicitação. Tente novamente.');return {ok:true};
});
