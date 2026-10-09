import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/site/Layout";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade | Majesta Embalagens" },
      { name: "description", content: "Como a Majesta Embalagens trata as informações enviadas pelo site." },
      { property: "og:title", content: "Política de Privacidade | Majesta Embalagens" },
      { property: "og:description", content: "Tratamento de dados no site da Majesta Embalagens." },
    ],
  }),
  component: () => (
    <>
      <PageHero eyebrow="Institucional" title="Política de Privacidade" />
      <section className="mx-auto max-w-3xl space-y-4 px-5 py-14 leading-relaxed text-foreground/85">
        <p>A lista de orçamento montada neste site fica salva apenas no seu navegador. Seus dados (nome, empresa e cidade) são incluídos na mensagem enviada por você pelo WhatsApp e utilizados exclusivamente para responder à sua solicitação.</p>
        <p>Para dúvidas sobre o tratamento das suas informações, entre em contato pelos nossos canais oficiais.</p>
      </section>
    </>
  ),
});
