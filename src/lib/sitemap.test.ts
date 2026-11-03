import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  categoryDataSchema,
  productDataSchema,
  type Category,
  type Product,
} from "@/data/catalog";
import { buildSitemapXml, createSitemapResponse, SITEMAP_ORIGIN } from "./sitemap";

function category(slug: string, active = true): Category {
  return {
    ...categoryDataSchema.parse({ name: `Categoria ${slug}` }),
    slug,
    image: "",
    active,
  };
}

function product(
  slug: string,
  categorySlug: string,
  options: { active?: boolean; demo?: boolean } = {},
): Product {
  return {
    ...productDataSchema.parse({ name: `Produto ${slug}`, description: "", demo: options.demo }),
    slug,
    category: categorySlug,
    image: "",
    additionalImages: [],
    active: options.active ?? true,
  };
}

describe("public sitemap", () => {
  it("generates valid XML using only canonical public static and dynamic URLs", () => {
    const xml = buildSitemapXml({
      categories: [category("caixas"), category("oculta", false)],
      products: [
        product("caixa-ativa", "caixas"),
        product("produto-inativo", "caixas", { active: false }),
        product("produto-demo", "caixas", { demo: true }),
        product("produto-categoria-oculta", "oculta"),
      ],
    });

    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toMatch(/<\/urlset>\s*$/);
    const parsedXml = new DOMParser().parseFromString(xml, "application/xml");
    expect(parsedXml.querySelector("parsererror")).toBeNull();
    expect(parsedXml.documentElement.tagName).toBe("urlset");
    expect(xml).toContain(`<loc>${SITEMAP_ORIGIN}/</loc>`);
    expect(xml).toContain(`<loc>${SITEMAP_ORIGIN}/categorias</loc>`);
    expect(xml).toContain(`<loc>${SITEMAP_ORIGIN}/produtos</loc>`);
    expect(xml).toContain(`<loc>${SITEMAP_ORIGIN}/privacidade</loc>`);
    expect(xml).toContain(`<loc>${SITEMAP_ORIGIN}/termos</loc>`);
    expect(xml).toContain(`<loc>${SITEMAP_ORIGIN}/categorias/caixas</loc>`);
    expect(xml).toContain(`<loc>${SITEMAP_ORIGIN}/produtos/caixa-ativa</loc>`);
    expect(xml).not.toContain("oculta");
    expect(xml).not.toContain("produto-inativo");
    expect(xml).not.toContain("produto-demo");
    expect(xml).not.toContain("/orcamento");
    expect(xml).not.toContain("/auth");
    expect(xml).not.toContain("/admin");
    expect(xml).not.toContain("/reset-password");
    expect(xml).not.toContain("lovable.app");
    expect(xml).not.toContain("lastmod");
  });

  it("omits slugs that do not match the public catalog route format", () => {
    const xml = buildSitemapXml({
      categories: [category("categoria/invalida")],
      products: [product("caixa&papel", "caixas")],
    });

    expect(xml).not.toContain("categoria%2Finvalida");
    expect(xml).not.toContain("caixa%26papel");
  });

  it("returns HTTP 200 with an XML content type", async () => {
    const response = createSitemapResponse({ categories: [], products: [] });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/xml; charset=utf-8");
    expect(await response.text()).toContain("<urlset");
  });

  it("preserves crawler rules and advertises the official sitemap in robots.txt", () => {
    const robots = readFileSync(resolve(process.cwd(), "public", "robots.txt"), "utf8").replace(
      /\r\n/g,
      "\n",
    );

    expect(robots).toContain("User-agent: Googlebot\nAllow: /");
    expect(robots).toContain("User-agent: *\nAllow: /");
    expect(robots).toContain(`Sitemap: ${SITEMAP_ORIGIN}/sitemap.xml`);
  });
});
