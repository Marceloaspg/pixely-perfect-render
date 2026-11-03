import { describe, expect, it } from "vitest";
import { siteConfig, whatsappLink } from "./config";

describe("public contact defaults", () => {
  it("uses the official corporate email and preserves WhatsApp URL encoding", () => {
    expect(siteConfig.email).toBe("contato@majestaembalagens.com.br");
    const url = whatsappLink("Olá! Quero informações & orçamento.", "5519996145193");
    expect(url).toBe(
      "https://wa.me/5519996145193?text=Ol%C3%A1!%20Quero%20informa%C3%A7%C3%B5es%20%26%20or%C3%A7amento.",
    );
  });
});
