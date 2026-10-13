import { expect, it, vi } from 'vitest';
import { productDataSchema } from '@/data/catalog';
import {
  addAdditionalImage,
  collectReferencedImagePaths,
  findUnreferencedImagePaths,
  MAX_IMAGE_INPUT_BYTES,
  removeImageAssociation,
  reorderAdditionalImages,
  selectMainImage,
  uploadValidatedImage,
  validateImageBytes,
} from './product-images';

it('keeps legacy products compatible with empty additional image paths', () => {
  const product = productDataSchema.parse({ name: 'Caixa', description: '', imagePath: 'old.jpg' });
  expect(product.imagePath).toBe('old.jpg');
  expect(product.additionalImagePaths).toEqual([]);
  expect(() => productDataSchema.parse({
    name: 'Caixa',
    description: '',
    imagePath: 'old.jpg',
    additionalImagePaths: ['extra.jpg', 'extra.jpg'],
  })).toThrow('caminhos repetidos');
});

it('persists image paths and changes the selected main image without losing associations', () => {
  const paths = { imagePath: 'main.webp', additionalImagePaths: ['side.webp', 'back.webp'] };
  expect(selectMainImage(paths, 'side.webp')).toEqual({
    imagePath: 'side.webp',
    additionalImagePaths: ['main.webp', 'back.webp'],
  });
});

it('reorders additional images while leaving the main image unchanged', () => {
  const result = reorderAdditionalImages(
    { imagePath: 'main.webp', additionalImagePaths: ['a.webp', 'b.webp', 'c.webp'] },
    2,
    0,
  );
  expect(result).toEqual({ imagePath: 'main.webp', additionalImagePaths: ['c.webp', 'a.webp', 'b.webp'] });
});

it('removes only an image association and never deletes a referenced file', () => {
  const paths = removeImageAssociation(
    { imagePath: 'main.webp', additionalImagePaths: ['extra.webp'] },
    'extra.webp',
  );
  expect(paths).toEqual({ imagePath: 'main.webp', additionalImagePaths: [] });
  expect(collectReferencedImagePaths([{ ...paths }], [{ imagePath: 'category.webp' }])).toEqual(
    new Set(['main.webp', 'category.webp']),
  );
  expect(findUnreferencedImagePaths(['main.webp', 'extra.webp', 'category.webp'], new Set(['main.webp', 'category.webp']))).toEqual(['extra.webp']);
});

it('limits each product to five additional images', () => {
  let paths = { imagePath: 'main.webp', additionalImagePaths: [] as string[] };
  for (let index = 0; index < 5; index++) paths = addAdditionalImage(paths, `extra-${index}.webp`);
  expect(paths.additionalImagePaths).toHaveLength(5);
  expect(() => addAdditionalImage(paths, 'extra-six.webp')).toThrow('até cinco');
});

it('validates the actual image signature and maximum input size', () => {
  expect(validateImageBytes(new Uint8Array([0xff, 0xd8, 0xff, 0x00]), 'image/jpeg')).toBe('image/jpeg');
  expect(validateImageBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image/png')).toBe('image/png');
  expect(validateImageBytes(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]), 'image/webp')).toBe('image/webp');
  expect(() => validateImageBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), 'image/jpeg')).toThrow('não corresponde');
  expect(() => validateImageBytes(new Uint8Array(MAX_IMAGE_INPUT_BYTES + 1), 'image/png')).toThrow('5 MB');
});

it('reports upload failures without returning a path that could be persisted', async () => {
  const upload = vi.fn().mockResolvedValue({ error: { message: 'Storage indisponível' } });
  await expect(uploadValidatedImage(upload, new Uint8Array([0xff, 0xd8, 0xff, 0x00]), 'image/jpeg', 'id'))
    .rejects.toThrow('Storage indisponível');
  expect(upload).toHaveBeenCalledWith('catalog/id.jpg', expect.any(Uint8Array), 'image/jpeg');
  const rejectedUpload = vi.fn().mockRejectedValue(new Error('Conexão interrompida'));
  await expect(uploadValidatedImage(rejectedUpload, new Uint8Array([0xff, 0xd8, 0xff, 0x00]), 'image/jpeg', 'id'))
    .rejects.toThrow('Conexão interrompida');
});

it('generates unique storage keys and uses the detected image type', async () => {
  const upload = vi.fn().mockResolvedValue({ error: null });
  const first = await uploadValidatedImage(upload, new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]), 'image/webp', 'uuid-1');
  const second = await uploadValidatedImage(upload, new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]), 'image/webp', 'uuid-2');
  expect(first).toBe('catalog/uuid-1.webp');
  expect(second).toBe('catalog/uuid-2.webp');
  expect(first).not.toBe(second);
});
