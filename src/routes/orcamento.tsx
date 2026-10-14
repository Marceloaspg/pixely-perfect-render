import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useCatalog } from '@/lib/catalog-context';
import { Button } from '@/components/ui/button';
import { PageHero } from '@/components/site/Layout';
import { quoteItemKey, useQuote, validateQuoteItemsAgainstCatalog, validateQuoteRequest } from '@/lib/quote';
import { calculateTotalUnits, openWhatsAppQuote, prepareQuoteForWhatsApp } from '@/lib/quote-model';

export const Route = createFileRoute('/orcamento')({
  head: () => ({
    meta: [{ property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
      { title: 'Solicitar Orçamento | Majesta Embalagens' },
      { name: 'description', content: 'Monte sua lista de embalagens e envie o pedido de orçamento pelo WhatsApp.' },
      { property: 'og:title', content: 'Solicitar Orçamento | Majesta Embalagens' },
      { property: 'og:description', content: 'Selecione produtos, informe quantidades e envie pelo WhatsApp.' },
    ],
  }),
  component: Quote,
});

const field = 'h-11 w-full rounded-xl border border-input bg-background px-3 outline-none focus:ring-2 focus:ring-ring';

function Quote() {
  const { items, remove, setQty, setVariation } = useQuote();
  const { config, products } = useCatalog();
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [contact, setContact] = useState({ nome: '', empresa: '', cidade: '', whatsapp: '', email: '', observations: '' });
  const validationError = validateQuoteRequest(items, contact) ?? validateQuoteItemsAgainstCatalog(items, products);

  function send() {
    const prepared = prepareQuoteForWhatsApp(items, contact, products, config.whatsapp);
    if (!prepared.ok) {
      setError(prepared.error);
      return;
    }

    setError('');
    setStatus('');
    if (!openWhatsAppQuote(prepared.url)) {
      setError('Não foi possível abrir o WhatsApp. Tente novamente ou copie os dados da sua lista antes de sair.');
      return;
    }
    setStatus('O WhatsApp foi aberto com a mensagem preparada. Revise e envie por lá; sua lista continua salva neste navegador.');
  }

  return (
    <>
      <PageHero eyebrow="Orçamento" title="Sua lista de orçamento" text="Informe quantidades, seus dados e envie a solicitação pelo WhatsApp." />
      <section className="mx-auto grid max-w-6xl gap-8 px-5 py-12 lg:grid-cols-[1fr_380px]">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="font-bold text-navy">Produtos selecionados</h2>
          {items.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">Sua lista está vazia. <Link to="/produtos" className="font-semibold text-navy underline">Navegue pelo catálogo</Link> e clique em “Solicitar cotação”.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {items.map(item => {
                const product = products.find(candidate => candidate.slug === item.slug);
                const key = quoteItemKey(item);
                const totalUnits = calculateTotalUnits(item.quantity, item.packageQuantity);
                const alternatives = [...new Set(product?.variations.map(value => value.trim()).filter(Boolean) ?? [])];
                return (
                  <li key={key} className="grid gap-4 py-5 sm:grid-cols-[100px_minmax(0,1fr)_auto]">
                    <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-muted">
                      {product?.image ? <img src={product.image} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="text-xs text-muted-foreground">Sem foto</span>}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <h3 className="font-semibold text-navy">{item.name}</h3>
                      {item.sku && <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>}
                      {alternatives.length > 1 ? (
                        <label className="block pt-1 text-sm">
                          <span className="font-medium">Tamanho/modelo</span>
                          <select aria-label={`Tamanho ou modelo de ${item.name}`} value={item.variation ?? ''} onChange={event => setVariation(key, event.target.value)} className={`${field} mt-1`}>
                            <option value="" disabled>Selecione uma opção</option>
                            {alternatives.map(value => <option key={value} value={value}>{value}</option>)}
                          </select>
                        </label>
                      ) : item.variation ? <p className="text-sm">Tamanho/modelo: {item.variation}</p> : null}
                      {item.material && <p className="text-sm text-muted-foreground">Material: {item.material}</p>}
                      {item.dimensions && <p className="text-sm text-muted-foreground">Dimensões: {item.dimensions}</p>}
                      {item.packageQuantity ? (
                        <p className="text-sm text-muted-foreground">Embalagem comercial: {item.packageType || item.packUnit || 'embalagem'} com {item.packageQuantity} unidades</p>
                      ) : item.packUnit ? <p className="text-sm text-muted-foreground">Unidade comercial: {item.packUnit}</p> : null}
                      {totalUnits !== null && <p className="text-sm font-medium text-navy">Total estimado: {totalUnits.toLocaleString('pt-BR')} unidades</p>}
                      <label className="mt-2 block max-w-xs text-sm font-medium">
                        {item.packageQuantity ? `Embalagens solicitadas (${item.packageType || 'embalagem'})` : 'Quantidade solicitada'}
                        <input
                          aria-label={`Quantidade de ${item.name}${item.variation ? ` ${item.variation}` : ''}`}
                          type="text"
                          inputMode="numeric"
                          maxLength={30}
                          value={item.quantity}
                          onChange={event => setQty(key, event.target.value)}
                          placeholder="Ex.: 10"
                          className={`${field} mt-1`}
                        />
                      </label>
                    </div>
                    <Button variant="ghost" size="icon" aria-label={`Remover ${item.name}${item.variation ? ` ${item.variation}` : ''}`} onClick={() => remove(key)} className="justify-self-end rounded-lg p-2 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="h-fit rounded-2xl bg-gradient-navy p-6 text-primary-foreground shadow-card">
          <h2 className="font-bold">Seus dados</h2>
          <div className="mt-4 space-y-3 text-foreground">
            <label className="block text-sm">Nome *
              <input aria-label="Nome" autoComplete="off" value={contact.nome} maxLength={100} onChange={event => setContact({ ...contact, nome: event.target.value })} placeholder="Seu nome" className={`${field} mt-1`} />
            </label>
            <label className="block text-sm">Empresa (opcional)
              <input aria-label="Empresa" autoComplete="off" value={contact.empresa} maxLength={100} onChange={event => setContact({ ...contact, empresa: event.target.value })} placeholder="Empresa" className={`${field} mt-1`} />
            </label>
            <label className="block text-sm">Cidade *
              <input aria-label="Cidade" autoComplete="off" value={contact.cidade} maxLength={100} onChange={event => setContact({ ...contact, cidade: event.target.value })} placeholder="Cidade" className={`${field} mt-1`} />
            </label>
            <label className="block text-sm">WhatsApp para contato *
              <input aria-label="WhatsApp para contato" autoComplete="off" type="tel" value={contact.whatsapp} maxLength={30} onChange={event => setContact({ ...contact, whatsapp: event.target.value })} placeholder="(19) 99999-9999" className={`${field} mt-1`} />
            </label>
            <label className="block text-sm">E-mail (opcional)
              <input aria-label="E-mail" autoComplete="off" type="email" value={contact.email} maxLength={254} onChange={event => setContact({ ...contact, email: event.target.value })} placeholder="voce@exemplo.com" className={`${field} mt-1`} />
            </label>
            <label className="block text-sm">Observações (opcional)
              <textarea aria-label="Observações" autoComplete="off" value={contact.observations} maxLength={1000} onChange={event => setContact({ ...contact, observations: event.target.value })} placeholder="Informações adicionais sobre sua solicitação" className="mt-1 min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" />
            </label>
          </div>
          {validationError && <p role="alert" className="mt-4 text-sm">{validationError}</p>}
          <Button variant="gold" disabled={!!validationError} onClick={send} className="mt-5 h-12 w-full">Continuar pelo WhatsApp</Button>
          {error && <p role="alert" className="mt-3 text-sm">{error}</p>}
          {status && <p role="status" className="mt-3 text-sm">{status}</p>}
          <p className="mt-3 text-xs text-primary-foreground/60">A mensagem só será enviada quando você confirmar no WhatsApp. Consulte a <Link to="/privacidade" className="underline">política de privacidade</Link>.</p>
        </div>
      </section>
    </>
  );
}
