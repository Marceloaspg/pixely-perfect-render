import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { productDataSchema, type Product } from "@/data/catalog";
import { QuotePage } from "@/routes/orcamento";

const quotePageMocks = vi.hoisted(() => ({
  items: [
    {
      id: "caixa-grande",
      slug: "caixa",
      name: "Caixa para delivery",
      quantity: "12",
      variationId: "variation:grande",
      variation: "Grande",
      sku: "CX-001",
      material: "Papel kraft",
    },
  ],
  remove: vi.fn(),
  setQty: vi.fn(),
  setVariation: vi.fn(),
  register: vi.fn(
    async (_input: {
      data: {
        requestKey: string;
        contact: Record<string, string>;
        items: Array<{ slug: string; variation?: string; quantity: string }>;
        turnstileToken: string;
      };
    }) => ({ id: "6d5f02e1-68cf-4622-a998-142a81bfbc20" }),
  ),
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
      onClick={(event) => {
        onClick?.(event);
        event.preventDefault();
      }}
      {...props}
    >
      {children}
    </a>
  ),
}));

vi.mock("@tanstack/react-start", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-start")>("@tanstack/react-start");
  return { ...actual, useServerFn: () => quotePageMocks.register };
});

vi.mock("@/components/site/CloudflareTurnstile", () => ({
  CloudflareTurnstile: ({ onToken }: { onToken: (token: string) => void }) => (
    <button type="button" onClick={() => onToken("test-turnstile-token")}>
      Concluir verificação antispam
    </button>
  ),
}));

