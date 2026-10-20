import { describe, expect, it, vi } from "vitest";
import {
  moveProductInOrder,
  persistAdminProductOrder,
  sortCatalogProducts,
} from "./catalog-product-order";

describe("administrative product order", () => {
  it("uses the separate order only for administration, preserving the public catalog order", () => {
    const products = [
      { slug: "box-a", order: 1 },
      { slug: "box-b", order: 0 },
      { slug: "box-c", order: 2 },
    ];
    const adminOrder = new Map([
      ["box-a", 2],
      ["box-b", 0],
      ["box-c", 1],
    ]);

    expect(sortCatalogProducts(products, adminOrder, false).map((product) => product.slug)).toEqual([
      "box-b",
      "box-a",
      "box-c",
    ]);
    expect(sortCatalogProducts(products, adminOrder, true).map((product) => product.slug)).toEqual([
      "box-b",
      "box-c",
      "box-a",
    ]);
  });

  it("moves products without losing or duplicating their slugs", () => {
    const initial = ["first", "second", "third"];

    expect(moveProductInOrder(initial, "third", "first")).toEqual([
      "third",
      "first",
      "second",
    ]);
    expect(initial).toEqual(["first", "second", "third"]);
    expect(moveProductInOrder(initial, "missing", "first")).toEqual(initial);
  });

  it("verifies administrator permission before persisting the order", async () => {
    const persist = vi.fn().mockResolvedValue({ error: null });
    const denied = new Error("admin permission denied");

    await expect(
      persistAdminProductOrder(
        ["one", "two"],
        async () => {
          throw denied;
        },
        persist,
      ),
    ).rejects.toBe(denied);
    expect(persist).not.toHaveBeenCalled();
  });

  it("persists only unique orders and reports database failures", async () => {
    const verify = vi.fn().mockResolvedValue(undefined);
    const persist = vi.fn().mockResolvedValue({ error: null });

    await persistAdminProductOrder(["one", "two"], verify, persist);
    expect(verify).toHaveBeenCalledOnce();
    expect(persist).toHaveBeenCalledOnce();

    persist.mockClear();
    await expect(
      persistAdminProductOrder(["one", "one"], verify, persist),
    ).rejects.toThrow("produtos duplicados");
    expect(persist).not.toHaveBeenCalled();

    persist.mockResolvedValueOnce({ error: new Error("database unavailable") });
    await expect(
      persistAdminProductOrder(["one"], verify, persist),
    ).rejects.toThrow("Não foi possível salvar a ordem");
  });
});
