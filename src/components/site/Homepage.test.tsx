import { cleanup, render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { categoryDataSchema, type CatalogData } from "@/data/catalog";
import { Route } from "@/routes/index";

const homepageMocks = vi.hoisted(() => ({
  catalog: null as unknown as CatalogData,
}));

vi.mock("@/lib/catalog-context", () => ({
  useCatalog: () => homepageMocks.catalog,
}));

vi.mock("@/components/site/FeaturedProductsCarousel", () => ({
  FeaturedProductsCarousel: () => null,
}));

vi.mock("@/components/site/HomepageCarousel", () => ({
  HomepageCarousel: () => null,
}));

vi.mock("@/components/site/HomepageHeroCarousel", () => ({
  HomepageHeroCarousel: () => (
    <section>
      <h1 className="text-center md:text-left">
        Embalagens que valorizam seu produto e fortalecem seu negócio.
      </h1>
      <div className="flex flex-wrap justify-center gap-3 md:justify-start">
        <a href="/produtos">Conheça nossos produtos</a>
        <a href="/orcamento">Solicitar orçamento</a>
      </div>
    </section>
  ),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  Link: ({
    to,
    params,
    children,
    ...props
  }: {
    to: string;
    params?: { slug: string };
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={params ? to.replace("$slug", params.slug) : to} {...props}>
      {children}
    </a>
  ),
}));

function category(slug: string, name: string, active: boolean) {
  return {
    ...categoryDataSchema.parse({ name }),
    slug,
    active,
    image: `/assets/${slug}.jpg`,
  };
}

describe("homepage presentation", () => {
  afterEach(cleanup);

  it("shows only active categories and centers mobile hero, catalog, and benefit content", () => {
    homepageMocks.catalog = {
      categories: [
        category("caixas", "Caixas", true),
        category("oculta", "Categoria inativa", false),
      ],
      products: [],
      config: { whatsapp: "5519996145193", email: "", instagram: "", facebook: "" },
    };
    const homepage = Route.options.component;
    if (!homepage) throw new Error("Homepage route component is not configured.");
    const { container } = render(createElement(homepage));

    expect(screen.getByRole("heading", { name: /Embalagens que valorizam seu produto/ })).toHaveClass(
      "text-center",
      "md:text-left",
    );
    expect(screen.getByRole("link", { name: /Conheça nossos produtos/ }).parentElement).toHaveClass(
      "justify-center",
      "md:justify-start",
    );
    expect(screen.getByRole("heading", { name: "Encontre a embalagem ideal para o seu negócio." })).toHaveClass(
      "text-center",
      "md:text-left",
    );
    const cards = container.querySelectorAll('a[href^="/categorias/"]');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveAttribute("href", "/categorias/caixas");
    expect(within(container).queryByText("Categoria inativa")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Variedade de soluções" }).parentElement).toHaveClass(
      "items-center",
      "text-center",
      "md:items-start",
      "md:text-left",
    );
    expect(screen.queryByText("Para diversos segmentos")).not.toBeInTheDocument();
  });
});
