import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { productDataSchema, type Product } from "@/data/catalog";
import type { RegisterQuoteRequestResult } from "@/lib/quote.functions";
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
    }): Promise<RegisterQuoteRequestResult> => ({
      ok: true,
      id: "6d5f02e1-68cf-4622-a998-142a81bfbc20",
    }),
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

function createPopup() {
  const replace = vi.fn();
  const close = vi.fn();
  const popup = {
    closed: false,
    opener: window,
    location: { replace },
    close,
  } as unknown as Window;
  return { popup, replace, close };
}

describe("quote page actions", () => {
  beforeEach(() => {
    quotePageMocks.remove.mockClear();
    quotePageMocks.setQty.mockClear();
    quotePageMocks.setVariation.mockClear();
    quotePageMocks.register
      .mockClear()
      .mockResolvedValue({ ok: true, id: "6d5f02e1-68cf-4622-a998-142a81bfbc20" });
    quotePageMocks.items[0]!.quantity = "12";
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
    "keeps the main action within the available width at %i px and preserves the quote",
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
      const buttons = [
        continueLink,
        screen.getByRole("button", { name: "Solicitar orçamento pelo WhatsApp" }),
      ];
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

  it("registers first and opens the WhatsApp tab only after confirmation from the server", async () => {
    render(<QuotePage />);
    const { popup, replace } = createPopup();
    vi.spyOn(window, "open").mockReturnValue(popup);
    const originalLocation = window.location.href;
    let confirmRegistration!: (result: { ok: true; id: string }) => void;
    quotePageMocks.register.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          confirmRegistration = resolve;
        }),
    );

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
    fireEvent.click(screen.getByRole("button", { name: "Solicitar orçamento pelo WhatsApp" }));

    expect(quotePageMocks.register).toHaveBeenCalledOnce();
    expect(window.open).toHaveBeenCalledWith("about:blank", "_blank");
    expect(replace).not.toHaveBeenCalled();
    const loadingButton = screen.getByRole("button", { name: "Registrando orçamento..." });
    expect(loadingButton).toBeDisabled();
    expect(loadingButton).toHaveAttribute("aria-busy", "true");
    expect(loadingButton.querySelector("svg")).toHaveClass("animate-spin");

    const submitted = quotePageMocks.register.mock.calls[0]![0].data;
    expect(submitted.contact).toMatchObject({
      nome: "Ana Costa",
      cidade: "Campinas",
      whatsapp: "(19) 99999-1234",
    });
    expect(submitted.items).toEqual([{ slug: "caixa", variation: "Grande", quantity: "12" }]);
    expect(submitted.turnstileToken).toBe("test-turnstile-token");
    await act(async () =>
      confirmRegistration({ ok: true, id: "6d5f02e1-68cf-4622-a998-142a81bfbc20" }),
    );

    expect(popup.opener).toBeNull();
    expect(replace).toHaveBeenCalledOnce();
    const [url] = replace.mock.calls[0]!;
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
    expect(screen.getByText("Identificador do orçamento:").parentElement).toHaveTextContent(
      "6d5f02e1-68cf-4622-a998-142a81bfbc20",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /nenhuma mensagem é enviada automaticamente/i,
    );
    expect(screen.queryByRole("button", { name: "Abrir WhatsApp" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Continuar pelo WhatsApp" }),
    ).not.toBeInTheDocument();
  });

  it("shows an explicit WhatsApp fallback when the browser blocks the reserved tab", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Solicitar orçamento pelo WhatsApp" }));

    await screen.findByRole("button", { name: "Abrir WhatsApp" });
    expect(quotePageMocks.register).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent(/não foi possível abrir a conversa/i);

    fireEvent.click(screen.getByRole("button", { name: "Abrir WhatsApp" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/continua registrado/i);
  });

  it("replaces the main action with a direct WhatsApp fallback only after explicit unavailability", async () => {
    quotePageMocks.register.mockResolvedValueOnce({ ok: false, reason: "unavailable" });
    const { popup, replace, close } = createPopup();
    render(<QuotePage />);
    vi.spyOn(window, "open").mockReturnValue(popup);

    const primaryButton = screen.getByRole("button", {
      name: "Solicitar orçamento pelo WhatsApp",
    });
    expect(
      screen.queryByRole("button", { name: "Continuar pelo WhatsApp" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Atendimento direto pelo WhatsApp (sem registro)" }),
    ).not.toBeInTheDocument();

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
    fireEvent.change(screen.getByRole("textbox", { name: "E-mail" }), {
      target: { value: "ana@example.com" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Observações" }), {
      target: { value: "Observação privada." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Solicitar orçamento pelo WhatsApp" }));
    const fallbackButton = await screen.findByRole("button", { name: "Continuar pelo WhatsApp" });

    expect(close).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByText("Identificador do orçamento:")).not.toBeInTheDocument();
    expect(quotePageMocks.register).toHaveBeenCalledOnce();
    expect(window.open).toHaveBeenCalledOnce();
    expect(fallbackButton).toBe(primaryButton);
    expect(fallbackButton).toHaveClass("h-12", "w-full", "rounded-full");
    expect(
      screen.getByText(
        /o registro não foi confirmado; a solicitação poderá não aparecer no painel/i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    const requestKey = sessionStorage.getItem("majesta-quote-request-key");
    expect(requestKey).toBeTruthy();

    fireEvent.click(fallbackButton);
    expect(quotePageMocks.register).toHaveBeenCalledOnce();
    expect(window.open).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenCalledOnce();
    const [url] = replace.mock.calls[0]!;
    const message = new URL(url).searchParams.get("text") ?? "";
    expect(message).toContain("CX-001");
    expect(message).toContain("Grande");
    expect(message).toContain("Quantidade: *12");
    expect(message).not.toContain("Ana Costa");
    expect(message).not.toContain("ana@example.com");
    expect(message).not.toContain("Observação privada.");
    expect(screen.getByRole("status")).toHaveTextContent(/poderá não aparecer no painel/i);
  });

  it("allows a registration retry from the unavailable state with the same request key", async () => {
    quotePageMocks.register
      .mockResolvedValueOnce({ ok: false, reason: "unavailable" })
      .mockResolvedValueOnce({ ok: true, id: "6d5f02e1-68cf-4622-a998-142a81bfbc20" });
    const { popup, replace } = createPopup();
    render(<QuotePage />);
    vi.spyOn(window, "open").mockReturnValue(popup);

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
    fireEvent.click(screen.getByRole("button", { name: "Solicitar orçamento pelo WhatsApp" }));
    await screen.findByRole("button", { name: "Continuar pelo WhatsApp" });
    const firstRequestKey = quotePageMocks.register.mock.calls[0]![0].data.requestKey;

    const retryButton = screen.getByRole("button", { name: "Tentar novamente" });
    expect(retryButton).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Concluir verificação antispam" }));
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByText("Identificador do orçamento:");

    expect(quotePageMocks.register).toHaveBeenCalledTimes(2);
    expect(quotePageMocks.register.mock.calls[1]![0].data.requestKey).toBe(firstRequestKey);
    expect(replace).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem("majesta-quote-request-key")).toBeNull();
  });

  it("does not offer WhatsApp fallback after a server-side Turnstile or rate-limit rejection", async () => {
    quotePageMocks.register.mockRejectedValueOnce(
      new Error("Muitas tentativas foram realizadas. Aguarde antes de enviar outra solicitação."),
    );
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
    fireEvent.click(screen.getByRole("button", { name: "Solicitar orçamento pelo WhatsApp" }));
    await screen.findByRole("alert");

    expect(screen.getByRole("alert")).not.toHaveTextContent(/Muitas tentativas/i);
    expect(
      screen.queryByRole("button", { name: "Continuar pelo WhatsApp" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar registrar novamente" })).toBeInTheDocument();
  });

  it("does not register without Turnstile or with an invalid quantity", () => {
    quotePageMocks.items[0]!.quantity = "0";
    render(<QuotePage />);
    const submitButton = screen.getByRole("button", {
      name: "Solicitar orçamento pelo WhatsApp",
    });
    expect(submitButton).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Nome" }), {
      target: { value: "Ana Costa" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Cidade" }), {
      target: { value: "Campinas" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "WhatsApp para contato" }), {
      target: { value: "(19) 99999-1234" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Concluir verificação antispam" }));
    expect(submitButton).toBeDisabled();
    expect(quotePageMocks.register).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Continuar pelo WhatsApp" }),
    ).not.toBeInTheDocument();
  });

  it("prevents duplicate registration while the first request is pending", async () => {
    render(<QuotePage />);
    let confirmRegistration!: (result: { ok: true; id: string }) => void;
    quotePageMocks.register.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          confirmRegistration = resolve;
        }),
    );
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

    const submitButton = screen.getByRole("button", {
      name: "Solicitar orçamento pelo WhatsApp",
    });
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);
    expect(quotePageMocks.register).toHaveBeenCalledOnce();

    await act(async () =>
      confirmRegistration({ ok: true, id: "6d5f02e1-68cf-4622-a998-142a81bfbc20" }),
    );
    expect(quotePageMocks.register).toHaveBeenCalledOnce();
  });

  it("keeps the same idempotency key when the customer retries a failed registration", async () => {
    quotePageMocks.register
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce({ ok: true, id: "6d5f02e1-68cf-4622-a998-142a81bfbc20" });
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
    fireEvent.click(screen.getByRole("button", { name: "Solicitar orçamento pelo WhatsApp" }));
    await screen.findByRole("alert");
    const firstRequestKey = quotePageMocks.register.mock.calls[0]![0].data.requestKey;
    expect(sessionStorage.getItem("majesta-quote-request-key")).toBe(firstRequestKey);
    expect(
      screen.queryByRole("button", { name: "Continuar pelo WhatsApp" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Concluir verificação antispam" }));
    fireEvent.click(screen.getByRole("button", { name: "Tentar registrar novamente" }));
    await screen.findByRole("button", { name: "Abrir WhatsApp" });

    expect(quotePageMocks.register).toHaveBeenCalledTimes(2);
    expect(quotePageMocks.register.mock.calls[1]![0].data.requestKey).toBe(firstRequestKey);
  });

  it("keeps the same idempotency key after a rejected Turnstile token and requests a new challenge", async () => {
    quotePageMocks.register
      .mockResolvedValueOnce({ ok: false, reason: "turnstile_rejected" })
      .mockResolvedValueOnce({ ok: true, id: "6d5f02e1-68cf-4622-a998-142a81bfbc20" });
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
    fireEvent.click(screen.getByRole("button", { name: "Solicitar orçamento pelo WhatsApp" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/verificação antispam não foi aceita/i);
    const firstRequestKey = quotePageMocks.register.mock.calls[0]![0].data.requestKey;
    expect(sessionStorage.getItem("majesta-quote-request-key")).toBe(firstRequestKey);

    fireEvent.click(screen.getByRole("button", { name: "Concluir verificação antispam" }));
    fireEvent.click(screen.getByRole("button", { name: "Tentar registrar novamente" }));
    await screen.findByRole("button", { name: "Abrir WhatsApp" });

    expect(quotePageMocks.register).toHaveBeenCalledTimes(2);
    expect(quotePageMocks.register.mock.calls[1]![0].data.requestKey).toBe(firstRequestKey);
  });
});
