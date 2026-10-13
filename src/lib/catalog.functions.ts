import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Database, Json } from '@/integrations/supabase/types';
import { categoryDataSchema, categorySlugSchema, filterPublicCatalog, productDataSchema, contactSchema, sortCategories, type CatalogData } from '@/data/catalog';
import { collectReferencedImagePaths, findUnreferencedImagePaths, uploadValidatedImage } from '@/lib/product-images';
import { verifyAdminRole, SupabaseServiceUnavailableError } from '@/lib/admin-access';
import { applySignedCatalogImageUrls, signCatalogImagePaths } from '@/lib/catalog-image-signing';
import { filterEligibleHomepageBanners, getEligibleFeaturedProductSlugs, homepageBannerSchema, type HomepageBanner, type HomepageProductEligibilityRecord } from '@/lib/homepage-banners';

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
 purpose:z.enum(['catalog','banner']).default('catalog'),
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
  data.purpose==='banner'?'banners':'catalog',
 );
 return {path};
});

type HomepageBannerRow=Database['public']['Tables']['homepage_banners']['Row'];

function safeTechnicalType(error:unknown):string{
 if(error instanceof Error)return error.name||'Error';
 if(typeof error==='object'&&error!==null&&'status'in error&&typeof error.status==='number')return `HTTP ${error.status}`;
 return 'unknown';
}

function homepageBannerFromRow(row:HomepageBannerRow,imageUrls:Map<string,string>):HomepageBanner{
 const parsed=homepageBannerSchema.parse({
  id:row.id,
  type:row.type,
  title:row.title,
  subtitle:row.subtitle,
  imagePath:row.image_path,
  mobileImagePath:row.mobile_image_path,
  buttonLabel:row.button_label,
  buttonHref:row.button_href,
  productSlug:row.product_slug,
  displayOrder:row.display_order,
  active:row.active,
  startsAt:row.starts_at,
  endsAt:row.ends_at,
 });
 return {
  ...parsed,
  id:row.id,
  imageUrl:row.image_path?imageUrls.get(row.image_path)??'':'',
  mobileImageUrl:row.mobile_image_path?imageUrls.get(row.mobile_image_path)??'':'',
  archivedAt:row.archived_at,
 };
}

async function signHomepageBannerRows(
 db:ReturnType<typeof createClient<Database>>,
 rows:HomepageBannerRow[],
):Promise<HomepageBanner[]>{
 const imagePaths=[...new Set(rows.flatMap(row=>[row.image_path,row.mobile_image_path].filter((path):path is string=>!!path)))];
 const urls=await signCatalogImagePaths(imagePaths,batch=>db.storage.from('catalog-images').createSignedUrls(batch,3600));
 const serverUrl=process.env['SUPABASE_URL'];
 const browserUrl=import.meta.env['VITE_SUPABASE_URL'];
 if(serverUrl&&browserUrl)for(const [path,url]of urls)urls.set(path,url.replace(serverUrl,browserUrl));
 return rows.map(row=>homepageBannerFromRow(row,urls));
}

function createHomepageReadClient():ReturnType<typeof createClient<Database>>{
 const url=process.env['SUPABASE_URL'];
 const key=process.env['SUPABASE_PUBLISHABLE_KEY'];
 if(!url||!key)throw new Error('Supabase server configuration unavailable.');
 return createClient<Database>(url,key,{
  auth:{persistSession:false,autoRefreshToken:false},
  global:{fetch:(input,init)=>{
   const headers=new Headers(typeof Request!=='undefined'&&input instanceof Request?input.headers:undefined);
   if(init?.headers)new Headers(init.headers).forEach((value,name)=>headers.set(name,value));
   if(key.startsWith('sb_')&&headers.get('Authorization')===`Bearer ${key}`)headers.delete('Authorization');
   headers.set('apikey',key);
   return fetch(input,{...init,headers});
  }},
 });
}

