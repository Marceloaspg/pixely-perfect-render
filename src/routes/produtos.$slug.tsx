import { createFileRoute, Link, notFound } from "@tanstack/react-router";
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
      ? { meta: [
          { title: `${loaderData.product.name} | Majesta Embalagens` },
          { name: "description", content: loaderData.product.description },
          { property: "og:title", content: `${loaderData.product.name} | Majesta Embalagens` },
          { property: "og:description", content: loaderData.product.description },
        ] }
      : { meta: [{ title: "Produto não encontrado" }, { name: "robots", content: "noindex" }] },
  notFoundComponent: () => <div className="py-24 text-center">Produto não encontrado. <Link to="/produtos" className="text-navy underline">Voltar ao catálogo</Link></div>,
  component: ProductPage,
});

function ProductPage() {
  const { product: p, category } = Route.useLoaderData();
  const { add, has } = useQuote();
  return (
    <section className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-2">
      <div className="overflow-hidden rounded-3xl bg-muted shadow-card">
        <img src={p.image} alt={p.name} width={912} height={736} className="h-full w-full object-cover" />
      </div>
      <div>
        <Link to="/categorias/$slug" params={{ slug: category.slug }} className="text-xs font-bold uppercase tracking-widest text-gold">{category.name}</Link>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-navy md:text-4xl">{p.name}</h1>
        {p.demo && <p className="mt-2 inline-block rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">Produto demonstrativo — exemplo</p>}
        <p className="mt-5 text-muted-foreground">{p.description}</p>
        {p.specs.length > 0 && <Block title="Descrição técnica" items={p.specs} />}
        {p.variations.length > 0 && <Block title="Variações de tamanho e material" items={p.variations} />}
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
