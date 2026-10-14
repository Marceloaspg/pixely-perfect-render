import { describe, expect, it } from "vitest";
import { buildQuoteMessage } from "./quote";

describe("buildQuoteMessage", () => {
  it("lists numbered products and quantities without including personal contact details", () => {
    const msg = buildQuoteMessage(
      [
        { slug: "a", name: "Caixa para hambúrguer", quantity: "500", packageType: "caixa" },
        { slug: "b", name: "Papel toalha interfolha", quantity: "10", packageType: "pacote" },
      ],
      { nome: "Ana", empresa: "Burger X", cidade: "Santos", email: "ana@example.com" },
    );
    expect(msg).toContain("*01. Caixa para hambúrguer*");
    expect(msg).toContain("Quantidade: *500 caixas*");
    expect(msg).toContain("*02. Papel toalha interfolha*");
    expect(msg).toContain("Quantidade: *10 pacotes*");
    expect(msg).toContain("Produtos diferentes: *2*");
    expect(msg.match(/(?:[#*0-9]\uFE0F?\u20E3)|[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Regional_Indicator}\uFE0F\u20E3\u200D\u{1F3FB}-\u{1F3FF}]/gu)).toBeNull();
    expect(msg).not.toContain("\uFFFD");
    expect(msg).not.toContain("Ana");
    expect(msg).not.toContain("Burger X");
    expect(msg).not.toContain("Santos");
    expect(msg).not.toContain("ana@example.com");
  });
});
