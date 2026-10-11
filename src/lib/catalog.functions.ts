import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Database, Json } from '@/integrations/supabase/types';
import { categoryDataSchema, categorySlugSchema, filterPublicCatalog, productDataSchema, contactSchema, sortCategories, type CatalogData } from '@/data/catalog';
import { collectReferencedImagePaths, findUnreferencedImagePaths, uploadValidatedImage } from '@/lib/product-images';
import { verifyAdminRole, SupabaseServiceUnavailableError } from '@/lib/admin-access';
import { applySignedCatalogImageUrls, signCatalogImagePaths } from '@/lib/catalog-image-signing';

export const getCatalog = createServerFn({method:'GET'}).handler(async ():Promise<CatalogData>=>{
 const url=process.env['SUPABASE_URL']; const key=process.env['SUPABASE_PUBLISHABLE_KEY'];
 if(!url||!key) throw new Error('Catálogo indisponível.');
 const db=createClient<Database>(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{const h=new Headers(init?.headers);if(key.startsWith('sb_')&&h.get('Authorization')===`Bearer ${key}`)h.delete('Authorization');h.set('apikey',key);return fetch(input,{...init,headers:h});}}});
 return readCatalog(db,false);
});

async function readCatalog(db:ReturnType<typeof createClient<Database>>,admin:boolean):Promise<CatalogData>{
 const [cats,ps,cs]=await Promise.all([db.from('catalog_categories').select('*'),db.from('catalog_products').select('*'),db.from('contact_settings').select('data').eq('id',1).single()]);
 if(cats.error||ps.error||cs.error) throw new Error('Não foi possível carregar o catálogo.');
 const categories=(cats.data??[]).map(r=>({...categoryDataSchema.parse(r.data),slug:r.slug,active:r.active,image:''}));
 const products=(ps.data??[]).map(r=>({...productDataSchema.parse(r.data),slug:r.slug,category:r.category,active:r.active,image:'',additionalImages:[] as string[]}));
 const visible=admin?{categories,products}:filterPublicCatalog(categories,products);
 const imagePaths=[...new Set([
  ...visible.categories.map(category=>category.imagePath),
  ...visible.products.flatMap(product=>[product.imagePath,...product.additionalImagePaths]),
 ].filter(Boolean))];
 const signedUrls=await signCatalogImagePaths(imagePaths,batch=>db.storage.from('catalog-images').createSignedUrls(batch,3600));
 const browserUrl=import.meta.env['VITE_SUPABASE_URL'];
 const serverUrl=process.env['SUPABASE_URL'];
 if(browserUrl&&serverUrl){
  for(const [path,url] of signedUrls)signedUrls.set(path,url.replace(serverUrl,browserUrl));
 }
 const {categories:categoriesWithImages,products:productsWithImages}=applySignedCatalogImageUrls(visible.categories,visible.products,signedUrls);
 return {categories:sortCategories(categoriesWithImages),products:productsWithImages.sort((a,b)=>a.order-b.order),config:contactSchema.parse(cs.data?.data)};
}

