import { categorySlugSchema, filterPublicCatalog, type CatalogData } from "@/data/catalog";

export const SITEMAP_ORIGIN = "https://majestaembalagens.com.br";

const publicStaticPaths = [
  "/",
  "/categorias",
  "/produtos",
  "/sobre",
  "/contato",
  "/privacidade",
  "/termos",
] as const;

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function location(path: string): string {
  return `${SITEMAP_ORIGIN}${path}`;
}

export function buildSitemapXml(catalog: Pick<CatalogData, "categories" | "products">): string {
  const { categories, products } = filterPublicCatalog(catalog.categories, catalog.products);
  const categoryLocations = categories.flatMap((category) => {
    const slug = categorySlugSchema.safeParse(category.slug);
    return slug.success ? [location(`/categorias/${encodeURIComponent(slug.data)}`)] : [];
  });
  const productLocations = products.flatMap((product) => {
    const slug = categorySlugSchema.safeParse(product.slug);
    return slug.success ? [location(`/produtos/${encodeURIComponent(slug.data)}`)] : [];
  });
  const urls = [...publicStaticPaths.map(location), ...categoryLocations, ...productLocations];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`),
    "</urlset>",
    "",
  ].join("\n");
}

export function createSitemapResponse(catalog: Pick<CatalogData, "categories" | "products">): Response {
  return new Response(buildSitemapXml(catalog), {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
