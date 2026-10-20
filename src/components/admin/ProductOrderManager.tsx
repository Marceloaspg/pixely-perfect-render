import { useRef, useState, type DragEvent } from "react";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import type { Product } from "@/data/catalog";
import { Button } from "@/components/ui/button";
import { moveProductInOrder } from "@/lib/catalog-product-order";

export function ProductOrderManager({
  products,
  busy,
  onSave,
  onCancel,
}: {
  products: Product[];
  busy: boolean;
  onSave: (slugs: string[]) => void;
  onCancel: () => void;
}) {
  const [order, setOrder] = useState(() => products.map((product) => product.slug));
  const draggedProduct = useRef<string | null>(null);
  const productsBySlug = new Map(products.map((product) => [product.slug, product]));
  const orderedProducts = order.flatMap((slug) => {
    const product = productsBySlug.get(slug);
    return product ? [product] : [];
  });

  function moveBy(slug: string, offset: -1 | 1) {
    const index = order.indexOf(slug);
    const target = order[index + offset];
    if (index < 0 || !target) return;
    setOrder((current) => moveProductInOrder(current, slug, target));
  }

  function handleDrop(event: DragEvent<HTMLLIElement>, targetSlug: string) {
    event.preventDefault();
    const sourceSlug = event.dataTransfer.getData("text/plain") || draggedProduct.current;
    if (sourceSlug) setOrder((current) => moveProductInOrder(current, sourceSlug, targetSlug));
    draggedProduct.current = null;
  }

  return (
    <section className="space-y-4" aria-labelledby="product-order-heading">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="product-order-heading" className="text-xl font-bold text-navy">
            Organizar produtos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Arraste os produtos ou use os controles de posição. Esta lista completa altera somente
            a ordem administrativa.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" disabled={busy} onClick={() => onSave(order)}>
            {busy ? "Salvando..." : "Salvar ordem"}
          </Button>
        </div>
      </header>

      <ol className="divide-y divide-border rounded-2xl border border-border bg-card shadow-card">
        {orderedProducts.map((product, index) => (
          <li
            key={product.slug}
            draggable={!busy}
            onDragStart={(event) => {
              draggedProduct.current = product.slug;
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", product.slug);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDrop(event, product.slug)}
            onDragEnd={() => {
              draggedProduct.current = null;
            }}
            className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 p-4"
          >
            <GripVertical
              className="h-5 w-5 cursor-grab text-muted-foreground active:cursor-grabbing"
              aria-hidden="true"
            />
            <span className="w-8 text-center text-sm font-bold text-navy" aria-label={`Posição ${index + 1}`}>
              {index + 1}
            </span>
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                {product.image ? (
                  <img src={product.image} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="truncate font-bold text-navy">{product.name}</p>
                {product.sku && (
                  <p className="truncate text-xs font-mono text-muted-foreground">
                    SKU: {product.sku}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Mover ${product.name} para cima`}
                disabled={busy || index === 0}
                onClick={() => moveBy(product.slug, -1)}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Mover ${product.name} para baixo`}
                disabled={busy || index === orderedProducts.length - 1}
                onClick={() => moveBy(product.slug, 1)}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
        {orderedProducts.length === 0 && (
          <li className="p-8 text-center text-sm text-muted-foreground">
            Não há produtos para organizar.
          </li>
        )}
      </ol>
    </section>
  );
}
