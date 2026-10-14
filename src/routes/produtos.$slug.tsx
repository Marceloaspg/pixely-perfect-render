import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { catalogQuery } from "@/lib/catalog-context";
import { Button } from "@/components/ui/button";
import { useQuote } from "@/lib/quote";
import { getProductGalleryImages, getProductPublicSections, isQuoteVariationSelectionValid, nextGalleryIndex } from '@/lib/quote-model';

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
  const gallery = getProductGalleryImages(p);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedVariation, setSelectedVariation] = useState(p.variations.length === 1 ? p.variations[0]! : '');
  const touchStartX = useRef<number | null>(null);
  useEffect(() => {
    setActiveImage(0);
    setSelectedVariation(p.variations.length === 1 ? p.variations[0]! : '');
  }, [p.slug, p.variations]);

  const dim = p.dimensions && p.dimensions.length && p.dimensions.width
    ? `${p.dimensions.length} × ${p.dimensions.width}${p.dimensions.height ? ` × ${p.dimensions.height}` : ''} ${p.dimensions.unit || 'cm'}` 
    : null;
  const packaging = p.packageQuantity
    ? `${p.packageType ? p.packageType.charAt(0).toUpperCase() + p.packageType.slice(1) + ' com ' : ''}${p.packageQuantity} unidades` 
    : null;
  const variations = [...new Set(p.variations.map(value => value.trim()).filter(Boolean))];
  const selected = variations.length === 1 ? variations[0] : selectedVariation;
  const alreadyAdded = has(p.slug, selected || undefined);
  const publicSections = getProductPublicSections(p);
  const packageInfo = packaging || p.packUnit.trim();
  const changeImage = (step: number) => setActiveImage(index => nextGalleryIndex(index, step, gallery.length));
  const handleGalleryKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      changeImage(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      changeImage(1);
    }
  };

  return (
    <section className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-2">
      <div className="space-y-3">
        <div
          className="group relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-3xl bg-muted shadow-card"
          role="group"
          aria-label="Galeria de fotografias do produto"
          tabIndex={gallery.length > 1 ? 0 : undefined}
          onKeyDown={handleGalleryKeyDown}
          onTouchStart={event => { touchStartX.current = event.changedTouches[0]?.clientX ?? null; }}
          onTouchEnd={event => {
            const start = touchStartX.current;
            const end = event.changedTouches[0]?.clientX;
            touchStartX.current = null;
            if (start === null || end === undefined || Math.abs(end - start) < 40 || gallery.length < 2) return;
            changeImage(end < start ? 1 : -1);
          }}
        >
          {gallery[activeImage] && (
            <img key={gallery[activeImage]} src={gallery[activeImage]} alt={p.name} width={1600} height={1200} className="h-full w-full object-contain" />
          )}
          {gallery.length > 1 && (
            <>
              <button type="button" aria-label="Fotografia anterior" onClick={() => changeImage(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/85 p-2 text-navy shadow transition hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button type="button" aria-label="Próxima fotografia" onClick={() => changeImage(1)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/85 p-2 text-navy shadow transition hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <ChevronRight className="h-5 w-5" />
              </button>
              <span aria-live="polite" className="absolute bottom-3 right-3 rounded-full bg-background/85 px-2.5 py-1 text-xs font-semibold text-navy">
                {activeImage + 1}/{gallery.length}
              </span>
            </>
          )}
        </div>
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/categorias/$slug" params={{ slug: category.slug }} className="text-xs font-bold uppercase tracking-widest text-gold">{category.name}</Link>
          {p.sku && <span className="rounded bg-secondary px-2 py-0.5 text-xs font-mono font-semibold text-muted-foreground">SKU: {p.sku}</span>}
        </div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-navy md:text-4xl">{p.name}</h1>
        {p.demo && <p className="mt-2 inline-block rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">Produto demonstrativo — exemplo</p>}
        {p.description.trim() && <p className="mt-5 text-muted-foreground">{p.description}</p>}

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
              {packageInfo && (
                <div className="rounded-xl bg-secondary/60 p-3 sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Embalagem comercial</dt>
                  <dd className="mt-1 font-semibold text-navy">{packageInfo}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {publicSections.filter(section => section.title !== 'Variações de tamanho e modelo' && section.title !== 'Unidade comercial')
          .map(section => <Block key={section.title} title={section.title} items={section.items} />)}
        {variations.length > 0 && (
          <fieldset className="mt-6 border-t border-border pt-5">
            <legend className="text-sm font-bold text-navy">Selecione tamanho ou modelo</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {variations.map(variation => (
                <button
                  key={variation}
                  type="button"
                  role="radio"
                  aria-checked={selected === variation}
                  onClick={() => setSelectedVariation(variation)}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${selected === variation ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-navy hover:bg-secondary'}`}
                >
                  {variation}
                </button>
              ))}
            </div>
            {variations.length > 1 && !selected && <p className="mt-2 text-sm text-muted-foreground">Escolha uma opção para adicionar à cotação.</p>}
          </fieldset>
        )}
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Button onClick={() => add(p, selected || undefined)} disabled={!isQuoteVariationSelectionValid(variations, selected) || alreadyAdded} className="h-12 w-full justify-center whitespace-nowrap rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-navy-soft disabled:bg-gold disabled:text-navy">
            {alreadyAdded ? "✓ Adicionado à lista" : "Solicitar cotação"}
          </Button>
          <Link to="/orcamento" className="inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-full border border-primary px-4 text-sm font-semibold text-primary">Ver lista de orçamento</Link>
        </div>
        <Link to="/produtos" className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-full border border-border bg-secondary px-4 text-sm font-semibold text-navy transition hover:bg-secondary/70">Continuar comprando</Link>
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
