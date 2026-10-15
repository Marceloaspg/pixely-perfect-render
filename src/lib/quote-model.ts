import { z } from "zod";
import type { Product } from "@/data/catalog";
import { whatsappLink } from "./config";

export const MAX_QUOTE_ITEMS = 50;
export const MAX_WHATSAPP_MESSAGE_LENGTH = 8_000;

export type QuoteItem = {
  id?: string;
  slug: string;
  name: string;
  quantity: string;
  variationId?: string;
  variation?: string;
  sku?: string;
  material?: string;
  dimensions?: string;
  specs?: string[];
  packageQuantity?: number | null;
  packageType?: string;
  packUnit?: string;
};

export type QuoteContact = {
  nome: string;
  empresa?: string;
  cidade: string;
  whatsapp?: string;
  email?: string;
  observations?: string;
};

const quoteItemSchema = z.object({
  id: z.string().max(120).optional(),
  slug: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  quantity: z.string().max(30).default(""),
  variationId: z.string().max(300).optional(),
  variation: z.string().trim().max(120).optional(),
  sku: z.string().max(60).optional(),
  material: z.string().max(120).optional(),
  dimensions: z.string().max(100).optional(),
  specs: z.array(z.string().max(200)).max(30).optional(),
  packageQuantity: z.number().int().positive().nullable().optional(),
  packageType: z.string().max(20).optional(),
  packUnit: z.string().max(120).optional(),
});

export const quoteContactSchema = z.object({
  nome: z.string().trim().min(1, "Informe seu nome.").max(100),
  empresa: z.string().trim().max(100).optional().default(""),
  cidade: z.string().trim().min(1, "Informe sua cidade.").max(100),
  whatsapp: z
    .string()
    .trim()
    .min(1, "Informe um WhatsApp para contato.")
    .max(30)
    .refine(
      (value) => value.replace(/\D/g, "").length >= 10 && value.replace(/\D/g, "").length <= 15,
      "Informe um WhatsApp válido com DDD.",
    ),
  email: z
    .string()
    .trim()
    .max(254)
    .refine(
      (value) => value === "" || z.string().email().safeParse(value).success,
      "Informe um e-mail válido.",
    )
    .optional()
    .default(""),
  observations: z.string().trim().max(1000).optional().default(""),
});

export function migrateQuoteItems(value: unknown): QuoteItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    const parsed = quoteItemSchema.safeParse(row);
    if (!parsed.success) return [];
    const item = parsed.data;
    return [
      {
        slug: item.slug,
        name: item.name,
        quantity: item.quantity,
        ...(item.id !== undefined ? { id: item.id } : {}),
        ...(item.variationId !== undefined ? { variationId: item.variationId } : {}),
        ...(item.variation !== undefined ? { variation: item.variation } : {}),
        ...(item.sku !== undefined ? { sku: item.sku } : {}),
        ...(item.material !== undefined ? { material: item.material } : {}),
        ...(item.dimensions !== undefined ? { dimensions: item.dimensions } : {}),
        ...(item.specs !== undefined ? { specs: item.specs } : {}),
        ...(item.packageQuantity !== undefined ? { packageQuantity: item.packageQuantity } : {}),
        ...(item.packageType !== undefined ? { packageType: item.packageType } : {}),
        ...(item.packUnit !== undefined ? { packUnit: item.packUnit } : {}),
      },
    ];
  });
}

export function enrichQuoteItems(items: QuoteItem[], products: Product[]): QuoteItem[] {
  return items.map((item) => {
    const product = products.find((candidate) => candidate.slug === item.slug);
    if (!product) return item;
    const options = [...new Set(product.variations.map((value) => value.trim()).filter(Boolean))];
    const variation = item.variation ?? (options.length === 1 ? options[0] : undefined);
    return {
      ...item,
      ...(variation
        ? { variation, variationId: item.variationId ?? variationIdForValue(variation) }
        : {}),
      ...(item.sku || !product.sku ? {} : { sku: product.sku }),
      ...(item.material || !product.material ? {} : { material: product.material }),
      ...(item.dimensions || !formatProductDimensions(product)
        ? {}
        : { dimensions: formatProductDimensions(product) }),
      ...(item.packageQuantity !== undefined ? {} : { packageQuantity: product.packageQuantity }),
      ...(item.packageType || !product.packageType ? {} : { packageType: product.packageType }),
      ...(item.packUnit || !product.packUnit ? {} : { packUnit: product.packUnit }),
    };
  });
}

