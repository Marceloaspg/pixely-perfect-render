import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/site/Layout";
import { useCatalog } from "@/lib/catalog-context";
import { whatsappLink } from "@/lib/config";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Termos de Uso e Condições Comerciais | Majesta Embalagens" },
      {
        name: "description",
        content: "Informações sobre o catálogo, solicitações de orçamento e atendimento da Majesta Embalagens.",
      },
      { property: "og:title", content: "Termos de Uso | Majesta Embalagens" },
      {
        property: "og:description",
        content: "Consulte como funcionam o catálogo e as solicitações de orçamento da Majesta Embalagens.",
      },
    ],
  }),
  component: Terms,
});

function Terms() {
  const { config } = useCatalog();
  const whatsappHref = whatsappLink("Olá! Gostaria de falar com a Majesta Embalagens.", config.whatsapp);

  return (
    <>
      <PageHero
        eyebrow="Institucional"
        title="Termos de Uso e Condições Comerciais"
        text="Informações sobre o catálogo e o atendimento da Majesta Embalagens."
      />
      <article className="mx-auto max-w-3xl space-y-4 px-5 py-14 leading-relaxed text-foreground/85">
        <h2 className="pt-4 text-xl font-bold text-navy">Identificação</h2>
        <p>
          MAJESTA EMBALAGENS é o nome comercial de 69.795.523 THAYSA SILVA VARELA DE VASCONCELOS,
          inscrita no CNPJ sob o nº 69.795.523/0001-78, com endereço comercial na Rua João Vieira,
          nº 12, Chácara São João, Amparo/SP, CEP 13905-713.
        </p>

        <h2 className="pt-4 text-xl font-bold text-navy">Catálogo</h2>
        <p>
          O site apresenta produtos e informações para consulta e escolha. A exibição de um produto
          no catálogo não confirma, por si só, estoque, disponibilidade para uma região ou preço
          final. Essas informações serão verificadas no atendimento e apresentadas na proposta
          comercial.
        </p>

        <h2 className="pt-4 text-xl font-bold text-navy">Solicitação de orçamento</h2>
        <p>
          O visitante pode selecionar produtos, informar quantidades e enviar uma solicitação de
          orçamento pelo formulário. Quando o registro estiver disponível, a solicitação é registrada
          para atendimento antes de o site abrir o WhatsApp. Também pode haver atendimento direto
          pelo WhatsApp, conforme as opções apresentadas no site.
        </p>
        <p>
          Enviar uma solicitação de orçamento não conclui uma compra, não representa confirmação de
          pedido e não obriga o visitante a contratar. Preços, disponibilidade, frete, condições de
          entrega e demais condições aplicáveis serão confirmados na proposta comercial. Uma
          eventual contratação dependerá das informações e da manifestação de aceite correspondentes,
          observada a legislação aplicável.
        </p>

        <h2 className="pt-4 text-xl font-bold text-navy">Condições comerciais e promoções</h2>
        <p>
          A empresa oferece entregas grátis para pedidos elegíveis. A elegibilidade será informada
          no orçamento antes da confirmação da compra. A chamada “Consulte condições” não estabelece
          cidades, distâncias ou outros critérios além da avaliação informada no orçamento.
        </p>
        <p>
          Pagamentos via PIX têm desconto de 5% sobre o valor dos produtos, válido para todos os
          produtos e sem valor mínimo de compra. O desconto não é declarado para frete ou outros
          serviços. Estas condições não estabelecem regras de cumulatividade com outras promoções.
        </p>
        <p>
          É possível parcelar em até 3 vezes sem juros, sem valor mínimo de compra. A forma de
          pagamento e as opções de parcelamento devem ser confirmadas no atendimento. Não há neste
          termo definição de bandeiras de cartão ou outras restrições não confirmadas.
        </p>
        <p>
          As condições comerciais aplicáveis ao pedido serão apresentadas de forma clara no
          atendimento e na proposta, sem prejuízo dos direitos previstos na legislação de proteção
          ao consumidor. Estas informações não restringem direitos legais do consumidor.
        </p>

        <h2 className="pt-4 text-xl font-bold text-navy">Atendimento</h2>
        <p>
          Para dúvidas sobre produtos e orçamentos, utilize os canais comerciais disponibilizados
          no site:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          {whatsappHref && (
            <li>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-navy underline"
              >
                WhatsApp comercial
              </a>
            </li>
          )}
          {config.email && (
            <li>
              <a href={`mailto:${config.email}`} className="font-medium text-navy underline">
                {config.email}
              </a>
            </li>
          )}
        </ul>
        <p>
          O tratamento de dados pessoais relacionados às solicitações é descrito na{" "}
          <a href="/privacidade" className="font-medium text-navy underline">
            Política de Privacidade
          </a>
          . Dúvidas sobre privacidade e exercício de direitos previstos na LGPD podem ser enviados
          para{" "}
          <a href="mailto:marceloacessft@gmail.com" className="font-medium text-navy underline">
            marceloacessft@gmail.com
          </a>
          .
        </p>
      </article>
    </>
  );
}
