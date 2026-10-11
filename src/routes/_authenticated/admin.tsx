import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getAdminCatalog, saveCatalogItem } from '@/lib/catalog.functions';
import { allowedCategories, categoryDataSchema, productDataSchema, contactSchema, type Product, type Category, type SiteConfig } from '@/data/catalog';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus, LogOut, Pencil, Upload, Save, Search, Image as ImageIcon, Trash2, Filter } from 'lucide-react';

const adminQuery=queryOptions({queryKey:['admin-catalog'],queryFn:()=>getAdminCatalog()});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export const Route=createFileRoute('/_authenticated/admin')({
  loader:({context})=>context.queryClient.ensureQueryData(adminQuery),
  head:()=>({meta:[{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"},{title:'Painel administrativo | Majesta Embalagens'},{name:'description',content:'Gerenciamento de produtos, categorias e contato.'},{property:'og:title',content:'Painel administrativo | Majesta'},{property:'og:description',content:'Administração do catálogo.'},{name:'robots',content:'noindex'}]}),
  errorComponent:()=> (
    <section className="mx-auto max-w-xl px-5 py-16">
      <h1 className="text-2xl font-bold">Acesso restrito</h1>
      <p className="mt-4">Sua conta precisa de permissão administrativa para acessar o catálogo.</p>
      <Button onClick={async()=>{await supabase.auth.signOut();window.location.href='/auth';}} className="mt-4">Sair</Button>
    </section>
  ),
  component:Admin
});

function Admin(){
 const {data}=useSuspenseQuery(adminQuery);
 const qc=useQueryClient();
 const nav=useNavigate();
 const save=useServerFn(saveCatalogItem);

 const [tab,setTab]=useState('Produtos');
 const [edit,setEdit]=useState<Product|Category|null>(null);
 const [kind,setKind]=useState<'product'|'category'>('product');
 const [contact,setContact]=useState<SiteConfig>(data.catalog.config);
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [previewUrl,setPreviewUrl]=useState<string>('');

 // Filtros da listagem de produtos
 const [searchQuery,setSearchQuery]=useState('');
 const [filterCategory,setFilterCategory]=useState('');
 const [filterStatus,setFilterStatus]=useState<'all'|'active'|'inactive'|'demo'>('all');

 const cats=data.catalog.categories;
 const isExistingProduct = kind === 'product' && !!edit && 'category' in edit && data.catalog.products.some(p => p.slug === edit.slug && p.slug !== '');

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

 async function refresh(){
   await qc.invalidateQueries({queryKey:['catalog']});
   await qc.invalidateQueries({queryKey:['admin-catalog']});
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
        category:edit.category as typeof allowedCategories[number],
        active:edit.active,
        data:parsedData
      }
    });
   } else {
    await save({
      data:{
        kind:'category',
        slug:edit.slug as typeof allowedCategories[number],
        active:edit.active,
        data:categoryDataSchema.parse(edit)
      }
    });
   }
   await refresh();
   setEdit(null);
   setPreviewUrl('');
   setMessage('Alterações salvas com sucesso.');
  }catch(e){
    setMessage(e instanceof Error ? e.message : 'Não foi possível salvar.');
  }finally{
    setBusy(false);
  }
 }

 async function upload(file:File|undefined){
  if(!file||!edit) return;
  if(file.size > 5*1024*1024 || !['image/jpeg','image/png','image/webp'].includes(file.type)){
    setMessage('Use JPG, PNG ou WebP de até 5 MB.');
    return;
  }
  setBusy(true);
  setMessage('Enviando fotografia...');
  const localUrl = URL.createObjectURL(file);
  setPreviewUrl(localUrl);

  const path=`${crypto.randomUUID()}.${file.type.split('/')[1]}`;
  const r=await supabase.storage.from('catalog-images').upload(path,file);
  if(r.error){
   const isMissingBucket = r.error.message.includes('not found') || r.error.message.includes('NoSuchBucket');
   setMessage(isMissingBucket 
     ? 'Bucket "catalog-images" não encontrado no Supabase Storage. Crie o bucket para habilitar o envio de fotos.' 
     : `Não foi possível enviar a foto: ${r.error.message}`);
  }else{
   setEdit({...edit,imagePath:path});
   setMessage('Fotografia enviada com sucesso.');
  }
  setBusy(false);
 }

 function patch(key:string,value:unknown){
   if(edit) setEdit({...edit,[key]:value});
 }

 function startEditProduct(p: Product) {
   setKind('product');
   setEdit(p);
   setPreviewUrl(p.image || '');
   setMessage('');
 }

 function startNewProduct() {
   setKind('product');
   setEdit({
     slug:'',
     category:allowedCategories[0],
     ...productDataSchema.parse({name:'Novo produto',description:''}),
     image:'',
     active:false
   });
   setPreviewUrl('');
   setMessage('');
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
      {['Produtos','Categorias','Contato','Orçamentos'].map(t=>(
        <Button key={t} variant={tab===t?'default':'secondary'} onClick={()=>{setTab(t);setEdit(null);setPreviewUrl('');setMessage('');}}>
          {t}
        </Button>
      ))}
    </div>

    {message && (
      <div role="status" className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm font-medium text-navy">
        {message}
      </div>
    )}

    {/* ABA PRODUTOS - LISTAGEM */}
    {tab==='Produtos' && !edit && (
      <>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Button onClick={startNewProduct} className="rounded-full bg-primary font-semibold text-primary-foreground hover:bg-navy-soft">
            <Plus className="h-4 w-4 mr-2" />Novo produto
          </Button>
          <span className="text-sm text-muted-foreground">{filteredProducts.length} de {data.catalog.products.length} produto(s)</span>
        </div>

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
      <div className="divide-y divide-border rounded-2xl border border-border bg-card shadow-card">
        {cats.map(c=>(
          <div key={c.slug} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-4">
            <div>
              <p className="font-bold text-navy">{c.number} — {c.name}</p>
              <p className="text-sm text-muted-foreground">{c.active?'Visível':'Desativada'} · {c.subcategories.length} subcategorias</p>
            </div>
            <Button variant="outline" size="sm" onClick={()=>{setKind('category');setEdit(c);setMessage('');}}>
              <Pencil className="h-3.5 w-3.5 mr-1" />Editar
            </Button>
          </div>
        ))}
      </div>
    )}

    {/* FORMULÁRIO DE EDIÇÃO ORGANIZADO */}
    {edit && (
      <div className="max-w-4xl space-y-8 rounded-2xl border border-border bg-card p-6 shadow-card md:p-8">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h2 className="text-xl font-bold text-navy">
            {kind==='product' ? (isExistingProduct ? `Editar: ${edit.name}` : 'Cadastrar Novo Produto') : `Editar Categoria: ${edit.name}`}
          </h2>
          <Button variant="ghost" size="sm" onClick={()=>{setEdit(null);setPreviewUrl('');}}>Cancelar</Button>
        </div>

        {/* SEÇÃO 1: IDENTIFICAÇÃO BÁSICA */}
        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gold">1. Identificação Básica</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold">Nome do produto *</span>
              <input 
                className="admin-input" 
                value={edit.name} 
                onChange={e=>{
                  patch('name',e.target.value);
                  if(!isExistingProduct && kind==='product' && !edit.slug) patch('slug',slugify(e.target.value));
                }}
              />
            </label>

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
        ) : (
          <section className="space-y-4 border-t border-border pt-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gold">Subcategorias e Ordem</h3>
            <label className="block">
              <span className="text-sm font-semibold">Subcategorias da categoria (uma por linha)</span>
              <textarea 
                className="admin-input min-h-32 text-xs font-mono" 
                value={edit.subcategories.join('\n')} 
                onChange={e=>patch('subcategories', e.target.value.split('\n'))}
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Número / Ordem da categoria</span>
              <input className="admin-input" value={edit.number} onChange={e=>patch('number', e.target.value)} />
            </label>
          </section>
        )}

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

        {/* SEÇÃO 5: FOTOGRAFIA PRINCIPAL E PRÉ-VISUALIZAÇÃO 4:3 */}
        <section className="space-y-4 border-t border-border pt-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gold">5. Fotografia Principal</h3>
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
                <span className="text-sm font-semibold block mb-1">Selecionar arquivo de foto</span>
                <input 
                  type="file" 
                  accept="image/jpeg,image/png,image/webp" 
                  onChange={e=>upload(e.target.files?.[0])} 
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-navy-soft"
                />
              </label>
              <p className="text-xs text-muted-foreground">Formatos suportados: JPG, PNG ou WebP de até 5 MB.</p>
              {edit.imagePath && (
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-xs font-medium text-emerald-600">✓ Fotografia salva no cadastro</span>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={()=>{
                      patch('imagePath','');
                      setPreviewUrl('');
                      setMessage('Fotografia removida do produto. Lembre-se de salvar.');
                    }}
                    className="text-destructive hover:bg-destructive/10 h-7 text-xs"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />Remover foto
                  </Button>
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
          <Button variant="outline" onClick={()=>{setEdit(null);setPreviewUrl('');}} className="rounded-full">
            Cancelar
          </Button>
        </div>
      </div>
    )}

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
      <div className="divide-y divide-border rounded-2xl border border-border bg-card shadow-card">
        {data.quotes.length===0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">Nenhum orçamento registrado no banco de dados.</p>
        )}
        {data.quotes.map(q=>(
          <article key={q.id} className="p-6">
            <p className="text-xs font-semibold text-gold uppercase tracking-wider">{new Date(q.created_at).toLocaleString('pt-BR')}</p>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm rounded-xl bg-secondary/50 p-4 border border-border">
              {JSON.stringify(q.contact,null,2)}{'\n\n'}Itens Solicitados:{'\n'}{JSON.stringify(q.items,null,2)}
            </pre>
          </article>
        ))}
      </div>
    )}
  </section>
 );
}

