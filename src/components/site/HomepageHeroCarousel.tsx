import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import hero from "@/assets/hero.jpg";
import { filterPublicCatalog } from "@/data/catalog";
import { useCatalog } from "@/lib/catalog-context";
import { getHomepageBanners } from "@/lib/catalog.functions";
import {
  buildHomepageSlides,
  homepageHeroFallbackContent,
  useHomepageFallback,
  type HomepageSlide,
} from "@/lib/homepage-banners";
import { whatsappLink } from "@/lib/config";

const publicBannersQuery = queryOptions({
  queryKey: ["homepage-banners"],
  queryFn: () => getHomepageBanners(),
  staleTime: 30_000,
  refetchInterval: 60_000,
});

const fallbackSlide: HomepageSlide = {
  id: "institutional-fallback",
  type: "institutional",
  imageUrl: hero,
  ...homepageHeroFallbackContent,
  source: "fallback",
};

export function HomepageHeroCarousel() {
  const { data: banners = [] } = useQuery(publicBannersQuery);
  const { products, categories, config } = useCatalog();
  const publicCatalog = filterPublicCatalog(categories, products);
  const managedSlides = buildHomepageSlides(
    banners.filter((banner) => banner.type === "institutional"),
    publicCatalog.products,
    publicCatalog.categories,
    Date.now(),
    undefined,
    false,
  );
  const slides = useHomepageFallback(managedSlides, fallbackSlide);
  const [activeIndex, setActiveIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const currentIndex = activeIndex % slides.length;
  const hasMultipleSlides = slides.length > 1;
  const isWhatsappAction = (label: string) => label.trim().toLowerCase() === "solicitar orçamento";
  const whatsappQuoteHref = whatsappLink(
    "Olá! Gostaria de solicitar um orçamento com a Majesta Embalagens.",
    config.whatsapp,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!hasMultipleSlides || reducedMotion || hovered || focusWithin) return;
    const timer = setTimeout(() => setActiveIndex((index) => (index + 1) % slides.length), 5000);
    return () => clearTimeout(timer);
  }, [activeIndex, focusWithin, hasMultipleSlides, hovered, reducedMotion, slides.length]);

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(0, slides.length - 1)));
  }, [slides.length]);

  return (
    <section
      className="relative overflow-hidden bg-navy"
      aria-label="Banner principal da Majesta Embalagens"
      aria-roledescription={hasMultipleSlides ? "carrossel" : undefined}
      role="region"
      tabIndex={hasMultipleSlides ? 0 : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocusWithin(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setFocusWithin(false);
      }}
    >
      <div className="grid">
        {slides.map((slide, index) => (
          <article
            key={slide.id}
            className={`relative col-start-1 row-start-1 min-h-[420px] overflow-hidden transition-opacity duration-700 motion-reduce:transition-none sm:min-h-[400px] md:min-h-[380px] lg:min-h-[400px] ${index === currentIndex ? "opacity-100" : "pointer-events-none opacity-0"}`}
            aria-hidden={index !== currentIndex}
            inert={index !== currentIndex}
            aria-roledescription={hasMultipleSlides ? "slide" : undefined}
            aria-label={hasMultipleSlides ? `${index + 1} de ${slides.length}: ${slide.title}` : undefined}
          >
            <picture className="absolute inset-0">
              {slide.mobileImageUrl && (
                <source media="(max-width: 639px)" srcSet={slide.mobileImageUrl} />
              )}
              <img
                src={slide.imageUrl}
                alt={
                  slide.source === "fallback"
                    ? "Composição de embalagens para delivery: caixas, sacos kraft e embalagens para alimentos"
                    : ""
                }
                width={1600}
                height={1008}
                loading={index === currentIndex ? "eager" : "lazy"}
                fetchPriority={index === currentIndex ? "high" : "auto"}
                className="h-full w-full object-cover opacity-60"
              />
            </picture>
            <div className="absolute inset-0 bg-gradient-to-r from-navy via-navy/85 to-navy/10" />
            <div className="relative mx-auto flex min-h-[420px] max-w-7xl items-center px-5 py-12 sm:min-h-[400px] md:min-h-[380px] md:py-10 lg:min-h-[400px]">
              <div className="mx-auto max-w-2xl animate-rise text-center text-primary-foreground md:mx-0 md:text-left">
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-gold">
                  A embalagem certa valoriza o seu negócio
                </p>
                <h1 className="mt-5 text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-4xl md:text-5xl">
                  {slide.title}
                </h1>
                {slide.subtitle && (
                  <p className="mt-5 text-base text-primary-foreground/80 sm:text-lg">
                    {slide.subtitle}
                  </p>
                )}
                <div className="mt-7 flex flex-wrap justify-center gap-3 md:justify-start">
                  {slide.buttonLabel &&
                    slide.buttonHref &&
                    !isWhatsappAction(slide.buttonLabel) && (
                      <a
                        href={slide.buttonHref}
                        target={slide.buttonHref.startsWith("https://") ? "_blank" : undefined}
                        rel={slide.buttonHref.startsWith("https://") ? "noreferrer" : undefined}
                        className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3.5 font-bold text-navy transition hover:brightness-105"
                      >
                        {slide.buttonLabel} <ArrowRight className="h-4 w-4" />
                      </a>
                    )}
                  {whatsappQuoteHref && (
                    <a
                      href={whatsappQuoteHref}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-primary-foreground/40 px-6 py-3.5 font-semibold text-primary-foreground transition hover:bg-primary-foreground/10"
                    >
                      Solicitar orçamento
                    </a>
                  )}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
