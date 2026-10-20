import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { filterPublicCatalog } from "@/data/catalog";
import { useCatalog } from "@/lib/catalog-context";
import { getHomepageBanners, getHomepageFeaturedProductSlugs } from "@/lib/catalog.functions";
import { buildHomepageSlides } from "@/lib/homepage-banners";

const publicBannersQuery = queryOptions({
  queryKey: ["homepage-banners"],
  queryFn: () => getHomepageBanners(),
  staleTime: 30_000,
  refetchInterval: 60_000,
});

const publicFeaturedProductsQuery = queryOptions({
  queryKey: ["homepage-featured-products"],
  queryFn: () => getHomepageFeaturedProductSlugs(),
  staleTime: 30_000,
  refetchInterval: 60_000,
});

export function HomepageCarousel() {
  const { data: banners = [] } = useQuery(publicBannersQuery);
  const { data: featuredProductSlugs = [] } = useQuery(publicFeaturedProductsQuery);
  const { products, categories } = useCatalog();
  const publicCatalog = filterPublicCatalog(categories, products);
  const slides = buildHomepageSlides(
    banners.filter((banner) => banner.type !== "institutional"),
    publicCatalog.products,
    publicCatalog.categories,
    Date.now(),
    new Set(featuredProductSlugs),
    false,
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [autoplayPaused, setAutoplayPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [pointerStart, setPointerStart] = useState<{ x: number; y: number } | null>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentIndex = slides.length ? activeIndex % slides.length : 0;
  const hasMultipleSlides = slides.length > 1;
  const currentSlide = slides[currentIndex];
  const interactionActive = hovered || focusWithin || pointerStart !== null;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(
    () => () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!hasMultipleSlides || reducedMotion || autoplayPaused || interactionActive) return;
    const timer = setTimeout(() => setActiveIndex((index) => (index + 1) % slides.length), 5000);
    return () => clearTimeout(timer);
  }, [
    activeIndex,
    autoplayPaused,
    hasMultipleSlides,
    interactionActive,
    reducedMotion,
    slides.length,
  ]);

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(0, slides.length - 1)));
  }, [slides.length]);

  function pauseForInteraction() {
    if (!hasMultipleSlides) return;
    setAutoplayPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setAutoplayPaused(false), 7000);
  }

  function goTo(index: number, manual = true) {
    if (manual) pauseForInteraction();
    setActiveIndex((index + slides.length) % slides.length);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (!hasMultipleSlides) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(currentIndex - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(currentIndex + 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      goTo(0);
    } else if (event.key === "End") {
      event.preventDefault();
      goTo(slides.length - 1);
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLElement>) {
    if (!pointerStart) return;
    const distanceX = event.clientX - pointerStart.x;
    const distanceY = event.clientY - pointerStart.y;
    setPointerStart(null);
    if (Math.abs(distanceX) < 48 || Math.abs(distanceX) < Math.abs(distanceY)) return;
    event.preventDefault();
    goTo(currentIndex + (distanceX < 0 ? 1 : -1));
  }

  if (!slides.length) return null;

  return (
    <section className="bg-white py-14 md:py-18">
      <div className="mx-auto max-w-7xl px-5">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-gold">Novidades</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-navy md:text-3xl">
              Campanhas e novidades
            </h2>
          </div>
          {hasMultipleSlides && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Campanha anterior"
                onClick={() => goTo(currentIndex - 1)}
                className="rounded-full border-navy/15 text-navy"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Próxima campanha"
                onClick={() => goTo(currentIndex + 1)}
                className="rounded-full border-navy/15 text-navy"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        <div
          className="relative overflow-hidden rounded-3xl bg-navy"
          aria-label="Campanhas da Majesta Embalagens"
          aria-roledescription={hasMultipleSlides ? "carrossel" : undefined}
          role="region"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocusCapture={() => setFocusWithin(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null))
              setFocusWithin(false);
          }}
          onPointerDown={(event) => setPointerStart({ x: event.clientX, y: event.clientY })}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => setPointerStart(null)}
        >
          <div className="relative min-h-[560px] w-full sm:min-h-[580px] md:min-h-[520px] lg:min-h-[460px]">
            {slides.map((slide, index) => (
              <article
                key={slide.id}
                className={`absolute inset-0 grid grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-3xl border border-border bg-white shadow-card transition-opacity duration-700 motion-reduce:transition-none md:grid-cols-[58%_42%] md:grid-rows-1 ${index === currentIndex ? "opacity-100" : "pointer-events-none opacity-0"}`}
                aria-hidden={index !== currentIndex}
                inert={index !== currentIndex}
                aria-roledescription="slide"
                aria-label={`${index + 1} de ${slides.length}: ${slide.title}`}
              >
                <picture className="relative block min-h-[220px] sm:min-h-[250px] md:min-h-0">
                  {slide.mobileImageUrl && (
                    <source media="(max-width: 639px)" srcSet={slide.mobileImageUrl} />
                  )}
                  <img
                    src={slide.imageUrl}
                    alt=""
                    width={1600}
                    height={900}
                    loading={index === currentIndex ? "eager" : "lazy"}
                    fetchPriority={index === currentIndex ? "high" : "auto"}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </picture>
                <div className="flex flex-col justify-center px-6 pb-14 pt-6 text-navy sm:px-8 md:px-7 lg:px-10">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.3em] text-gold">
                      Majesta Embalagens
                    </p>
                    <h2 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl lg:text-4xl">
                      {slide.title}
                    </h2>
                    {slide.subtitle && (
                      <p className="mt-4 line-clamp-5 text-sm text-muted-foreground sm:text-base">
                        {slide.subtitle}
                      </p>
                    )}
                    {slide.buttonLabel && slide.buttonHref && (
                      <div className="mt-5 flex flex-wrap gap-3">
                        <a
                          href={slide.buttonHref}
                          target={slide.buttonHref.startsWith("https://") ? "_blank" : undefined}
                          rel={slide.buttonHref.startsWith("https://") ? "noreferrer" : undefined}
                          className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-3 font-bold text-navy transition hover:brightness-105"
                        >
                          {slide.buttonLabel}
                          <ArrowRightIcon />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}

            {hasMultipleSlides && (
              <>
                <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2 rounded-full bg-navy/10 px-3 py-2">
                  {slides.map((slide, index) => (
                    <button
                      key={slide.id}
                      type="button"
                      aria-label={`Mostrar campanha ${index + 1} de ${slides.length}`}
                      aria-current={index === currentIndex ? "true" : undefined}
                      onClick={() => goTo(index)}
                      className={`h-2.5 rounded-full transition-all ${index === currentIndex ? "w-7 bg-gold" : "w-2.5 bg-navy/35 hover:bg-navy/60"}`}
                    />
                  ))}
                </div>
                <p className="sr-only" aria-live="polite">
                  {currentIndex + 1} de {slides.length}: {currentSlide?.title}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ArrowRightIcon() {
  return <ArrowRight className="h-4 w-4" aria-hidden="true" />;
}
