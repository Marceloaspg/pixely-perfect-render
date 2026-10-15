import { describe, expect, it, vi } from "vitest";
import { withQuoteRegistrationEnabled } from "./quote-registration-gate";

describe("quote registration feature flag", () => {
  it.each([undefined, "", "false", "TRUE", "1", " true "])(
    "blocks registration and all downstream database effects when flag is %s",
    async (enabled) => {
      const databaseEffects = {
        selectPersonalData: vi.fn(),
        consumeRateLimit: vi.fn(),
        insertRequest: vi.fn(),
      };
      const register = vi.fn(async () => {
        databaseEffects.selectPersonalData();
        databaseEffects.consumeRateLimit();
        databaseEffects.insertRequest();
      });

      await expect(withQuoteRegistrationEnabled(enabled, register)).rejects.toThrow(
        "O registro de orçamentos está temporariamente desativado.",
      );
      expect(register).not.toHaveBeenCalled();
      expect(databaseEffects.selectPersonalData).not.toHaveBeenCalled();
      expect(databaseEffects.consumeRateLimit).not.toHaveBeenCalled();
      expect(databaseEffects.insertRequest).not.toHaveBeenCalled();
    },
  );

  it("runs registration only when the server flag is exactly true", async () => {
    const register = vi.fn(async () => "created");

    await expect(withQuoteRegistrationEnabled("true", register)).resolves.toBe("created");
    expect(register).toHaveBeenCalledOnce();
  });
});
