import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { productDataSchema, type Product } from "@/data/catalog";
import { QuotePage } from "@/routes/orcamento";

const quotePageMocks = vi.hoisted(() => ({
  items: [{
    id: "caixa-grande",
    slug: "caixa",
    name: "Caixa para delivery",
    quantity: "12",
    variationId: "variation:grande",
    variation: "Grande",
    sku: "CX-001",
    material: "Papel kraft",
  }],
  remove: vi.fn(),
  setQty: vi.fn(),
  setVariation: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({
    to,
    children,
    onClick,
    ...props
  }: {
    to: string;
    children: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
    [key: string]: unknown;
  }) => (
    <a
      href={to}
      onClick={event => {
        onClick?.(event);
        event.preventDefault();
      }}
      {...props}
    >
      {children}
    </a>
  ),
}));

vi.mock("@/lib/catalog-context", () => ({
  useCatalog: () => ({
    products: [{
      ...productDataSchema.parse({
        name: "Caixa para delivery",
        description: "Caixa resistente",
        sku: "CX-001",
        material: "Papel kraft",
        variations: ["Pequena", "Grande"],
      }),
      slug: "caixa",
      category: "embalagens",
      image: "",
      additionalImages: [],
      active: true,
    } satisfies Product],
    config: { whatsapp: "5519996145193", email: "", instagram: "", facebook: "" },
  }),
}));

vi.mock("@/lib/quote", async () => {
  const actual = await vi.importActual<typeof import("@/lib/quote")>("@/lib/quote");
  return {
    ...actual,
    useQuote: () => ({
      items: quotePageMocks.items,
      remove: quotePageMocks.remove,
      setQty: quotePageMocks.setQty,
      setVariation: quotePageMocks.setVariation,
    }),
  };
});

vi.mock("@/components/site/Layout", () => ({
  PageHero: () => <header />,
}));

describe("quote page actions", () => {
  beforeEach(() => {
    quotePageMocks.remove.mockClear();
    quotePageMocks.setQty.mockClear();
    quotePageMocks.setVariation.mockClear();
    localStorage.clear();
    localStorage.setItem("majesta-orcamento", JSON.stringify(quotePageMocks.items));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it.each([320, 375, 390])("keeps both buttons within the available width at %i px and preserves the quote", width => {
    window.innerWidth = width;
    render(<QuotePage />);

    expect(screen.getByRole("combobox", { name: "Tamanho ou modelo de Caixa para delivery" })).toHaveValue("Grande");
    expect(screen.getByRole("textbox", { name: "Quantidade de Caixa para delivery Grande" })).toHaveValue("12");
    const continueLink = screen.getByRole("link", { name: "Continuar comprando" });
    const buttons = [
      continueLink,
      screen.getByRole("button", { name: "Continuar pelo WhatsApp" }),
    ];
    expect(continueLink).toHaveAttribute("href", "/produtos");
    expect(continueLink.parentElement).toHaveClass("grid-cols-1", "sm:grid-cols-2", "lg:grid-cols-1");
    for (const button of buttons) {
      expect(button).toHaveClass("w-full", "min-w-0", "max-w-full", "whitespace-normal");
      expect(button).toHaveClass("h-12");
    }

    fireEvent.click(continueLink);

    expect(JSON.parse(localStorage.getItem("majesta-orcamento") ?? "[]")).toEqual(quotePageMocks.items);
    expect(quotePageMocks.remove).not.toHaveBeenCalled();
    expect(quotePageMocks.items[0]).toMatchObject({ quantity: "12", variation: "Grande", variationId: "variation:grande" });
  });

  it("opens the configured WhatsApp message in a new tab while preserving the site and quote", () => {
    render(<QuotePage />);
    vi.spyOn(window, "open").mockReturnValue(null);
    const originalLocation = window.location.href;

    fireEvent.change(screen.getByRole("textbox", { name: "Nome" }), { target: { value: "Ana Costa" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Cidade" }), { target: { value: "Campinas" } });
    fireEvent.change(screen.getByRole("textbox", { name: "WhatsApp para contato" }), { target: { value: "(19) 99999-1234" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Observações" }), { target: { value: "Entrega em horário comercial." } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar pelo WhatsApp" }));

    expect(window.open).toHaveBeenCalledOnce();
    const [url, target, features] = vi.mocked(window.open).mock.calls[0]!;
    expect(target).toBe("_blank");
    expect(features).toContain("noopener");
    expect(features).toContain("noreferrer");
    expect(url).toBeDefined();
    if (!url) throw new Error("WhatsApp link was not opened.");
    expect(url).toContain("https://wa.me/5519996145193?text=");
    const message = new URL(url).searchParams.get("text") ?? "";
    expect(message).toContain("CX-001");
    expect(message).toContain("Grande");
    expect(message).toContain("Papel kraft");
    expect(message).toContain("Quantidade: *12");
    expect(message).toContain("Observações: Entrega em horário comercial.");
    expect(message).not.toMatch(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/u);
    expect(window.location.href).toBe(originalLocation);
    expect(JSON.parse(localStorage.getItem("majesta-orcamento") ?? "[]")).toEqual(quotePageMocks.items);
    expect(screen.getByRole("status")).toHaveTextContent(/confirme o envio/i);
  });
});
