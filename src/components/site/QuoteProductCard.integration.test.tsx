import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { productDataSchema, type Product } from "@/data/catalog";
import { Header, ProductCard } from "./Layout";
import { QuoteProvider, useQuote } from "@/lib/quote";

const quoteProviderMocks = vi.hoisted(() => ({
  products: [] as Product[],
  config: {
    whatsapp: "5519996145193",
    email: "",
    instagram: "",
    facebook: "",
  },
}));

vi.mock("@/lib/catalog-context", () => ({
  useCatalog: () => quoteProviderMocks,
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
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
    <a href={params ? to.replace("$slug", params.slug) : to} {...Object.fromEntries(
      Object.entries(props).filter(([key]) => key !== "activeOptions"),
    )}>
      {children}
    </a>
  ),
}));

function QuoteCount() {
  const { items } = useQuote();
  return <output aria-label="Produtos no orçamento">{items.length}</output>;
}

describe("product card and quote provider integration", () => {
  it("adds an unambiguous SKU/model once, updates the header count and persists all quote fields", async () => {
    const product: Product = {
      ...productDataSchema.parse({
        name: "Caixa para delivery",
        description: "Embalagem resistente.",
        sku: "CX-001",
        material: "Papel kraft",
        dimensions: { length: "20", width: "15", height: "10", unit: "cm" },
        variations: ["Grande"],
        packageQuantity: 100,
        packageType: "caixa",
        packUnit: "100 unidades",
      }),
      slug: "caixa-delivery",
      category: "embalagens",
      active: true,
      image: "/caixa.webp",
      additionalImages: [],
    };
    quoteProviderMocks.products = [product];
    localStorage.clear();

    render(
      <QuoteProvider>
        <Header />
        <QuoteCount />
        <ProductCard p={product} />
      </QuoteProvider>,
    );

    const addButton = screen.getByRole("button", { name: "Solicitar cotação de Caixa para delivery" });
    fireEvent.click(addButton);
    await waitFor(() => expect(screen.getByLabelText("Produtos no orçamento")).toHaveTextContent("1"));
    expect(screen.getByRole("link", { name: "Solicitar orçamento, 1 produto" })).toBeInTheDocument();
    const addedButton = await screen.findByRole("button", {
      name: "Adicionado ao orçamento de Caixa para delivery",
    });
    expect(addedButton).toBeDisabled();
    expect(within(screen.getByRole("article")).queryByRole("status")).not.toBeInTheDocument();

    fireEvent.click(addedButton);
    expect(screen.getByLabelText("Produtos no orçamento")).toHaveTextContent("1");
    expect(screen.queryByText("Já está no orçamento")).not.toBeInTheDocument();

    await waitFor(() => {
      const storedItems = JSON.parse(localStorage.getItem("majesta-orcamento") ?? "[]") as Array<
        Record<string, unknown>
      >;
      expect(storedItems).toHaveLength(1);
      expect(storedItems[0]).toMatchObject({
        slug: "caixa-delivery",
        name: "Caixa para delivery",
        quantity: "",
        variation: "Grande",
        sku: "CX-001",
        material: "Papel kraft",
        dimensions: "20 × 15 × 10 cm",
        packageQuantity: 100,
        packageType: "caixa",
        packUnit: "100 unidades",
      });
    });
  });

  it("shows the added button state for an item loaded from persisted quote storage", async () => {
    const product: Product = {
      ...productDataSchema.parse({
        name: "Saco kraft unitário",
        description: "Produto cadastrado sem variações.",
        sku: "SK-002",
      }),
      slug: "saco-kraft-unitario",
      category: "embalagens",
      active: true,
      image: "/saco.webp",
      additionalImages: [],
    };
    quoteProviderMocks.products = [product];
    localStorage.setItem(
      "majesta-orcamento",
      JSON.stringify([
        { id: "saved-quote-item", slug: product.slug, name: product.name, quantity: "10", sku: product.sku },
      ]),
    );

    render(
      <QuoteProvider>
        <ProductCard p={product} />
      </QuoteProvider>,
    );

    const button = await screen.findByRole("button", {
      name: "Adicionado ao orçamento de Saco kraft unitário",
    });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
