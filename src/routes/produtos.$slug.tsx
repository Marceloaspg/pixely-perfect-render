import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from 'react';
import { catalogQuery } from "@/lib/catalog-context";
import { Button } from "@/components/ui/button";
import { useQuote } from "@/lib/quote";

export const Route = createFileRoute("/produtos/$slug")({
  loader: async ({ params, context }) => {
    const catalog = await context.queryClient.ensureQueryData(catalogQuery);
    const product = catalog.products.find(p => p.slug === params.slug);
    if (!product) throw notFound();
    const category = catalog.categories.find(c => c.slug === product.category);
    if (!category) throw notFound();
    return { product, category };
  },
  head: ({ loaderData }) =>
    loaderData
      ? { meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
          { title: `${loaderData.product.name} | Majesta Embalagens` },
          { name: "description", content: loaderData.product.description },
          { property: "og:title", content: `${loaderData.product.name} | Majesta Embalagens` },
          { property: "og:description", content: loaderData.product.description },
          ...(loaderData.product.image.startsWith("https://") ? [{ property: "og:image", content: loaderData.product.image }, { name: "twitter:image", content: loaderData.product.image }] : []),
        ] }
      : { meta: [{ title: "Produto não encontrado" }, { name: "robots", content: "noindex" }] },
  notFoundComponent: () => <div className="py-24 text-center">Produto não encontrado. <Link to="/produtos" className="text-navy underline">Voltar ao catálogo</Link></div>,
  component: ProductPage,
});

function ProductPage() {
  const { product: p, category } = Route.useLoaderData();
  const { add, has } = useQuote();
  const gallery = [p.image, ...p.additionalImages].filter(Boolean);
  const [activeImage, setActiveImage] = useState(0);

  const dim = p.dimensions && p.dimensions.length && p.dimensions.width 
    ? `${p.dimensions.length} × ${p.dimensions.width}${p.dimensions.height ? ` × ${p.dimensions.height}` : ''} ${p.dimensions.unit || 'cm'}` 
    : null;
  const packaging = p.packageQuantity 
    ? `${p.packageType ? p.packageType.charAt(0).toUpperCase() + p.packageType.slice(1) + ' com ' : ''}${p.packageQuantity} unidades` 
    : null;

  return (
    <section className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-2">
      <div className="space-y-3">
        <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-3xl bg-muted shadow-card">
          <img src={gallery[activeImage]??p.image} alt={p.name} width={1600} height={1200} className="h-full w-full object-contain" />
        </div>
        {gallery.length>1&&<div className="flex gap-2 overflow-x-auto pb-2" aria-label="Galeria de fotografias do produto">
          {gallery.map((image,index)=>(
            <button
              key={image}
              type="button"
              onClick={()=>setActiveImage(index)}
              aria-label={index===0?'Ver fotografia principal':`Ver fotografia adicional ${index}`}
              aria-pressed={activeImage===index}
              className={`h-20 w-24 shrink-0 overflow-hidden rounded-lg border-2 bg-muted ${activeImage===index?'border-primary':'border-transparent'}`}
            >
              <img src={image} alt="" loading={index===0?'eager':'lazy'} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>}
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/categorias/$slug" params={{ slug: category.slug }} className="text-xs font-bold uppercase tracking-widest text-gold">{category.name}</Link>
          {p.sku && <span className="rounded bg-secondary px-2 py-0.5 text-xs font-mono font-semibold text-muted-foreground">SKU: {p.sku}</span>}
        </div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-navy md:text-4xl">{p.name}</h1>
        {p.demo && <p className="mt-2 inline-block rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">Produto demonstrativo — exemplo</p>}
        <p className="mt-5 text-muted-foreground">{p.description}</p>

        {(p.material || dim || packaging) && (
          <div className="mt-6 border-t border-border pt-5">
            <h2 className="text-sm font-bold text-navy">Ficha técnica</h2>
            <dl className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-sm">
              {p.material && (
                <div className="rounded-xl bg-secondary/60 p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Material</dt>
                  <dd className="mt-1 font-semibold text-navy">{p.material}</dd>
                </div>
              )}
              {dim && (
                <div className="rounded-xl bg-secondary/60 p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dimensões (C × L × A)</dt>
                  <dd className="mt-1 font-semibold text-navy">{dim}</dd>
                </div>
              )}
              {packaging && (
                <div className="rounded-xl bg-secondary/60 p-3 sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Embalagem comercial</dt>
                  <dd className="mt-1 font-semibold text-navy">{packaging}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {p.specs.length > 0 && <Block title="Especificações técnicas" items={p.specs} />}
        {p.variations.length > 0 && <Block title="Variações de tamanho e modelo" items={p.variations} />}
        {p.packUnit && <Block title="Quantidade por pacote / caixa" items={[p.packUnit]} />}
        <Block title="Aplicações" items={p.applications} />
        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={() => add(p.slug, p.name)} disabled={has(p.slug)} className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-navy-soft disabled:bg-gold disabled:text-navy">
            {has(p.slug) ? "✓ Adicionado à lista" : "Solicitar cotação"}
          </Button>
          <Link to="/orcamento" className="rounded-full border border-primary px-6 py-3 font-semibold text-primary">Ver lista de orçamento</Link>
        </div>
      </div>
    </section>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-6 border-t border-border pt-5">
      <h2 className="text-sm font-bold text-navy">{title}</h2>
      <ul className="mt-2 flex flex-wrap gap-2">{items.map((i) => <li key={i} className="rounded-lg bg-secondary px-3 py-1.5 text-sm">{i}</li>)}</ul>
    </div>
  );
}
