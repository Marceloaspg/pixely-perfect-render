import { expect, it, vi } from 'vitest';
import { whatsappLink } from './config';
import { productDataSchema } from '@/data/catalog';
import {
  buildQuoteMessage,
  calculateTotalUnits,
  enrichQuoteItems,
  getProductGalleryImages,
  getProductPublicSections,
  isQuoteVariationSelectionValid,
  migrateQuoteItems,
  nextGalleryIndex,
  quoteContactSchema,
  quoteItemKey,
  registerQuoteAndOpenWhatsApp,
  validateQuoteRequest,
  type QuoteContact,
  type QuoteItem,
} from './quote-model';

const contact: QuoteContact = {
  nome: 'Ana Costa',
  empresa: '',
  cidade: 'Campinas',
  whatsapp: '(19) 99999-1234',
  observations: 'Entregar cotação para o setor de compras.',
};

it('hides empty product sections and avoids repeating commercial packaging information', () => {
  expect(getProductPublicSections({
    specs: ['', '  '],
    applications: [],
    variations: [''],
    packUnit: 'Caixa com 100 unidades',
    packageQuantity: 100,
  })).toEqual([]);
  expect(getProductPublicSections({
    specs: [' Papel resistente ', ''],
    applications: ['Delivery'],
    variations: [],
    packUnit: 'Caixa com 100 unidades',
  })).toEqual([
    { title: 'Especificações técnicas', items: ['Papel resistente'] },
    { title: 'Aplicações', items: ['Delivery'] },
    { title: 'Unidade comercial', items: ['Caixa com 100 unidades'] },
  ]);
});

it('accepts no variation, auto-accepts one option, and requires a choice for several options', () => {
  expect(isQuoteVariationSelectionValid([])).toBe(true);
  expect(isQuoteVariationSelectionValid(['Tamanho G'])).toBe(true);
  expect(isQuoteVariationSelectionValid(['Tamanho G', 'Tamanho M'])).toBe(false);
  expect(isQuoteVariationSelectionValid(['Tamanho G', 'Tamanho M'], 'Tamanho P')).toBe(false);
  expect(isQuoteVariationSelectionValid(['Tamanho G', 'Tamanho M'], 'Tamanho M')).toBe(true);
});

it('keeps the same product and SKU as separate quote lines for different variations', () => {
  const small: QuoteItem = { slug: 'caixa', name: 'Caixa', sku: 'CX-1', variationId: 'variation:p', variation: 'P', quantity: '2' };
  const large: QuoteItem = { ...small, variationId: 'variation:g', variation: 'G' };
  expect(quoteItemKey(small)).not.toBe(quoteItemKey(large));
});

it('migrates legacy browser quote items without losing their identifying data or quantity', () => {
  expect(migrateQuoteItems([{ slug: 'caixa', name: 'Caixa', quantity: '5' }])).toEqual([
    { slug: 'caixa', name: 'Caixa', quantity: '5' },
  ]);
});

it('preserves selected variation values and identifiers in stored quote items', () => {
  const item: QuoteItem = {
    slug: 'caixa',
    name: 'Caixa',
    quantity: '3',
    variationId: 'variation:tamanho-g',
    variation: 'Tamanho G',
  };
  expect(migrateQuoteItems([item])).toEqual([item]);
});

it('enriches legacy quote lines from the catalog and auto-selects the only variation', () => {
  const product = {
    ...productDataSchema.parse({
      name: 'Caixa',
      description: '',
      sku: 'CX-1',
      material: 'Papel',
      dimensions: { length: '20', width: '15', height: '', unit: 'cm' },
      variations: ['Tamanho único'],
      packageQuantity: 100,
    }),
    slug: 'caixa',
    category: 'hamburguer',
    image: '',
    additionalImages: [],
    active: true,
  };
  expect(enrichQuoteItems([{ slug: 'caixa', name: 'Caixa', quantity: '2' }], [product])[0]).toMatchObject({
    quantity: '2',
    sku: 'CX-1',
    material: 'Papel',
    dimensions: '20 × 15 cm',
    variation: 'Tamanho único',
    packageQuantity: 100,
  });
});

it('calculates total units only for a valid integer package count', () => {
  expect(calculateTotalUnits('12', 100)).toBe(1200);
  expect(calculateTotalUnits('1,5', 100)).toBeNull();
  expect(calculateTotalUnits('0', 100)).toBeNull();
  expect(calculateTotalUnits('12', null)).toBeNull();
});

