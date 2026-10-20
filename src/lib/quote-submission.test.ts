import { describe, expect, it, vi } from 'vitest';
import { productDataSchema } from '@/data/catalog';
import {
  buildQuoteRequestSnapshot,
  hashQuoteClientIp,
  quoteRequestSnapshotMatches,
  quoteRequestStatusSchema,
  quoteSubmissionInputSchema,
  validateQuoteClientIp,
  verifyQuoteTurnstileToken,
  type QuoteProductRecord,
} from './quote-submission';

const contact = {
  nome: 'Ana Costa',
  empresa: 'Empresa Exemplo',
  cidade: 'Campinas',
  whatsapp: '(19) 99999-1234',
  email: 'ana@example.com',
  observations: '',
};

function productRecord(options: {
  slug?: string;
  active?: boolean;
  demo?: boolean;
  category?: string;
  sku?: string;
  material?: string;
  variations?: string[];
  packageType?: 'pacote' | 'fardo' | 'caixa' | 'unidade' | '';
} = {}): QuoteProductRecord {
  return {
    slug: options.slug ?? 'caixinha-batata',
    category: options.category ?? 'porcoes',
    active: options.active ?? true,
    data: productDataSchema.parse({
      name: 'Caixinha | Embalagem para Batata Frita',
      description: 'Embalagem para porções',
      sku: options.sku ?? 'CB-EBP-01',
      material: options.material ?? 'Papel Cartão Triplex',
      variations: options.variations ?? ['Kraft', 'Branco'],
      packageType: options.packageType ?? 'unidade',
      demo: options.demo ?? false,
    }),
  };
}

function submission(items: Array<{ slug: string; variation?: string; quantity: string }>) {
  return quoteSubmissionInputSchema.parse({
    requestKey: '79e55b44-c9eb-477e-a746-a7d61fb10e2c',
    contact,
    items,
    turnstileToken: 'test-token',
  });
}

