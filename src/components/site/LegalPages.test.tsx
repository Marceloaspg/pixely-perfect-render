import { cleanup, render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Route as PrivacyRoute } from "@/routes/privacidade";
import { Route as TermsRoute } from "@/routes/termos";

const legalPageMocks = vi.hoisted(() => ({
  config: {
    whatsapp: "5519996145193",
    email: "comercial@example.com",
    instagram: "",
    facebook: "",
  },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));

vi.mock("@/lib/catalog-context", () => ({
  useCatalog: () => ({ config: legalPageMocks.config }),
}));

vi.mock("@/components/site/Layout", () => ({
  PageHero: ({ title }: { title: string }) => (
    <header>
      <h1>{title}</h1>
    </header>
  ),
}));

describe("legal pages", () => {
  afterEach(cleanup);

  it("identifies the company in the privacy policy and preserves the existing practices and rights channel", () => {
    const component = PrivacyRoute.options.component;
    if (!component) throw new Error("Privacy route component is not configured.");
    render(createElement(component));

    expect(screen.getByText(/69\.795\.523 THAYSA SILVA VARELA DE VASCONCELOS/)).toBeInTheDocument();
    expect(screen.getByText(/CNPJ sob o nº 69\.795\.523\/0001-78/)).toBeInTheDocument();
    expect(screen.getByText(/Rua João Vieira, nº 12, Chácara São João, Amparo\/SP, CEP 13905-713/)).toBeInTheDocument();
    expect(screen.queryByText(/ainda sem CNPJ|Marcelo Afonso da Silva/)).not.toBeInTheDocument();
    expect(screen.getByText(/Cloudflare Turnstile/)).toBeInTheDocument();
    expect(
      screen.getByText(/revisará manualmente os registros de orçamento a cada três meses/),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "marceloacessft@gmail.com" })[0]).toHaveAttribute(
      "href",
      "mailto:marceloacessft@gmail.com",
    );
  });

  it("explains confirmed commercial conditions and uses configured contact channels", () => {
    const component = TermsRoute.options.component;
    if (!component) throw new Error("Terms route component is not configured.");
    render(createElement(component));

    const article = screen.getByRole("article");
    expect(within(article).getByText(/não conclui uma compra/)).toBeInTheDocument();
    expect(
      within(article).getByText(/Preços, disponibilidade, frete, condições de entrega/),
    ).toBeInTheDocument();
    expect(within(article).getByText(/entregas grátis para pedidos elegíveis/)).toBeInTheDocument();
    expect(within(article).getByText(/elegibilidade será informada no orçamento antes da confirmação da compra/)).toBeInTheDocument();
    expect(within(article).getByText(/desconto de 5% sobre o valor dos produtos, válido para todos os produtos e sem valor mínimo/)).toBeInTheDocument();
    expect(within(article).getByText(/O desconto não é declarado para frete ou outros serviços/)).toBeInTheDocument();
    expect(within(article).getByText(/parcelar em até 3 vezes sem juros, sem valor mínimo de compra/)).toBeInTheDocument();
    expect(within(article).getByText(/forma de pagamento e as opções de parcelamento devem ser confirmadas no atendimento/)).toBeInTheDocument();
    expect(within(article).queryByText(/pendente de revisão|compras acima de R\$ ?200/)).not.toBeInTheDocument();
    expect(within(article).getByText(/Rua João Vieira, nº 12, Chácara São João, Amparo\/SP, CEP 13905-713/)).toBeInTheDocument();
    expect(within(article).getByRole("link", { name: "WhatsApp comercial" })).toHaveAttribute(
      "href",
      expect.stringContaining("https://wa.me/5519996145193"),
    );
    expect(within(article).getByRole("link", { name: "comercial@example.com" })).toHaveAttribute(
      "href",
      "mailto:comercial@example.com",
    );
    expect(within(article).getByRole("link", { name: "Política de Privacidade" })).toHaveAttribute(
      "href",
      "/privacidade",
    );
  });
});
