import { createFileRoute, useNavigate, useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getAdminCatalog, getUnreferencedImageReport, removeUnreferencedCatalogImages, reorderCatalogCategories, saveCatalogItem, uploadCatalogImage } from '@/lib/catalog.functions';
import { updateQuoteRequestStatus } from '@/lib/quote.functions';
import { quoteRequestStatusLabels, quoteRequestStatusSchema, type QuoteRequestStatus } from '@/lib/quote-submission';
import type { Json } from '@/integrations/supabase/types';
import { categoryDataSchema, categorySlugSchema, imageMap, productDataSchema, contactSchema, slugify, sortCategories, type Product, type Category, type SiteConfig } from '@/data/catalog';
import { addAdditionalImage, MAX_ADDITIONAL_IMAGES, removeImageAssociation, reorderAdditionalImages, selectMainImage } from '@/lib/product-images';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus, LogOut, Pencil, Upload, Save, Search, Image as ImageIcon, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { ImageCropDialog } from '@/components/admin/ImageCropDialog';
import { getAdminRouteErrorKind, getAdminRouteErrorMessage } from '@/lib/admin-access';
import { BannerManager } from '@/components/admin/BannerManager';
import { z } from 'zod';

const adminQuery=queryOptions({queryKey:['admin-catalog'],queryFn:()=>getAdminCatalog()});
const quoteStatuses=quoteRequestStatusSchema.options;
const quoteFilterSchema=z.enum(['all',...quoteStatuses]);

type JsonRecord={ [key:string]:Json|undefined };
function quoteRecord(value:Json):JsonRecord{
 return typeof value==='object'&&value!==null&&!Array.isArray(value)?value:{};
}
function quoteText(record:JsonRecord,key:string):string{
 const value=record[key];
 return typeof value==='string'||typeof value==='number'?String(value):'';
}

