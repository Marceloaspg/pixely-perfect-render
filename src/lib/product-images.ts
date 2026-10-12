export const MAX_IMAGE_INPUT_BYTES = 5 * 1024 * 1024;
export const MAX_ADDITIONAL_IMAGES = 5;
export const acceptedImageTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type ProductImagePaths = {
  imagePath: string;
  additionalImagePaths: string[];
};

export function validateImageBytes(bytes: Uint8Array, declaredType: string): string {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_INPUT_BYTES) {
    throw new Error('A imagem deve ter até 5 MB e não pode estar vazia.');
  }

  let detectedType: string | undefined;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) detectedType = 'image/jpeg';
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) detectedType = 'image/png';
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) detectedType = 'image/webp';

  if (!detectedType || !acceptedImageTypes.includes(declaredType as (typeof acceptedImageTypes)[number]) || detectedType !== declaredType) {
    throw new Error('O conteúdo do arquivo não corresponde a um JPG, PNG ou WebP válido.');
  }
  return detectedType;
}

export function addAdditionalImage(paths: ProductImagePaths, imagePath: string): ProductImagePaths {
  if (!imagePath) throw new Error('O caminho da imagem está vazio.');
  if (paths.imagePath === imagePath || paths.additionalImagePaths.includes(imagePath)) {
    throw new Error('Esta imagem já está associada ao produto.');
  }
  if (paths.additionalImagePaths.length >= MAX_ADDITIONAL_IMAGES) {
    throw new Error('Cada produto pode ter até cinco fotografias adicionais.');
  }
  return { ...paths, additionalImagePaths: [...paths.additionalImagePaths, imagePath] };
}

export function selectMainImage(paths: ProductImagePaths, selectedPath: string): ProductImagePaths {
  const selectedIndex = paths.additionalImagePaths.indexOf(selectedPath);
  if (selectedIndex < 0) {
    throw new Error('A imagem selecionada não pertence à galeria do produto.');
  }
  const additionalImagePaths = [...paths.additionalImagePaths];
  if (paths.imagePath) additionalImagePaths[selectedIndex] = paths.imagePath;
  else additionalImagePaths.splice(selectedIndex, 1);
  return {
    imagePath: selectedPath,
    additionalImagePaths,
  };
}

export function reorderAdditionalImages(paths: ProductImagePaths, from: number, to: number): ProductImagePaths {
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < 0 ||
    from >= paths.additionalImagePaths.length ||
    to >= paths.additionalImagePaths.length
  ) throw new Error('Posição de imagem inválida.');
  const additionalImagePaths = [...paths.additionalImagePaths];
  const [moved] = additionalImagePaths.splice(from, 1);
  additionalImagePaths.splice(to, 0, moved!);
  return { ...paths, additionalImagePaths };
}

export function removeImageAssociation(paths: ProductImagePaths, imagePath: string): ProductImagePaths {
  if (paths.imagePath === imagePath) {
    throw new Error('Escolha outra imagem principal antes de remover esta associação.');
  }
  return {
    ...paths,
    additionalImagePaths: paths.additionalImagePaths.filter(path => path !== imagePath),
  };
}

export function collectReferencedImagePaths(
  products: Array<{ imagePath?: string; additionalImagePaths?: string[] }>,
  categories: Array<{ imagePath?: string }>,
): Set<string> {
  const paths = new Set<string>();
  for (const product of products) {
    if (product.imagePath) paths.add(product.imagePath);
    for (const path of product.additionalImagePaths ?? []) if (path) paths.add(path);
  }
  for (const category of categories) if (category.imagePath) paths.add(category.imagePath);
  return paths;
}

export function findUnreferencedImagePaths(storagePaths: string[], referencedPaths: Set<string>): string[] {
  return [...new Set(storagePaths)].filter(path => !referencedPaths.has(path)).sort();
}

export async function uploadValidatedImage(
  upload: (path: string, bytes: Uint8Array, contentType: string) => Promise<{ error: { message: string } | null }>,
  bytes: Uint8Array,
  declaredType: string,
  id: string,
  folder: 'catalog' | 'banners' = 'catalog',
): Promise<string> {
  const contentType = validateImageBytes(bytes, declaredType);
  const extension = contentType === 'image/jpeg' ? 'jpg' : contentType.split('/')[1]!;
  const path = `${folder}/${id}.${extension}`;
  let result: { error: { message: string } | null };
  try {
    result = await upload(path, bytes, contentType);
  } catch (error) {
    throw new Error(`Falha ao enviar a imagem: ${error instanceof Error ? error.message : 'erro inesperado'}`);
  }
  if (result.error) throw new Error(`Falha ao enviar a imagem: ${result.error.message}`);
  return path;
}

export async function processImageForUpload(file: File, crop: { x: number; y: number; width: number; height: number }): Promise<File> {
  if (file.size > MAX_IMAGE_INPUT_BYTES) throw new Error('Use uma imagem de até 5 MB.');
  if (!acceptedImageTypes.includes(file.type as (typeof acceptedImageTypes)[number])) {
    throw new Error('Use JPG, PNG ou WebP.');
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / crop.width, 1200 / crop.height);
    const width = Math.max(1, Math.round(crop.width * scale));
    const height = Math.max(1, Math.round(crop.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível preparar a imagem.');

    context.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
    let quality = 0.86;
    let blob = await canvasToBlob(canvas, 'image/webp', quality);
    while (blob.size > 500 * 1024 && quality > 0.55) {
      quality = Math.max(0.55, quality - 0.08);
      blob = await canvasToBlob(canvas, 'image/webp', quality);
    }
    if (blob.type !== 'image/webp') {
      quality = 0.86;
      blob = await canvasToBlob(canvas, 'image/jpeg', quality);
      while (blob.size > 500 * 1024 && quality > 0.55) {
        quality = Math.max(0.55, quality - 0.08);
        blob = await canvasToBlob(canvas, 'image/jpeg', quality);
      }
    }
    if (blob.size > MAX_IMAGE_INPUT_BYTES) throw new Error('A imagem processada excede o limite de 5 MB.');
    const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
    return new File([blob], `majesta-image.${extension}`, { type: blob.type });
  } finally {
    bitmap.close();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Não foi possível comprimir a imagem.')), type, quality);
  });
}