export function variationIdForValue(value: string): string {
  return `variation:${value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR")}`;
}

export function isQuoteVariationSelectionValid(variations: string[], selected?: string): boolean {
  const options = [...new Set(variations.map((value) => value.trim()).filter(Boolean))];
  return options.length <= 1 || (!!selected && options.includes(selected.trim()));
}

export function quoteItemKey(item: Pick<QuoteItem, "slug" | "variationId" | "id">): string {
  return item.id ?? `${item.slug}::${item.variationId ?? "default"}`;
}

export function getProductGalleryImages(product: {
  image: string;
  additionalImages: string[];
}): string[] {
  return [product.image, ...product.additionalImages].filter(Boolean);
}

export function nextGalleryIndex(current: number, step: number, imageCount: number): number {
  if (imageCount <= 0) return 0;
  return (current + step + imageCount) % imageCount;
}

export function getProductPublicSections(product: {
  specs: string[];
  applications: string[];
  variations: string[];
  packUnit: string;
  packageQuantity?: number | null;
}): Array<{ title: string; items: string[] }> {
  const sections: Array<{ title: string; items: string[] }> = [];
  const specs = product.specs.map((item) => item.trim()).filter(Boolean);
  const applications = product.applications.map((item) => item.trim()).filter(Boolean);
  const variations = [...new Set(product.variations.map((item) => item.trim()).filter(Boolean))];
  if (specs.length) sections.push({ title: "Especificações técnicas", items: specs });
  if (applications.length) sections.push({ title: "Aplicações", items: applications });
  if (variations.length)
    sections.push({ title: "Variações de tamanho e modelo", items: variations });
  if (!product.packageQuantity && product.packUnit.trim())
    sections.push({ title: "Unidade comercial", items: [product.packUnit.trim()] });
  return sections;
}

export function formatProductDimensions(product: {
  dimensions?: { length?: string; width?: string; height?: string; unit?: string };
}): string {
  const dimensions = product.dimensions;
  if (!dimensions?.length || !dimensions.width) return "";
  return `${dimensions.length} × ${dimensions.width}${dimensions.height ? ` × ${dimensions.height}` : ""} ${dimensions.unit || "cm"}`;
}

export function calculateTotalUnits(
  quantity: string,
  packageQuantity?: number | null,
): number | null {
  if (!packageQuantity || !Number.isInteger(packageQuantity) || packageQuantity <= 0) return null;
  const packages = Number(quantity.trim().replace(",", "."));
  if (!Number.isSafeInteger(packages) || packages <= 0) return null;
  const total = packages * packageQuantity;
  return Number.isSafeInteger(total) ? total : null;
}

function validateQuoteItems(items: QuoteItem[]): string | null {
  if (items.length === 0) return "Adicione ao menos um produto à cotação.";
  if (items.length > MAX_QUOTE_ITEMS)
    return `Uma solicitação pode conter no máximo ${MAX_QUOTE_ITEMS} produtos.`;
  if (items.some((item) => !item.name.trim() || !item.slug.trim()))
    return "Revise os produtos da cotação.";
  if (
    items.some(
      (item) =>
        !item.quantity.trim() ||
        item.quantity.trim().length > 30 ||
        !/^\d+(?:[.,]\d+)?$/.test(item.quantity.trim()) ||
        !Number.isFinite(Number(item.quantity.replace(",", "."))) ||
        Number(item.quantity.replace(",", ".")) <= 0 ||
        Number(item.quantity.replace(",", ".")) > Number.MAX_SAFE_INTEGER,
    )
  ) {
    return "Informe uma quantidade numérica maior que zero para cada produto.";
  }
  return null;
}

export function validateQuoteRequest(items: QuoteItem[], contact: QuoteContact): string | null {
  const itemValidation = validateQuoteItems(items);
  if (itemValidation) return itemValidation;
  const parsedContact = quoteContactSchema.safeParse(contact);
  return parsedContact.success
    ? null
    : (parsedContact.error.issues[0]?.message ?? "Revise seus dados de contato.");
}

