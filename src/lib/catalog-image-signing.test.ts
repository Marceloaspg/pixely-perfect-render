import { expect, it, vi } from 'vitest';
import { categoryDataSchema, productDataSchema } from '@/data/catalog';
import { applySignedCatalogImageUrls, signCatalogImagePaths } from './catalog-image-signing';

it('retries temporary signing failures and preserves batch signing', async () => {
  const signBatch = vi.fn()
    .mockRejectedValueOnce(new Error('network timeout'))
    .mockResolvedValueOnce({ data: [{ path: 'catalog/main.webp', signedUrl: 'https://signed/main' }], error: null });

  const result = await signCatalogImagePaths(['catalog/main.webp'], signBatch);

  expect(signBatch).toHaveBeenCalledTimes(2);
  expect(signBatch).toHaveBeenCalledWith(['catalog/main.webp']);
  expect(result.get('catalog/main.webp')).toBe('https://signed/main');
});

it('returns a safe image fallback after Storage connection and signing failures', async () => {
  const report = vi.fn();
  const signBatch = vi.fn().mockRejectedValue(new Error('network timeout'));
  const urls = await signCatalogImagePaths(['catalog/main.webp'], signBatch, report);
  const category = {
    ...categoryDataSchema.parse({ name: 'Embalagens', imagePath: 'catalog/category.webp' }),
    slug: 'embalagens',
    image: '',
    active: true,
  };
  const product = {
    ...productDataSchema.parse({
      name: 'Produto demonstrativo',
      description: '',
      imagePath: 'catalog/main.webp',
      additionalImagePaths: ['catalog/unavailable.webp'],
    }),
    slug: 'produto-demo',
    category: 'embalagens',
    image: '',
    additionalImages: [],
    active: false,
  };
  const catalog = applySignedCatalogImageUrls([category], [product], urls);

  expect(signBatch).toHaveBeenCalledTimes(2);
  expect(catalog.categories[0]?.image).toBe('');
  expect(catalog.products[0]?.image).toBe('');
  expect(catalog.products[0]?.additionalImages).toEqual(['']);
  expect(report).toHaveBeenCalledWith({ category: 'Error', attempts: 2, imageCount: 1 });
});

it('continues using images that signed successfully when another image is unavailable', async () => {
  const report = vi.fn();
  const urls = await signCatalogImagePaths(
    ['catalog/available.webp', 'catalog/missing.webp'],
    async () => ({
      data: [
        { path: 'catalog/available.webp', signedUrl: 'https://signed/available' },
        { path: null, signedUrl: null },
      ],
      error: null,
    }),
    report,
  );

  expect(urls.get('catalog/available.webp')).toBe('https://signed/available');
  expect(urls.has('catalog/missing.webp')).toBe(false);
  expect(report).toHaveBeenCalledWith({ category: 'incomplete-response', attempts: 1, imageCount: 1 });
});
