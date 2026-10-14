import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, ClipboardList, Mail, Phone, MessageCircle, Instagram, Facebook } from "lucide-react";
import logo from "@/assets/majesta-logo.png";
import { type Product } from "@/data/catalog";
import { whatsappLink } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { useCatalog } from "@/lib/catalog-context";
import { useQuote } from "@/lib/quote";

const nav = [
  { to: "/", label: "Início" },
  { to: "/categorias", label: "Categorias" },
  { to: "/produtos", label: "Produtos" },
  { to: "/sobre", label: "Sobre Nós" },
  { to: "/contato", label: "Contato" },
] as const;

function formatPhoneNumber(number: string): string {
  const digits = number.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return number;
}

export function Header() {
  const [open, setOpen] = useState(false);
  const { items } = useQuote();

  function closeNavigation() {
    setOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-5">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <img src={logo} alt="Majesta Embalagens" width={48} height={48} className="h-12 w-12 shrink-0 rounded-full object-cover" />
          <span className="hidden truncate text-sm font-extrabold tracking-[0.18em] text-navy sm:block">MAJESTA<span className="block text-[10px] font-semibold tracking-[0.35em] text-gold">EMBALAGENS</span></span>
        </Link>
        <nav className="hidden items-center gap-3 lg:flex xl:gap-7">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: n.to === "/" }} className="whitespace-nowrap text-sm font-medium text-foreground/80 transition-colors hover:text-navy data-[status=active]:text-navy data-[status=active]:font-bold">
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
            <Link key={n.to} to={n.to} onClick={closeNavigation} className="block py-3 font-medium text-foreground">{n.label}</Link>
          ))}
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  const { config: siteConfig } = useCatalog();
  const formattedPhone = formatPhoneNumber(siteConfig.whatsapp);
  const whatsappHref = whatsappLink("Olá, Majesta Embalagens!", siteConfig.whatsapp);
  return (
    <footer className="bg-gradient-navy text-primary-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col items-center text-center md:items-start md:text-left">
          <img src={logo} alt="Majesta Embalagens" width={96} height={96} loading="lazy" className="h-24 w-24 rounded-full object-cover" />
          <h2 className="mt-4 text-sm font-extrabold tracking-[0.16em] text-gold">MAJESTA EMBALAGENS</h2>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-primary-foreground/70">Soluções em embalagens para valorizar produtos e fortalecer negócios.</p>
        </div>
        <div className="flex flex-col items-center border-t border-primary-foreground/10 pt-6 text-center md:items-start md:border-l md:border-t-0 md:pl-8 md:pt-0 md:text-left">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gold">Contato</h3>
          <ul className="mt-4 flex flex-col items-center space-y-4 text-sm text-primary-foreground/75 md:items-start">
            <li>
              <a href={`tel:${siteConfig.whatsapp}`} className="inline-flex items-center justify-center gap-3 hover:text-gold md:items-start md:justify-start">
                <Phone aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <span><span className="block text-xs text-primary-foreground/55">Telefone</span>{formattedPhone}</span>
              </a>
            </li>
            <li>
              <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-3 hover:text-gold md:items-start md:justify-start">
                <MessageCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <span><span className="block text-xs text-primary-foreground/55">WhatsApp</span>{formattedPhone}</span>
              </a>
            </li>
            {siteConfig.email && (
              <li>
                <a href={`mailto:${siteConfig.email}`} className="inline-flex items-center justify-center gap-3 break-all hover:text-gold md:items-start md:justify-start">
                  <Mail aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-gold" />{siteConfig.email}
                </a>
              </li>
            )}
            {siteConfig.instagram && (
              <li>
                <a href={siteConfig.instagram} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-3 hover:text-gold md:items-start md:justify-start">
                  <Instagram aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  <span>Instagram</span>
                </a>
              </li>
            )}
            {siteConfig.facebook && (
              <li>
                <a href={siteConfig.facebook} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-3 hover:text-gold md:items-start md:justify-start">
                  <Facebook aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  <span>Facebook</span>
                </a>
              </li>
            )}
          </ul>
        </div>
        <div className="flex flex-col items-center border-t border-primary-foreground/10 pt-6 text-center md:col-span-2 md:items-start md:pt-6 md:text-left lg:col-span-1 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gold">Links úteis</h3>
          <ul className="mt-4 space-y-3 text-sm text-primary-foreground/75">
            <li><Link to="/produtos" className="hover:text-gold">Produtos</Link></li>
            <li><Link to="/sobre" className="hover:text-gold">Sobre Nós</Link></li>
            <li><Link to="/contato" className="hover:text-gold">Contato</Link></li>
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
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition hover:-translate-y-1">
      <Link to="/produtos/$slug" params={{ slug: p.slug }} className="relative block aspect-[5/4] overflow-hidden bg-muted">
        <img src={p.image} alt={p.name} loading="lazy" width={912} height={736} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        {p.demo && <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Exemplo</span>}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <Link to="/produtos/$slug" params={{ slug: p.slug }} className="line-clamp-2 min-h-12 font-bold leading-6 text-navy hover:underline">{p.name}</Link>
        <p className="mt-1 h-[4.5rem] overflow-hidden text-ellipsis text-sm leading-6 text-muted-foreground line-clamp-3">{p.description}</p>
        <Button asChild variant="quote" className="mt-auto h-11 w-full rounded-full px-4 text-sm font-semibold">
          <Link to="/produtos/$slug" params={{ slug: p.slug }}>
            Solicitar cotação
          </Link>
        </Button>
      </div>
    </article>
  );
}