export function validateQuoteItemsAgainstCatalog(
  items: QuoteItem[],
  products: Product[],
): string | null {
  if (items.length > MAX_QUOTE_ITEMS)
    return `Uma solicitação pode conter no máximo ${MAX_QUOTE_ITEMS} produtos.`;
  const keys = new Set<string>();

  for (const item of items) {
    const product = products.find((candidate) => candidate.slug === item.slug);
    if (!product || !product.active || product.demo) {
      return `O produto "${item.name}" não está mais disponível no catálogo. Revise a lista antes de continuar.`;
    }
    const options = [...new Set(product.variations.map((value) => value.trim()).filter(Boolean))];
    const variation = item.variation?.trim();
    if (
      (options.length > 1 && (!variation || !options.includes(variation))) ||
      (!!variation && !options.includes(variation)) ||
      (item.variationId !== undefined && item.variationId !== variationIdForValue(variation ?? ""))
    ) {
      return `Revise a variação selecionada para "${product.name}".`;
    }
    const key = `${product.slug}::${variation ? variationIdForValue(variation) : "default"}`;
    if (keys.has(key)) return `Remova itens duplicados de "${product.name}" da lista.`;
    keys.add(key);
  }
  return null;
}

export type PreparedQuoteWhatsApp =
  { ok: true; url: string; message: string } | { ok: false; error: string };

export function prepareQuoteForWhatsApp(
  items: QuoteItem[],
  contact: QuoteContact | undefined,
  products: Product[],
  commercialNumber: string,
): PreparedQuoteWhatsApp {
  const validation = contact ? validateQuoteRequest(items, contact) : validateQuoteItems(items);
  if (validation) return { ok: false, error: validation };
  const catalogValidation = validateQuoteItemsAgainstCatalog(items, products);
  if (catalogValidation) return { ok: false, error: catalogValidation };

  const parsedContact = contact
    ? quoteContactSchema.safeParse(contact)
    : { success: true as const, data: { nome: "", cidade: "", observations: "" } };
  if (!parsedContact.success) return { ok: false, error: "Revise seus dados de contato." };
  const messageItems = items.map((item) => {
    const product = products.find((candidate) => candidate.slug === item.slug)!;
    return {
      ...(item.id ? { id: item.id } : {}),
      slug: item.slug,
      name: product.name,
      quantity: item.quantity,
      ...(item.variation ? { variation: item.variation } : {}),
      ...(product.sku ? { sku: product.sku } : {}),
      ...(product.material ? { material: product.material } : {}),
      dimensions: formatProductDimensions(product),
      specs: product.specs,
      packageQuantity: product.packageQuantity,
      ...(product.packageType ? { packageType: product.packageType } : {}),
      ...(product.packUnit ? { packUnit: product.packUnit } : {}),
    };
  });
  const dynamicText = messageItems.flatMap((item) => [
    item.name,
    item.sku ?? "",
    item.variation ?? "",
    item.material ?? "",
    item.dimensions ?? "",
    ...(item.specs ?? []),
    item.packageType ?? "",
    item.packUnit ?? "",
  ]);
  dynamicText.push(parsedContact.data.observations ?? "");
  if (dynamicText.some((value) => value.includes("\uFFFD"))) {
    return {
      ok: false,
      error:
        "A mensagem contém caracteres inválidos. Revise os dados dos produtos e tente novamente.",
    };
  }
  const message = buildQuoteMessage(messageItems, parsedContact.data);
  if (message.length > MAX_WHATSAPP_MESSAGE_LENGTH) {
    return {
      ok: false,
      error:
        "A mensagem ficou muito extensa. Reduza a quantidade de itens ou o texto das observações e tente novamente.",
    };
  }
  const url = whatsappLink(message, commercialNumber);
  if (!url)
    return {
      ok: false,
      error: "O número comercial do WhatsApp não está configurado corretamente.",
    };
  return { ok: true, url, message };
}

function formatQuantity(value: string): string {
  const normalized = value.trim().replace(",", ".");
  const [integer = "0", fraction = ""] = normalized.split(".");
  const groupedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const trimmedFraction = fraction.replace(/0+$/, "");
  return trimmedFraction ? `${groupedInteger},${trimmedFraction}` : groupedInteger;
}

function sumQuantities(values: string[]): string {
  const fractions = values.map((value) => value.trim().replace(",", ".").split(".")[1] ?? "");
  const scale = Math.max(0, ...fractions.map((fraction) => fraction.length));
  const factor = 10n ** BigInt(scale);
  const total = values.reduce((sum, value) => {
    const [integer = "0", fraction = ""] = value.trim().replace(",", ".").split(".");
    const scaled =
      BigInt(integer) * factor + BigInt((fraction + "0".repeat(scale)).slice(0, scale) || "0");
    return sum + scaled;
  }, 0n);
  const integer = (total / factor).toString();
  const fraction = scale ? (total % factor).toString().padStart(scale, "0").replace(/0+$/, "") : "";
  return formatQuantity(fraction ? `${integer}.${fraction}` : integer);
}

