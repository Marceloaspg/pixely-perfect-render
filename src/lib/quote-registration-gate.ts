const disabledMessage = "O registro de orçamentos está temporariamente desativado.";

export async function withQuoteRegistrationEnabled<T>(
  enabled: string | undefined,
  register: () => Promise<T>,
): Promise<T> {
  if (enabled !== "true") throw new Error(disabledMessage);
  return register();
}
