import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Mail, Instagram, Facebook } from "lucide-react";
import { useCatalog } from "@/lib/catalog-context";
import { PageHero } from "@/components/site/Layout";
import { whatsappLink } from "@/lib/config";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: "Contato | Majesta Embalagens" },
      { name: "description", content: "Fale com a Majesta Embalagens pelo WhatsApp, e-mail ou redes sociais." },
      { property: "og:title", content: "Contato | Majesta Embalagens" },
      { property: "og:description", content: "Entre em contato e solicite seu orçamento." },
    ],
  }),
  component: Contact,
});

function Contact() {
  const { config: siteConfig } = useCatalog();
  const cards = [
    { icon: MessageCircle, label: "WhatsApp", value: "Iniciar conversa", href: whatsappLink("Olá, Majesta Embalagens!") },
    siteConfig.email && { icon: Mail, label: "E-mail comercial", value: siteConfig.email, href: `mailto:${siteConfig.email}` },
    siteConfig.instagram && { icon: Instagram, label: "Instagram", value: "Seguir", href: siteConfig.instagram },
    siteConfig.facebook && { icon: Facebook, label: "Facebook", value: "Curtir", href: siteConfig.facebook },
  ].filter(Boolean) as { icon: typeof Mail; label: string; value: string; href: string }[];
  return (
    <>
      <PageHero eyebrow="Contato" title="Fale com a Majesta" text="Estamos à disposição para ajudar você a encontrar a embalagem certa." />
      <section className="mx-auto grid max-w-5xl gap-5 px-5 py-14 sm:grid-cols-2">
        {cards.map((c) => (
          <a key={c.label} href={c.href} target="_blank" rel="noreferrer" className="flex items-center gap-4 rounded-2xl border border-border bg-card p-6 shadow-card transition hover:-translate-y-1">
            <c.icon className="h-8 w-8 shrink-0 text-gold" />
            <div className="min-w-0"><p className="font-bold text-navy">{c.label}</p><p className="truncate text-sm text-muted-foreground">{c.value}</p></div>
          </a>
        ))}
      </section>
    </>
  );
}