function pluralizeCommercialUnit(unit: string): string {
  const normalized = unit.trim().toLocaleLowerCase("pt-BR");
  if (normalized === "unidade") return "unidades";
  if (normalized === "caixa") return "caixas";
  if (normalized === "pacote") return "pacotes";
  if (normalized === "fardo") return "fardos";
  return `${unit.trim()}s`;
}

function commercialQuantityUnit(item: QuoteItem): string {
  const packageType = cleanWhatsAppText(item.packageType ?? "");
  if (packageType) return pluralizeCommercialUnit(packageType);

  const packUnit = cleanWhatsAppText(item.packUnit ?? "");
  if (packUnit) {
    if (/^(unidade|caixa|pacote|fardo)$/i.test(packUnit)) return pluralizeCommercialUnit(packUnit);
    return `× ${packUnit}`;
  }
  return "embalagens";
}

function cleanWhatsAppText(value: string): string {
  return value
    .replace(/\uFFFD/gu, "")
    .replace(
      /(?:[#*0-9]\uFE0F?\u20E3)|[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Regional_Indicator}\uFE0F\u20E3\u200D\u{1F3FB}-\u{1F3FF}]/gu,
      "",
    )
    .replace(/[ \t]{2,}/gu, " ")
    .trim();
}

function addIfPresent(
  lines: string[],
  label: string,
  value: string | number | null | undefined,
): void {
  if (value === undefined || value === null) return;
  const cleaned = cleanWhatsAppText(String(value));
  if (cleaned) lines.push(`${label}: ${cleaned}`);
}

export function buildQuoteMessage(items: QuoteItem[], contact: QuoteContact): string {
  const lines = [
    "*MAJESTA EMBALAGENS*",
    "*SOLICITAÇÃO DE ORÇAMENTO*",
    "",
    "Olá!",
    "",
    "Gostaria de solicitar uma cotação dos seguintes produtos:",
    "",
    "---",
  ];

  items.forEach((item, index) => {
    if (index > 0) lines.push("", "---");
    lines.push("", `*${String(index + 1).padStart(2, "0")}. ${cleanWhatsAppText(item.name)}*`);
    addIfPresent(lines, "Código", item.sku);
    addIfPresent(lines, "Modelo", item.variation || item.dimensions);
    addIfPresent(lines, "Material", item.material);
    if (item.specs?.length)
      addIfPresent(
        lines,
        "Especificações",
        item.specs
          .map((value) => value.trim())
          .filter(Boolean)
          .join(", "),
      );
    lines.push(`Quantidade: *${formatQuantity(item.quantity)} ${commercialQuantityUnit(item)}*`);
  });

  const quantitiesByUnit = new Map<string, string[]>();
  for (const item of items) {
    const unit = commercialQuantityUnit(item);
    quantitiesByUnit.set(unit, [...(quantitiesByUnit.get(unit) ?? []), item.quantity]);
  }
  const distinctProducts = new Set(
    items.map((item) => item.sku?.trim().toLocaleUpperCase("pt-BR") || item.slug),
  ).size;
  lines.push(
    "",
    "---",
    "",
    "*RESUMO DA SOLICITAÇÃO*",
    "",
    `Produtos diferentes: *${distinctProducts}*`,
  );
  if (quantitiesByUnit.size === 1) {
    const [unit, quantities] = [...quantitiesByUnit.entries()][0]!;
    lines.push(`Quantidade total: *${sumQuantities(quantities)} ${unit}*`);
  } else {
    lines.push("Quantidade total por unidade comercial:");
    for (const [unit, quantities] of quantitiesByUnit) {
      lines.push(`- *${sumQuantities(quantities)} ${unit}*`);
    }
  }
  lines.push("");
  addIfPresent(lines, "Observações", contact.observations);
  lines.push("", "Agradeço pela atenção e aguardo o retorno com a proposta comercial!");
  return lines.join("\n");
}

export function openWhatsAppQuote(
  url: string,
  open: (target: string, targetName: string, features: string) => Window | null = (
    target,
    targetName,
    features,
  ) => window.open(target, targetName, features),
): boolean {
  try {
    open(url, "_blank", "noopener,noreferrer");
    return true;
  } catch {
    return false;
  }
}
