import { expect, it } from 'vitest';
import { allowedCategories, assertAdminRole, categoryDataSchema, categorySlugSchema, filterPublicCatalog, segments, productDataSchema, slugify, sortCategories } from './catalog';
import { AdminPermissionDeniedError, AdminRoleCheckError } from '@/lib/admin-access';

it('exposes exactly the seven requested categories',()=>{expect([...allowedCategories]).toEqual(['embalagens-para-hamburguer','sacos-kraft-e-sacolas','papeis-para-alimentos','embalagens-para-batatas-e-porcoes','embalagens-para-hot-dog','embalagens-para-combos','etiquetas-e-lacres-de-seguranca']);});
it('never relates segments to removed categories',()=>{for(const segment of segments)for(const category of segment.categories)expect(allowedCategories).toContain(category);});

it('parses legacy product data seamlessly without losing data', () => {
  const legacyData = {
    name: 'Caixa para hambúrguer',
    description: 'Exemplo de embalagem para hambúrguer.',
    demo: true,
    order: 1,
    featured: true,
    applications: ['Delivery', 'Lanches'],
    specs: ['Papel resistente'],
    packUnit: 'Caixa com 100 unidades',
  };
  const parsed = productDataSchema.parse(legacyData);
  expect(parsed.name).toBe('Caixa para hambúrguer');
  expect(parsed.packUnit).toBe('Caixa com 100 unidades');
  expect(parsed.sku).toBe('');
  expect(parsed.material).toBe('');
  expect(parsed.dimensions.unit).toBe('cm');
  expect(parsed.packageQuantity).toBeNull();
  expect(parsed.packageType).toBe('');
});

it('validates and accepts structured SKU, dimensions, and packaging', () => {
  const fullData = {
    name: 'Saco Kraft Delivery G',
    description: 'Saco resistente.',
    sku: 'SK-KRAFT-G',
    material: 'Papel Kraft 80g',
    dimensions: { length: '24', width: '14', height: '32', unit: 'cm' },
    packageQuantity: 500,
    packageType: 'fardo',
  };
  const parsed = productDataSchema.parse(fullData);
  expect(parsed.sku).toBe('SK-KRAFT-G');
  expect(parsed.material).toBe('Papel Kraft 80g');
  expect(parsed.dimensions.length).toBe('24');
  expect(parsed.packageQuantity).toBe(500);
  expect(parsed.packageType).toBe('fardo');
});

it('keeps the original categories while accepting new valid category slugs', () => {
  expect([...allowedCategories]).toHaveLength(7);
  expect(categorySlugSchema.parse('embalagens-para-pizzas')).toBe('embalagens-para-pizzas');
  expect(() => categorySlugSchema.parse('Embalagens para pizzas')).toThrow();
});

it('generates the full slug from a category name', () => {
  expect(slugify('Teste')).toBe('teste');
  expect(slugify('Embalagens para Pizzas')).toBe('embalagens-para-pizzas');
});

it('preserves existing category fields and subcategories when parsing old records', () => {
  const category = categoryDataSchema.parse({
    name: 'Sacos Kraft e Sacolas',
    number: '02',
    description: 'Sacos e sacolas para delivery.',
    imageKey: 'kraft',
    subcategories: ['Sacos kraft para lanche', 'Sacolas kraft para delivery'],
  });
  expect(category.subcategories).toEqual(['Sacos kraft para lanche', 'Sacolas kraft para delivery']);
  expect(category.order).toBeUndefined();
});

it('sorts categories by persisted order with legacy number fallback', () => {
  const categories = [
    { ...categoryDataSchema.parse({ name: 'Terceira', number: '03', order: 2 }), slug: 'terceira', image: '', active: true },
    { ...categoryDataSchema.parse({ name: 'Primeira', number: '02' }), slug: 'primeira', image: '', active: true },
    { ...categoryDataSchema.parse({ name: 'Segunda', number: '02', order: 0 }), slug: 'segunda', image: '', active: true },
  ];
  expect(sortCategories(categories).map(category => category.slug)).toEqual(['segunda', 'primeira', 'terceira']);
});

it('excludes inactive categories and their products from every public catalog surface', () => {
  const categories = [
    { ...categoryDataSchema.parse({ name: 'Ativa', number: '01' }), slug: 'ativa', image: '', active: true },
    { ...categoryDataSchema.parse({ name: 'Inativa', number: '02' }), slug: 'inativa', image: '', active: false },
  ];
  const products = [
    { ...productDataSchema.parse({ name: 'Produto ativo', description: '' }), slug: 'produto-ativo', category: 'ativa', image: '', additionalImages: [], active: true },
    { ...productDataSchema.parse({ name: 'Produto desligado', description: '' }), slug: 'produto-desligado', category: 'ativa', image: '', additionalImages: [], active: false },
    { ...productDataSchema.parse({ name: 'Produto de categoria inativa', description: '' }), slug: 'produto-categoria-inativa', category: 'inativa', image: '', additionalImages: [], active: true },
  ];
  const publicCatalog = filterPublicCatalog(categories, products);
  expect(publicCatalog.categories.map(category => category.slug)).toEqual(['ativa']);
  expect(publicCatalog.products.map(product => product.slug)).toEqual(['produto-ativo']);
});

it('rejects writes when the server role check errors or is not an administrator', () => {
  expect(() => assertAdminRole({ data: false, error: null })).toThrow(AdminPermissionDeniedError);
  expect(() => assertAdminRole({ data: true, error: new Error('role lookup failed') })).toThrow(AdminRoleCheckError);
  expect(() => assertAdminRole({ data: true, error: null })).not.toThrow();
});
