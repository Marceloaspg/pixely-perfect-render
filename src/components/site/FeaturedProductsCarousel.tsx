import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ArrowRight as ArrowRightLink } from "lucide-react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import useEmblaCarousel from "embla-carousel-react";
import { useCatalog } from "@/lib/catalog-context";
import { getHomepageBanners, getHomepageFeaturedProductSlugs } from "@/lib/catalog.functions";
import { Button } from "@/components/ui/button";

const featuredProductsQuery = queryOptions({
  queryKey: ["homepage-featured-products"],
  queryFn: () => getHomepageFeaturedProductSlugs(),
  staleTime: 30_000,
  refetchInterval: 60_000,
});

const homepageBannersQuery = queryOptions({
  queryKey: ["homepage-banners"],
  queryFn: () => getHomepageBanners(),
  staleTime: 30_000,
  refetchInterval: 60_000,
});

export function FeaturedProductsCarousel() {
  const { data: eligibleSlugs = [] } = useQuery(featuredProductsQuery);
  const { data: homepageBanners = [] } = useQuery(homepageBannersQuery);
  const { products, categories } = useCatalog();
  const [viewportRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    slidesToScroll: 1,
    loop: false,
  });
  const interactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeSnap, setActiveSnap] = useState(0);
  const [snapCount, setSnapCount] = useState(1);
  const [slidesPerPage, setSlidesPerPage] = useState(1);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [touching, setTouching] = useState(false);

  const activeCategories = useMemo(
    () =>
      new Set(categories.filter((category) => category.active).map((category) => category.slug)),
    [categories],
  );
  const eligibleSet = useMemo(() => new Set(eligibleSlugs), [eligibleSlugs]);
  const bannerLinkedProducts = useMemo(
    () =>
      new Set(
        homepageBanners
          .filter((banner) => banner.type === "product" && banner.productSlug)
          .map((banner) => banner.productSlug!),
      ),
    [homepageBanners],
  );
  const featuredProducts = useMemo(
    () =>
      products
        .filter(
          (product) =>
            eligibleSet.has(product.slug) &&
            !bannerLinkedProducts.has(product.slug) &&
            product.active &&
            activeCategories.has(product.category) &&
            product.featured &&
            !product.demo &&
            Boolean(product.imagePath && product.image) &&
            product.imageAvailable !== false,
        )
        .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name)),
    [activeCategories, bannerLinkedProducts, eligibleSet, products],
  );

  useEffect(() => {
    const updateSlidesPerPage = () => {
      setSlidesPerPage(window.innerWidth >= 1024 ? 3 : window.innerWidth >= 640 ? 2 : 1);
    };
    updateSlidesPerPage();
    window.addEventListener("resize", updateSlidesPerPage);
    return () => window.removeEventListener("resize", updateSlidesPerPage);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(
    () => () => {
      if (interactionTimer.current) clearTimeout(interactionTimer.current);
    },
    [],
  );

  const hasMultipleSnaps = snapCount > 1;
  const interactionActive = hovered || focusWithin || touching;

  const syncCarousel = useCallback(() => {
    if (!emblaApi) return;
    setActiveSnap(emblaApi.selectedScrollSnap());
    setSnapCount(emblaApi.scrollSnapList().length);
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    syncCarousel();
    emblaApi.on("select", syncCarousel);
    emblaApi.on("reInit", syncCarousel);
    return () => {
      emblaApi.off("select", syncCarousel);
      emblaApi.off("reInit", syncCarousel);
    };
  }, [emblaApi, syncCarousel, featuredProducts.length, slidesPerPage]);

  function pauseForInteraction() {
    if (interactionTimer.current) clearTimeout(interactionTimer.current);
    interactionTimer.current = setTimeout(() => setTouching(false), 5000);
  }

  function goToSnap(snap: number) {
    if (interactionTimer.current) clearTimeout(interactionTimer.current);
    setTouching(false);
    emblaApi?.scrollTo(snap, !reducedMotion);
  }

  useEffect(() => {
    if (!emblaApi || !hasMultipleSnaps || reducedMotion || interactionActive) return;
    const timer = setTimeout(() => {
      if (emblaApi.canScrollNext()) {
        emblaApi.scrollNext();
      } else {
        emblaApi.scrollTo(0);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [activeSnap, emblaApi, hasMultipleSnaps, interactionActive, reducedMotion]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (emblaApi?.canScrollPrev()) emblaApi.scrollPrev(!reducedMotion);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      if (emblaApi?.canScrollNext()) emblaApi.scrollNext(!reducedMotion);
    } else if (event.key === "Home") {
      event.preventDefault();
      goToSnap(0);
    } else if (event.key === "End") {
      event.preventDefault();
      goToSnap(snapCount - 1);
    }
  }

  if (!featuredProducts.length) return null;

  return (
    <section
      className="bg-white py-14 md:py-18"
      aria-labelledby="featured-products-heading"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocusWithin(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocusWithin(false);
        }
      }}
      onPointerDown={() => setTouching(true)}
      onPointerUp={pauseForInteraction}
      onPointerCancel={() => {
        setTouching(false);
        if (interactionTimer.current) clearTimeout(interactionTimer.current);
      }}
      onTouchStart={() => setTouching(true)}
      onTouchEnd={pauseForInteraction}
      onTouchCancel={() => {
        setTouching(false);
        if (interactionTimer.current) clearTimeout(interactionTimer.current);
      }}
    >
      <div className="mx-auto max-w-7xl px-5">
        <div className="mb-7 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-gold">Seleção Majesta</p>
          <h2
            id="featured-products-heading"
            className="mt-2 text-center text-2xl font-extrabold tracking-tight text-navy md:text-3xl"
          >
            Produtos em Destaque
          </h2>
        </div>

        <div className="mx-auto flex w-full max-w-[1040px] items-center justify-center gap-2">
          {hasMultipleSnaps && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Produtos anteriores"
              onClick={() => emblaApi?.scrollPrev(!reducedMotion)}
              className="shrink-0 rounded-full border-navy/15 text-navy"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}

          <div
            ref={viewportRef}
            className="min-w-0 flex-1 overflow-hidden pb-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-4 sm:max-w-[616px] lg:max-w-[920px]"
            role="region"
            aria-roledescription="carrossel"
            aria-label="Produtos em destaque"
            tabIndex={hasMultipleSnaps ? 0 : undefined}
            onKeyDown={handleKeyDown}
          >
            <div className="flex touch-pan-y">
              {featuredProducts.map((product) => (
                <div
                  key={product.slug}
                  className={`min-w-0 shrink-0 pl-4 first:pl-0 ${
                    slidesPerPage === 1
                      ? "basis-full"
                      : slidesPerPage === 2
                        ? "basis-1/2"
                        : "basis-1/3"
                  }`}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={product.name}
                >
                  <article className="group mx-auto flex h-full w-full max-w-[300px] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-card transition-transform hover:-translate-y-1">
                    <Link
                      to="/produtos/$slug"
                      params={{ slug: product.slug }}
                      className="flex h-full flex-col items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold"
                      aria-label={`Veja mais sobre ${product.name}`}
                    >
                      <div className="flex h-[280px] w-full max-w-[280px] shrink-0 items-center justify-center overflow-hidden bg-white">
                        <img
                          src={product.image}
                          alt={product.name}
                          width={600}
                          height={600}
                          loading="lazy"
                          className="block h-full min-h-0 min-w-0 w-full object-contain"
                        />
                      </div>
                      <div className="flex min-h-[118px] w-full flex-1 flex-col items-start p-5">
                        <h3 className="line-clamp-2 min-h-12 font-bold leading-6 text-navy">
                          {product.name}
                        </h3>
                        <span className="mt-3 inline-flex shrink-0 items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-bold text-navy transition group-hover:brightness-105">
                          Veja mais
                          <ArrowRightLink className="h-4 w-4" aria-hidden="true" />
                        </span>
                      </div>
                    </Link>
                  </article>
                </div>
              ))}
            </div>
          </div>

          {hasMultipleSnaps && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Próximos produtos"
              onClick={() => emblaApi?.scrollNext(!reducedMotion)}
              className="shrink-0 rounded-full border-navy/15 text-navy"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        {hasMultipleSnaps && (
          <div
            className="mt-5 flex justify-center gap-2"
            role="group"
            aria-label="Posição do carrossel"
          >
            {Array.from({ length: snapCount }, (_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Mostrar posição ${index + 1} de ${snapCount}`}
                aria-current={index === activeSnap ? "true" : undefined}
                onClick={() => goToSnap(index)}
                className={`h-2.5 rounded-full transition-all motion-reduce:transition-none ${index === activeSnap ? "w-7 bg-gold" : "w-2.5 bg-navy/25 hover:bg-navy/50"}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
