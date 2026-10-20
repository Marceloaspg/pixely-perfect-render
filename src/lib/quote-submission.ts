import { z } from 'zod';
import { productDataSchema } from '@/data/catalog';
import { formatProductDimensions, quoteContactSchema } from '@/lib/quote-model';

export const quoteRequestStatusSchema = z.enum([
  'aguardando_orcamento',
  'orcamento_realizado',
  'compra_finalizada',
]);

export type QuoteRequestStatus = z.infer<typeof quoteRequestStatusSchema>;

export const quoteRequestStatusLabels: Record<QuoteRequestStatus, string> = {
  aguardando_orcamento: 'Aguardando orçamento',
  orcamento_realizado: 'Orçamento realizado',
  compra_finalizada: 'Compra finalizada',
};

const quoteLineInputSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  variation: z.string().trim().max(120).optional(),
  quantity: z.string().trim().min(1).max(30)
    .regex(/^\d+(?:[.,]\d+)?$/)
    .refine(value => {
      const amount = Number(value.replace(',', '.'));
      return Number.isFinite(amount) && amount > 0 && amount <= Number.MAX_SAFE_INTEGER;
    }),
}).strict();

export const quoteSubmissionInputSchema = z.object({
  requestKey: z.string().uuid(),
  contact: quoteContactSchema.strict(),
  items: z.array(quoteLineInputSchema).min(1).max(50),
  turnstileToken: z.string().trim().min(1).max(2048),
}).strict();

export type QuoteSubmissionInput = z.infer<typeof quoteSubmissionInputSchema>;

export function validateQuoteClientIp(ipHeader: string | null | undefined): string {
  const ip = ipHeader?.trim();
  const isIpv4 =
    ip?.split(".").length === 4 &&
    ip.split(".").every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
  let isIpv6 = false;
  if (ip?.includes(":") && /^[0-9a-fA-F:.]+$/.test(ip)) {
    try {
      isIpv6 = new URL(`http://[${ip}]/`).hostname.startsWith("[");
    } catch {
      isIpv6 = false;
    }
  }
  if (!ip || ip.length > 45 || ip.includes(",") || (!isIpv4 && !isIpv6)) {
    throw new Error("A origem da solicitação não pôde ser validada.");
  }
  return ip;
}

export type QuoteProductRecord = {
  slug: string;
  category: string;
  active: boolean;
  data: unknown;
};

export type QuoteCategoryRecord = {
  slug: string;
  active: boolean;
};

export type QuoteItemSnapshot = {
  slug: string;
  name: string;
  sku?: string;
  model?: string;
  material?: string;
  quantity: string;
  unit: string;
};

export type QuoteRequestSnapshot = {
  contact: {
    nome: string;
    empresa: string;
    cidade: string;
    whatsapp: string;
    email: string;
    observations: string;
  };
  items: QuoteItemSnapshot[];
};

const turnstileResponseSchema = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  action: z.string().optional(),
  "error-codes": z.array(z.string()).optional(),
});

const rejectedTurnstileErrorCodes = new Set([
  "invalid-input-response",
  "missing-input-response",
  "timeout-or-duplicate",
]);

const hostnamePattern =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))+$/;

export function parseQuoteTurnstileHostnames(
  hostnames: string | undefined,
  legacyHostname: string | undefined,
): string[] | null {
  const configured = hostnames !== undefined ? hostnames : legacyHostname;
  if (configured === undefined) return null;

  const normalized = configured.split(",").map((hostname) => hostname.trim().toLowerCase());
  if (normalized.some((hostname) => !hostnamePattern.test(hostname))) return null;
  return [...new Set(normalized)];
}

export type QuoteTurnstileVerification = "verified" | "rejected" | "unavailable";

export async function verifyQuoteTurnstileToken(
  token: string,
  clientIp: string,
  secretKey: string,
  expectedHostnames: readonly string[],
  fetcher: typeof fetch = fetch,
): Promise<QuoteTurnstileVerification> {
  if (!secretKey || expectedHostnames.length === 0) return "unavailable";
  if (!token) return "rejected";
  try {
    const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
        remoteip: clientIp,
      }),
    });
    if (!response.ok) return "unavailable";
    const parsed = turnstileResponseSchema.safeParse(await response.json());
    if (!parsed.success) return "unavailable";
    if (!parsed.data.success) {
      const errorCodes = parsed.data["error-codes"] ?? [];
      return errorCodes.length > 0 && errorCodes.every((code) => rejectedTurnstileErrorCodes.has(code))
        ? "rejected"
        : "unavailable";
    }
    return expectedHostnames.includes(parsed.data.hostname?.trim().toLowerCase() ?? "") &&
      parsed.data.action === 'quote_registration'
      ? "verified"
      : "rejected";
  } catch {
    return "unavailable";
  }
}

