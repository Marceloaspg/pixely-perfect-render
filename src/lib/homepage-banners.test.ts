import { describe, expect, it } from "vitest";
import { categoryDataSchema, productDataSchema, type Category, type Product } from "@/data/catalog";
import {
  buildHomepageSlides,
  filterEligibleHomepageBanners,
  getEligibleFeaturedProductSlugs,
  homepageBannerSchema,
  isSafeBannerHref,
  useHomepageFallback,
  type HomepageBanner,
  type HomepageSlide,
} from "./homepage-banners";

const now = Date.parse("2026-10-11T12:00:00.000Z");

function category(active = true): Category {
  return {
    ...categoryDataSchema.parse({ name: "Embalagens", description: "" }),
    slug: "embalagens",
    active,
    image: "/category.webp",
  };
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    ...productDataSchema.parse({
      name: "Caixa para delivery",
      description: "Produto cadastrado",
      featured: true,
      imagePath: "catalog/caixa.webp",
    }),
    slug: "caixa-delivery",
    category: "embalagens",
    active: true,
    image: "/signed/caixa.webp",
    additionalImages: [],
    ...overrides,
  };
}

function banner(overrides: Partial<HomepageBanner> = {}): HomepageBanner {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    type: "campaign",
    title: "Novidades Majesta",
    subtitle: "Conheça nossas soluções",
    imagePath: "banners/campanha.webp",
    mobileImagePath: null,
    buttonLabel: "Ver produtos",
    buttonHref: "/produtos",
    productSlug: null,
    displayOrder: 0,
    active: true,
    startsAt: null,
    endsAt: null,
    imageUrl: "/signed/campanha.webp",
    mobileImageUrl: "",
    archivedAt: null,
    ...overrides,
  };
}

describe("homepage banner validation", () => {
  it("requires an associated product for product banners and an uploaded image for other types", () => {
    expect(() => homepageBannerSchema.parse({ type: "product", title: "Produto" })).toThrow(
      "Selecione um produto",
    );
    expect(() => homepageBannerSchema.parse({ type: "campaign", title: "Campanha" })).toThrow(
      "Envie uma imagem",
    );
    expect(() =>
      homepageBannerSchema.parse({
        type: "institutional",
        title: "Institucional",
        imagePath: "banners/hero.webp",
        buttonHref: "javascript:alert(1)",
      }),
    ).toThrow("HTTPS segura");
  });

  it("rejects invalid schedule ranges", () => {
    expect(() =>
      homepageBannerSchema.parse({
        type: "campaign",
        title: "Campanha",
        imagePath: "banners/campanha.webp",
        startsAt: "2026-10-12T00:00:00.000Z",
        endsAt: "2026-10-11T00:00:00.000Z",
      }),
    ).toThrow("posterior");
  });

  it("accepts safe internal and HTTPS destinations only", () => {
    expect(isSafeBannerHref("/produtos/caixa")).toBe(true);
    expect(isSafeBannerHref("https://majesta.example/campanha")).toBe(true);
    expect(isSafeBannerHref("//evil.example")).toBe(false);
    expect(isSafeBannerHref("/\\evil.example")).toBe(false);
    expect(isSafeBannerHref("data:text/html,alert(1)")).toBe(false);
    expect(isSafeBannerHref("https://user:password@example.com")).toBe(false);
  });
});

