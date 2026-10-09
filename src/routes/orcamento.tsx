import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { PageHero } from "@/components/site/Layout";
import { buildQuoteMessage, useQuote } from "@/lib/quote";
import { whatsappLink } from "@/lib/config";

export const Route = createFileRoute("/orcamento")({
  head: () => ({
    meta: [
      { title: "Solicitar Orçamento | Majesta Embalagens" },
      { name: "description", content: "Monte sua lista de embalagens e envie o pedido de orçamento pelo WhatsApp." },
      { property: "og:title", content: "Solicitar Orçamento | Majesta Embalagens" },
      { property: "og:description", content: "Selecione produtos, informe quantidades e envie pelo WhatsApp." },
    ],
  }),
  component: Quote,
});

const field = "h-11 w-full rounded-xl border border-input bg-background px-3 outline-none focus:ring-2 focus:ring-ring";

function Quote() {
  const { items, remove, setQty } = useQuote();
  const [c, setC] = useState({ nome: "", empresa: "", cidade: "" });
  const ok = items.length > 0 && c.nome && c.empresa && c.cidade;
  return (
    <>
      <PageHero eyebrow="Orçamento" title="Sua lista de orçamento" text="Informe as quantidades, preencha seus dados e envie a lista completa pelo WhatsApp." />
      <section className="mx-auto grid max-w-6xl gap-8 px-5 py-12 lg:grid-cols-[1fr_380px]">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="font-bold text-navy">Produtos selecionados</h2>
          {items.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">Sua lista está vazia. <Link to="/produtos" className="font-semibold text-navy underline">Navegue pelo catálogo</Link> e clique em "Solicitar cotação".</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {items.map((i) => (
                <li key={i.slug} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_200px_auto]">
                  <span className="min-w-0 truncate font-medium">{i.name}</span>
                  <input value={i.quantity} onChange={(e) => setQty(i.slug, e.target.value)} placeholder="Ex.: 500 unidades" className={`${field} col-span-2 sm:col-span-1`} />
                  <button aria-label="Remover" onClick={() => remove(i.slug)} className="row-start-1 col-start-2 rounded-lg p-2 text-muted-foreground hover:text-destructive sm:col-start-3"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="h-fit rounded-2xl bg-gradient-navy p-6 text-primary-foreground shadow-card">
          <h2 className="font-bold">Seus dados</h2>
          <div className="mt-4 space-y-3 text-foreground">
            {(["nome", "empresa", "cidade"] as const).map((k) => (
              <input key={k} value={c[k]} maxLength={100} onChange={(e) => setC({ ...c, [k]: e.target.value })} placeholder={k[0].toUpperCase() + k.slice(1)} className={field} />
            ))}
          </div>
          <a
            href={ok ? whatsappLink(buildQuoteMessage(items, c)) : undefined}
            target="_blank" rel="noreferrer" aria-disabled={!ok}
            className={`mt-5 block rounded-full px-6 py-3.5 text-center font-bold ${ok ? "bg-gold text-navy hover:brightness-105" : "pointer-events-none bg-primary-foreground/15 text-primary-foreground/50"}`}
          >Enviar pelo WhatsApp</a>
          <p className="mt-3 text-xs text-primary-foreground/60">Nenhum pagamento é feito pelo site. A Majesta retornará com a cotação.</p>
        </div>
      </section>
    </>
  );
}
