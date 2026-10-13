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
    expect(msg).toContain("1. Caixa para hambúrguer");
    expect(msg).toContain("Embalagens solicitadas: 500 unidades");
    expect(msg).toContain("2. Papel toalha interfolha");
    expect(msg).toContain("Embalagens solicitadas: 10 pacotes");
    expect(msg).toContain("Empresa: Burger X");
  });
});
