import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { segments } from "@/data/catalog";
import { useCatalog } from "@/lib/catalog-context";
import { Button } from "@/components/ui/button";
import { PageHero, ProductCard } from "@/components/site/Layout";

export const Route = createFileRoute("/segmentos")({
  head: () => ({
    meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
      { title: "Soluções por Segmento | Majesta Embalagens" },
      { name: "description", content: "Embalagens para hamburguerias, lanchonetes, hot-doguerias e delivery em Amparo e região." },
      { property: "og:title", content: "Soluções por Segmento | Majesta Embalagens" },
      { property: "og:description", content: "Encontre as embalagens certas para o seu tipo de negócio." },
    ],
  }),
  component: Segments,
});

function Segments() {
  const { products } = useCatalog();
  const [active, setActive] = useState(segments[0]?.slug ?? "");
  const seg = segments.find((s) => s.slug === active);
  if (!seg) return null;
  return (
    <>
      <PageHero eyebrow="Soluções por segmento" title="Embalagens pensadas para o seu tipo de negócio" />
      <section className="mx-auto max-w-7xl px-5 py-12">
        <div className="flex flex-wrap gap-2">
          {segments.map((s) => (
            <Button key={s.slug} onClick={() => setActive(s.slug)} className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${s.slug === active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-border"}`}>{s.name}</Button>
          ))}
        </div>
        <h2 className="mt-10 text-2xl font-extrabold text-navy">{seg.name}</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.filter(p => seg.categories.some(c => c === p.category)).map(p => <ProductCard key={p.slug} p={p} />)}
        </div>
      </section>
    </>
  );
}