export const getHomepageBanners=createServerFn({method:'GET'}).handler(async():Promise<HomepageBanner[]>=>{
 try{
  const db=createHomepageReadClient();
  const {data,error}=await db.from('homepage_banners').select('*').order('display_order').order('id');
  if(error){
   const isMigrationPending=error.code==='42P01'||error.code==='PGRST205';
   const log=(isMigrationPending?console.warn:console.error);
   log('[Homepage] Banner query unavailable; using institutional fallback.',{
    errorType:safeTechnicalType(error),
    code:error.code,
   });
   return [];
  }
  const rows=data??[];
  const linkedSlugs=[...new Set(rows.flatMap(row=>row.product_slug?[row.product_slug]:[]))];
  const linkedProducts=linkedSlugs.length
   ?await db.from('catalog_products').select('slug,category,active,data').in('slug',linkedSlugs)
   :{data:[],error:null};
  if(linkedProducts.error)throw linkedProducts.error;
  const productRecords:HomepageProductEligibilityRecord[]=(linkedProducts.data??[]).flatMap(row=>{
   const parsed=productDataSchema.safeParse(row.data);
   if(!parsed.success)return [];
   return [{
    slug:row.slug,
    category:row.category,
    active:row.active,
    featured:parsed.data.featured,
    demo:parsed.data.demo,
    imagePath:parsed.data.imagePath,
   }];
  });
  const linkedCategorySlugs=[...new Set(productRecords.map(product=>product.category))];
  const linkedCategories=linkedCategorySlugs.length
   ?await db.from('catalog_categories').select('slug,active').in('slug',linkedCategorySlugs)
   :{data:[],error:null};
  if(linkedCategories.error)throw linkedCategories.error;
  const activeCategorySlugs=new Set((linkedCategories.data??[])
   .filter(category=>category.active)
   .map(category=>category.slug));
  const eligibleIds=new Set(filterEligibleHomepageBanners(rows.map(row=>({
   id:row.id,
   active:row.active,
   type:row.type,
   productSlug:row.product_slug,
   buttonHref:row.button_href,
   archivedAt:row.archived_at,
   startsAt:row.starts_at,
   endsAt:row.ends_at,
  })),productRecords,activeCategorySlugs).map(row=>row.id));
  const eligibleRows=rows.filter(row=>eligibleIds.has(row.id));
  return await signHomepageBannerRows(db,eligibleRows);
 }catch(error){
  console.error('[Homepage] Banner request failed; using institutional fallback.',{errorType:safeTechnicalType(error)});
  return [];
 }
});

export const getHomepageFeaturedProductSlugs=createServerFn({method:'GET'}).handler(async():Promise<string[]>=>{
 try{
  const db=createHomepageReadClient();
  const {data:productRows,error:productsError}=await db.from('catalog_products').select('slug,category,active,data');
  if(productsError)throw productsError;
  const products:HomepageProductEligibilityRecord[]=(productRows??[]).flatMap(row=>{
   const parsed=productDataSchema.safeParse(row.data);
   if(!parsed.success)return [];
   return [{
    slug:row.slug,
    category:row.category,
    active:row.active,
    featured:parsed.data.featured,
    demo:parsed.data.demo,
    imagePath:parsed.data.imagePath,
   }];
  });
  const categorySlugs=[...new Set(products.map(product=>product.category))];
  const {data:categoryRows,error:categoriesError}=categorySlugs.length
   ?await db.from('catalog_categories').select('slug,active').in('slug',categorySlugs)
   :{data:[],error:null};
  if(categoriesError)throw categoriesError;
  const activeCategorySlugs=new Set((categoryRows??[])
   .filter(category=>category.active)
   .map(category=>category.slug));
  return [...getEligibleFeaturedProductSlugs(products,activeCategorySlugs)];
 }catch(error){
  console.error('[Homepage] Featured products unavailable; omitting automatic product slides.',{errorType:safeTechnicalType(error)});
  return [];
 }
});

