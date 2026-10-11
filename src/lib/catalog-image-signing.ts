import type { Category, Product } from '@/data/catalog';

type SignedImage = { path: string | null; signedUrl: string | null };
type SignedImagesResponse = { data: SignedImage[] | null; error: unknown | null };
type SigningFailure = { category: string; attempts: number; imageCount: number };

function errorCategory(error: unknown): string {
  if (error instanceof Error) return error.name || 'Error';
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = error.status;
    if (typeof status === 'number') return `HTTP ${status}`;
  }
  return 'unknown';
}

export async function signCatalogImagePaths(
  paths: string[],
  signBatch: (batch: string[]) => Promise<SignedImagesResponse>,
  onFailure: (failure: SigningFailure) => void = failure => {
    console.error('[Catalog] Falha ao gerar URLs assinadas para imagens.', failure);
  },
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  const uniquePaths = [...new Set(paths.filter(Boolean))];

  for (let offset = 0; offset < uniquePaths.length; offset += 100) {
    const batch = uniquePaths.slice(offset, offset + 100);
    let response: SignedImagesResponse | undefined;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await signBatch(batch);
        if (result.error) {
          if (attempt === 2) {
            onFailure({ category: errorCategory(result.error), attempts: attempt, imageCount: batch.length });
          }
          continue;
        }
        response = result;
        break;
      } catch (error) {
        if (attempt === 2) {
          onFailure({ category: errorCategory(error), attempts: attempt, imageCount: batch.length });
        }
      }
    }

    if (!response) continue;
    let missingCount = 0;
    for (const image of response.data ?? []) {
      if (image.path && image.signedUrl) urls.set(image.path, image.signedUrl);
      else missingCount++;
    }
    if (missingCount > 0) {
      onFailure({ category: 'incomplete-response', attempts: 1, imageCount: missingCount });
    }
  }

  return urls;
}

export function applySignedCatalogImageUrls(
  categories: Category[],
  products: Product[],
  signedUrls: Map<string, string>,
): { categories: Category[]; products: Product[] } {
  return {
    categories: categories.map(category => ({
      ...category,
      image: signedUrls.get(category.imagePath) ?? '',
    })),
    products: products.map(product => ({
      ...product,
      image: signedUrls.get(product.imagePath) ?? '',
      additionalImages: product.additionalImagePaths.map(path => signedUrls.get(path) ?? ''),
    })),
  };
}
