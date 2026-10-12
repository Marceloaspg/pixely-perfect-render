import { z } from 'zod';
import type { Product } from '@/data/catalog';

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
  packageQuantity?: number | null;
  packageType?: string;
  packUnit?: string;
};

export type QuoteContact = {
  nome: string;
  empresa?: string;
  cidade: string;
  whatsapp?: string;
  observations?: string;
};

const quoteItemSchema = z.object({
  id: z.string().optional(),
  slug: z.string().min(1),
  name: z.string().min(1),
  quantity: z.string().default(''),
  variationId: z.string().optional(),
  variation: z.string().optional(),
  sku: z.string().optional(),
  material: z.string().optional(),
  dimensions: z.string().optional(),
  packageQuantity: z.number().int().positive().nullable().optional(),
  packageType: z.string().optional(),
  packUnit: z.string().optional(),
});

export const quoteContactSchema = z.object({
  nome: z.string().trim().min(1, 'Informe seu nome.').max(100),
  empresa: z.string().trim().max(100).optional().default(''),
  cidade: z.string().trim().min(1, 'Informe sua cidade.').max(100),
  whatsapp: z.string().trim().min(1, 'Informe um WhatsApp para contato.').max(30)
    .refine(value => value.replace(/\D/g, '').length >= 10 && value.replace(/\D/g, '').length <= 15, 'Informe um WhatsApp válido com DDD.'),
  observations: z.string().trim().max(1000).optional().default(''),
});

export function migrateQuoteItems(value: unknown): QuoteItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(row => {
    const parsed = quoteItemSchema.safeParse(row);
    if (!parsed.success) return [];
    const item = parsed.data;
    return [{
      slug: item.slug,
      name: item.name,
      quantity: item.quantity,
      ...(item.id !== undefined ? { id: item.id } : {}),
      ...(item.variationId !== undefined ? { variationId: item.variationId } : {}),
      ...(item.variation !== undefined ? { variation: item.variation } : {}),
      ...(item.sku !== undefined ? { sku: item.sku } : {}),
      ...(item.material !== undefined ? { material: item.material } : {}),
      ...(item.dimensions !== undefined ? { dimensions: item.dimensions } : {}),
      ...(item.packageQuantity !== undefined ? { packageQuantity: item.packageQuantity } : {}),
      ...(item.packageType !== undefined ? { packageType: item.packageType } : {}),
      ...(item.packUnit !== undefined ? { packUnit: item.packUnit } : {}),
    }];
  });
}

export function enrichQuoteItems(items: QuoteItem[], products: Product[]): QuoteItem[] {
  return items.map(item => {
    const product = products.find(candidate => candidate.slug === item.slug);
    if (!product) return item;
    const options = [...new Set(product.variations.map(value => value.trim()).filter(Boolean))];
    const variation = item.variation ?? (options.length === 1 ? options[0] : undefined);
    return {
      ...item,
      ...(variation ? { variation, variationId: item.variationId ?? variationIdForValue(variation) } : {}),
      ...(item.sku || !product.sku ? {} : { sku: product.sku }),
      ...(item.material || !product.material ? {} : { material: product.material }),
      ...(item.dimensions || !formatProductDimensions(product) ? {} : { dimensions: formatProductDimensions(product) }),
      ...(item.packageQuantity !== undefined ? {} : { packageQuantity: product.packageQuantity }),
      ...(item.packageType || !product.packageType ? {} : { packageType: product.packageType }),
      ...(item.packUnit || !product.packUnit ? {} : { packUnit: product.packUnit }),
    };
  });
}

export function variationIdForValue(value: string): string {
  return `variation:${value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')}`;
}

export function isQuoteVariationSelectionValid(variations: string[], selected?: string): boolean {
  const options = [...new Set(variations.map(value => value.trim()).filter(Boolean))];
  return options.length <= 1 || (!!selected && options.includes(selected.trim()));
}

export function quoteItemKey(item: Pick<QuoteItem, 'slug' | 'variationId' | 'id'>): string {
  return item.id ?? `${item.slug}::${item.variationId ?? 'default'}`;
}

export function getProductGalleryImages(product: { image: string; additionalImages: string[] }): string[] {
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
  const specs = product.specs.map(item => item.trim()).filter(Boolean);
  const applications = product.applications.map(item => item.trim()).filter(Boolean);
  const variations = [...new Set(product.variations.map(item => item.trim()).filter(Boolean))];
  if (specs.length) sections.push({ title: 'Especificações técnicas', items: specs });
  if (applications.length) sections.push({ title: 'Aplicações', items: applications });
  if (variations.length) sections.push({ title: 'Variações de tamanho e modelo', items: variations });
  if (!product.packageQuantity && product.packUnit.trim()) sections.push({ title: 'Unidade comercial', items: [product.packUnit.trim()] });
  return sections;
}