describe('quote submission validation and snapshots', () => {
  it('accepts a valid CF-Connecting-IP on a standard Request without Worker metadata', () => {
    const request = new Request('https://majesta.example/quote', {
      headers: { 'CF-Connecting-IP': '203.0.113.9' },
    });

    expect((request as Request & { cf?: unknown }).cf).toBeUndefined();
    expect(validateQuoteClientIp(request.headers.get('cf-connecting-ip'))).toBe('203.0.113.9');
    expect(validateQuoteClientIp('2001:db8::1')).toBe('2001:db8::1');
  });

  it.each([
    ['missing header', null],
    ['empty header', '   '],
    ['malformed IPv4', '203.0.113.999'],
    ['malformed IPv6', '2001:db8:::1'],
    ['multiple addresses', '203.0.113.9, 198.51.100.7'],
  ])('rejects %s as a client IP', (_case, ip) => {
    expect(() => validateQuoteClientIp(ip)).toThrow();
  });

  it('does not use X-Forwarded-For when CF-Connecting-IP is absent', () => {
    const request = new Request('https://majesta.example/quote', {
      headers: { 'X-Forwarded-For': '203.0.113.9' },
    });

    expect(() => validateQuoteClientIp(request.headers.get('cf-connecting-ip'))).toThrow();
  });

  it('snapshots canonical product data and keeps different models as separate lines', () => {
    const result = buildQuoteRequestSnapshot(
      submission([
        { slug: 'caixinha-batata', variation: 'Kraft', quantity: '10' },
        { slug: 'caixinha-batata', variation: 'Branco', quantity: '10' },
      ]),
      [productRecord()],
      [{ slug: 'porcoes', active: true }],
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.items).toEqual([
      {
        slug: 'caixinha-batata',
        name: 'Caixinha | Embalagem para Batata Frita',
        sku: 'CB-EBP-01',
        model: 'Kraft',
        material: 'Papel Cartão Triplex',
        quantity: '10',
        unit: 'unidades',
      },
      {
        slug: 'caixinha-batata',
        name: 'Caixinha | Embalagem para Batata Frita',
        sku: 'CB-EBP-01',
        model: 'Branco',
        material: 'Papel Cartão Triplex',
        quantity: '10',
        unit: 'unidades',
      },
    ]);
    expect(result.snapshot.contact).toMatchObject(contact);
  });

  it('rejects invalid quantities, more than fifty lines, and unknown input fields', () => {
    expect(quoteSubmissionInputSchema.safeParse({
      requestKey: '79e55b44-c9eb-477e-a746-a7d61fb10e2c',
      contact,
      items: [{ slug: 'caixinha-batata', quantity: '0' }],
      turnstileToken: 'test-token',
    }).success).toBe(false);
    expect(quoteSubmissionInputSchema.safeParse({
      requestKey: '79e55b44-c9eb-477e-a746-a7d61fb10e2c',
      contact,
      items: Array.from({ length: 51 }, () => ({ slug: 'caixinha-batata', quantity: '1' })),
      turnstileToken: 'test-token',
    }).success).toBe(false);
    expect(quoteSubmissionInputSchema.safeParse({
      requestKey: '79e55b44-c9eb-477e-a746-a7d61fb10e2c',
      contact: { ...contact, internalNote: 'untrusted' },
      items: [{ slug: 'caixinha-batata', quantity: '1', sku: 'spoofed' }],
      turnstileToken: 'test-token',
    }).success).toBe(false);
  });

  it.each([
    ['inactive product', [productRecord({ active: false })], [{ slug: 'porcoes', active: true }]],
    ['demonstration product', [productRecord({ demo: true })], [{ slug: 'porcoes', active: true }]],
    ['inactive category', [productRecord()], [{ slug: 'porcoes', active: false }]],
    ['unknown product', [], [{ slug: 'porcoes', active: true }]],
  ])('rejects %s before creating a request snapshot', (_case, products, categories) => {
    const result = buildQuoteRequestSnapshot(
      submission([{ slug: 'caixinha-batata', variation: 'Kraft', quantity: '10' }]),
      products as QuoteProductRecord[],
      categories as Array<{ slug: string; active: boolean }>,
    );
    expect(result.ok).toBe(false);
  });

  it('rejects quantities outside the positive safe-number range', () => {
    const validInput = submission([{ slug: 'caixinha-batata', variation: 'Kraft', quantity: '10' }]);
    const result = buildQuoteRequestSnapshot(
      { ...validInput, items: [{ ...validInput.items[0]!, quantity: '9007199254740992' }] },
      [productRecord()],
      [{ slug: 'porcoes', active: true }],
    );
    expect(result).toMatchObject({ ok: false });
  });

  it('rejects unknown models and duplicate lines while allowing distinct variations', () => {
    const products = [productRecord()];
    const categories = [{ slug: 'porcoes', active: true }];
    expect(buildQuoteRequestSnapshot(
      submission([{ slug: 'caixinha-batata', variation: 'Vermelho', quantity: '1' }]),
      products,
      categories,
    ).ok).toBe(false);
    expect(buildQuoteRequestSnapshot(
      submission([
        { slug: 'caixinha-batata', variation: 'Kraft', quantity: '1' },
        { slug: 'caixinha-batata', variation: 'Kraft', quantity: '2' },
      ]),
      products,
      categories,
    ).ok).toBe(false);
    expect(buildQuoteRequestSnapshot(
      submission([
        { slug: 'caixinha-batata', variation: 'Kraft', quantity: '1' },
        { slug: 'caixinha-batata', variation: 'Branco', quantity: '2' },
      ]),
      products,
      categories,
    ).ok).toBe(true);
  });

  it('omits SKU and material from snapshots when the catalog does not provide them', () => {
    const result = buildQuoteRequestSnapshot(
      submission([{ slug: 'caixinha-batata', quantity: '2' }]),
      [productRecord({ sku: '', material: '', variations: [] })],
      [{ slug: 'porcoes', active: true }],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.items[0]).not.toHaveProperty('sku');
    expect(result.snapshot.items[0]).not.toHaveProperty('material');
  });

  it('preserves distinct commercial units in each snapshot line', () => {
    const result = buildQuoteRequestSnapshot(
      submission([
        { slug: 'caixinha-batata', variation: 'Kraft', quantity: '2' },
        { slug: 'sacola-kraft', quantity: '3' },
      ]),
      [
        productRecord({ variations: ['Kraft'], packageType: 'caixa' }),
        productRecord({ slug: 'sacola-kraft', variations: [], packageType: 'pacote' }),
      ],
      [{ slug: 'porcoes', active: true }],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.items.map(item => item.unit)).toEqual(['caixas', 'pacotes']);
  });

  it('accepts exactly the three allowed administrative statuses', () => {
    expect(quoteRequestStatusSchema.options).toEqual([
      'aguardando_orcamento',
      'orcamento_realizado',
      'compra_finalizada',
    ]);
    expect(quoteRequestStatusSchema.safeParse('deleted').success).toBe(false);
  });

  it('compares idempotent retries independent of JSONB object key order and rejects changed payloads', () => {
    const result = buildQuoteRequestSnapshot(
      submission([{ slug: 'caixinha-batata', variation: 'Kraft', quantity: '10' }]),
      [productRecord()],
      [{ slug: 'porcoes', active: true }],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const reorderedContact = Object.fromEntries(Object.entries(result.snapshot.contact).reverse());
    const reorderedItem = Object.fromEntries(Object.entries(result.snapshot.items[0]!).reverse());
    expect(quoteRequestSnapshotMatches(reorderedContact, [reorderedItem], result.snapshot)).toBe(true);
    expect(quoteRequestSnapshotMatches(
      { ...result.snapshot.contact, cidade: 'Santos' },
      result.snapshot.items,
      result.snapshot,
    )).toBe(false);
  });
});

describe('Cloudflare Turnstile and rate-limit key protections', () => {
  it('validates Turnstile success, hostname, and action using Siteverify server-side', async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(String(_url)).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
      const form = new URLSearchParams(String(init?.body));
      expect(form.get('secret')).toBe('server-secret');
      expect(form.get('response')).toBe('turnstile-token');
      expect(form.get('remoteip')).toBe('203.0.113.9');
      return new Response(JSON.stringify({
        success: true,
        hostname: 'majesta.example',
        action: 'quote_registration',
      }), { status: 200 });
    });
    await expect(verifyQuoteTurnstileToken(
      'turnstile-token',
      '203.0.113.9',
      'server-secret',
      'majesta.example',
      fetcher,
    )).resolves.toBe(true);
    await expect(verifyQuoteTurnstileToken(
      'turnstile-token',
      '203.0.113.9',
      'server-secret',
      'wrong.example',
      fetcher,
    )).resolves.toBe(false);
  });

  it('fails closed when Siteverify is unavailable, fails, or has a wrong action', async () => {
    const failed = vi.fn(async () => new Response(JSON.stringify({ success: false }), { status: 200 }));
    const wrongAction = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      hostname: 'majesta.example',
      action: 'other',
    }), { status: 200 }));
    const offline = vi.fn(async () => { throw new Error('offline'); });
    await expect(verifyQuoteTurnstileToken('token', '203.0.113.9', 'secret', 'majesta.example', failed)).resolves.toBe(false);
    await expect(verifyQuoteTurnstileToken('token', '203.0.113.9', 'secret', 'majesta.example', wrongAction)).resolves.toBe(false);
    await expect(verifyQuoteTurnstileToken('token', '203.0.113.9', 'secret', 'majesta.example', offline)).resolves.toBe(false);
  });

  it('derives an opaque HMAC key and rejects short rate-limit secrets', async () => {
    const first = await hashQuoteClientIp('203.0.113.9', '0123456789abcdef0123456789abcdef');
    const same = await hashQuoteClientIp('203.0.113.9', '0123456789abcdef0123456789abcdef');
    const different = await hashQuoteClientIp('203.0.113.9', 'fedcba9876543210fedcba9876543210');
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(same).toBe(first);
    expect(different).not.toBe(first);
    await expect(hashQuoteClientIp('203.0.113.9', 'short')).rejects.toThrow();
  });

  it('keeps the validated edge IP as the stable HMAC identity for rate limiting', async () => {
    const request = new Request('https://majesta.example/quote', {
      headers: { 'CF-Connecting-IP': '203.0.113.9' },
    });
    const clientIp = validateQuoteClientIp(request.headers.get('cf-connecting-ip'));
    const requestKey = await hashQuoteClientIp(
      clientIp,
      '0123456789abcdef0123456789abcdef',
    );

    expect(requestKey).toMatch(/^[0-9a-f]{64}$/);
    expect(requestKey).toBe(
      await hashQuoteClientIp('203.0.113.9', '0123456789abcdef0123456789abcdef'),
    );
  });
});
