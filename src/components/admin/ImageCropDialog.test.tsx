import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageCropDialog } from './ImageCropDialog';

const imageProcessing = vi.hoisted(() => ({
  process: vi.fn(),
  validate: vi.fn(),
}));

vi.mock('@/lib/product-images', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/product-images')>();
  return {
    ...original,
    processImageForUpload: imageProcessing.process,
    validateImageBytes: imageProcessing.validate,
  };
});

function imageFile(name: string, type: string): File {
  return new File(['test image'], name, { type });
}

function processedImageFile(): File {
  const file = new File(['optimized'], 'optimized.webp', { type: 'image/webp' });
  Object.defineProperty(file, 'arrayBuffer', {
    configurable: true,
    value: async () => new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]).buffer,
  });
  return file;
}

function markImageAsLoaded(image: HTMLImageElement, width = 1200, height = 900): void {
  Object.defineProperties(image, {
    naturalWidth: { configurable: true, value: width },
    naturalHeight: { configurable: true, value: height },
    complete: { configurable: true, value: true },
  });
  fireEvent.load(image);
}

describe('ImageCropDialog', () => {
  let createObjectUrl: ReturnType<typeof vi.fn>;
  let revokeObjectUrl: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    let nextUrl = 0;
    createObjectUrl = vi.fn(() => `blob:test-${++nextUrl}`);
    revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(480);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(360);
    imageProcessing.process.mockReset();
    imageProcessing.validate.mockReset();
    imageProcessing.process.mockImplementation(async () => processedImageFile());
    imageProcessing.validate.mockReturnValue('image/webp');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it.each([
    ['JPG', 'produto.jpg', 'image/jpeg'],
    ['PNG', 'produto.png', 'image/png'],
    ['WebP', 'produto.webp', 'image/webp'],
  ])('accepts a selected %s image and waits for its asynchronous load', async (_format, name, type) => {
    const file = imageFile(name, type);
    const onConfirm = vi.fn();
    render(<ImageCropDialog file={file} onCancel={vi.fn()} onConfirm={onConfirm} />);

    const image = await screen.findByAltText('Pré-visualização do corte') as HTMLImageElement;
    expect(image.getAttribute('src')).toMatch(/^blob:test-/);
    expect(screen.getByRole('status')).toHaveTextContent('Carregando');
    expect(screen.getByRole('button', { name: 'Confirmar corte e enviar' })).toBeDisabled();
    expect(imageProcessing.process).not.toHaveBeenCalled();

    markImageAsLoaded(image);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar corte e enviar' })).toBeEnabled());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('handles a temporarily null image reference without throwing', async () => {
    const file = imageFile('produto.jpg', 'image/jpeg');
    const { rerender } = render(<ImageCropDialog file={file} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(await screen.findByAltText('Pré-visualização do corte')).toBeInTheDocument();

    rerender(<ImageCropDialog file={null} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.queryByAltText('Pré-visualização do corte')).not.toBeInTheDocument();
    rerender(<ImageCropDialog file={file} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(await screen.findByAltText('Pré-visualização do corte')).toBeInTheDocument();
  });

  it('shows a recoverable message when the selected image fails to load', async () => {
    const onConfirm = vi.fn();
    render(<ImageCropDialog file={imageFile('invalid.png', 'image/png')} onCancel={vi.fn()} onConfirm={onConfirm} />);
    fireEvent.error(await screen.findByAltText('Pré-visualização do corte'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar esta imagem');
    expect(screen.getByRole('button', { name: 'Confirmar corte e enviar' })).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('discards stale loading events when the selected file changes', async () => {
    const firstFile = imageFile('primeira.jpg', 'image/jpeg');
    const nextFile = imageFile('segunda.webp', 'image/webp');
    const { rerender } = render(<ImageCropDialog file={firstFile} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    const firstImage = await screen.findByAltText('Pré-visualização do corte') as HTMLImageElement;

    rerender(<ImageCropDialog file={nextFile} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    const nextImage = await screen.findByAltText('Pré-visualização do corte') as HTMLImageElement;
    expect(nextImage).not.toBe(firstImage);
    expect(nextImage.src).toBe('blob:test-2');
    expect(screen.getByRole('button', { name: 'Confirmar corte e enviar' })).toBeDisabled();

    markImageAsLoaded(nextImage);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar corte e enviar' })).toBeEnabled());
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:test-1');
  });

  it('cancels, releases temporary URLs, and supports reopening with a replacement photo', async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const file = imageFile('produto.jpg', 'image/jpeg');
    const { rerender } = render(<ImageCropDialog file={file} onCancel={onCancel} onConfirm={onConfirm} />);
    await screen.findByAltText('Pré-visualização do corte');

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledOnce();
    rerender(<ImageCropDialog file={null} onCancel={onCancel} onConfirm={onConfirm} />);
    await waitFor(() => expect(revokeObjectUrl).toHaveBeenCalledWith('blob:test-1'));

    rerender(<ImageCropDialog file={imageFile('substituta.png', 'image/png')} onCancel={onCancel} onConfirm={onConfirm} />);
    const replacement = await screen.findByAltText('Pré-visualização do corte') as HTMLImageElement;
    expect(replacement.src).toBe('blob:test-2');
  });

  it('only confirms after processing and keeps the editor open if processing fails', async () => {
    const onConfirm = vi.fn();
    const file = imageFile('produto.jpg', 'image/jpeg');
    render(<ImageCropDialog file={file} onCancel={vi.fn()} onConfirm={onConfirm} />);
    markImageAsLoaded(await screen.findByAltText('Pré-visualização do corte') as HTMLImageElement);

    const confirm = screen.getByRole('button', { name: 'Confirmar corte e enviar' });
    await waitFor(() => expect(confirm).toBeEnabled());
    imageProcessing.process.mockRejectedValueOnce(new Error('Falha ao recortar'));
    fireEvent.click(confirm);

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao recortar');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByAltText('Pré-visualização do corte')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
  });

  it('passes the selected file to processing and confirms only the processed file', async () => {
    const onConfirm = vi.fn();
    const file = imageFile('original.jpg', 'image/jpeg');
    render(<ImageCropDialog file={file} onCancel={vi.fn()} onConfirm={onConfirm} />);
    markImageAsLoaded(await screen.findByAltText('Pré-visualização do corte') as HTMLImageElement);
    const confirm = screen.getByRole('button', { name: 'Confirmar corte e enviar' });
    await waitFor(() => expect(confirm).toBeEnabled());

    fireEvent.click(confirm);
    await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce());
    expect(imageProcessing.process).toHaveBeenCalledWith(file, expect.objectContaining({
      width: expect.any(Number),
      height: expect.any(Number),
    }));
    expect(onConfirm.mock.calls[0]?.[0]).toMatchObject({ name: 'optimized.webp', type: 'image/webp' });
  });
});
