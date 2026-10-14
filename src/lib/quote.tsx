import { useCatalog } from './catalog-context';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Product } from '@/data/catalog';
import {
  formatProductDimensions,
  enrichQuoteItems,
  migrateQuoteItems,
  quoteItemKey,
  variationIdForValue,
  type QuoteItem,
} from './quote-model';

export {
  buildQuoteMessage,
  calculateTotalUnits,
  quoteContactSchema,
  quoteItemKey,
  openWhatsAppQuote,
  prepareQuoteForWhatsApp,
  validateQuoteItemsAgainstCatalog,
  validateQuoteRequest,
} from './quote-model';
export type { QuoteContact, QuoteItem } from './quote-model';

type Ctx = {
  items: QuoteItem[];
  add: (product: Product, variation?: string) => void;
  remove: (key: string) => void;
  setQty: (key: string, quantity: string) => void;
  setVariation: (key: string, variation: string) => void;
  has: (slug: string, variation?: string) => boolean;
};
const QuoteCtx = createContext<Ctx | null>(null);
const KEY = 'majesta-orcamento';

function makeQuoteItem(product: Product, variation?: string): QuoteItem {
  const selectedVariation = variation?.trim() || undefined;
  return {
    id: crypto.randomUUID(),
    slug: product.slug,
    name: product.name,
    quantity: '',
    ...(selectedVariation ? { variationId: variationIdForValue(selectedVariation), variation: selectedVariation } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.material ? { material: product.material } : {}),
    ...(formatProductDimensions(product) ? { dimensions: formatProductDimensions(product) } : {}),
    packageQuantity: product.packageQuantity,
    ...(product.packageType ? { packageType: product.packageType } : {}),
    ...(product.packUnit ? { packUnit: product.packUnit } : {}),
  };
}

export function QuoteProvider({ children }: { children: ReactNode }) {
  const { products } = useCatalog();
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const savedItems = migrateQuoteItems(JSON.parse(localStorage.getItem(KEY) || '[]'));
      setItems(enrichQuoteItems(
        savedItems.filter(item => products.some(product => product.slug === item.slug && product.active)),
        products,
      ));
    } catch {
      setItems([]);
    }
    setReady(true);
  }, [products]);

  useEffect(() => {
    if (ready) localStorage.setItem(KEY, JSON.stringify(items));
  }, [items, ready]);

  const value: Ctx = {
    items,
    add: (product, variation) => {
      const item = makeQuoteItem(product, variation);
      setItems(current => current.some(existing =>
        existing.slug === item.slug && existing.variationId === item.variationId,
      ) ? current : [...current, item]);
    },
    remove: key => setItems(current => current.filter(item => quoteItemKey(item) !== key)),
    setQty: (key, quantity) => setItems(current => current.map(item => quoteItemKey(item) === key ? { ...item, quantity } : item)),
    setVariation: (key, variation) => setItems(current => current.map(item => {
      if (quoteItemKey(item) !== key) return item;
      const normalized = variation.trim();
      return { ...item, variationId: variationIdForValue(normalized), variation: normalized };
    })),
    has: (slug, variation) => items.some(item =>
      item.slug === slug && item.variationId === (variation ? variationIdForValue(variation) : undefined),
    ),
  };
  return <QuoteCtx.Provider value={value}>{children}</QuoteCtx.Provider>;
}

export function useQuote() {
  const context = useContext(QuoteCtx);
  if (!context) throw new Error('useQuote outside provider');
  return context;
}
