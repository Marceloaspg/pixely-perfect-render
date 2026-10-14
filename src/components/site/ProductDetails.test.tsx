import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { categoryDataSchema, productDataSchema, type Category, type Product } from "@/data/catalog";
import { Route } from "@/routes/produtos.$slug";

const productPageMocks = vi.hoisted(() => ({
  loaderData: null as unknown as { product: Product; category: Category },
  add: vi.fn(),
  has: vi.fn(() => false),
  quoteItems: [{ slug: "produto-preexistente" }],
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    options,
    useLoaderData: () => productPageMocks.loaderData,
  }),
  Link: ({
    to,
    params,
    children,
    onClick,
    ...props
  }: {
    to: string;
    params?: { slug: string };
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
    [key: string]: unknown;
  }) => (
    <a
      href={params ? to.replace("$slug", params.slug) : to}
      onClick={event => {
        onClick?.(event);
        event.preventDefault();
      }}
      {...props}
    >
      {children}
    </a>
  ),
  notFound: () => {
    throw new Error("Route not found");
  },
}));

vi.mock("@/lib/quote", () => ({
  useQuote: () => ({
    add: productPageMocks.add,
    has: productPageMocks.has,
    items: productPageMocks.quoteItems,
  }),
}));

describe("product details actions", () => {
  beforeEach(() => {
    productPageMocks.loaderData = {
      product: {
        ...productDataSchema.parse({
          name: "Caixa para delivery",
          description: "Embalagem resistente",
          imagePath: "catalog/caixa.webp",
          variations: [],
        }),
        slug: "caixa",
        category: "caixas",
        image: "/signed/caixa.webp",
        additionalImages: [],
        active: true,
      },
      category: {
        ...categoryDataSchema.parse({ name: "Caixas" }),
        slug: "caixas",
        image: "/signed/categoria.webp",
        active: true,
      },
    };
    productPageMocks.add.mockClear();
    productPageMocks.has.mockReset().mockReturnValue(false);
  });

  afterEach(cleanup);

  it("gives both primary actions equal dimensions and links back to products without clearing the quote", () => {
    const productPage = Route.options.component;
    if (!productPage) throw new Error("Product route component is not configured.");
    render(createElement(productPage));

    const quoteButton = screen.getByRole("button", { name: "Solicitar cotação" });
    const quoteListLink = screen.getByRole("link", { name: "Ver lista de orçamento" });
    expect(quoteButton).toHaveClass("h-12", "w-full", "rounded-full", "text-sm");
    expect(quoteListLink).toHaveAttribute("href", "/orcamento");
    expect(quoteListLink).toHaveClass("h-12", "w-full", "rounded-full", "text-sm");

    const continueLink = screen.getByRole("link", { name: "Continuar comprando" });
    expect(continueLink).toHaveAttribute("href", "/produtos");
    fireEvent.click(continueLink);
    expect(productPageMocks.quoteItems).toEqual([{ slug: "produto-preexistente" }]);
    expect(productPageMocks.add).not.toHaveBeenCalled();
  });

  it("keeps the complete product description available on the detail page", () => {
    const productPage = Route.options.component;
    if (!productPage) throw new Error("Product route component is not configured.");
    render(createElement(productPage));
    expect(screen.getByText("Embalagem resistente")).toBeInTheDocument();
  });
});
