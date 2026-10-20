import { z } from "zod";
import type { Category, Product } from "@/data/catalog";

export const homepageBannerTypes = ["institutional", "campaign", "product"] as const;
export type HomepageBannerType = (typeof homepageBannerTypes)[number];

export const homepageBannerSchema = z
  .object({
    id: z.string().uuid().optional(),
    type: z.enum(homepageBannerTypes),
    title: z.string().trim().min(1, "Informe um título.").max(120),
    subtitle: z.string().trim().max(500).default(""),
    imagePath: z.string().max(300).nullable().default(null),
    mobileImagePath: z.string().max(300).nullable().default(null),
    buttonLabel: z.string().trim().max(60).default(""),
    buttonHref: z.string().trim().max(500).default(""),
    productSlug: z.string().max(120).nullable().default(null),
    displayOrder: z.number().int().min(0).max(9999).default(0),
    active: z.boolean().default(false),
    startsAt: z.string().datetime({ offset: true }).nullable().default(null),
    endsAt: z.string().datetime({ offset: true }).nullable().default(null),
  })
  .superRefine((banner, context) => {
    if (banner.type === "product" && !banner.productSlug) {
      context.addIssue({
        code: "custom",
        path: ["productSlug"],
        message: "Selecione um produto para este banner.",
      });
    }
    if (banner.type !== "product" && !banner.imagePath) {
      context.addIssue({
        code: "custom",
        path: ["imagePath"],
        message: "Envie uma imagem para este banner.",
      });
    }
    if (banner.buttonHref && !isSafeBannerHref(banner.buttonHref)) {
      context.addIssue({
        code: "custom",
        path: ["buttonHref"],
        message: "Use um caminho interno ou uma URL HTTPS segura.",
      });
    }
    if (
      banner.startsAt &&
      banner.endsAt &&
      Date.parse(banner.startsAt) >= Date.parse(banner.endsAt)
    ) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "A data final deve ser posterior à data inicial.",
      });
    }
  });

export type HomepageBannerDraft = z.infer<typeof homepageBannerSchema>;

export type HomepageBanner = HomepageBannerDraft & {
  id: string;
  imageUrl: string;
  mobileImageUrl: string;
  archivedAt: string | null;
};

export function reorderHomepageBannerGroup<T extends Pick<HomepageBanner, "id" | "type">>(
  banners: readonly T[],
  id: string,
  direction: -1 | 1,
): T[] {
  const isInstitutional = banners.find((banner) => banner.id === id)?.type === "institutional";
  const group = banners.filter(
    (banner) => (banner.type === "institutional") === isInstitutional,
  );
  const index = group.findIndex((banner) => banner.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= group.length) return [...banners];

  [group[index], group[target]] = [group[target]!, group[index]!];
  let groupIndex = 0;
  return banners.map((banner) =>
    (banner.type === "institutional") === isInstitutional ? group[groupIndex++]! : banner,
  );
}

export type HomepageSlide = {
  id: string;
  type: HomepageBannerType;
  title: string;
  subtitle: string;
  imageUrl: string;
  mobileImageUrl?: string;
  buttonLabel: string;
  buttonHref: string;
  source: "banner" | "product" | "fallback";
};

export type HomepageBannerEligibilityRecord = {
  active: boolean;
  archivedAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  type: string;
  productSlug: string | null;
  buttonHref: string;
};

export type HomepageProductEligibilityRecord = {
  slug: string;
  category: string;
  active: boolean;
  featured: boolean;
  demo: boolean;
  imagePath: string;
};

