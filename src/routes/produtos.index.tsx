import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { applications } from "@/data/catalog";
import { useCatalog } from "@/lib/catalog-context";
import { PageHero, ProductCard } from "@/components/site/Layout";

export const Route = createFileRoute("/produtos/")({
  validateSearch: (s: Record<string, unknown>): { categoria?: string } => typeof s['categoria'] === "string" ? { categoria: s['categoria'] } : {},
  head: () => ({
    meta: [
      { title: "Produtos — Catálogo de embalagens | Majesta Embalagens" },
      { name: "description", content: "Catálogo de embalagens para delivery: caixas para hambúrguer, hot dog e combos, sacos kraft, papéis e lacres." },
      { property: "og:title", content: "Catálogo de embalagens | Majesta Embalagens" },
      { property: "og:description", content: "Pesquise e filtre embalagens por categoria e aplicação." },
    ],
  }),
  component: Catalog,
});

function Catalog() {
  const { categories, products } = useCatalog();
  const { categoria } = Route.useSearch();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(categoria ?? "");
  const [app, setApp] = useState("");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return products
      .filter((p) => (!cat || p.category === cat) && (!app || p.applications.includes(app)) && (!t || `${p.name} ${p.description}`.toLowerCase().includes(t)))
      .sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || a.order - b.order);
  }, [q, cat, app]);

  return (
    <>
      <PageHero eyebrow="Produtos" title="Catálogo de embalagens e suprimentos" text="Produtos demonstrativos. Os itens oficiais e suas fotografias serão cadastrados em breve. Disponibilidade sob consulta." />
      <section className="mx-auto max-w-7xl px-5 py-12">
        <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-card md:grid-cols-[1fr_auto_auto]">
          <label className="flex items-center gap-2 rounded-xl bg-secondary px-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar produtos…" className="h-11 w-full bg-transparent outline-none" />
          </label>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="h-11 rounded-xl border border-input bg-background px-3 text-sm">
            <option value="">Todas as categorias</option>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
          <select value={app} onChange={(e) => setApp(e.target.value)} className="h-11 rounded-xl border border-input bg-background px-3 text-sm">
            <option value="">Todas as aplicações</option>
            {applications.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">{list.length} produto(s)</p>
        <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {list.map((p) => <ProductCard key={p.slug} p={p} />)}
        </div>
        {list.length === 0 && <p className="py-16 text-center text-muted-foreground">Nenhum produto encontrado.</p>}
      </section>
    </>
  );
}
