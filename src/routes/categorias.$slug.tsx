import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { catalogQuery, useCatalog } from "@/lib/catalog-context";
import { PageHero, ProductCard } from "@/components/site/Layout";

export const Route = createFileRoute("/categorias/$slug")({
  loader: async ({ params, context }) => {
    const catalog = await context.queryClient.ensureQueryData(catalogQuery);
    const category = catalog.categories.find(c => c.slug === params.slug);
    if (!category) throw notFound();
    return { category };
  },
  head: ({ loaderData }) =>
    loaderData
      ? { meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
          { title: `${loaderData.category.name} | Majesta Embalagens` },
          { name: "description", content: `${loaderData.category.name}: ${loaderData.category.subcategories.join(", ")}. Solicite orçamento.` },
          { property: "og:title", content: `${loaderData.category.name} | Majesta Embalagens` },
          { property: "og:description", content: loaderData.category.description },
          ...(loaderData.category.image.startsWith("https://") ? [{ property: "og:image", content: loaderData.category.image }, { name: "twitter:image", content: loaderData.category.image }] : []),
        ] }
      : { meta: [{ title: "Categoria não encontrada" }, { name: "robots", content: "noindex" }] },
  notFoundComponent: () => <div className="py-24 text-center">Categoria não encontrada. <Link to="/produtos" className="text-navy underline">Ver catálogo</Link></div>,
  component: CategoryPage,
});

function CategoryPage() {
  const { category: c } = Route.useLoaderData();
  const { products } = useCatalog();
  const list = products.filter((p) => p.category === c.slug);
  return (
    <>
      <PageHero eyebrow={`Categoria ${c.number}`} title={c.name} text={c.description} />
      <section className="mx-auto max-w-7xl px-5 py-12">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Linhas desta categoria</h2>
        <ul className="mt-3 flex flex-wrap gap-2">{c.subcategories.map((s) => <li key={s} className="rounded-full border border-border px-4 py-1.5 text-sm">{s}</li>)}</ul>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{list.map((p) => <ProductCard key={p.slug} p={p} />)}</div>
        <p className="mt-8 text-sm text-muted-foreground">Os produtos exibidos são exemplos. Consulte a disponibilidade solicitando um orçamento.</p>
      </section>
    </>
  );
}