it('validates required contact data and numeric quantities before sending', () => {
  const item: QuoteItem = { slug: 'caixa', name: 'Caixa', quantity: '3' };
  expect(validateQuoteRequest([item], contact)).toBeNull();
  expect(validateQuoteRequest([item], { ...contact, whatsapp: '' })).toMatch(/WhatsApp/);
  expect(validateQuoteRequest([{ ...item, quantity: '' }], contact)).toMatch(/quantidade numérica/);
  expect(validateQuoteRequest([], contact)).toMatch(/ao menos um produto/);
});

it('requires name, city, and a valid contact WhatsApp but leaves company optional', () => {
  expect(quoteContactSchema.safeParse({ nome: 'Ana', cidade: 'Campinas', whatsapp: '19999991234' }).success).toBe(true);
  expect(quoteContactSchema.safeParse({ nome: 'Ana', cidade: 'Campinas', whatsapp: '123' }).success).toBe(false);
  expect(quoteContactSchema.safeParse({ cidade: 'Campinas', whatsapp: '19999991234' }).success).toBe(false);
});

it('builds a professional message with only available product and contact details', () => {
  const message = buildQuoteMessage([{
    slug: 'caixa',
    name: 'Caixa para hambúrguer',
    quantity: '4',
    variationId: 'variation:g',
    variation: 'Tamanho G',
    sku: 'CX-G',
    material: 'Papel cartão',
    dimensions: '20 × 15 × 8 cm',
    packageQuantity: 100,
    packageType: 'caixa',
  }], contact);
  expect(message).toContain('MAJESTA EMBALAGENS — SOLICITAÇÃO DE ORÇAMENTO');
  expect(message).toContain('1. Caixa para hambúrguer');
  expect(message).toContain('SKU: CX-G');
  expect(message).toContain('Tamanho/modelo: Tamanho G');
  expect(message).toContain('Material: Papel cartão');
  expect(message).toContain('Conteúdo por embalagem: 100 unidades (caixa)');
  expect(message).toContain('Embalagens solicitadas: 4');
  expect(message).toContain('Total de unidades estimado: 400');
  expect(message).toContain('WhatsApp para contato: (19) 99999-1234');
  expect(message).toContain('Observações: Entregar cotação para o setor de compras.');
  expect(message).not.toContain('Prazo de entrega:');
  expect(message).not.toContain('Preço:');
});

it('URL-encodes the complete message and uses the configured commercial number', () => {
  const url = whatsappLink('Olá, Majesta! Caixa & papel', '5519996145193');
  expect(url).toContain('https://wa.me/5519996145193?text=');
  expect(url).toContain(encodeURIComponent('Olá, Majesta! Caixa & papel'));
  expect(whatsappLink('mensagem', 'número inválido')).toBeUndefined();
});

it('opens WhatsApp even when quote registration fails and leaves the cart data unchanged', async () => {
  const savedItems: QuoteItem[] = [{ slug: 'caixa', name: 'Caixa', quantity: '3' }];
  const originalItems = structuredClone(savedItems);
  const openWhatsApp = vi.fn();
  const result = await registerQuoteAndOpenWhatsApp(
    async () => { throw new Error('server unavailable'); },
    openWhatsApp,
  );
  expect(result).toEqual({ registered: false, opened: true });
  expect(openWhatsApp).toHaveBeenCalledOnce();
  expect(savedItems).toEqual(originalItems);
});

it('reports an explicit registration failure result without suppressing WhatsApp', async () => {
  const openWhatsApp = vi.fn();
  const result = await registerQuoteAndOpenWhatsApp(async () => ({ saved: false }), openWhatsApp);
  expect(result).toEqual({ registered: false, opened: true });
  expect(openWhatsApp).toHaveBeenCalledOnce();
});

it('navigates a single or multi-image gallery without exposing empty photos', () => {
  expect(getProductGalleryImages({ image: 'main.webp', additionalImages: ['', 'side.webp'] })).toEqual(['main.webp', 'side.webp']);
  expect(nextGalleryIndex(0, 1, 1)).toBe(0);
  expect(nextGalleryIndex(0, 1, 3)).toBe(1);
  expect(nextGalleryIndex(0, -1, 3)).toBe(2);
  expect(nextGalleryIndex(0, 1, 0)).toBe(0);
});
