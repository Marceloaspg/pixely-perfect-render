import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { categoryDataSchema, type CatalogData } from "@/data/catalog";
import { CategoriesPage } from "./CategoriesPage";

const categoryPageMocks = vi.hoisted(() => ({
  catalog: null as unknown as CatalogData,
}));

vi.mock("@/lib/catalog-context", () => ({
  useCatalog: () => categoryPageMocks.catalog,
}));

vi.mock("@tanstack/react-router", () => ({
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

vi.mock("@/components/site/Layout", () => ({
  PageHero: ({ title, text }: { title: string; text: string }) => (
    <header>
      <h1>{title}</h1>
      <p>{text}</p>
    </header>
  ),
}));

function category(slug: string, name: string, order: number, options: { active?: boolean; imagePath?: string; imageKey?: string; description?: string } = {}) {
  return {
    ...categoryDataSchema.parse({
      name,
      order,
      description: options.description ?? "",
      imagePath: options.imagePath ?? "",
      imageKey: options.imageKey ?? "burger",
    }),
    slug,
    active: options.active ?? true,
    image: options.imagePath ? `/signed/${slug}.webp` : options.imageKey && options.imageKey !== "burger" ? `/assets/${options.imageKey}.jpg` : "",
  };
}

function setCatalog(categories: CatalogData["categories"]) {
  categoryPageMocks.catalog = {
    categories,
    products: [],
    config: { whatsapp: "5519996145193", email: "", instagram: "", facebook: "" },
  };
}

describe("categories page", () => {
  afterEach(cleanup);

  it("shows active categories in catalog order with links to their public detail routes", () => {
    setCatalog([
      category("primeira", "Primeira categoria", 0, { imagePath: "categories/primeira.webp" }),
      category("inativa", "Categoria inativa", 1, { active: false }),
      category("segunda", "Segunda categoria", 2, { description: "Descrição da segunda categoria." }),
    ]);
    render(<CategoriesPage />);

    expect(screen.getByRole("heading", { name: "Explore nossas categorias" })).toBeInTheDocument();
    expect(screen.getByText("Encontre a embalagem ideal para o seu negócio.")).toBeInTheDocument();
    const list = screen.getByRole("region", { name: "Categorias de embalagens" });
    const cards = within(list).getAllByRole("link");
    expect(cards.map(card => card.getAttribute("aria-label"))).toEqual(["Ver categoria Primeira categoria", "Ver categoria Segunda categoria"]);
    expect(cards[0]).toHaveAttribute("href", "/categorias/primeira");
    expect(cards[1]).toHaveAttribute("href", "/categorias/segunda");
    expect(within(cards[0]!).getByText("Ver produtos")).toBeInTheDocument();
    expect(within(cards[1]!).getByText("Ver produtos")).toBeInTheDocument();
    expect(within(cards[1]!).getByText("Descrição da segunda categoria.")).toBeInTheDocument();
    expect(cards[0]).toHaveClass("flex", "h-full", "flex-col");
    expect(cards[1]).toHaveClass("flex", "h-full", "flex-col");
    expect(within(cards[0]!).getByText("Ver produtos")).toHaveClass("mt-auto");
    expect(within(cards[1]!).getByText("Ver produtos")).toHaveClass("mt-auto");
    expect(within(list).queryByText("Categoria inativa")).not.toBeInTheDocument();
    expect(cards[0]!.querySelector("img")).toHaveAttribute("src", "/signed/primeira.webp");
    expect(cards[1]!.querySelector("img")).toBeNull();
    expect(cards[1]).toHaveAttribute("aria-label", "Ver categoria Segunda categoria");
  });

  it("shows a neutral package icon when the category has no assigned image", () => {
    setCatalog([category("caixas", "Caixas", 0)]);
    render(<CategoriesPage />);
    const card = screen.getByRole("link", { name: "Ver categoria Caixas" });
    expect(card.querySelector("img")).toBeNull();
    expect(card.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the responsive grid and links product actions to each category route", () => {
    setCatalog([category("caixas", "Caixas", 0, { description: "Embalagens para seus produtos." })]);
    render(<CategoriesPage />);
    const list = screen.getByRole("region", { name: "Categorias de embalagens" }).querySelector("ul");
    expect(list).toHaveClass("grid-cols-1", "sm:grid-cols-2", "lg:grid-cols-3");
    expect(screen.getByRole("link", { name: "Ver categoria Caixas" })).toHaveAttribute("href", "/categorias/caixas");
  });

  it("shows a friendly empty state when no categories are active", () => {
    setCatalog([category("inativa", "Categoria inativa", 0, { active: false })]);
    render(<CategoriesPage />);
    expect(screen.getByText(/não há categorias disponíveis/i)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Categorias de embalagens" })).not.toBeInTheDocument();
  });
});
