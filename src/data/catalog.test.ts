import { expect, it } from 'vitest';
import { allowedCategories, segments, productDataSchema } from './catalog';

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