export function formatProductDimensions(product: {
  dimensions?: { length?: string; width?: string; height?: string; unit?: string };
}): string {
  const dimensions = product.dimensions;
  if (!dimensions?.length || !dimensions.width) return '';
  return `${dimensions.length} × ${dimensions.width}${dimensions.height ? ` × ${dimensions.height}` : ''} ${dimensions.unit || 'cm'}`;
}

export function calculateTotalUnits(quantity: string, packageQuantity?: number | null): number | null {
  if (!packageQuantity || !Number.isInteger(packageQuantity) || packageQuantity <= 0) return null;
  const packages = Number(quantity.trim().replace(',', '.'));
  if (!Number.isSafeInteger(packages) || packages <= 0) return null;
  const total = packages * packageQuantity;
  return Number.isSafeInteger(total) ? total : null;
}

export function validateQuoteRequest(items: QuoteItem[], contact: QuoteContact): string | null {
  if (items.length === 0) return 'Adicione ao menos um produto à cotação.';
  if (items.some(item => !item.name.trim() || !item.slug.trim())) return 'Revise os produtos da cotação.';
  if (items.some(item =>
    !item.quantity.trim() ||
    item.quantity.trim().length > 30 ||
    !/^\d+(?:[.,]\d+)?$/.test(item.quantity.trim()) ||
    !Number.isFinite(Number(item.quantity.replace(',', '.'))) ||
    Number(item.quantity.replace(',', '.')) <= 0,
  )) {
    return 'Informe uma quantidade numérica maior que zero para cada produto.';
  }
  const parsedContact = quoteContactSchema.safeParse(contact);
  return parsedContact.success ? null : parsedContact.error.issues[0]?.message ?? 'Revise seus dados de contato.';
}

function addIfPresent(lines: string[], label: string, value: string | number | null | undefined): void {
  if (value !== undefined && value !== null && String(value).trim()) lines.push(`${label}: ${value}`);
}

export function buildQuoteMessage(items: QuoteItem[], contact: QuoteContact): string {
  const lines = [
    'MAJESTA EMBALAGENS — SOLICITAÇÃO DE ORÇAMENTO',
    '',
    `Olá, ${contact.nome.trim()}!`,
  ];
  addIfPresent(lines, 'Empresa', contact.empresa);
  addIfPresent(lines, 'Cidade', contact.cidade);
  addIfPresent(lines, 'WhatsApp para contato', contact.whatsapp);
  lines.push('', 'Produtos solicitados:');

  items.forEach((item, index) => {
    lines.push('', `${index + 1}. ${item.name}`);
    addIfPresent(lines, 'SKU', item.sku);
    addIfPresent(lines, 'Tamanho/modelo', item.variation);
    addIfPresent(lines, 'Material', item.material);
    addIfPresent(lines, 'Dimensões', item.dimensions);
    const commercialPackage = item.packageType ? item.packageType : 'embalagem';
    if (item.packageQuantity) {
      addIfPresent(lines, 'Conteúdo por embalagem', `${item.packageQuantity} unidades${item.packageType ? ` (${item.packageType})` : ''}`);
    } else {
      addIfPresent(lines, 'Unidade comercial', item.packUnit || commercialPackage);
    }
    addIfPresent(lines, 'Embalagens solicitadas', item.quantity);
    const totalUnits = calculateTotalUnits(item.quantity, item.packageQuantity);
    if (totalUnits !== null) addIfPresent(lines, 'Total de unidades estimado', totalUnits);
  });

  addIfPresent(lines, 'Observações', contact.observations);
  lines.push('', 'Por favor, informem preços, disponibilidade e condições de atendimento para os itens acima.', 'Aguardo retorno. Obrigado!');
  return lines.join('\n');
}

export async function registerQuoteAndOpenWhatsApp(
  register: () => Promise<unknown>,
  openWhatsApp: () => void,
): Promise<{ registered: boolean; opened: boolean }> {
  let registered = false;
  try {
    const result = await register();
    registered = result !== false && !(typeof result === 'object' && result !== null && 'saved' in result && result.saved === false);
  } catch {
    registered = false;
  }
  try {
    openWhatsApp();
    return { registered, opened: true };
  } catch {
    return { registered, opened: false };
  }
}