export const getAdminHomepageBanners=createServerFn({method:'GET'}).middleware([adminMiddleware]).handler(async({context})=>{
 await verifyAdminRole(()=>context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'}));
 const {data,error}=await context.supabase.from('homepage_banners').select('*').order('display_order').order('id');
 if(error){
  if(error.code==='42P01'||error.code==='PGRST205')throw new Error('A migração local de banners ainda não foi aplicada no ambiente conectado.');
  throw new Error('Não foi possível carregar os banners. Tente novamente.');
 }
 return signHomepageBannerRows(context.supabase,data??[]);
});

const bannerImagePath=z.string().regex(/^banners\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i);
const saveHomepageBannerInput=homepageBannerSchema.and(z.object({
 imagePath:bannerImagePath.nullable(),
 mobileImagePath:bannerImagePath.nullable(),
}));

export const saveHomepageBanner=createServerFn({method:'POST'}).middleware([adminMiddleware]).validator((value:unknown)=>saveHomepageBannerInput.parse(value)).handler(async({data,context})=>{
 await verifyAdminRole(()=>context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'}));
 if(data.productSlug){
  const {data:product,error}=await context.supabase.from('catalog_products').select('slug').eq('slug',data.productSlug).maybeSingle();
  if(error)throw new Error('Não foi possível validar o produto vinculado.');
  if(!product)throw new Error('O produto vinculado não existe mais. Atualize o painel.');
 }
 const row={
  type:data.type,
  title:data.title,
  subtitle:data.subtitle,
  image_path:data.imagePath,
  mobile_image_path:data.mobileImagePath,
  button_label:data.buttonLabel,
  button_href:data.buttonHref,
  product_slug:data.productSlug,
  display_order:data.displayOrder,
  active:data.active,
  starts_at:data.startsAt,
  ends_at:data.endsAt,
  updated_at:new Date().toISOString(),
 };
 const result=data.id
  ?await context.supabase.from('homepage_banners').update(row).eq('id',data.id).is('archived_at',null).select('*').maybeSingle()
  :await context.supabase.from('homepage_banners').insert(row).select('*').single();
 if(result.error)throw new Error('Não foi possível salvar o banner. Verifique a migração e os dados informados.');
 if(!result.data)throw new Error('O banner não existe mais ou já foi arquivado.');
 return (await signHomepageBannerRows(context.supabase,[result.data]))[0]!;
});

export const archiveHomepageBanner=createServerFn({method:'POST'}).middleware([adminMiddleware]).validator((value:unknown)=>z.object({id:z.string().uuid()}).parse(value)).handler(async({data,context})=>{
 await verifyAdminRole(()=>context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'}));
 const {data:archived,error}=await context.supabase.from('homepage_banners')
  .update({active:false,archived_at:new Date().toISOString(),updated_at:new Date().toISOString()})
  .eq('id',data.id).is('archived_at',null).select('id').maybeSingle();
 if(error)throw new Error('Não foi possível arquivar o banner.');
 if(!archived)throw new Error('O banner não existe mais ou já foi arquivado.');
 return {ok:true};
});

export const reorderHomepageBanners=createServerFn({method:'POST'}).middleware([adminMiddleware]).validator((value:unknown)=>z.object({ids:z.array(z.string().uuid()).max(500)}).parse(value)).handler(async({data,context})=>{
 await verifyAdminRole(()=>context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'}));
 if(new Set(data.ids).size!==data.ids.length)throw new Error('A sequência contém banners duplicados.');
 const {error}=await context.supabase.rpc('reorder_homepage_banners',{_ids:data.ids});
 if(error)throw new Error('Não foi possível salvar a ordem dos banners. Atualize o painel e tente novamente.');
 return {ok:true};
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
 await visit('catalog');
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
const quoteRequestInput=z.object({
 requestKey:z.string().uuid(),
 contact:z.object({
  nome:z.string().trim().min(1).max(100),
  empresa:z.string().trim().max(100).optional().default(''),
  cidade:z.string().trim().min(1).max(100),
  whatsapp:z.string().trim().min(1).max(30),
  observations:z.string().trim().max(1000).optional().default(''),
 }),
 items:z.array(z.object({
  id:z.string().optional(),
  slug:z.string().min(1).max(120),
  name:z.string().trim().min(1).max(120),
  quantity:z.string().trim().regex(/^\d+(?:[.,]\d+)?$/).max(30)
   .refine(value=>Number(value.replace(',','.'))>0,'A quantidade deve ser maior que zero.'),
  variationId:z.string().max(300).optional(),
  variation:z.string().max(120).optional(),
  sku:z.string().max(60).optional(),
  material:z.string().max(120).optional(),
  dimensions:z.string().max(100).optional(),
  packageQuantity:z.number().int().positive().nullable().optional(),
  packageType:z.string().max(20).optional(),
  packUnit:z.string().max(120).optional(),
 })).min(1).max(100),
});
export const saveQuote=createServerFn({method:'POST'}).inputValidator((value:unknown)=>quoteRequestInput.parse(value)).handler(async({data})=>{
 try{
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const result=await supabaseAdmin.from('quote_requests').upsert(
   {request_key:data.requestKey,contact:data.contact,items:data.items},
   {onConflict:'request_key',ignoreDuplicates:true},
  );
  if(result.error)throw result.error;
  return {saved:true};
 }catch(error){
  console.error('[Quote] Não foi possível registrar a solicitação.',{
   errorType:error instanceof Error?error.name:'unknown',
   status:typeof error==='object'&&error!==null&&'status' in error&&typeof error.status==='number'?error.status:undefined,
  });
  return {saved:false};
 }
});