export async function hashQuoteClientIp(clientIp: string, secret: string): Promise<string> {
  if (secret.trim().length < 32) throw new Error('Rate limit secret is not configured.');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(clientIp));
  return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function quoteRequestSnapshotMatches(
  contact: unknown,
  items: unknown,
  snapshot: QuoteRequestSnapshot,
): boolean {
  return stableJson(contact) === stableJson(snapshot.contact) &&
    stableJson(items) === stableJson(snapshot.items);
}

function normalizeQuantity(value: string): string | null {
  const normalized = value.trim().replace(',', '.');
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0 || amount > Number.MAX_SAFE_INTEGER) return null;
  return normalized;
}

function getCommercialUnit(packageType: string, packUnit: string): string {
  const value = (packageType || packUnit).trim();
  if (!value) return 'embalagens';
  const normalized = value.toLocaleLowerCase('pt-BR');
  if (normalized === 'unidade') return 'unidades';
  if (normalized === 'caixa') return 'caixas';
  if (normalized === 'pacote') return 'pacotes';
  if (normalized === 'fardo') return 'fardos';
  return `${value}s`;
}

export function buildQuoteRequestSnapshot(
  input: QuoteSubmissionInput,
  productRecords: QuoteProductRecord[],
  categoryRecords: QuoteCategoryRecord[],
): { ok: true; snapshot: QuoteRequestSnapshot } | { ok: false; error: string } {
  const products = new Map(productRecords.map(product => [product.slug, product]));
  const activeCategories = new Set(categoryRecords.filter(category => category.active).map(category => category.slug));
  const seenLines = new Set<string>();
  const items: QuoteItemSnapshot[] = [];

  for (const requestedItem of input.items) {
    const record = products.get(requestedItem.slug);
    if (!record || !record.active || !activeCategories.has(record.category)) {
      return { ok: false, error: 'Um ou mais produtos não estão disponíveis no catálogo. Atualize a lista e tente novamente.' };
    }

    const parsedProduct = productDataSchema.safeParse(record.data);
    if (!parsedProduct.success || parsedProduct.data.demo) {
      return { ok: false, error: 'Um ou mais produtos não estão disponíveis para orçamento.' };
    }

    const product = parsedProduct.data;
    const options = [...new Set(product.variations.map(value => value.trim()).filter(Boolean))];
    const requestedVariation = requestedItem.variation?.trim();
    if (
      (options.length > 1 && (!requestedVariation || !options.includes(requestedVariation))) ||
      (requestedVariation !== undefined && !options.includes(requestedVariation))
    ) {
      return { ok: false, error: `Revise o modelo selecionado para "${product.name}".` };
    }

    const quantity = normalizeQuantity(requestedItem.quantity);
    if (!quantity) return { ok: false, error: `Revise a quantidade solicitada para "${product.name}".` };

    const model = requestedVariation || (options.length === 1 ? options[0] : undefined) || formatProductDimensions(product) || undefined;
    const lineKey = `${record.slug}::${model?.toLocaleLowerCase('pt-BR') ?? 'default'}`;
    if (seenLines.has(lineKey)) return { ok: false, error: `A lista contém uma linha duplicada para "${product.name}".` };
    seenLines.add(lineKey);

    items.push({
      slug: record.slug,
      name: product.name,
      ...(product.sku.trim() ? { sku: product.sku.trim() } : {}),
      ...(model ? { model } : {}),
      ...(product.material.trim() ? { material: product.material.trim() } : {}),
      quantity,
      unit: getCommercialUnit(product.packageType, product.packUnit),
    });
  }

  return {
    ok: true,
    snapshot: {
      contact: {
        nome: input.contact.nome.trim(),
        empresa: input.contact.empresa?.trim() ?? '',
        cidade: input.contact.cidade.trim(),
        whatsapp: input.contact.whatsapp.trim(),
        email: input.contact.email?.trim() ?? '',
        observations: input.contact.observations?.trim() ?? '',
      },
      items,
    },
  };
}
