import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getProduct, segments } from "@/data/catalog";
import { PageHero, ProductCard } from "@/components/site/Layout";

export const Route = createFileRoute("/segmentos")({
  head: () => ({
    meta: [
      { title: "Soluções por Segmento | Majesta Embalagens" },
      { name: "description", content: "Embalagens para hamburgueria, pizzaria, marmitaria, restaurantes, lanchonetes, pastelarias, hot-doguerias e delivery." },
      { property: "og:title", content: "Soluções por Segmento | Majesta Embalagens" },
      { property: "og:description", content: "Encontre as embalagens certas para o seu tipo de negócio." },
    ],
  }),
  component: Segments,
});

function Segments() {
  const [active, setActive] = useState(segments[0].slug);
  const seg = segments.find((s) => s.slug === active)!;
  return (
    <>
      <PageHero eyebrow="Soluções por segmento" title="Embalagens pensadas para o seu tipo de negócio" />
      <section className="mx-auto max-w-7xl px-5 py-12">
        <div className="flex flex-wrap gap-2">
          {segments.map((s) => (
            <button key={s.slug} onClick={() => setActive(s.slug)} className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${s.slug === active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-border"}`}>{s.name}</button>
          ))}
        </div>
        <h2 className="mt-10 text-2xl font-extrabold text-navy">{seg.name}</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {seg.products.map((slug) => { const p = getProduct(slug); return p ? <ProductCard key={slug} p={p} /> : null; })}
        </div>
      </section>
    </>
  );
}