vi.mock("@/lib/catalog-context", () => ({
  useCatalog: () => ({
    products: [
      {
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
      } satisfies Product,
    ],
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
    quotePageMocks.register
      .mockClear()
      .mockResolvedValue({ id: "6d5f02e1-68cf-4622-a998-142a81bfbc20" });
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("majesta-orcamento", JSON.stringify(quotePageMocks.items));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it.each([320, 375, 390])(
    "keeps both buttons within the available width at %i px and preserves the quote",
    (width) => {
      window.innerWidth = width;
      render(<QuotePage />);

      expect(
        screen.getByRole("combobox", { name: "Tamanho ou modelo de Caixa para delivery" }),
      ).toHaveValue("Grande");
      expect(
        screen.getByRole("textbox", { name: "Quantidade de Caixa para delivery Grande" }),
      ).toHaveValue("12");
      const continueLink = screen.getByRole("link", { name: "Continuar comprando" });
      const buttons = [continueLink, screen.getByRole("button", { name: "Registrar orçamento" })];
      expect(continueLink).toHaveAttribute("href", "/produtos");
      expect(continueLink.parentElement).toHaveClass(
        "grid-cols-1",
        "sm:grid-cols-2",
        "lg:grid-cols-1",
      );
      for (const button of buttons) {
        expect(button).toHaveClass("w-full", "min-w-0", "max-w-full", "whitespace-normal");
        expect(button).toHaveClass("h-12");
      }

      fireEvent.click(continueLink);

      expect(JSON.parse(localStorage.getItem("majesta-orcamento") ?? "[]")).toEqual(
        quotePageMocks.items,
      );
      expect(quotePageMocks.remove).not.toHaveBeenCalled();
      expect(quotePageMocks.items[0]).toMatchObject({
        quantity: "12",
        variation: "Grande",
        variationId: "variation:grande",
      });
    },
  );

  it("registers first and opens the prepared WhatsApp message only after a separate user action", async () => {
    render(<QuotePage />);
    vi.spyOn(window, "open").mockReturnValue(null);
    const originalLocation = window.location.href;

    fireEvent.click(screen.getByRole("button", { name: "Concluir verificação antispam" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nome" }), {
      target: { value: "Ana Costa" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Cidade" }), {
      target: { value: "Campinas" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "WhatsApp para contato" }), {
      target: { value: "(19) 99999-1234" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Observações" }), {
      target: { value: "Entrega em horário comercial." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar orçamento" }));
    await screen.findByRole("button", { name: "Abrir conversa no WhatsApp" });

    expect(quotePageMocks.register).toHaveBeenCalledOnce();
    const submitted = quotePageMocks.register.mock.calls[0]![0].data;
    expect(submitted.contact).toMatchObject({
      nome: "Ana Costa",
      cidade: "Campinas",
      whatsapp: "(19) 99999-1234",
    });
    expect(submitted.items).toEqual([{ slug: "caixa", variation: "Grande", quantity: "12" }]);
    expect(submitted.turnstileToken).toBe("test-turnstile-token");
    expect(window.open).not.toHaveBeenCalled();

    expect(screen.getByText("Identificador do orçamento:").parentElement).toHaveTextContent(
      "6d5f02e1-68cf-4622-a998-142a81bfbc20",
    );
    fireEvent.click(screen.getByRole("button", { name: "Abrir conversa no WhatsApp" }));

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
    expect(JSON.parse(localStorage.getItem("majesta-orcamento") ?? "[]")).toEqual(
      quotePageMocks.items,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/não envia uma mensagem automaticamente/i);
  });

  it("offers a direct WhatsApp request without personal fields or database registration", () => {
    render(<QuotePage />);
    vi.spyOn(window, "open").mockReturnValue(null);
    const originalLocation = window.location.href;

    fireEvent.click(screen.getByRole("button", { name: "Solicitar orçamento pelo WhatsApp" }));

    expect(quotePageMocks.register).not.toHaveBeenCalled();
    expect(window.open).toHaveBeenCalledOnce();
    const [url, target, features] = vi.mocked(window.open).mock.calls[0]!;
    expect(target).toBe("_blank");
    expect(features).toContain("noopener");
    expect(features).toContain("noreferrer");
    if (!url) throw new Error("WhatsApp link was not opened.");
    const message = new URL(url).searchParams.get("text") ?? "";
    expect(message).toContain("CX-001");
    expect(message).toContain("Grande");
    expect(message).toContain("Papel kraft");
    expect(message).toContain("Quantidade: *12");
    expect(message).not.toContain("Observações:");
    expect(message).not.toContain("Ana Costa");
    expect(message).not.toMatch(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/u);
    expect(window.location.href).toBe(originalLocation);
    expect(JSON.parse(localStorage.getItem("majesta-orcamento") ?? "[]")).toEqual(
      quotePageMocks.items,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/não foi registrada no painel/i);
  });

  it("offers direct WhatsApp after a disabled registration attempt without claiming it was saved", async () => {
    quotePageMocks.register.mockRejectedValueOnce(new Error("registration disabled"));
    render(<QuotePage />);
    vi.spyOn(window, "open").mockReturnValue(null);

    fireEvent.click(screen.getByRole("button", { name: "Concluir verificação antispam" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nome" }), {
      target: { value: "Ana Costa" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Cidade" }), {
      target: { value: "Campinas" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "WhatsApp para contato" }), {
      target: { value: "(19) 99999-1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar orçamento" }));
    await screen.findByRole("alert");

    expect(screen.getByRole("alert")).toHaveTextContent(/não foi possível salvar/i);
    expect(screen.queryByText("Identificador do orçamento:")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Solicitar orçamento pelo WhatsApp" }));

    expect(quotePageMocks.register).toHaveBeenCalledOnce();
    expect(window.open).toHaveBeenCalledOnce();
    const url = vi.mocked(window.open).mock.calls[0]![0];
    if (!url) throw new Error("WhatsApp link was not opened.");
    const message = new URL(url).searchParams.get("text") ?? "";
    expect(message).toContain("CX-001");
    expect(message).toContain("Quantidade: *12");
    expect(message).not.toContain("Ana Costa");
    expect(screen.getByRole("status")).toHaveTextContent(/não foi registrada no painel/i);
  });

  it("keeps the same idempotency key when the customer retries a failed registration", async () => {
    quotePageMocks.register
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce({ id: "6d5f02e1-68cf-4622-a998-142a81bfbc20" });
    render(<QuotePage />);

    fireEvent.click(screen.getByRole("button", { name: "Concluir verificação antispam" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nome" }), {
      target: { value: "Ana Costa" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Cidade" }), {
      target: { value: "Campinas" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "WhatsApp para contato" }), {
      target: { value: "(19) 99999-1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registrar orçamento" }));
    await screen.findByRole("alert");
    const firstRequestKey = quotePageMocks.register.mock.calls[0]![0].data.requestKey;

    fireEvent.click(screen.getByRole("button", { name: "Concluir verificação antispam" }));
    fireEvent.click(screen.getByRole("button", { name: "Tentar registrar novamente" }));
    await screen.findByRole("button", { name: "Abrir conversa no WhatsApp" });

    expect(quotePageMocks.register).toHaveBeenCalledTimes(2);
    expect(quotePageMocks.register.mock.calls[1]![0].data.requestKey).toBe(firstRequestKey);
  });
});