describe("server-side banner eligibility", () => {
  const activeProduct = {
    slug: "caixa-delivery",
    category: "embalagens",
    active: true,
    featured: true,
    demo: false,
    imagePath: "catalog/caixa.webp",
  };

  it("filters inactive, archived, scheduled, unsafe, and ineligible product banners", () => {
    const eligible = {
      id: "eligible",
      active: true,
      archivedAt: null,
      startsAt: null,
      endsAt: null,
      type: "campaign",
      productSlug: null,
      buttonHref: "/produtos",
    };
    const productBanner = {
      ...eligible,
      id: "product",
      type: "product",
      productSlug: activeProduct.slug,
    };
    const result = filterEligibleHomepageBanners(
      [
        eligible,
        productBanner,
        { ...eligible, id: "inactive", active: false },
        { ...eligible, id: "archived", archivedAt: "2026-10-10T00:00:00Z" },
        { ...eligible, id: "future", startsAt: "2026-10-12T00:00:00Z" },
        { ...eligible, id: "expired", endsAt: "2026-10-10T00:00:00Z" },
        { ...eligible, id: "invalid-date", startsAt: "not-a-date" },
        { ...eligible, id: "unsafe-link", buttonHref: "javascript:alert(1)" },
        { ...productBanner, id: "demo", productSlug: "demo" },
      ],
      [activeProduct, { ...activeProduct, slug: "demo", demo: true }],
      new Set(["embalagens"]),
      now,
    );

    expect(result.map((item) => item.id)).toEqual(["eligible", "product"]);
  });

  it("requires linked products and active categories, plus a featured non-demo image for product banners", () => {
    const productBanner = {
      id: "product",
      active: true,
      archivedAt: null,
      startsAt: null,
      endsAt: null,
      type: "product",
      productSlug: activeProduct.slug,
      buttonHref: "",
    };
    expect(
      filterEligibleHomepageBanners([productBanner], [activeProduct], new Set(["embalagens"]), now),
    ).toHaveLength(1);
    expect(
      filterEligibleHomepageBanners(
        [productBanner],
        [{ ...activeProduct, featured: false }],
        new Set(["embalagens"]),
        now,
      ),
    ).toHaveLength(0);
    expect(
      filterEligibleHomepageBanners(
        [productBanner],
        [{ ...activeProduct, imagePath: " " }],
        new Set(["embalagens"]),
        now,
      ),
    ).toHaveLength(0);
    expect(
      filterEligibleHomepageBanners([productBanner], [activeProduct], new Set(), now),
    ).toHaveLength(0);
    expect(
      filterEligibleHomepageBanners([{ ...productBanner, productSlug: null }], [], new Set(), now),
    ).toHaveLength(0);
  });

  it("returns server-approved slugs only for active, featured, non-demo products with photos", () => {
    const slugs = getEligibleFeaturedProductSlugs(
      [
        activeProduct,
        { ...activeProduct, slug: "inactive", active: false },
        { ...activeProduct, slug: "inactive-category", category: "inactive" },
        { ...activeProduct, slug: "not-featured", featured: false },
        { ...activeProduct, slug: "demo", demo: true },
        { ...activeProduct, slug: "no-image", imagePath: "" },
      ],
      new Set(["embalagens"]),
    );
    expect([...slugs]).toEqual(["caixa-delivery"]);
    expect(buildHomepageSlides([], [product()], [category()], now, slugs)).toHaveLength(1);
    expect(buildHomepageSlides([], [product()], [category()], now, new Set())).toHaveLength(0);
  });

  it("keeps managed product banners in their separate promotional carousel without auto-inserting products", () => {
    const productBanner = banner({
      type: "product",
      productSlug: "caixa-delivery",
      imagePath: null,
      imageUrl: "",
    });
    const slides = buildHomepageSlides(
      [productBanner],
      [product()],
      [category()],
      now,
      new Set(["caixa-delivery"]),
      false,
    );

    expect(slides).toHaveLength(1);
    expect(slides[0]).toMatchObject({ id: productBanner.id, source: "banner" });
    expect(
      buildHomepageSlides([], [product()], [category()], now, new Set(["caixa-delivery"]), false),
    ).toEqual([]);
  });
});

