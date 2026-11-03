import type { Json } from "@/integrations/supabase/types";

export interface CatalogProductFields {
  category: string;
  active: boolean;
  data: Json;
}

export interface NewCatalogProduct extends CatalogProductFields {
  slug: string;
  admin_order: number;
}

interface ProductWriteError {
  code?: string;
}

export interface CatalogProductWriteOperations {
  insert: (product: NewCatalogProduct) => Promise<{ error: ProductWriteError | null }>;
  update: (
    originalSlug: string,
    product: CatalogProductFields,
  ) => Promise<{ data: { slug: string } | null; error: ProductWriteError | null }>;
}

export type CatalogProductWrite =
  | { mode: "create"; product: NewCatalogProduct }
  | {
      mode: "update";
      originalSlug: string;
      slug: string;
      product: CatalogProductFields;
    };

export async function persistCatalogProduct(
  write: CatalogProductWrite,
  operations: CatalogProductWriteOperations,
): Promise<void> {
  if (write.mode === "create") {
    const { error } = await operations.insert(write.product);
    if (error?.code === "23505") {
      throw new Error("Já existe um produto com este slug. Informe uma URL diferente.");
    }
    if (error) throw new Error("Não foi possível salvar o produto.");
    return;
  }

  if (write.slug !== write.originalSlug) {
    throw new Error("O slug do produto não pode ser alterado durante a edição.");
  }

  const { data, error } = await operations.update(write.originalSlug, write.product);
  if (error) throw new Error("Não foi possível salvar o produto.");
  if (!data) {
    throw new Error("O produto original não existe mais. Atualize o painel e tente novamente.");
  }
}
