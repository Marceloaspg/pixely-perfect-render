import { createFileRoute } from "@tanstack/react-router";
import logo from "@/assets/majesta-logo.png";
import { PageHero } from "@/components/site/Layout";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
      { title: "Sobre Nós | Majesta Embalagens" },
      { name: "description", content: "Conheça a Majesta Embalagens: soluções práticas em embalagens e suprimentos para o setor alimentício." },
      { property: "og:title", content: "Sobre a Majesta Embalagens" },
      { property: "og:description", content: "Relacionamentos comerciais baseados em confiança e atendimento próximo." },
    ],
  }),
  component: About,
});

function About() {
  return (
    <>
      <PageHero eyebrow="Sobre nós" title="Sobre a Majesta" />
      <section className="mx-auto grid max-w-5xl items-center gap-12 px-5 py-16 md:grid-cols-[1fr_260px]">
        <div className="space-y-5 text-lg leading-relaxed text-foreground/85">
          <p>A Majesta Embalagens nasce com o propósito de oferecer soluções práticas em embalagens e suprimentos para negócios do setor alimentício.</p>
          <p>Entendemos que uma boa embalagem vai além de proteger o alimento: ela também contribui para a apresentação do produto, a experiência do consumidor e a identidade de cada estabelecimento.</p>
          <p>Nosso objetivo é construir relacionamentos comerciais baseados em confiança, atendimento próximo e soluções adequadas às necessidades de cada cliente.</p>
        </div>
        <img src={logo} alt="Majesta Embalagens" width={260} height={260} loading="lazy" className="mx-auto w-56 rounded-full object-cover shadow-card" />
      </section>
    </>
  );
}
