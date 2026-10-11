import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MAX_IMAGE_INPUT_BYTES, processImageForUpload, validateImageBytes } from '@/lib/product-images';

type Crop = { x: number; y: number; width: number; height: number };
type Preview = { file: File; url: string };

export function ImageCropDialog({
  file,
  onCancel,
  onConfirm,
}: {
  file: File | null;
  onCancel: () => void;
  onConfirm: (processed: File) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [imageStatus, setImageStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [dimensions, setDimensions] = useState({ width: 0, height: 0, stageWidth: 0, stageHeight: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const processingGeneration = useRef(0);
  const sourceUrl = file && preview?.file === file ? preview.url : '';

  useEffect(() => {
    processingGeneration.current++;
    setProcessing(false);
    setDimensions({ width: 0, height: 0, stageWidth: 0, stageHeight: 0 });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setError('');
    setImageStatus('loading');
    if (!file) {
      setPreview(null);
      return;
    }

    let url: string;
    try {
      url = URL.createObjectURL(file);
    } catch {
      setPreview(null);
      setImageStatus('error');
      setError('Não foi possível preparar a pré-visualização da imagem.');
      return;
    }
    setPreview({ file, url });

    return () => URL.revokeObjectURL(url);
  }, [file]);

  function measureStage() {
    const stage = stageRef.current;
    if (!stage) return;
    setDimensions(current => ({
      ...current,
      stageWidth: stage.clientWidth,
      stageHeight: stage.clientHeight,
    }));
  }

  const baseWidth = dimensions.width && dimensions.stageWidth
    ? Math.max(dimensions.stageWidth / dimensions.width, dimensions.stageHeight / dimensions.height) * dimensions.width
    : 0;
  const baseHeight = dimensions.height && dimensions.stageHeight
    ? Math.max(dimensions.stageWidth / dimensions.width, dimensions.stageHeight / dimensions.height) * dimensions.height
    : 0;
  const displayedWidth = baseWidth * zoom;
  const displayedHeight = baseHeight * zoom;

  function constrainOffset(x: number, y: number, nextZoom = zoom) {
    const maxX = Math.max(0, (baseWidth * nextZoom - dimensions.stageWidth) / 2);
    const maxY = Math.max(0, (baseHeight * nextZoom - dimensions.stageHeight) / 2);
    setOffset({ x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) });
  }

  async function confirmCrop() {
    const image = imageRef.current;
    const sourceFile = file;
    if (
      !sourceFile ||
      !image ||
      imageStatus !== 'loaded' ||
      !image.complete ||
      image.naturalWidth <= 0 ||
      image.naturalHeight <= 0 ||
      !dimensions.width ||
      !dimensions.height ||
      !dimensions.stageWidth ||
      !dimensions.stageHeight
    ) return;
    const generation = processingGeneration.current;
    setProcessing(true);
    setError('');
    try {
      const renderedWidth = baseWidth * zoom;
      const renderedHeight = baseHeight * zoom;
      const left = dimensions.stageWidth / 2 + offset.x - renderedWidth / 2;
      const top = dimensions.stageHeight / 2 + offset.y - renderedHeight / 2;
      const crop: Crop = {
        x: Math.max(0, -left / renderedWidth * dimensions.width),
        y: Math.max(0, -top / renderedHeight * dimensions.height),
        width: dimensions.stageWidth / renderedWidth * dimensions.width,
        height: dimensions.stageHeight / renderedHeight * dimensions.height,
      };
      const output = await processImageForUpload(sourceFile, crop);
      if (processingGeneration.current !== generation) return;
      const bytes = new Uint8Array(await output.arrayBuffer());
      validateImageBytes(bytes, output.type);
      if (processingGeneration.current === generation) onConfirm(output);
    } catch (cause) {
      if (processingGeneration.current !== generation) return;
      setError(cause instanceof Error ? cause.message : 'Não foi possível processar a imagem.');
    } finally {
      if (processingGeneration.current === generation) setProcessing(false);
    }
  }

  return (
    <Dialog open={!!file} onOpenChange={open => { if (!open && !processing) onCancel(); }}>
      <DialogContent className="max-h-[95vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enquadrar fotografia</DialogTitle>
          <DialogDescription>Arraste para posicionar, ajuste o zoom e confirme o corte 4:3 antes do upload. Arquivo original: até {Math.round(MAX_IMAGE_INPUT_BYTES / 1024 / 1024)} MB.</DialogDescription>
        </DialogHeader>
        {file && sourceUrl && (
          <div
            ref={stageRef}
            className="relative aspect-[4/3] w-full touch-none overflow-hidden rounded-xl bg-black"
            onPointerDown={event => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragStart({ pointerX: event.clientX, pointerY: event.clientY, ...offset });
            }}
            onPointerMove={event => {
              if (dragStart) constrainOffset(dragStart.x + event.clientX - dragStart.pointerX, dragStart.y + event.clientY - dragStart.pointerY);
            }}
            onPointerUp={() => setDragStart(null)}
            onPointerCancel={() => setDragStart(null)}
          >
            <img
              ref={imageRef}
              src={sourceUrl}
              alt="Pré-visualização do corte"
              draggable={false}
              onLoad={event => {
                const image = event.currentTarget;
                if (!image || imageRef.current !== image) return;
                const width = image.naturalWidth;
                const height = image.naturalHeight;
                if (!width || !height) return;
                setDimensions({
                  width,
                  height,
                  stageWidth: stageRef.current?.clientWidth ?? 0,
                  stageHeight: stageRef.current?.clientHeight ?? 0,
                });
                setImageStatus('loaded');
                requestAnimationFrame(measureStage);
              }}
              onError={event => {
                if (imageRef.current !== event.currentTarget) return;
                setDimensions({ width: 0, height: 0, stageWidth: 0, stageHeight: 0 });
                setImageStatus('error');
                setError('Não foi possível carregar esta imagem. Escolha outro arquivo.');
              }}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
              style={{ width: displayedWidth, height: displayedHeight, transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` }}
            />
            {imageStatus === 'loading' && (
              <p role="status" className="absolute inset-0 flex items-center justify-center text-sm text-white">
                Carregando pré-visualização...
              </p>
            )}
            <div className="pointer-events-none absolute inset-0 border border-white/80" />
          </div>
        )}
        <label className="block text-sm font-medium">
          Zoom
          <input
            className="mt-2 w-full"
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={event => {
              const nextZoom = Number(event.target.value);
              setZoom(nextZoom);
              constrainOffset(offset.x, offset.y, nextZoom);
            }}
          />
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={processing} onClick={onCancel}>Cancelar</Button>
          <Button type="button" disabled={!file || processing || imageStatus !== 'loaded' || !dimensions.width || !dimensions.stageWidth || !dimensions.stageHeight} onClick={confirmCrop}>
            {processing ? 'Processando...' : 'Confirmar corte e enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
