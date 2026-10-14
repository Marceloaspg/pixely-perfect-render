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
  MAX_QUOTE_ITEMS,
  MAX_WHATSAPP_MESSAGE_LENGTH,
  migrateQuoteItems,
  nextGalleryIndex,
  openWhatsAppQuote,
  prepareQuoteForWhatsApp,
  quoteContactSchema,
  quoteItemKey,
  validateQuoteItemsAgainstCatalog,
  validateQuoteRequest,
  type QuoteContact,
  type QuoteItem,
} from './quote-model';

const contact: QuoteContact = {
  nome: 'Ana Costa',
  empresa: 'Majesta Cliente Teste',
  cidade: 'Campinas',
  whatsapp: '(19) 99999-1234',
  email: 'ana@example.com',
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

it('preserves a newly added quote line with an empty quantity in local storage', () => {
  expect(migrateQuoteItems([{ slug: 'caixa', name: 'Caixa', quantity: '' }])).toEqual([
    { slug: 'caixa', name: 'Caixa', quantity: '' },
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
  expect(validateQuoteRequest(
    Array.from({ length: MAX_QUOTE_ITEMS + 1 }, (_, index) => ({
      slug: `item-${index}`,
      name: 'Caixa',
      quantity: '1',
    })),
    contact,
  )).toMatch(/no máximo/);
});

it('requires name, city, and a valid contact WhatsApp but leaves company optional', () => {
  expect(quoteContactSchema.safeParse({ nome: 'Ana', cidade: 'Campinas', whatsapp: '19999991234' }).success).toBe(true);
  expect(quoteContactSchema.safeParse({ nome: 'Ana', cidade: 'Campinas', whatsapp: '123' }).success).toBe(false);
  expect(quoteContactSchema.safeParse({ cidade: 'Campinas', whatsapp: '19999991234' }).success).toBe(false);
  expect(quoteContactSchema.safeParse({ ...contact, email: '' }).success).toBe(true);
  expect(quoteContactSchema.safeParse({ ...contact, email: '   ' }).success).toBe(true);
  expect(quoteContactSchema.safeParse({ ...contact, email: 'ana@example.com' }).success).toBe(true);
  expect(quoteContactSchema.safeParse({ ...contact, email: 'email-invalido' }).success).toBe(false);
});

it('rejects unavailable, inactive, demo, and invalid-variation products before opening WhatsApp', () => {
  const requestItem: QuoteItem = {
    slug: 'caixa',
    name: 'Tampered name',
    quantity: '2',
    variation: 'Tamanho P',
  };
  const product = {
    ...productDataSchema.parse({
      name: 'Caixa oficial',
      description: '',
      sku: 'CX-01',
      variations: ['Tamanho P', 'Tamanho G'],
      material: 'Papel',
    }),
    slug: 'caixa',
    category: 'ativa',
    image: '',
    additionalImages: [],
    active: true,
  };
  const inactiveProduct = { ...product, active: false };
  const demoProduct = { ...product, demo: true };
  expect(validateQuoteItemsAgainstCatalog([requestItem], [inactiveProduct])).toMatch(/não está mais disponível/);
  expect(validateQuoteItemsAgainstCatalog([requestItem], [demoProduct])).toMatch(/não está mais disponível/);
  expect(validateQuoteItemsAgainstCatalog([requestItem], [])).toMatch(/não está mais disponível/);
  expect(validateQuoteItemsAgainstCatalog([{ ...requestItem, variation: 'Tamanho X' }], [product])).toMatch(/variação/);
  expect(validateQuoteItemsAgainstCatalog([{ slug: 'caixa', name: 'Caixa', quantity: '2' }], [product])).toMatch(/variação/);
});

it('rejects duplicate products and allows distinct product variations', () => {
  const item: QuoteItem = { slug: 'caixa', name: 'Caixa', quantity: '2', variation: 'P' };
  const product = {
    ...productDataSchema.parse({ name: 'Caixa', description: '', variations: ['P', 'G'] }),
    slug: 'caixa',
    category: 'ativa',
    image: '',
    additionalImages: [],
    active: true,
  };
  expect(validateQuoteItemsAgainstCatalog([item, item], [product])).toMatch(/duplicados/);
  expect(validateQuoteItemsAgainstCatalog(
    [{ ...item, variation: 'P' }, { ...item, variation: 'G' }],
    [product],
  )).toBeNull();
});

it('prepares a WhatsApp message from canonical catalog data without personal contact details', () => {
  const product = {
    ...productDataSchema.parse({
      name: 'Caixa oficial',
      description: '',
      sku: 'CX-01',
      material: 'Papel cartão',
      dimensions: { length: '20', width: '15', height: '8', unit: 'cm' },
      variations: ['Tamanho P', 'Tamanho G'],
      packageQuantity: 100,
      packageType: 'caixa',
    }),
    slug: 'caixa',
    category: 'ativa',
    image: '',
    additionalImages: [],
    active: true,
  };
  const prepared = prepareQuoteForWhatsApp(
    [{
      slug: 'caixa',
      name: 'Nome adulterado',
      quantity: '4',
      variation: 'Tamanho G',
      sku: 'SKU adulterado',
    }],
    contact,
    [product],
    '5519996145193',
  );
  expect(prepared.ok).toBe(true);
  if (!prepared.ok) return;
  expect(prepared.message).toContain('*MAJESTA EMBALAGENS*');
  expect(prepared.message).toContain('*SOLICITAÇÃO DE ORÇAMENTO*');
  expect(prepared.message).toContain('Olá!');
  expect(prepared.message).toContain('*01. Caixa oficial*');
  expect(prepared.message).toContain('Código: CX-01');
  expect(prepared.message).toContain('Modelo: Tamanho G');
  expect(prepared.message).toContain('Material: Papel cartão');
  expect(prepared.message).toContain('Quantidade: *4 caixas*');
  expect(prepared.message).toContain('Produtos diferentes: *1*');
  expect(prepared.message).toContain('Quantidade total: *4 caixas*');
  expect(prepared.message).toContain('---');
  expect(prepared.message).toContain('Observações: Entregar cotação para o setor de compras.');
  expect(prepared.message.match(/(?:[#*0-9]\uFE0F?\u20E3)|[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Regional_Indicator}\uFE0F\u20E3\u200D\u{1F3FB}-\u{1F3FF}]/gu)).toBeNull();
  expect(prepared.message).not.toContain('\uFFFD');
  expect(prepared.message).not.toContain('Ana Costa');
  expect(prepared.message).not.toContain('Majesta Cliente Teste');
  expect(prepared.message).not.toContain('Campinas');
  expect(prepared.message).not.toContain('99999-1234');
  expect(prepared.message).not.toContain('ana@example.com');
  expect(prepared.url).toContain('https://wa.me/5519996145193?text=');
  expect(prepared.url).toContain(encodeURIComponent(prepared.message));
  expect(new URL(prepared.url).searchParams.get('text')).toBe(prepared.message);
  expect(prepared.message).toContain('SOLICITAÇÃO');
});

it('refuses to prepare invalid contact, quantity, missing products, or destination values', () => {
  const product = {
    ...productDataSchema.parse({ name: 'Caixa', description: '' }),
    slug: 'caixa',
    category: 'ativa',
    image: '',
    additionalImages: [],
    active: true,
  };
  const item: QuoteItem = { slug: 'caixa', name: 'Caixa', quantity: '2' };
  expect(prepareQuoteForWhatsApp([item], { ...contact, nome: '' }, [product], '5519996145193').ok).toBe(false);
  expect(prepareQuoteForWhatsApp([{ ...item, quantity: '0' }], contact, [product], '5519996145193').ok).toBe(false);
  expect(prepareQuoteForWhatsApp([item], contact, [], '5519996145193').ok).toBe(false);
  expect(prepareQuoteForWhatsApp([item], contact, [product], 'invalid-number').ok).toBe(false);
});

it('rejects dynamic product text that already contains the Unicode replacement character', () => {
  const product = {
    ...productDataSchema.parse({ name: `Caixa\uFFFD`, description: '' }),
    slug: 'caixa',
    category: 'ativa',
    image: '',
    additionalImages: [],
    active: true,
  };
  const result = prepareQuoteForWhatsApp(
    [{ slug: 'caixa', name: product.name, quantity: '2' }],
    contact,
    [product],
    '5519996145193',
  );
  expect(result).toEqual({
    ok: false,
    error: 'A mensagem contém caracteres inválidos. Revise os dados dos produtos e tente novamente.',
  });
});

it('refuses to create an oversized WhatsApp message with a corrective error', () => {
  const products = Array.from({ length: MAX_QUOTE_ITEMS }, (_, index) => ({
    ...productDataSchema.parse({
      name: `Produto ${index} ${'N'.repeat(100)}`,
      description: '',
      sku: 'S'.repeat(60),
      material: 'M'.repeat(120),
      dimensions: { length: '1'.repeat(30), width: '2'.repeat(30), height: '3'.repeat(30), unit: 'cm' },
      variations: ['V'.repeat(120)],
      packageQuantity: 100,
      packageType: 'caixa',
    }),
    slug: `produto-${index}`,
    category: 'ativa',
    image: '',
    additionalImages: [],
    active: true,
  }));
  const items = products.map(product => ({
    slug: product.slug,
    name: product.name,
    quantity: '1',
    variation: product.variations[0]!,
  }));
  const result = prepareQuoteForWhatsApp(items, contact, products, '5519996145193');
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toMatch(/mensagem ficou muito extensa/);
});

it('builds a complete single-product message and omits unavailable product fields and personal data', () => {
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
  expect(message).toContain('*01. Caixa para hambúrguer*');
  expect(message).toContain('Código: CX-G');
  expect(message).toContain('Modelo: Tamanho G');
  expect(message).toContain('Material: Papel cartão');
  expect(message).toContain('Quantidade: *4 caixas*');
  expect(message).toContain('*RESUMO DA SOLICITAÇÃO*');
  expect(message).toContain('*INFORMAÇÕES DESEJADAS*');
  expect(message).toContain('- Valores dos produtos');
  expect(message).toContain('- Disponibilidade em estoque');
  expect(message).toContain('- Prazo e condições de entrega');
  expect(message).toContain('- Formas de pagamento');
  expect(message).toContain('- Quantidade mínima para pedido');
  expect(message).toContain('Agradeço pela atenção e aguardo o retorno com a proposta comercial!');
  expect(message).not.toContain('Ana Costa');
  expect(message).not.toContain('Majesta Cliente Teste');
  expect(message).not.toContain('Campinas');
  expect(message).not.toContain('99999-1234');
  expect(message).not.toContain('\uFFFD');
  expect(message.match(/(?:[#*0-9]\uFE0F?\u20E3)|[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Regional_Indicator}\uFE0F\u20E3\u200D\u{1F3FB}-\u{1F3FF}]/gu)).toBeNull();
});

it('removes emojis and replacement characters from dynamic product text', () => {
  const message = buildQuoteMessage([{
    slug: 'caixa',
    name: 'Caixa 📦',
    quantity: '2',
    sku: 'CX\uFFFD-1',
    material: 'Papel 👋',
    packageType: 'caixa',
  }], contact);
  expect(message).toContain('*01. Caixa*');
  expect(message).toContain('Código: CX-1');
  expect(message).toContain('Material: Papel');
  expect(message).not.toContain('\uFFFD');
  expect(message.match(/(?:[#*0-9]\uFE0F?\u20E3)|[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Regional_Indicator}\uFE0F\u20E3\u200D\u{1F3FB}-\u{1F3FF}]/gu)).toBeNull();
});

it('numbers multiple products, includes only available details, and keeps unlike commercial units separate', () => {
  const message = buildQuoteMessage([
    { slug: 'caixa', name: 'Caixa', quantity: '10', packageType: 'caixa', sku: 'CX-1', material: 'Papel' },
    { slug: 'sacola', name: 'Sacola', quantity: '5', packageType: 'pacote', dimensions: '20 × 30 cm' },
  ], { ...contact, observations: '', email: 'cliente@example.com' });
  expect(message).toContain('*01. Caixa*');
  expect(message).toContain('*02. Sacola*');
  expect(message).toContain('---');
  expect(message).toContain('Código: CX-1');
  expect(message).toContain('Material: Papel');
  expect(message).toContain('Modelo: 20 × 30 cm');
  expect(message).toContain('Quantidade: *10 caixas*');
  expect(message).toContain('Quantidade: *5 pacotes*');
  expect(message).toContain('Produtos diferentes: *2*');
  expect(message).toContain('Quantidade total por unidade comercial:');
  expect(message).toContain('*10 caixas*');
  expect(message).toContain('*5 pacotes*');
  expect(message).not.toContain('Quantidade total: *15');
  expect(message).not.toContain('Código: \n');
  expect(message).not.toContain('Material: \n');
  expect(message).not.toContain('ana@example.com');
  expect(message).not.toContain('cliente@example.com');
  expect(message).not.toContain('Ana Costa');
  expect(message).not.toContain('Campinas');
  expect(message).not.toContain('99999-1234');
  expect(message).not.toContain('\uFFFD');
  expect(message.match(/(?:[#*0-9]\uFE0F?\u20E3)|[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Regional_Indicator}\uFE0F\u20E3\u200D\u{1F3FB}-\u{1F3FF}]/gu)).toBeNull();
  const url = whatsappLink(message, '5519996145193');
  expect(url).toBeDefined();
  expect(new URL(url!).searchParams.get('text')).toBe(message);
});

it('adds quantities exactly for products sold in the same commercial unit', () => {
  const message = buildQuoteMessage([
    { slug: 'caixa-a', name: 'Caixa A', quantity: '10', packageType: 'caixa' },
    { slug: 'caixa-b', name: 'Caixa B', quantity: '5', packageType: 'caixa' },
  ], contact);
  expect(message).toContain('Quantidade total: *15 caixas*');
});

it('URL-encodes the complete message and uses the configured commercial number', () => {
  const url = whatsappLink('Olá, Majesta! Caixa & papel', '5519996145193');
  expect(url).toContain('https://wa.me/5519996145193?text=');
  expect(url).toContain(encodeURIComponent('Olá, Majesta! Caixa & papel'));
  expect(whatsappLink('mensagem', 'número inválido')).toBeUndefined();
});

it('navigates to the prepared WhatsApp link synchronously and reports navigation errors', () => {
  const navigate = vi.fn();
  expect(openWhatsAppQuote('https://wa.me/5519996145193?text=oi', navigate)).toBe(true);
  expect(navigate).toHaveBeenCalledWith('https://wa.me/5519996145193?text=oi');
  expect(openWhatsAppQuote('https://wa.me/5519996145193', () => { throw new Error('blocked'); })).toBe(false);
});

it('caps the message length to avoid constructing oversized WhatsApp links', () => {
  expect(MAX_WHATSAPP_MESSAGE_LENGTH).toBe(8_000);
});

it('navigates a single or multi-image gallery without exposing empty photos', () => {
  expect(getProductGalleryImages({ image: 'main.webp', additionalImages: ['', 'side.webp'] })).toEqual(['main.webp', 'side.webp']);
  expect(nextGalleryIndex(0, 1, 1)).toBe(0);
  expect(nextGalleryIndex(0, 1, 3)).toBe(1);
  expect(nextGalleryIndex(0, -1, 3)).toBe(2);
  expect(nextGalleryIndex(0, 1, 0)).toBe(0);
});