export const Route=createFileRoute('/_authenticated/admin')({
  loader:({context})=>context.queryClient.ensureQueryData(adminQuery),
  head:()=>({meta:[{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"},{title:'Painel administrativo | Majesta Embalagens'},{name:'description',content:'Gerenciamento de produtos, categorias e contato.'},{property:'og:title',content:'Painel administrativo | Majesta'},{property:'og:description',content:'Administração do catálogo.'},{name:'robots',content:'noindex'}]}),
  errorComponent: AdminRouteError,
  component:Admin
});

function AdminRouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const kind = getAdminRouteErrorKind(error);

  return (
    <section className="mx-auto max-w-xl px-5 py-16">
      <h1 className="text-2xl font-bold">
        {kind === 'permission' ? 'Acesso restrito' : kind === 'authentication' ? 'Sessão necessária' : 'Painel indisponível'}
      </h1>
      <p className="mt-4">{getAdminRouteErrorMessage(error)}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button onClick={() => { void router.invalidate().then(reset, reset); }}>Tentar novamente</Button>
        {kind === 'authentication' && (
          <Button variant="outline" onClick={() => { window.location.href = '/auth'; }}>Ir para entrar</Button>
        )}
      </div>
    </section>
  );
}

function Admin(){
 const {data}=useSuspenseQuery(adminQuery);
 const qc=useQueryClient();
 const nav=useNavigate();
 const save=useServerFn(saveCatalogItem);
 const saveQuoteStatus=useServerFn(updateQuoteRequestStatus);
 const saveOrder=useServerFn(reorderCatalogCategories);
 const uploadImage=useServerFn(uploadCatalogImage);
 const getImageReport=useServerFn(getUnreferencedImageReport);
 const removeImages=useServerFn(removeUnreferencedCatalogImages);

 const [tab,setTab]=useState('Produtos');
 const [edit,setEdit]=useState<Product|Category|null>(null);
 const [kind,setKind]=useState<'product'|'category'>('product');
 const [contact,setContact]=useState<SiteConfig>(data.catalog.config);
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [previewUrl,setPreviewUrl]=useState<string>('');
 const [categorySlugEdited,setCategorySlugEdited]=useState(false);
 const [cropFile,setCropFile]=useState<File|null>(null);
 const [cropTarget,setCropTarget]=useState<'main'|'additional'>('main');
 const [additionalImagePreviews,setAdditionalImagePreviews]=useState<Record<string,string>>({});
 const [orphanReport,setOrphanReport]=useState<string[]|null>(null);
 const pendingImageUploads=useRef(new Set<string>());

 // Filtros da listagem de produtos
 const [searchQuery,setSearchQuery]=useState('');
 const [filterCategory,setFilterCategory]=useState('');
 const [filterStatus,setFilterStatus]=useState<'all'|'active'|'inactive'|'demo'>('all');
 const [quoteFilter,setQuoteFilter]=useState<QuoteRequestStatus|'all'>('all');
 const [savingQuoteId,setSavingQuoteId]=useState('');

 const cats=data.catalog.categories;
 const orderedCats=sortCategories(cats);
 const categoryEdit=edit&&!('category' in edit)?edit:null;
 const isExistingProduct = kind === 'product' && !!edit && 'category' in edit && data.catalog.products.some(p => p.slug === edit.slug && p.slug !== '');
 const isExistingCategory = kind === 'category' && !!categoryEdit && cats.some(c => c.slug === categoryEdit.slug);

 const filteredProducts = data.catalog.products.filter(p => {
   const q = searchQuery.trim().toLowerCase();
   const matchesSearch = !q || p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q));
   const matchesCategory = !filterCategory || p.category === filterCategory;
   const matchesStatus = 
     filterStatus === 'all' ? true :
     filterStatus === 'active' ? p.active :
     filterStatus === 'inactive' ? !p.active :
     filterStatus === 'demo' ? p.demo : true;
   return matchesSearch && matchesCategory && matchesStatus;
 });
 const filteredQuotes=data.quotes.filter(quote=>quoteFilter==='all'||quote.status===quoteFilter);

 async function updateQuoteStatus(id:string,status:QuoteRequestStatus){
   setSavingQuoteId(id);
   setMessage('');
   try{
     await saveQuoteStatus({data:{id,status}});
     await qc.invalidateQueries({queryKey:['admin-catalog']});
     setMessage('Situação do orçamento atualizada.');
   }catch{
     setMessage('Não foi possível atualizar a situação. Verifique sua permissão e tente novamente.');
   }finally{
     setSavingQuoteId('');
   }
 }

 async function refresh(){
   await qc.invalidateQueries({queryKey:['catalog']});
   await qc.invalidateQueries({queryKey:['admin-catalog']});
 }

 function revokePreview(url=previewUrl) {
   if(url.startsWith('blob:')) URL.revokeObjectURL(url);
 }

 function revokeImagePreviews() {
   for(const url of Object.values(additionalImagePreviews))if(url.startsWith('blob:'))URL.revokeObjectURL(url);
   setAdditionalImagePreviews({});
 }

 async function fileToBase64(file:File):Promise<string> {
   return new Promise((resolve,reject)=>{
     const reader=new FileReader();
     reader.onload=()=>resolve(String(reader.result).split(',')[1]??'');
     reader.onerror=()=>reject(reader.error??new Error('Não foi possível ler a imagem processada.'));
     reader.readAsDataURL(file);
   });
 }

 async function uploadProcessedImage(file:File) {
   setBusy(true);
   setMessage('Enviando imagem otimizada...');
   try{
     const result=await uploadImage({data:{contentType:file.type as 'image/jpeg'|'image/png'|'image/webp',base64:await fileToBase64(file)}});
     const preview=URL.createObjectURL(file);
     pendingImageUploads.current.add(result.path);
     setEdit(current=>{
       if(!current)return current;
       if(kind==='category') {
         return {...current,imagePath:result.path};
       }
       if(!('category' in current))return current;
       if(cropTarget==='main'){
         const additionalImagePaths=current.additionalImagePaths??[];
         const preservedMain=current.imagePath&&additionalImagePaths.length<MAX_ADDITIONAL_IMAGES
           ?[...additionalImagePaths,current.imagePath]
           :additionalImagePaths;
         return {...current,imagePath:result.path,additionalImagePaths:preservedMain};
       }
       return {...current,...addAdditionalImage(current,result.path)};
     });
     if(kind==='product'&&cropTarget==='additional'){
       setAdditionalImagePreviews(current=>({...current,[result.path]:preview}));
     }else{
       revokePreview();
       setPreviewUrl(preview);
     }
     setMessage('Imagem enviada. Salve as alterações para associá-la ao cadastro.');
   }catch(error){
     setMessage(error instanceof Error?error.message:'Não foi possível enviar a imagem.');
   }finally{
     setBusy(false);
   }
 }

 function openCrop(file:File|undefined,target:'main'|'additional'='main') {
   if(!file)return;
   setMessage('');
   if(file.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type)){
     setMessage('Use JPG, PNG ou WebP de até 5 MB.');
     return;
   }
   if(target==='additional'&&edit&&'category' in edit&&edit.additionalImagePaths.length>=MAX_ADDITIONAL_IMAGES){
     setMessage('Cada produto pode ter até cinco fotografias adicionais.');
     return;
   }
   if(target==='main'&&edit&&'category' in edit&&edit.imagePath&&edit.additionalImagePaths.length>=MAX_ADDITIONAL_IMAGES){
     setMessage('Remova uma fotografia adicional antes de substituir a principal para preservar a imagem atual.');
     return;
   }
   setCropTarget(target);
   setCropFile(file);
 }

 function clearEditorPreviews() {
   revokePreview();
   revokeImagePreviews();
 }

 async function removePendingUploads():Promise<string|undefined> {
   const paths=[...pendingImageUploads.current];
   if(paths.length===0)return undefined;
   try{
     await removeImages({data:{paths}});
     for(const path of paths)pendingImageUploads.current.delete(path);
     return undefined;
   }catch(error){
     return error instanceof Error?error.message:'erro inesperado';
   }
 }

 async function cancelEditor() {
   setBusy(true);
   const shouldRemovePendingUploads=!!edit;
   let cleanupError:string|undefined;
   try{
     if(shouldRemovePendingUploads)cleanupError=await removePendingUploads();
   }catch(error){
     cleanupError=error instanceof Error?error.message:'erro inesperado';
   }finally{
     clearEditorPreviews();
     setEdit(null);
     setPreviewUrl('');
     setCategorySlugEdited(false);
     setMessage(cleanupError?`Cadastro cancelado, mas não foi possível remover a fotografia temporária: ${cleanupError}`:'');
     setBusy(false);
   }
 }

 async function store(){
  if(!edit) return;
  setBusy(true);
  setMessage('');
  try{
   if(kind==='product' && 'category' in edit){
    const finalSlug = edit.slug.trim() || slugify(edit.name);
    if(!finalSlug){ setMessage('Informe o nome ou a URL do produto.'); setBusy(false); return; }
    const parsedData = productDataSchema.parse({
      ...edit,
      slug: finalSlug,
      packageQuantity: edit.packageQuantity ? Number(edit.packageQuantity) : null,
    });
    await save({
      data:{
        kind,
        slug:finalSlug,
        category:edit.category,
        active:edit.active,
        data:parsedData
      }
    });
   } else {
    if(!categoryEdit) throw new Error('Não foi possível identificar a categoria.');
    const finalSlug=categorySlugSchema.parse(categoryEdit.slug.trim()||slugify(categoryEdit.name));
    await save({
      data:{
        kind:'category',
        mode:isExistingCategory?'update':'create',
        slug:finalSlug,
        active:categoryEdit.active,
        data:categoryDataSchema.parse({...categoryEdit,order:categoryEdit.order??orderedCats.length})
      }
    });
   }
   await refresh();
   pendingImageUploads.current.clear();
   clearEditorPreviews();
   setEdit(null);
   setPreviewUrl('');
   setCategorySlugEdited(false);
   setMessage('Alterações salvas com sucesso.');
  }catch(e){
    setMessage(e instanceof Error ? e.message : 'Não foi possível salvar.');
  }finally{
    setBusy(false);
  }
 }

 function patch(key:string,value:unknown){
   setEdit(current=>current?{...current,[key]:value}:current);
 }

 function startEditProduct(p: Product) {
   clearEditorPreviews();
   setKind('product');
   setEdit(p);
   setPreviewUrl(p.image || '');
   setAdditionalImagePreviews(Object.fromEntries(p.additionalImagePaths.map((path,index)=>[path,p.additionalImages[index]??''])));
   setMessage('');
 }

 function startNewProduct() {
   clearEditorPreviews();
   setKind('product');
   setEdit({
     slug:'',
     category:cats[0]?.slug??'',
     ...productDataSchema.parse({name:'Novo produto',description:''}),
     image:'',
     additionalImages:[],
     active:false
   });
   setPreviewUrl('');
   setAdditionalImagePreviews({});
   setMessage('');
 }

 function startNewCategory() {
   clearEditorPreviews();
   setKind('category');
   setCategorySlugEdited(false);
   setEdit({
     slug:'',
     name:'',
     number:String(cats.length+1).padStart(2,'0'),
     order:orderedCats.length,
     description:'',
     imageKey:'burger',
     imagePath:'',
     subcategories:[],
     image:'',
     active:false,
   });
   setPreviewUrl('');
   setAdditionalImagePreviews({});
   setMessage('');
 }

 async function moveCategory(slug:string, offset:-1|1) {
   const index=orderedCats.findIndex(category=>category.slug===slug);
   const target=index+offset;
   if(index<0||target<0||target>=orderedCats.length)return;
   const slugs=orderedCats.map(category=>category.slug);
   [slugs[index],slugs[target]]=[slugs[target]!,slugs[index]!];
   setBusy(true);
   setMessage('');
   try{
     await saveOrder({data:{slugs}});
     await refresh();
     setMessage('Ordem das categorias salva com sucesso.');
   }catch(error){
     setMessage(error instanceof Error?error.message:'Não foi possível reorganizar as categorias.');
   }finally{
     setBusy(false);
   }
 }

 function updateSubcategory(index:number,value:string) {
   if(categoryEdit)setEdit({...categoryEdit,subcategories:categoryEdit.subcategories.map((item,i)=>i===index?value:item)});
 }

 function moveSubcategory(index:number,offset:-1|1) {
   if(!categoryEdit)return;
   const target=index+offset;
   if(target<0||target>=categoryEdit.subcategories.length)return;
   const subcategories=[...categoryEdit.subcategories];
   [subcategories[index],subcategories[target]]=[subcategories[target]!,subcategories[index]!];
   setEdit({...categoryEdit,subcategories});
 }

 async function generateImageReport() {
   setBusy(true);
   setMessage('');
   try{
     const report=await getImageReport();
     setOrphanReport(report.paths);
     setMessage(`Relatório concluído: ${report.paths.length} arquivo(s) sem referência encontrada. Nenhum arquivo foi removido.`);
   }catch(error){
     setMessage(error instanceof Error?error.message:'Não foi possível gerar o relatório de imagens.');
   }finally{
     setBusy(false);
   }
 }

 function promoteAdditionalImage(path:string) {
   if(!edit||!('category' in edit))return;
   const currentMainPath=edit.imagePath;
   const currentMainUrl=previewUrl||edit.image;
   const selectedUrl=additionalImagePreviews[path]??'';
   const next=selectMainImage(edit,path);
   setEdit({...edit,...next});
   setPreviewUrl(selectedUrl);
   setAdditionalImagePreviews(current=>({...current,[currentMainPath]:currentMainUrl,[path]:selectedUrl}));
 }

 function removeAdditionalImage(path:string) {
   if(!edit||!('category' in edit))return;
   setEdit({...edit,...removeImageAssociation(edit,path)});
   const imageUrl=additionalImagePreviews[path];
   if(imageUrl?.startsWith('blob:'))URL.revokeObjectURL(imageUrl);
   setAdditionalImagePreviews(current=>{
     const next={...current};
     delete next[path];
     return next;
   });
 }

 function moveAdditionalImage(from:number,to:number) {
   if(!edit||!('category' in edit))return;
   setEdit({...edit,...reorderAdditionalImages(edit,from,to)});
 }

 const currentDimensions = (edit && 'dimensions' in edit && edit.dimensions) ? edit.dimensions : { length: '', width: '', height: '', unit: 'cm' };

 return (
  <section className="mx-auto max-w-7xl px-5 py-12">
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
      <div>
        <h1 className="text-3xl font-extrabold text-navy">Administração do Catálogo</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gerencie produtos, categorias, dados de contato e orçamentos da Majesta Embalagens.</p>
      </div>
      <Button variant="outline" onClick={async()=>{await qc.cancelQueries();qc.clear();await supabase.auth.signOut();nav({to:'/auth',replace:true});}}>
        <LogOut className="h-4 w-4 mr-2" />Sair
      </Button>
    </header>

    <div className="my-8 flex flex-wrap gap-2">
      {['Produtos','Categorias','Banners e Campanhas','Contato','Orçamentos'].map(t=>(
        <Button key={t} disabled={busy} variant={tab===t?'default':'secondary'} onClick={async()=>{if(edit)await cancelEditor();setTab(t);setMessage('');}}>
          {t}
        </Button>
      ))}
    </div>

    {message && (
      <div role="status" className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm font-medium text-navy">
        {message}
      </div>
    )}

    {tab==='Banners e Campanhas' && !edit && <BannerManager products={data.catalog.products} />}

    {/* ABA PRODUTOS - LISTAGEM */}
    {tab==='Produtos' && !edit && (
      <>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Button onClick={startNewProduct} className="rounded-full bg-primary font-semibold text-primary-foreground hover:bg-navy-soft">
            <Plus className="h-4 w-4 mr-2" />Novo produto
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" disabled={busy} onClick={generateImageReport}>Relatório de imagens não referenciadas</Button>
            <span className="text-sm text-muted-foreground">{filteredProducts.length} de {data.catalog.products.length} produto(s)</span>
          </div>
        </div>
        {orphanReport&&<div className="mt-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
          <p className="font-semibold">Possíveis arquivos sem referência (somente relatório; nenhum arquivo foi excluído)</p>
          {orphanReport.length===0?<p className="mt-2 text-muted-foreground">Nenhum candidato encontrado.</p>:<ul className="mt-2 max-h-48 space-y-1 overflow-auto font-mono text-xs">{orphanReport.map(path=><li key={path}>{path}</li>)}</ul>}
        </div>}

        {/* BARRA DE FILTROS */}
        <div className="mt-5 grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-card sm:grid-cols-[1fr_auto_auto]">
          <label className="flex items-center gap-2 rounded-xl bg-secondary px-3.5">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input 
              value={searchQuery} 
              onChange={e=>setSearchQuery(e.target.value)} 
              placeholder="Pesquisar por nome ou SKU…" 
              className="h-10 w-full bg-transparent text-sm outline-none" 
            />
          </label>
          <select 
            value={filterCategory} 
            onChange={e=>setFilterCategory(e.target.value)} 
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="">Todas as categorias</option>
            {cats.map(c=><option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
          <select 
            value={filterStatus} 
            onChange={e=>setFilterStatus(e.target.value as typeof filterStatus)} 
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="all">Todos os status</option>
            <option value="active">Apenas visíveis</option>
            <option value="inactive">Apenas desativados</option>
            <option value="demo">Apenas demonstrativos</option>
          </select>
        </div>

        {/* LISTA DE PRODUTOS */}
        <div className="mt-5 divide-y divide-border rounded-2xl border border-border bg-card shadow-card">
          {filteredProducts.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhum produto encontrado com os filtros selecionados.
            </div>
          ) : (
            filteredProducts.map(p => {
              const catObj = cats.find(c => c.slug === p.category);
              return (
                <div key={p.slug} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 p-4 transition hover:bg-muted/40">
                  <div className="relative h-14 w-18 shrink-0 overflow-hidden rounded-lg bg-muted border border-border">
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-navy truncate">{p.name}</p>
                      {p.sku && (
                        <span className="rounded bg-secondary px-2 py-0.5 text-xs font-mono font-semibold text-muted-foreground">
                          SKU: {p.sku}
                        </span>
                      )}
                      {p.featured && (
                        <span className="rounded bg-gold/20 px-2 py-0.5 text-[10px] font-bold text-navy uppercase">
                          Destaque
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{catObj?.name || p.category}</span>
                      <span>•</span>
                      <span className={p.active ? "text-emerald-600 font-semibold" : "text-amber-600 font-medium"}>
                        {p.active ? 'Visível no site' : 'Desativado'}
                      </span>
                      <span>•</span>
                      <span>{p.demo ? 'Demonstrativo' : 'Oficial'}</span>
                      {p.packageQuantity && (
                        <>
                          <span>•</span>
                          <span>{p.packageQuantity} un/{p.packageType || 'embalagem'}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={()=>startEditProduct(p)} className="rounded-lg">
                    <Pencil className="h-3.5 w-3.5 mr-1" />Editar
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </>
    )}

    {/* ABA CATEGORIAS */}
    {tab==='Categorias' && !edit && (
      <>
        <div className="mb-4 flex justify-end">
          <Button onClick={startNewCategory} className="rounded-full bg-primary font-semibold text-primary-foreground hover:bg-navy-soft">
            <Plus className="mr-2 h-4 w-4" />Nova categoria
          </Button>
        </div>
        <div className="divide-y divide-border rounded-2xl border border-border bg-card shadow-card">
          {orderedCats.map((c,index)=>(
            <div key={c.slug} className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 p-4">
              <div className="flex flex-col gap-1">
                <Button type="button" variant="ghost" size="icon" aria-label={`Mover ${c.name} para cima`} disabled={busy||index===0} onClick={()=>moveCategory(c.slug,-1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label={`Mover ${c.name} para baixo`} disabled={busy||index===orderedCats.length-1} onClick={()=>moveCategory(c.slug,1)}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                {c.image||imageMap[c.imageKey]?<img src={c.image||imageMap[c.imageKey]} alt="" className="h-full w-full object-cover" />:<ImageIcon className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div className="min-w-0">
                <p className="truncate font-bold text-navy">{c.number} — {c.name}</p>
                <p className="text-sm text-muted-foreground">
                  Ordem {index+1} · {data.catalog.products.filter(product=>product.category===c.slug).length} produtos · {c.subcategories.length} subcategorias ·{' '}
                  <span className={c.active?'font-semibold text-emerald-600':'font-medium text-amber-600'}>{c.active?'Ativa':'Inativa'}</span>
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={()=>{setKind('category');setEdit(c);setPreviewUrl(c.image||imageMap[c.imageKey]||'');setCategorySlugEdited(false);setMessage('');}}>
                <Pencil className="mr-1 h-3.5 w-3.5" />Editar
              </Button>
            </div>
          ))}
          {orderedCats.length===0&&<p className="p-8 text-center text-sm text-muted-foreground">Nenhuma categoria cadastrada.</p>}
        </div>
      </>
    )}

    {/* FORMULÁRIO DE EDIÇÃO ORGANIZADO */}
    {edit && (
      <div className="max-w-4xl space-y-8 rounded-2xl border border-border bg-card p-6 shadow-card md:p-8">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h2 className="text-xl font-bold text-navy">
            {kind==='product' ? (isExistingProduct ? `Editar: ${edit.name}` : 'Cadastrar Novo Produto') : (isExistingCategory ? `Editar Categoria: ${edit.name}` : 'Cadastrar Nova Categoria')}
          </h2>
          <Button variant="ghost" size="sm" disabled={busy} onClick={cancelEditor}>Cancelar</Button>
        </div>

        {/* SEÇÃO 1: IDENTIFICAÇÃO BÁSICA */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gold">1. Identificação Básica</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold">{kind==='product'?'Nome do produto *':'Nome da categoria *'}</span>
              <input 
                className="admin-input" 
                value={edit.name} 
                onChange={e=>{
                  const name=e.target.value;
                  if(kind==='category'&&!isExistingCategory){
                    setEdit(current=>current&&!('category' in current)?{...current,name,slug:categorySlugEdited?current.slug:slugify(name)}:current);
                  }else{
                    patch('name',name);
                    if(!isExistingProduct && kind==='product' && !edit.slug) patch('slug',slugify(name));
                  }
                }}
              />
            </label>

            {kind==='category' && categoryEdit && (
              <>
                <label className="block sm:col-span-2">
                  <span className="text-sm font-semibold">Slug da categoria *</span>
                  <input
                    className={`admin-input font-mono ${isExistingCategory?'cursor-not-allowed bg-muted opacity-70':''}`}
                    value={categoryEdit.slug}
                    readOnly={isExistingCategory}
                    placeholder="ex: embalagens-para-pizzas"
                    onChange={e=>{setCategorySlugEdited(true);patch('slug',slugify(e.target.value));}}
                  />
                  <span className="mt-1 block text-xs text-muted-foreground">Identificador único usado na URL; não pode ser alterado após salvar.</span>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold">Imagem padrão</span>
                  <select className="admin-input" value={categoryEdit.imageKey} onChange={e=>patch('imageKey',e.target.value)}>
                    <option value="burger">Hambúrguer</option>
                    <option value="kraft">Kraft</option>
                    <option value="paper">Papel</option>
                    <option value="fries">Porções</option>
                    <option value="hotdog">Hot dog</option>
                    <option value="seal">Lacre</option>
                  </select>
                </label>
              </>
            )}

            {kind==='product' && 'category' in edit && (
              <>
                <label className="block">
                  <span className="text-sm font-semibold">SKU (Código único de estoque)</span>
                  <input 
                    className="admin-input font-mono" 
                    placeholder="Ex.: CX-HAMB-01" 
                    value={edit.sku ?? ''} 
                    onChange={e=>patch('sku',e.target.value)} 
                  />
                  <span className="mt-1 block text-xs text-muted-foreground">Identificador único. Diferenciação maiúsculas/espaços tratada automaticamente.</span>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold">Categoria *</span>
                  <select className="admin-input" value={edit.category} onChange={e=>patch('category',e.target.value)}>
                    {cats.map(c=><option value={c.slug} key={c.slug}>{c.name}</option>)}
                  </select>
                </label>

                <label className="block sm:col-span-2">
                  <span className="text-sm font-semibold">URL amigável do produto (slug)</span>
                  <input 
                    className={`admin-input font-mono ${isExistingProduct?'opacity-70 bg-muted cursor-not-allowed':''}`} 
                    readOnly={isExistingProduct} 
                    placeholder="ex: caixa-hamburguer-artesanal" 
                    value={edit.slug} 
                    onChange={e=>patch('slug',slugify(e.target.value))}
                  />
                  {isExistingProduct && <span className="mt-1 block text-xs text-muted-foreground">O identificador da URL não pode ser alterado após criado para manter links intactos.</span>}
                </label>
              </>
            )}

            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold">Descrição</span>
              <textarea 
                className="admin-input min-h-24" 
                value={edit.description} 
                onChange={e=>patch('description',e.target.value)}
                placeholder="Descrição comercial e benefícios da embalagem..."
              />
            </label>
          </div>
        </section>

        {/* SEÇÃO 2: DIMENSÕES E EMBALAGEM COMERCIAL (EXCLUSIVO PRODUTO) */}
        {'specs' in edit && (
          <section className="space-y-4 border-t border-border pt-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gold">2. Dimensões e Embalagem Comercial</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-sm font-semibold">Material</span>
                <input 
                  className="admin-input" 
                  placeholder="Ex.: Papel Kraft 80g, Papel Cartão Triplex, Papel Acoplado" 
                  value={edit.material ?? ''} 
                  onChange={e=>patch('material',e.target.value)} 
                />
              </label>

              <div className="sm:col-span-2">
                <span className="text-sm font-semibold block mb-2">Dimensões do produto</span>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <label className="block">
                    <span className="text-xs text-muted-foreground">Comprimento</span>
                    <input 
                      className="admin-input" 
                      placeholder="Ex.: 12" 
                      value={currentDimensions.length} 
                      onChange={e=>patch('dimensions', { ...currentDimensions, length: e.target.value })} 
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted-foreground">Largura</span>
                    <input 
                      className="admin-input" 
                      placeholder="Ex.: 12" 
                      value={currentDimensions.width} 
                      onChange={e=>patch('dimensions', { ...currentDimensions, width: e.target.value })} 
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted-foreground">Altura</span>
                    <input 
                      className="admin-input" 
                      placeholder="Ex.: 8" 
                      value={currentDimensions.height} 
                      onChange={e=>patch('dimensions', { ...currentDimensions, height: e.target.value })} 
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted-foreground">Unidade</span>
                    <select 
                      className="admin-input" 
                      value={currentDimensions.unit} 
                      onChange={e=>patch('dimensions', { ...currentDimensions, unit: e.target.value })}
                    >
                      <option value="cm">cm (centímetros)</option>
                      <option value="mm">mm (milímetros)</option>
                      <option value="m">m (metros)</option>
                    </select>
                  </label>
                </div>
              </div>

              <label className="block">
                <span className="text-sm font-semibold">Quantidade por embalagem (número inteiro)</span>
                <input 
                  type="number" 
                  min="1" 
                  step="1"
                  className="admin-input" 
                  placeholder="Ex.: 100, 500" 
                  value={edit.packageQuantity ?? ''} 
                  onChange={e=>patch('packageQuantity', e.target.value ? parseInt(e.target.value, 10) : null)} 
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold">Tipo de embalagem comercial</span>
                <select 
                  className="admin-input" 
                  value={edit.packageType ?? ''} 
                  onChange={e=>patch('packageType', e.target.value)}
                >
                  <option value="">Selecione o tipo...</option>
                  <option value="pacote">Pacote</option>
                  <option value="fardo">Fardo</option>
                  <option value="caixa">Caixa</option>
                  <option value="unidade">Unidade</option>
                </select>
              </label>

              <label className="block sm:col-span-2">
                <span className="text-sm font-semibold">Descrição complementar da embalagem (legado / livre)</span>
                <input 
                  className="admin-input" 
                  placeholder="Ex.: Caixa com 100 unidades" 
                  value={edit.packUnit ?? ''} 
                  onChange={e=>patch('packUnit', e.target.value)} 
                />
              </label>
            </div>
          </section>
        )}

        {/* SEÇÃO 3: ESPECIFICAÇÕES, VARIAÇÕES E APLICAÇÕES */}
        {'specs' in edit ? (
          <section className="space-y-4 border-t border-border pt-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gold">3. Especificações e Aplicações</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm font-semibold">Especificações (uma por linha)</span>
                <textarea 
                  className="admin-input min-h-24 text-xs font-mono" 
                  value={edit.specs.join('\n')} 
                  onChange={e=>patch('specs', e.target.value.split('\n'))}
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold">Variações (uma por linha)</span>
                <textarea 
                  className="admin-input min-h-24 text-xs font-mono" 
                  value={edit.variations.join('\n')} 
                  onChange={e=>patch('variations', e.target.value.split('\n'))}
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold">Aplicações (uma por linha)</span>
                <textarea 
                  className="admin-input min-h-24 text-xs font-mono" 
                  value={edit.applications.join('\n')} 
                  onChange={e=>patch('applications', e.target.value.split('\n'))}
                />
              </label>
            </div>
          </section>
        ) : categoryEdit ? (
          <section className="space-y-4 border-t border-border pt-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gold">Subcategorias</h3>
            <div className="space-y-2">
              {categoryEdit.subcategories.map((subcategory,index)=>(
                <div key={index} className="flex items-center gap-2">
                  <input
                    className="admin-input"
                    aria-label={`Subcategoria ${index+1}`}
                    value={subcategory}
                    onChange={e=>updateSubcategory(index,e.target.value)}
                  />
                  <Button type="button" variant="outline" size="icon" aria-label="Mover subcategoria para cima" disabled={index===0} onClick={()=>moveSubcategory(index,-1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="outline" size="icon" aria-label="Mover subcategoria para baixo" disabled={index===categoryEdit.subcategories.length-1} onClick={()=>moveSubcategory(index,1)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remover subcategoria ${index+1}`} onClick={()=>setEdit({...categoryEdit,subcategories:categoryEdit.subcategories.filter((_,i)=>i!==index)})}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={()=>setEdit({...categoryEdit,subcategories:[...categoryEdit.subcategories,'']})}>
                <Plus className="mr-2 h-4 w-4" />Adicionar subcategoria
              </Button>
            </div>
            <label className="block">
              <span className="text-sm font-semibold">Número de identificação</span>
              <input className="admin-input" maxLength={4} value={categoryEdit.number} onChange={e=>patch('number', e.target.value)} />
            </label>
          </section>
        ) : null}

        {/* SEÇÃO 4: VISIBILIDADE E STATUS */}
        <section className="space-y-4 border-t border-border pt-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gold">4. Visibilidade e Destaque</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <label className="flex items-center gap-2.5 font-medium cursor-pointer">
                <input type="checkbox" checked={edit.active} onChange={e=>patch('active', e.target.checked)} className="h-4 w-4 rounded text-primary" />
                <span>Exibir no site (ativo)</span>
              </label>
              {'specs' in edit && (
                <>
                  <label className="flex items-center gap-2.5 font-medium cursor-pointer">
                    <input type="checkbox" checked={edit.featured} onChange={e=>patch('featured', e.target.checked)} className="h-4 w-4 rounded text-primary" />
                    <span>Destaque na página inicial</span>
                  </label>
                  <label className="flex items-center gap-2.5 font-medium cursor-pointer text-muted-foreground">
                    <input type="checkbox" checked={edit.demo} onChange={e=>patch('demo', e.target.checked)} className="h-4 w-4 rounded text-primary" />
                    <span>Produto demonstrativo (exemplo temporário)</span>
                  </label>
                </>
              )}
            </div>

            {'specs' in edit && (
              <label className="block">
                <span className="text-sm font-semibold">Ordem de ordenação no catálogo</span>
                <input 
                  type="number" 
                  min="0" 
                  className="admin-input" 
                  value={edit.order} 
                  onChange={e=>patch('order', Number(e.target.value))} 
                />
              </label>
            )}
          </div>
        </section>

        {/* SEÇÃO 5: FOTOGRAFIAS */}
        <section className="space-y-4 border-t border-border pt-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gold">{kind==='category'?'Fotografia Principal da Categoria':'Fotografias do Produto'}</h3>
          <div className="grid gap-6 sm:grid-cols-[220px_1fr] items-start">
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground block">Pré-visualização (4:3)</span>
              <div className="aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-muted flex items-center justify-center">
                {previewUrl ? (
                  <img src={previewUrl} alt="Pré-visualização" className="h-full w-full object-cover" />
                ) : edit.imagePath ? (
                  <div className="text-center p-3 text-xs text-muted-foreground">
                    <ImageIcon className="h-8 w-8 mx-auto mb-1 text-muted-foreground/60" />
                    Foto enviada ao storage
                  </div>
                ) : (
                  <div className="text-center p-3 text-xs text-muted-foreground">
                    <ImageIcon className="h-8 w-8 mx-auto mb-1 text-muted-foreground/40" />
                    Sem fotografia
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-semibold block mb-1">{kind==='category'?'Substituir fotografia da categoria':'Substituir fotografia principal'}</span>
                <input 
                  type="file" 
                  accept="image/jpeg,image/png,image/webp" 
                  disabled={busy}
                  onChange={e=>{openCrop(e.target.files?.[0]);e.currentTarget.value='';}}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-navy-soft"
                />
              </label>
              <p className="text-xs text-muted-foreground">JPG, PNG ou WebP de até 5 MB. O corte 4:3 e a otimização são confirmados antes do upload.</p>
              {edit.imagePath && (
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-xs font-medium text-emerald-600">✓ Caminho da imagem selecionada</span>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    disabled={kind==='product'&&'category' in edit&&edit.additionalImagePaths.length>0}
                    onClick={()=>{
                      patch('imagePath','');
                      setPreviewUrl('');
                      setMessage(`Fotografia removida do ${kind==='category'?'cadastro da categoria':'produto'}. Lembre-se de salvar.`);
                    }}
                    className="text-destructive hover:bg-destructive/10 h-7 text-xs"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />Remover foto
                  </Button>
                </div>
              )}
              {kind==='product'&&'category' in edit&&(
                <div className="space-y-3 border-t border-border pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">Galeria adicional ({edit.additionalImagePaths.length}/{MAX_ADDITIONAL_IMAGES})</span>
                    <label className="cursor-pointer">
                      <span className="sr-only">Adicionar fotografia à galeria</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy||edit.additionalImagePaths.length>=MAX_ADDITIONAL_IMAGES} className="hidden" onChange={event=>{openCrop(event.target.files?.[0],'additional');event.currentTarget.value='';}} />
                      <span className={`inline-flex items-center rounded-full border px-3 py-2 text-sm font-medium ${busy||edit.additionalImagePaths.length>=MAX_ADDITIONAL_IMAGES?'cursor-not-allowed opacity-50':'cursor-pointer hover:bg-secondary'}`}>
                        <Plus className="mr-1 h-4 w-4" />Adicionar
                      </span>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {edit.additionalImagePaths.map((path,index)=>(
                      <div key={path} className="space-y-2 rounded-xl border border-border p-2">
                        <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-muted">
                          {additionalImagePreviews[path]?<img src={additionalImagePreviews[path]} alt={`Fotografia adicional ${index+1}`} className="h-full w-full object-cover" />:<ImageIcon className="h-8 w-8 text-muted-foreground" />}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={()=>promoteAdditionalImage(path)}>Principal</Button>
                          <Button type="button" size="icon" variant="ghost" aria-label={`Mover fotografia ${index+1} para cima`} disabled={busy||index===0} onClick={()=>moveAdditionalImage(index,index-1)}><ArrowUp className="h-4 w-4" /></Button>
                          <Button type="button" size="icon" variant="ghost" aria-label={`Mover fotografia ${index+1} para baixo`} disabled={busy||index===edit.additionalImagePaths.length-1} onClick={()=>moveAdditionalImage(index,index+1)}><ArrowDown className="h-4 w-4" /></Button>
                          <Button type="button" size="icon" variant="ghost" aria-label={`Remover fotografia ${index+1}`} disabled={busy} onClick={()=>removeAdditionalImage(path)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* BOTÕES DE AÇÃO */}
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
          <Button disabled={busy} onClick={store} className="rounded-full bg-primary font-semibold text-primary-foreground hover:bg-navy-soft px-7">
            <Save className="h-4 w-4 mr-2" />{busy ? 'Salvando...' : 'Salvar alterações'}
          </Button>
          <Button variant="outline" disabled={busy} onClick={cancelEditor} className="rounded-full">
            Cancelar
          </Button>
        </div>
      </div>
    )}
    <ImageCropDialog
      file={cropFile}
      onCancel={()=>setCropFile(null)}
      onConfirm={file=>{setCropFile(null);void uploadProcessedImage(file);}}
    />

    {/* ABA CONTATO */}
    {tab==='Contato' && (
      <div className="max-w-xl space-y-4 rounded-2xl border border-border bg-card p-6 shadow-card">
        <h2 className="text-xl font-bold text-navy">Informações de Contato Oficiais</h2>
        {(['whatsapp','email','instagram','facebook'] as const).map(k=>(
          <label className="block" key={k}>
            <span className="text-sm font-semibold">{k==='whatsapp'?'WhatsApp oficial (DDI + DDD + número)':k.charAt(0).toUpperCase()+k.slice(1)}</span>
            <input className="admin-input" value={contact[k]} onChange={e=>setContact({...contact,[k]:e.target.value})}/>
          </label>
        ))}
        <Button onClick={async()=>{
          try{
            await save({data:{kind:'contact',data:contactSchema.parse(contact)}});
            await refresh();
            setMessage('Contato salvo com sucesso.');
          }catch{
            setMessage('Verifique o número e os links informados.');
          }
        }} className="mt-2 rounded-full">
          <Save className="h-4 w-4 mr-2" />Salvar contato
        </Button>
      </div>
    )}

    {/* ABA ORÇAMENTOS */}
    {tab==='Orçamentos' && (
      <div className="space-y-4">
        <label className="flex max-w-sm flex-col gap-2 text-sm font-semibold text-navy">
          Filtrar por situação
          <select aria-label="Filtrar orçamentos por situação" value={quoteFilter} onChange={event=>{const parsed=quoteFilterSchema.safeParse(event.target.value);if(parsed.success)setQuoteFilter(parsed.data);}} className="admin-input">
            <option value="all">Todas as situações</option>
            {quoteStatuses.map(status=><option key={status} value={status}>{quoteRequestStatusLabels[status]}</option>)}
          </select>
        </label>
        {filteredQuotes.length===0 ? (
          <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            {data.quotes.length===0?'Nenhum orçamento registrado no banco de dados.':'Nenhum orçamento corresponde ao filtro selecionado.'}
          </p>
        ) : (
          <div className="space-y-4">
            {filteredQuotes.map(q=>{
              const contactData=quoteRecord(q.contact);
              const itemRows=Array.isArray(q.items)?q.items:[];
              const customerName=quoteText(contactData,'nome')||'Cliente sem nome';
              return (
                <article key={q.id} className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
                  <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gold">Solicitado em {new Date(q.created_at).toLocaleString('pt-BR')}</p>
                      <h2 className="mt-1 break-all font-bold text-navy">Orçamento {q.id}</h2>
                      <p className="mt-2 font-semibold">{customerName}</p>
                      <p className="text-sm text-muted-foreground">
                        {[quoteText(contactData,'empresa'),quoteText(contactData,'cidade')].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <label className="flex w-full min-w-0 flex-col gap-2 text-sm font-semibold text-navy lg:max-w-xs">
                      Situação
                      <select
                        aria-label={`Situação do orçamento ${q.id}`}
                        value={q.status}
                        disabled={savingQuoteId===q.id}
                        onChange={event=>{const parsed=quoteRequestStatusSchema.safeParse(event.target.value);if(parsed.success)void updateQuoteStatus(q.id,parsed.data);}}
                        className="admin-input min-w-0 max-w-full"
                      >
                        {quoteStatuses.map(status=><option key={status} value={status}>{quoteRequestStatusLabels[status]}</option>)}
                      </select>
                    </label>
                  </div>
                  <details className="mt-4 rounded-xl border border-border bg-secondary/30 p-4">
                    <summary className="cursor-pointer font-semibold text-navy">Ver detalhes ({itemRows.length} {itemRows.length===1?'produto':'produtos'})</summary>
                    <div className="mt-4 grid gap-5 lg:grid-cols-2">
                      <section aria-label="Contato do cliente" className="space-y-2 text-sm">
                        <h3 className="font-bold text-navy">Contato</h3>
                        <p>Nome: {customerName}</p>
                        {quoteText(contactData,'empresa')&&<p>Empresa: {quoteText(contactData,'empresa')}</p>}
                        <p>Cidade: {quoteText(contactData,'cidade')||'—'}</p>
                        <p>WhatsApp: {quoteText(contactData,'whatsapp')||'—'}</p>
                        {quoteText(contactData,'email')&&<p>E-mail: {quoteText(contactData,'email')}</p>}
                        {quoteText(contactData,'observations')&&<p className="whitespace-pre-wrap break-words">Observações: {quoteText(contactData,'observations')}</p>}
                      </section>
                      <section aria-label="Produtos solicitados" className="space-y-3">
                        <h3 className="font-bold text-navy">Produtos solicitados</h3>
                        {itemRows.map((raw,index)=>{
                          const item=quoteRecord(raw);
                          return (
                            <div key={`${quoteText(item,'slug')}-${index}`} className="rounded-xl border border-border bg-background p-3 text-sm">
                              <p className="font-semibold text-navy">{quoteText(item,'name')||'Produto'}</p>
                              {quoteText(item,'sku')&&<p>SKU: {quoteText(item,'sku')}</p>}
                              {quoteText(item,'model')&&<p>Modelo: {quoteText(item,'model')}</p>}
                              {quoteText(item,'material')&&<p>Material: {quoteText(item,'material')}</p>}
                              <p>Quantidade: {quoteText(item,'quantity')} {quoteText(item,'unit')}</p>
                            </div>
                          );
                        })}
                      </section>
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        )}
      </div>
    )}
  </section>
 );
}
