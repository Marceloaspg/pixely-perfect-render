export function sortCatalogProducts<T extends { slug: string; order: number }>(
  products: readonly T[],
  adminOrderBySlug: ReadonlyMap<string, number | undefined>,
  admin: boolean,
): T[] {
  return [...products].sort((left, right) =>
    admin
      ? (adminOrderBySlug.get(left.slug) ?? left.order) -
          (adminOrderBySlug.get(right.slug) ?? right.order) ||
        left.slug.localeCompare(right.slug)
      : left.order - right.order,
  );
}

export function moveProductInOrder(order: readonly string[], productSlug: string, targetSlug: string): string[] {
  const sourceIndex = order.indexOf(productSlug);
  const targetIndex = order.indexOf(targetSlug);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return [...order];

  const next = [...order];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved!);
  return next;
}

export async function persistAdminProductOrder(
  slugs: readonly string[],
  verifyAdministrator: () => Promise<void>,
  persistOrder: () => PromiseLike<{ error: unknown | null }>,
): Promise<void> {
  if (new Set(slugs).size !== slugs.length) {
    throw new Error("A sequência contém produtos duplicados.");
  }

  await verifyAdministrator();
  const { error } = await persistOrder();
  if (error) {
    throw new Error("Não foi possível salvar a ordem dos produtos. Atualize o painel e tente novamente.");
  }
}
