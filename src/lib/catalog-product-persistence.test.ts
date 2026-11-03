import { describe, expect, it, vi } from "vitest";
import {
  persistCatalogProduct,
  type CatalogProductFields,
  type CatalogProductWriteOperations,
  type NewCatalogProduct,
} from "./catalog-product-persistence";

function createProduct(slug: string, name: string, adminOrder = 0): NewCatalogProduct {
  return {
    slug,
    category: "embalagens-para-hamburguer",
    active: false,
    data: { name, description: "" },
    admin_order: adminOrder,
  };
}

function createInMemoryOperations(initial: NewCatalogProduct[] = []) {
  const products = new Map(initial.map((product) => [product.slug, product]));
  const operations: CatalogProductWriteOperations = {
    insert: vi.fn(async (product) => {
      if (products.has(product.slug)) return { error: { code: "23505" } };
      products.set(product.slug, product);
      return { error: null };
    }),
    update: vi.fn(async (originalSlug, fields) => {
      const current = products.get(originalSlug);
      if (!current) return { data: null, error: null };
      products.set(originalSlug, { ...current, ...fields });
      return { data: { slug: originalSlug }, error: null };
    }),
  };

  return { products, operations };
}

describe("persistCatalogProduct", () => {
  it("creates a product with an unused slug", async () => {
    const { products, operations } = createInMemoryOperations();
    const product = createProduct("caixa-nova", "Caixa nova", 3);

    await expect(
      persistCatalogProduct({ mode: "create", product }, operations),
    ).resolves.toBeUndefined();

    expect(operations.insert).toHaveBeenCalledWith(product);
    expect(products.get("caixa-nova")).toEqual(product);
  });

  it("rejects a slug collision without changing the existing product", async () => {
    const existing = createProduct("caixa-existente", "Produto preservado", 7);
    const { products, operations } = createInMemoryOperations([existing]);
    const before = structuredClone(existing);

    await expect(
      persistCatalogProduct(
        { mode: "create", product: createProduct(existing.slug, "Produto novo", 8) },
        operations,
      ),
    ).rejects.toThrow("Já existe um produto com este slug.");

    expect(products.get(existing.slug)).toEqual(before);
  });

  it("updates only the product identified by its original slug", async () => {
    const original = createProduct("produto-original", "Nome antigo", 4);
    const { products, operations } = createInMemoryOperations([original]);
    const fields: CatalogProductFields = {
      category: original.category,
      active: true,
      data: { name: "Nome atualizado", description: "Atualizado" },
    };

    await expect(
      persistCatalogProduct(
        {
          mode: "update",
          originalSlug: original.slug,
          slug: original.slug,
          product: fields,
        },
        operations,
      ),
    ).resolves.toBeUndefined();

    expect(operations.update).toHaveBeenCalledWith(original.slug, fields);
    expect(products.get(original.slug)).toEqual({ ...original, ...fields });
    expect(products.get(original.slug)?.admin_order).toBe(original.admin_order);
  });

  it("rejects an edit whose slug differs from the original without overwriting either record", async () => {
    const original = createProduct("produto-original", "Produto preservado", 2);
    const collision = createProduct("outro-produto", "Outro produto", 5);
    const { products, operations } = createInMemoryOperations([original, collision]);
    const before = structuredClone([...products.entries()]);

    await expect(
      persistCatalogProduct(
        {
          mode: "update",
          originalSlug: original.slug,
          slug: collision.slug,
          product: {
            category: original.category,
            active: true,
            data: { name: "Não deve substituir", description: "" },
          },
        },
        operations,
      ),
    ).rejects.toThrow("O slug do produto não pode ser alterado durante a edição.");

    expect(operations.update).not.toHaveBeenCalled();
    expect([...products.entries()]).toEqual(before);
  });
});
