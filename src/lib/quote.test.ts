import { describe, expect, it } from "vitest";
import { buildQuoteMessage } from "./quote";

describe("buildQuoteMessage", () => {
  it("lists every product with its quantity and the contact fields", () => {
    const msg = buildQuoteMessage(
      [
        { slug: "a", name: "Caixa para hambúrguer", quantity: "500 unidades" },
        { slug: "b", name: "Papel toalha interfolha", quantity: "10 pacotes" },
      ],
      { nome: "Ana", empresa: "Burger X", cidade: "Santos" },
    );
    expect(msg).toContain("Produto: Caixa para hambúrguer\nQuantidade: 500 unidades");
    expect(msg).toContain("Produto: Papel toalha interfolha\nQuantidade: 10 pacotes");
    expect(msg).toContain("Empresa: Burger X");
  });
});