const adminMiddleware= requireSupabaseAuth;
export const getAdminCatalog=createServerFn({method:'GET'}).middleware([adminMiddleware]).handler(async({context})=>{
 await verifyAdminRole(()=>context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'}));
 const [catalog,quotes]=await Promise.all([readCatalog(context.supabase,true),context.supabase.from('quote_requests').select('*').order('created_at',{ascending:false}).limit(100)]);
 if(quotes.error)throw new Error('Não foi possível carregar os orçamentos.');
 return {catalog,quotes:quotes.data};
});
const slug=categorySlugSchema;
export const saveCatalogItem=createServerFn({method:'POST'}).middleware([adminMiddleware]).validator((v:unknown)=>z.discriminatedUnion('kind',[
 z.object({kind:z.literal('product'),slug,category:slug,active:z.boolean(),data:productDataSchema}),
 z.object({kind:z.literal('category'),mode:z.enum(['create','update']),slug,active:z.boolean(),data:categoryDataSchema}),
 z.object({kind:z.literal('contact'),data:contactSchema})
]).parse(v)).handler(async({data,context})=>{
 await verifyAdminRole(()=>context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'}));
 if(data.kind==='contact'){
  const r=await context.supabase.from('contact_settings').upsert({id:1,data:data.data as Json});
  if(r.error)throw new Error('Não foi possível salvar.');
  return {ok:true};
 }
 if(data.kind==='category'){
  const existing=await context.supabase.from('catalog_categories').select('slug').eq('slug',data.slug).maybeSingle();
  if(existing.error)throw new Error('Não foi possível verificar a categoria.');
  if(data.mode==='create'&&existing.data)throw new Error('Já existe uma categoria com este slug.');
  if(data.mode==='update'&&!existing.data)throw new Error('A categoria não existe mais. Atualize o painel e tente novamente.');
  const r=data.mode==='create'
   ?await context.supabase.from('catalog_categories').insert({slug:data.slug,active:data.active,data:data.data as Json})
   :await context.supabase.from('catalog_categories').update({active:data.active,data:data.data as Json}).eq('slug',data.slug);
  if(r.error)throw new Error('Não foi possível salvar.');
  return {ok:true};
 }
 const category=await context.supabase.from('catalog_categories').select('slug').eq('slug',data.category).maybeSingle();
 if(category.error)throw new Error('Não foi possível verificar a categoria do produto.');
 if(!category.data)throw new Error('A categoria selecionada não existe mais. Atualize o painel e tente novamente.');
 const targetSku=data.data.sku?data.data.sku.trim().toLowerCase():'';
 if(targetSku){
  const existing=await context.supabase.from('catalog_products').select('slug, data').neq('slug',data.slug);
  if(!existing.error&&existing.data){
   const duplicate=existing.data.find(r=>{
    const rawSku=(r.data as Record<string,unknown>|null)?.['sku'];
    return typeof rawSku==='string'&&rawSku.trim().toLowerCase()===targetSku;
   });
   if(duplicate){
    const dupName=(duplicate.data as Record<string,unknown>|null)?.['name']||duplicate.slug;
    throw new Error(`O SKU "${data.data.sku.trim()}" já está em uso pelo produto "${dupName}".`);
   }
  }
 }
 const r=await context.supabase.from('catalog_products').upsert({slug:data.slug,category:data.category,active:data.active,data:data.data as Json});
 if(r.error)throw new Error('Não foi possível salvar.');
 return {ok:true};
});
export const reorderCatalogCategories=createServerFn({method:'POST'}).middleware([adminMiddleware]).validator((v:unknown)=>z.object({slugs:z.array(slug).min(1).max(500)}).parse(v)).handler(async({data,context})=>{
 await verifyAdminRole(()=>context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'}));
 if(new Set(data.slugs).size!==data.slugs.length)throw new Error('A sequência contém categorias duplicadas.');
 const current=await context.supabase.from('catalog_categories').select('slug,data,active');
 if(current.error)throw new Error('Não foi possível carregar as categorias para reorganização.');
 if(current.data.length!==data.slugs.length||current.data.some(category=>!data.slugs.includes(category.slug))){
  throw new Error('As categorias foram alteradas. Atualize o painel e tente novamente.');
 }
 const bySlug=new Map(current.data.map(category=>[category.slug,category]));
 const updates=data.slugs.map((categorySlug,order)=>{
  const category=bySlug.get(categorySlug);
  if(!category)throw new Error('A categoria não existe mais. Atualize o painel e tente novamente.');
  return {slug:categorySlug,active:category.active,data:{...categoryDataSchema.parse(category.data),order} as Json};
 });
 const result=await context.supabase.from('catalog_categories').upsert(updates,{onConflict:'slug'});
 if(result.error)throw new Error('Não foi possível salvar a nova ordem das categorias.');
 return {ok:true};
});
const imageUploadInput=z.object({
 contentType:z.enum(['image/jpeg','image/png','image/webp']),
 base64:z.string().min(1).max(7_000_000).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
});
export const uploadCatalogImage=createServerFn({method:'POST'}).middleware([adminMiddleware]).validator((v:unknown)=>imageUploadInput.parse(v)).handler(async({data,context})=>{
 await verifyAdminRole(()=>context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'}));
 const bytes=new Uint8Array(Buffer.from(data.base64,'base64'));
 const path=await uploadValidatedImage(
  async(filePath,fileBytes,contentType)=>{
   const result=await context.supabase.storage.from('catalog-images').upload(filePath,Buffer.from(fileBytes),{contentType,upsert:false,cacheControl:'31536000'});
   return {error:result.error?{message:result.error.message}:null};
  },
  bytes,
  data.contentType,
  crypto.randomUUID(),
 );
 return {path};
});

async function listCatalogImagePaths(db:ReturnType<typeof createClient<Database>>):Promise<string[]> {
 const paths:string[]=[];
 async function visit(folder:string):Promise<void>{
  for(let offset=0;;offset+=1000){
   const {data,error}=await db.storage.from('catalog-images').list(folder,{limit:1000,offset});
   if(error)throw new Error(`Não foi possível listar imagens do Storage: ${error.message}`);
   for(const entry of data??[]){
    const path=folder?`${folder}/${entry.name}`:entry.name;
    if(entry.id===null)await visit(path);
    else paths.push(path);
   }
   if((data?.length??0)<1000)return;
  }
 }
 await visit('');
 return paths;
}

export const getUnreferencedImageReport=createServerFn({method:'GET'}).middleware([adminMiddleware]).handler(async({context})=>{
 await verifyAdminRole(()=>context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'}));
 const [products,categories,storagePaths]=await Promise.all([
  context.supabase.from('catalog_products').select('data'),
  context.supabase.from('catalog_categories').select('data'),
  listCatalogImagePaths(context.supabase),
 ]);
 if(products.error||categories.error)throw new Error('Não foi possível verificar referências das imagens.');
 const referenced=collectReferencedImagePaths(
  (products.data??[]).map(row=>productDataSchema.parse(row.data)),
  (categories.data??[]).map(row=>categoryDataSchema.parse(row.data)),
 );
 return {paths:findUnreferencedImagePaths(storagePaths,referenced),generatedAt:new Date().toISOString()};
});
export const removeUnreferencedCatalogImages=createServerFn({method:'POST'}).middleware([adminMiddleware]).validator((v:unknown)=>z.object({paths:z.array(z.string().regex(/^catalog\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i)).min(1).max(6)}).parse(v)).handler(async({data,context})=>{
 await verifyAdminRole(()=>context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'}));
 if(new Set(data.paths).size!==data.paths.length)throw new Error('A lista contém caminhos duplicados.');
 const [products,categories]=await Promise.all([
  context.supabase.from('catalog_products').select('data'),
  context.supabase.from('catalog_categories').select('data'),
 ]);
 if(products.error||categories.error)throw new Error('Não foi possível verificar referências antes da exclusão.');
 const referenced=collectReferencedImagePaths(
  (products.data??[]).map(row=>productDataSchema.parse(row.data)),
  (categories.data??[]).map(row=>categoryDataSchema.parse(row.data)),
 );
 if(data.paths.some(path=>referenced.has(path)))throw new Error('Uma ou mais imagens ainda estão associadas ao catálogo e não podem ser removidas.');
 const result=await context.supabase.storage.from('catalog-images').remove(data.paths);
 if(result.error)throw new Error(`Não foi possível remover os uploads temporários: ${result.error.message}`);
 return {ok:true};
});
export const saveQuote=createServerFn({method:'POST'}).inputValidator((v:unknown)=>z.object({requestKey:z.string().uuid(),contact:z.object({nome:z.string().trim().min(1).max(100),empresa:z.string().trim().min(1).max(100),cidade:z.string().trim().min(1).max(100)}),items:z.array(z.object({slug,name:z.string().min(1).max(120),quantity:z.string().trim().min(1).max(100)})).min(1).max(100)}).parse(v)).handler(async({data})=>{
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const r=await supabaseAdmin.from('quote_requests').upsert({request_key:data.requestKey,contact:data.contact,items:data.items},{onConflict:'request_key',ignoreDuplicates:true});
 if(r.error)throw new Error('Não foi possível registrar sua solicitação. Tente novamente.');return {ok:true};
});
