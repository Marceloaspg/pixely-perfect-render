import { z } from "zod";
import { useCatalog } from "./catalog-context";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type QuoteItem = { slug: string; name: string; quantity: string };
export type QuoteContact = { nome: string; empresa: string; cidade: string };

export function buildQuoteMessage(items: QuoteItem[], c: QuoteContact) {
  const lines = items.map((i) => `Produto: ${i.name}\nQuantidade: ${i.quantity || "a definir"}`).join("\n\n");
  return `Olá, Majesta Embalagens!\n\nGostaria de solicitar um orçamento para os seguintes produtos:\n\n${lines}\n\nNome: ${c.nome}\nEmpresa: ${c.empresa}\nCidade: ${c.cidade}\n\nAguardo retorno. Obrigado!`;
}

type Ctx = {
  items: QuoteItem[];
  add: (slug: string, name: string) => void;
  remove: (slug: string) => void;
  setQty: (slug: string, q: string) => void;
  has: (slug: string) => boolean;
};
const QuoteCtx = createContext<Ctx | null>(null);
const KEY = "majesta-orcamento";

export function QuoteProvider({ children }: { children: ReactNode }) {
  const { products } = useCatalog();
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { const rows = z.array(z.object({slug:z.string(),name:z.string(),quantity:z.string()})).parse(JSON.parse(localStorage.getItem(KEY) || "[]")); setItems(rows.filter(i=>products.some(p=>p.slug===i.slug))); } catch { /* ignore */ }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(KEY, JSON.stringify(items)); }, [items, ready]);

  const value: Ctx = {
    items,
    add: (slug, name) => setItems((p) => (p.some((i) => i.slug === slug) ? p : [...p, { slug, name, quantity: "" }])),
    remove: (slug) => setItems((p) => p.filter((i) => i.slug !== slug)),
    setQty: (slug, q) => setItems((p) => p.map((i) => (i.slug === slug ? { ...i, quantity: q } : i))),
    has: (slug) => items.some((i) => i.slug === slug),
  };
  return <QuoteCtx.Provider value={value}>{children}</QuoteCtx.Provider>;
}

export function useQuote() {
  const c = useContext(QuoteCtx);
  if (!c) throw new Error("useQuote outside provider");
  return c;
}