export function isSafeBannerHref(value: string): boolean {
  if (
    !value ||
    [...value].some((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127 || character === "\\";
    })
  ) {
    return false;
  }
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function filterEligibleHomepageBanners<T extends HomepageBannerEligibilityRecord>(
  banners: T[],
  products: readonly HomepageProductEligibilityRecord[],
  activeCategorySlugs: ReadonlySet<string>,
  now = Date.now(),
): T[] {
  const productsBySlug = new Map(products.map((product) => [product.slug, product]));
  return banners.filter((banner) => {
    const startTime = banner.startsAt === null ? null : Date.parse(banner.startsAt);
    const endTime = banner.endsAt === null ? null : Date.parse(banner.endsAt);
    if (
      !banner.active ||
      banner.archivedAt ||
      (startTime !== null && (!Number.isFinite(startTime) || startTime > now)) ||
      (endTime !== null && (!Number.isFinite(endTime) || endTime <= now)) ||
      (banner.buttonHref !== "" && !isSafeBannerHref(banner.buttonHref))
    ) {
      return false;
    }

    if (!banner.productSlug) return banner.type !== "product";

    const product = productsBySlug.get(banner.productSlug);
    if (!product || !product.active || !activeCategorySlugs.has(product.category)) return false;
    if (banner.type !== "product") return true;

    return product.featured && !product.demo && product.imagePath.trim().length > 0;
  });
}

export function getEligibleFeaturedProductSlugs(
  products: readonly HomepageProductEligibilityRecord[],
  activeCategorySlugs: ReadonlySet<string>,
): Set<string> {
  return new Set(
    products
      .filter(
        (product) =>
          product.active &&
          activeCategorySlugs.has(product.category) &&
          product.featured &&
          !product.demo &&
          product.imagePath.trim().length > 0,
      )
      .map((product) => product.slug),
  );
}

function isWithinSchedule(banner: HomepageBanner, now: number): boolean {
  const startTime = banner.startsAt ? Date.parse(banner.startsAt) : null;
  const endTime = banner.endsAt ? Date.parse(banner.endsAt) : null;
  return (
    (startTime === null || (Number.isFinite(startTime) && startTime <= now)) &&
    (endTime === null || (Number.isFinite(endTime) && endTime > now))
  );
}

export function buildHomepageSlides(
  banners: HomepageBanner[],
  products: Product[],
  categories: Category[],
  now = Date.now(),
  eligibleFeaturedProductSlugs?: ReadonlySet<string>,
  includeAutomaticProducts = true,
): HomepageSlide[] {
  const activeCategorySlugs = new Set(
    categories.filter((category) => category.active).map((category) => category.slug),
  );
  const publicProducts = new Map(
    products
      .filter((product) => product.active && !product.demo && activeCategorySlugs.has(product.category))
      .map((product) => [product.slug, product]),
  );
  const eligibleBanners = banners
    .filter((banner) => banner.active && !banner.archivedAt && isWithinSchedule(banner, now))
    .filter((banner) => !banner.productSlug || publicProducts.has(banner.productSlug))
    .sort(
      (left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id),
    );
  const linkedProductSlugs = new Set<string>();
  const slides: HomepageSlide[] = [];

  for (const banner of eligibleBanners) {
    const linkedProduct = banner.productSlug ? publicProducts.get(banner.productSlug) : undefined;
    if (banner.type === "product") {
      if (
        !linkedProduct ||
        !linkedProduct.featured ||
        linkedProduct.demo ||
        !linkedProduct.imagePath ||
        !linkedProduct.image ||
        linkedProduct.imageAvailable === false ||
        (eligibleFeaturedProductSlugs && !eligibleFeaturedProductSlugs.has(linkedProduct.slug))
      )
        continue;
      slides.push({
        id: banner.id,
        type: banner.type,
        title: linkedProduct.name,
        subtitle: banner.subtitle || linkedProduct.description,
        imageUrl: linkedProduct.image,
        buttonLabel: banner.buttonLabel || "Conheça o produto",
        buttonHref: `/produtos/${encodeURIComponent(linkedProduct.slug)}`,
        source: "banner",
      });
      linkedProductSlugs.add(linkedProduct.slug);
      continue;
    }

    if (!banner.imageUrl) continue;
    const href = linkedProduct
      ? `/produtos/${encodeURIComponent(linkedProduct.slug)}`
      : banner.buttonHref;
    slides.push({
      id: banner.id,
      type: banner.type,
      title: banner.title,
      subtitle: banner.subtitle,
      imageUrl: banner.imageUrl,
      ...(banner.mobileImageUrl ? { mobileImageUrl: banner.mobileImageUrl } : {}),
      buttonLabel: banner.buttonLabel,
      buttonHref: href,
      source: "banner",
    });
    if (linkedProduct) linkedProductSlugs.add(linkedProduct.slug);
  }

  const featuredProducts = includeAutomaticProducts
    ? [...publicProducts.values()]
        .filter(
          (product) =>
            product.featured &&
            !product.demo &&
            product.imagePath &&
            product.image &&
            product.imageAvailable !== false &&
            (!eligibleFeaturedProductSlugs || eligibleFeaturedProductSlugs.has(product.slug)),
        )
        .filter((product) => !linkedProductSlugs.has(product.slug))
        .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name))
    : [];

  for (const product of featuredProducts) {
    slides.push({
      id: `product:${product.slug}`,
      type: "product",
      title: product.name,
      subtitle: product.description,
      imageUrl: product.image,
      buttonLabel: "Conheça o produto",
      buttonHref: `/produtos/${encodeURIComponent(product.slug)}`,
      source: "product",
    });
  }

  return slides;
}

export function useHomepageFallback(
  slides: HomepageSlide[],
  fallback: HomepageSlide,
): HomepageSlide[] {
  return slides.length ? slides : [fallback];
}
