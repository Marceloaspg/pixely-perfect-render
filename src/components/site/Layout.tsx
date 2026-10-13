import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, ClipboardList, Mail, Instagram, Facebook, MessageCircle } from "lucide-react";
import logo from "@/assets/majesta-logo.png.asset.json";
import { type Product } from "@/data/catalog";
import { whatsappLink } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { useCatalog } from "@/lib/catalog-context";
import { useQuote } from "@/lib/quote";

const nav = [
  { to: "/", label: "Início" },
  { to: "/produtos", label: "Produtos" },
  { to: "/segmentos", label: "Soluções por Segmento" },
  { to: "/sobre", label: "Sobre Nós" },
  { to: "/contato", label: "Contato" },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  const { items } = useQuote();
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-5">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <img src={logo.url} alt="Majesta Embalagens" width={48} height={48} className="h-12 w-12 shrink-0 rounded-full" />
          <span className="hidden truncate text-sm font-extrabold tracking-[0.18em] text-navy sm:block">MAJESTA<span className="block text-[10px] font-semibold tracking-[0.35em] text-gold">EMBALAGENS</span></span>
        </Link>
        <nav className="hidden items-center gap-7 lg:flex">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: n.to === "/" }} className="text-sm font-medium text-foreground/80 transition-colors hover:text-navy data-[status=active]:text-navy data-[status=active]:font-bold">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <Link to="/orcamento" className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-navy-soft">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Solicitar orçamento</span>
            {items.length > 0 && <span className="rounded-full bg-gold px-2 text-xs font-bold text-navy">{items.length}</span>}
          </Link>
          <Button variant="ghost" size="icon" aria-label="Menu" onClick={() => setOpen(!open)} className="rounded-md p-2 lg:hidden">{open ? <X /> : <Menu />}</Button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-border bg-background px-5 py-3 lg:hidden">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="block py-3 font-medium text-foreground">{n.label}</Link>
          ))}
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  const { categories, config: siteConfig } = useCatalog();
  return (
    <footer className="bg-gradient-navy text-primary-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-4">
        <div>
          <img src={logo.url} alt="Majesta Embalagens" width={96} height={96} loading="lazy" className="h-24 w-24 rounded-full" />
          <p className="mt-4 text-sm text-primary-foreground/70">A embalagem certa valoriza o seu negócio.</p>
        </div>
        <div className="md:col-span-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gold">Categorias</h3>
          <ul className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            {categories.map((c) => (
              <li key={c.slug}><Link to="/categorias/$slug" params={{ slug: c.slug }} className="text-primary-foreground/75 hover:text-gold">{c.name}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-gold">Contato</h3>
          <ul className="mt-4 space-y-3 text-sm text-primary-foreground/75">
            <li><a href={whatsappLink("Olá, Majesta Embalagens!", siteConfig.whatsapp)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-gold"><MessageCircle className="h-4 w-4" /> WhatsApp</a></li>
            {siteConfig.instagram && <li><a href={siteConfig.instagram} className="inline-flex items-center gap-2 hover:text-gold"><Instagram className="h-4 w-4" /> Instagram</a></li>}
            {siteConfig.facebook && <li><a href={siteConfig.facebook} className="inline-flex items-center gap-2 hover:text-gold"><Facebook className="h-4 w-4" /> Facebook</a></li>}
            {siteConfig.email && <li><a href={`mailto:${siteConfig.email}`} className="inline-flex items-center gap-2 hover:text-gold"><Mail className="h-4 w-4" /> {siteConfig.email}</a></li>}
            <li><Link to="/admin" className="hover:text-gold">Área administrativa</Link></li>
            <li><Link to="/privacidade" className="hover:text-gold">Política de Privacidade</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-primary-foreground/10 py-5 text-center text-xs text-primary-foreground/60">
        © {new Date().getFullYear()} Majesta Embalagens. Todos os direitos reservados.
      </div>
    </footer>
  );
}

export function PageHero({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <section className="bg-gradient-navy text-primary-foreground">
      <div className="mx-auto max-w-7xl px-5 py-16 md:py-20">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-gold">{eyebrow}</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-extrabold tracking-tight md:text-5xl">{title}</h1>
        {text && <p className="mt-4 max-w-2xl text-primary-foreground/75">{text}</p>}
      </div>
    </section>
  );
}

export function ProductCard({ p }: { p: Product }) {
  const { add, has } = useQuote();
  const variations = [...new Set(p.variations.map(value => value.trim()).filter(Boolean))];
  const hasMultipleVariations = variations.length > 1;
  const selectedVariation = variations.length === 1 ? variations[0] : undefined;
  const inList = has(p.slug, selectedVariation);
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition hover:-translate-y-1">
      <Link to="/produtos/$slug" params={{ slug: p.slug }} className="relative block aspect-[5/4] overflow-hidden bg-muted">
        <img src={p.image} alt={p.name} loading="lazy" width={912} height={736} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        {p.demo && <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Exemplo</span>}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <Link to="/produtos/$slug" params={{ slug: p.slug }} className="font-bold text-navy hover:underline">{p.name}</Link>
        <p className="mt-1 flex-1 text-sm text-muted-foreground">{p.description}</p>
        {hasMultipleVariations ? (
          <Link to="/produtos/$slug" params={{ slug: p.slug }} className="mt-4 inline-flex justify-center rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground">
            Selecionar tamanho/modelo
          </Link>
        ) : (
          <Button variant="quote" onClick={() => add(p, selectedVariation)} disabled={inList} className="mt-4 rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground disabled:border-gold disabled:bg-gold/15 disabled:text-navy">
            {inList ? "✓ Na lista de orçamento" : "Solicitar cotação"}
          </Button>
        )}
      </div>
    </article>
  );
}