describe("homepage slide eligibility", () => {
  it("shows a single eligible banner and preserves admin banner priority", () => {
    expect(buildHomepageSlides([banner()], [], [category()], now).map((slide) => slide.id)).toEqual(
      ["10000000-0000-4000-8000-000000000001"],
    );
    const slides = buildHomepageSlides(
      [
        banner({ displayOrder: 1 }),
        banner({
          id: "10000000-0000-4000-8000-000000000002",
          title: "Primeiro na ordem",
          displayOrder: 0,
        }),
      ],
      [product()],
      [category()],
      now,
    );
    expect(slides.map((slide) => slide.title)).toEqual([
      "Primeiro na ordem",
      "Novidades Majesta",
      "Caixa para delivery",
    ]);
  });

  it("includes only featured active non-demo products with an image in an active category", () => {
    const slides = buildHomepageSlides(
      [],
      [
        product(),
        product({ slug: "inativo", active: false }),
        product({ slug: "demo", demo: true }),
        product({ slug: "sem-foto", imagePath: "", image: "" }),
        product({ slug: "storage-indisponivel", imageAvailable: false }),
        product({ slug: "sem-destaque", featured: false }),
      ],
      [category()],
      now,
    );
    expect(slides.map((slide) => slide.id)).toEqual(["product:caixa-delivery"]);
    expect(buildHomepageSlides([], [product()], [category(false)], now)).toEqual([]);
  });

  it("uses the product image and link for product banners", () => {
    const productBanner = banner({
      type: "product",
      productSlug: "caixa-delivery",
      imagePath: null,
      imageUrl: "",
      buttonLabel: "",
    });
    expect(buildHomepageSlides([productBanner], [product()], [category()], now)).toEqual([
      expect.objectContaining({
        title: "Caixa para delivery",
        imageUrl: "/signed/caixa.webp",
        buttonHref: "/produtos/caixa-delivery",
      }),
    ]);
    expect(
      buildHomepageSlides([productBanner], [product({ demo: true })], [category()], now),
    ).toEqual([]);
    expect(
      buildHomepageSlides([productBanner], [product({ imageAvailable: false })], [category()], now),
    ).toEqual([]);
  });

  it("hides inactive, archived, future, and expired banners", () => {
    const slides = buildHomepageSlides(
      [
        banner({ id: "10000000-0000-4000-8000-000000000002", active: false }),
        banner({
          id: "10000000-0000-4000-8000-000000000003",
          archivedAt: "2026-10-10T00:00:00.000Z",
        }),
        banner({
          id: "10000000-0000-4000-8000-000000000004",
          startsAt: "2026-10-12T00:00:00.000Z",
        }),
        banner({ id: "10000000-0000-4000-8000-000000000005", endsAt: "2026-10-10T00:00:00.000Z" }),
        banner({ id: "10000000-0000-4000-8000-000000000006" }),
      ],
      [],
      [category()],
      now,
    );
    expect(slides.map((slide) => slide.id)).toEqual(["10000000-0000-4000-8000-000000000006"]);
  });

  it("deduplicates products already linked to eligible administrative banners", () => {
    const linked = banner({
      productSlug: "caixa-delivery",
      imageUrl: "/signed/campanha.webp",
    });
    const slides = buildHomepageSlides([linked], [product()], [category()], now);
    expect(slides).toHaveLength(1);
    expect(slides[0]?.source).toBe("banner");
  });

  it("does not let a banner with an unavailable image hide its linked featured product", () => {
    const linked = banner({
      productSlug: "caixa-delivery",
      imageUrl: "",
    });
    const slides = buildHomepageSlides([linked], [product()], [category()], now);
    expect(slides.map((slide) => slide.id)).toEqual(["product:caixa-delivery"]);
  });

  it("falls back to the institutional slide when no dynamic slides are available", () => {
    const fallback: HomepageSlide = {
      id: "institutional-fallback",
      type: "institutional",
      title: "A embalagem certa valoriza o seu negócio",
      subtitle: "Soluções Majesta Embalagens",
      imageUrl: "/hero.jpg",
      buttonLabel: "Conheça nossos produtos",
      buttonHref: "/produtos",
      source: "fallback",
    };
    expect(useHomepageFallback([], fallback)).toEqual([fallback]);
    expect(
      useHomepageFallback([{ ...fallback, id: "dynamic", source: "banner" }], fallback),
    ).toHaveLength(1);
  });
});
