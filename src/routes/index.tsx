import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Layers, Headphones, ClipboardCheck, Store } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { useCatalog } from "@/lib/catalog-context";
import { whatsappLink } from "@/lib/config";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
      { title: "Majesta Embalagens — Embalagens para delivery e food service" },
      { name: "description", content: "Embalagens para hamburguerias, lanchonetes e delivery em Amparo e região. Caixas, sacos kraft, papéis, lacres e suprimentos. Solicite seu orçamento." },
      { property: "og:title", content: "Majesta Embalagens — Embalagens para delivery e food service" },
      { property: "og:description", content: "A embalagem certa valoriza o seu negócio. Solicite seu orçamento pelo WhatsApp." },
    ],
  }),
  component: Index,
});

const perks = [
  { icon: Layers, title: "Variedade de soluções", text: "Embalagens e suprimentos para diferentes etapas da operação." },
  { icon: Headphones, title: "Atendimento personalizado", text: "Orientação para encontrar a embalagem adequada ao seu produto." },
  { icon: ClipboardCheck, title: "Orçamento facilitado", text: "Monte sua lista no site e envie direto pelo WhatsApp." },
  { icon: Store, title: "Para diversos segmentos", text: "Hamburguerias, lanchonetes, hot dog e delivery." },
];

function Index() {
  const { categories, config } = useCatalog();
  return (
    <>
      <section className="relative overflow-hidden bg-navy">
        <img src={hero} alt="Composição de embalagens para delivery: caixas, sacos kraft e embalagens para alimentos" width={1600} height={1008} className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy via-navy/85 to-navy/10" />
        <div className="relative mx-auto max-w-7xl px-5 py-24 md:py-36">
          <div className="max-w-2xl animate-rise text-primary-foreground">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-gold">A embalagem certa valoriza o seu negócio</p>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">Embalagens que valorizam seu produto e fortalecem seu negócio.</h1>
            <p className="mt-6 text-lg text-primary-foreground/80">Soluções em embalagens para hamburguerias, lanchonetes e delivery em Amparo e região.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/produtos" className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3.5 font-bold text-navy transition hover:brightness-105">Conheça nossos produtos <ArrowRight className="h-4 w-4" /></Link>
              <Link to="/orcamento" className="rounded-full border border-primary-foreground/40 px-6 py-3.5 font-semibold text-primary-foreground transition hover:bg-primary-foreground/10">Solicitar orçamento</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-gold">Catálogo</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-extrabold tracking-tight text-navy md:text-4xl">Encontre a embalagem ideal para o seu negócio.</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((c) => (
            <Link key={c.slug} to="/categorias/$slug" params={{ slug: c.slug }} className="group overflow-hidden rounded-2xl border border-border bg-card shadow-card transition hover:-translate-y-1">
              <div className="aspect-[4/3] overflow-hidden bg-muted"><img src={c.image} alt={c.name} loading="lazy" width={912} height={736} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /></div>
              <div className="p-5">
                <span className="text-xs font-bold text-gold">{c.number}</span>
                <h3 className="mt-1 font-bold text-navy">{c.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary">Ver produtos <ArrowRight className="h-4 w-4" /></span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-secondary">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-20 sm:grid-cols-2 lg:grid-cols-4">
          {perks.map((p) => (
            <div key={p.title} className="rounded-2xl bg-card p-7 shadow-card">
              <p.icon className="h-8 w-8 text-gold" />
              <h3 className="mt-4 font-bold text-navy">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20">
        <div className="rounded-3xl border-t-4 border-gold bg-gradient-navy px-8 py-14 text-center text-primary-foreground md:px-16">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Seu negócio merece uma apresentação à altura.</h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/75">Conheça nossas soluções em embalagens e solicite uma cotação para sua empresa.</p>
          <a href={whatsappLink("Olá, Majesta Embalagens! Gostaria de conhecer as soluções em embalagens.", config.whatsapp)} target="_blank" rel="noreferrer" className="mt-8 inline-flex rounded-full bg-gold px-7 py-3.5 font-bold text-navy hover:brightness-105">Falar com a Majesta</a>
        </div>
      </section>
    </>
  );
}
