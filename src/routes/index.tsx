import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Layers, Headphones, ClipboardCheck, Store, Truck, CreditCard, BadgePercent } from "lucide-react";
import { filterPublicCatalog } from "@/data/catalog";
import { useCatalog } from "@/lib/catalog-context";
import { whatsappLink } from "@/lib/config";
import { FeaturedProductsCarousel } from "@/components/site/FeaturedProductsCarousel";
import { HomepageCarousel } from "@/components/site/HomepageCarousel";
import { HomepageHeroCarousel } from "@/components/site/HomepageHeroCarousel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Majesta Embalagens — Embalagens para delivery e food service" },
      {
        name: "description",
        content:
          "Embalagens para hamburguerias, lanchonetes e delivery em Amparo e região. Caixas, sacos kraft, papéis, lacres e suprimentos. Solicite seu orçamento.",
      },
      {
        property: "og:title",
        content: "Majesta Embalagens — Embalagens para delivery e food service",
      },
      {
        property: "og:description",
        content: "A embalagem certa valoriza o seu negócio. Solicite seu orçamento pelo WhatsApp.",
      },
    ],
  }),
  component: Index,
});

const perks = [
  {
    icon: Layers,
    title: "Variedade de soluções",
    text: "Embalagens e suprimentos para diferentes etapas da operação.",
  },
  {
    icon: Headphones,
    title: "Atendimento personalizado",
    text: "Orientação para encontrar a embalagem adequada ao seu produto.",
  },
  {
    icon: ClipboardCheck,
    title: "Orçamento facilitado",
    text: "Monte sua lista no site e envie direto pelo WhatsApp.",
  },
  {
    icon: Store,
    title: "Para o seu negócio",
    text: "Hamburguerias, lanchonetes, hot dog e delivery.",
  },
];

const commercialBenefits = [
  { icon: Truck, title: "FRETE GRÁTIS", text: "Compras acima de R$200 consulte condições" },
  { icon: CreditCard, title: "PARCELE EM 3X", text: "Sem juros" },
  { icon: BadgePercent, title: "PAGUE VIA PIX", text: "5% de desconto!" },
];

function CommercialBenefits() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const motionPreference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const updatePreferences = () => {
      setIsMobile(window.innerWidth < 768);
      setReducedMotion(motionPreference?.matches ?? false);
    };
    updatePreferences();
    window.addEventListener("resize", updatePreferences);
    motionPreference?.addEventListener("change", updatePreferences);
    return () => {
      window.removeEventListener("resize", updatePreferences);
      motionPreference?.removeEventListener("change", updatePreferences);
    };
  }, []);

  useEffect(() => {
    if (!isMobile || reducedMotion) return;
    const interval = window.setInterval(() => {
      const track = trackRef.current;
      if (!track?.clientWidth) return;
      setActiveIndex((current) => {
        const next = (current + 1) % commercialBenefits.length;
        track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
        return next;
      });
    }, 2000);
    return () => window.clearInterval(interval);
  }, [isMobile, reducedMotion]);

  function selectBenefit(index: number) {
    const track = trackRef.current;
    if (track) track.scrollTo({ left: index * track.clientWidth, behavior: "smooth" });
    setActiveIndex(index);
  }

  function updateActiveBenefit() {
    const track = trackRef.current;
    if (track?.clientWidth) {
      setActiveIndex(Math.min(commercialBenefits.length - 1, Math.round(track.scrollLeft / track.clientWidth)));
    }
  }

  return (
    <section
      aria-label="Benefícios e condições comerciais"
      className="border-y border-border/70 bg-white py-6 md:py-8"
    >
      <div className="mx-auto max-w-7xl px-5">
        <div
          ref={trackRef}
          onScroll={updateActiveBenefit}
          className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 md:gap-4 md:overflow-visible"
        >
          {commercialBenefits.map((benefit, index) => (
            <article
              key={benefit.title}
              aria-roledescription="slide"
              aria-label={`${index + 1} de ${commercialBenefits.length}`}
              className="flex min-h-28 w-full shrink-0 snap-center items-center justify-center gap-4 rounded-2xl border border-border bg-card px-5 py-5 shadow-card md:min-w-0 md:justify-start md:px-6"
            >
              <benefit.icon aria-hidden="true" className="h-10 w-10 shrink-0 text-gold" />
              <div>
                <h2 className="text-sm font-extrabold tracking-wide text-navy">{benefit.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{benefit.text}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-4 flex justify-center gap-2 md:hidden" aria-label="Paginação dos benefícios">
          {commercialBenefits.map((benefit, index) => (
            <button
              key={benefit.title}
              type="button"
              aria-label={`Mostrar benefício: ${benefit.title}`}
              aria-pressed={activeIndex === index}
              onClick={() => selectBenefit(index)}
              className={`h-2.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeIndex === index ? "w-6 bg-navy" : "w-2.5 bg-border"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function Index() {
  const { categories, config } = useCatalog();
  const publicCategories = filterPublicCatalog(categories, []).categories;
  return (
    <>
      <HomepageHeroCarousel />

      <CommercialBenefits />

      <FeaturedProductsCarousel />
      <HomepageCarousel />

      <section className="mx-auto max-w-7xl px-5 py-20">
        <p className="text-center text-xs font-bold uppercase tracking-[0.3em] text-gold md:text-left">Catálogo</p>
        <h2 className="mx-auto mt-2 max-w-2xl text-center text-3xl font-extrabold tracking-tight text-navy md:mx-0 md:text-left md:text-4xl">
          Encontre a embalagem ideal para o seu negócio.
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {publicCategories.map((c) => (
            <Link
              key={c.slug}
              to="/categorias/$slug"
              params={{ slug: c.slug }}
              className="group overflow-hidden rounded-2xl border border-border bg-card shadow-card transition hover:-translate-y-1"
            >
              <div className="aspect-[4/3] overflow-hidden bg-muted">
                <img
                  src={c.image}
                  alt={c.name}
                  loading="lazy"
                  width={912}
                  height={736}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-5 text-center sm:text-left">
                <span className="text-xs font-bold text-gold">{c.number}</span>
                <h3 className="mt-1 font-bold text-navy">{c.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
                <span className="mt-4 inline-flex items-center justify-center gap-2 text-sm font-bold text-primary sm:justify-start">
                  Ver produtos <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-secondary">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-20 sm:grid-cols-2 lg:grid-cols-4">
          {perks.map((p) => (
            <div key={p.title} className="flex flex-col items-center rounded-2xl bg-card p-7 text-center shadow-card md:items-start md:text-left">
              <p.icon className="h-8 w-8 text-gold" />
              <h3 className="mt-4 font-bold text-navy">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20">
        <div className="rounded-3xl border-t-4 border-gold bg-gradient-navy px-8 py-14 text-center text-primary-foreground md:px-16">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            Seu negócio merece uma apresentação à altura.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/75">
            Conheça nossas soluções em embalagens e solicite uma cotação para sua empresa.
          </p>
          <a
            href={whatsappLink(
              "Olá, Majesta Embalagens! Gostaria de conhecer as soluções em embalagens.",
              config.whatsapp,
            )}
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-flex rounded-full bg-gold px-7 py-3.5 font-bold text-navy hover:brightness-105"
          >
            Falar com a Majesta
          </a>
        </div>
      </section>
    </>
  );
}
