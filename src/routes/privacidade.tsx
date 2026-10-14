import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/site/Layout";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [{ property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
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
        <p className="rounded-xl border border-gold/40 bg-secondary p-4 text-sm">
          Informações pendentes para publicação: preencher a razão social e o CNPJ do responsável pelo tratamento, um canal oficial para privacidade e o prazo de retenção aprovado pela empresa. Este texto é informativo e não constitui certificação ou parecer jurídico.
        </p>

        <h2 className="pt-4 text-xl font-bold text-navy">Responsável pelo tratamento</h2>
        <p>
          Controlador: <strong>[PENDENTE: razão social da Majesta Embalagens]</strong>, CNPJ
          <strong> [PENDENTE: CNPJ]</strong>. Canal para assuntos de privacidade:
          <strong> [PENDENTE: e-mail ou outro contato oficial]</strong>.
        </p>

        <h2 className="pt-4 text-xl font-bold text-navy">Dados coletados e finalidade</h2>
        <p>
          Para preparar uma solicitação, o formulário utiliza nome, cidade e WhatsApp para
          contato; empresa, e-mail e observações são opcionais. O e-mail é validado quando
          preenchido, mas não é usado na mensagem. A lista de produtos, quantidades e variações
          é mantida no armazenamento local do navegador. Os dados de contato, incluindo o
          e-mail, ficam apenas temporariamente na memória da página e não são salvos pelo site
          em armazenamento persistente do navegador.
        </p>
        <p>
          Os dados de contato são usados para validar o formulário; somente os produtos,
          quantidades, variações e eventuais observações são usados para montar a mensagem de
          orçamento que você poderá revisar e enviar à Majesta pelo WhatsApp. Nome, empresa,
          cidade, WhatsApp e e-mail não são incluídos no texto gerado. Não informe dados
          pessoais de terceiros nas observações.
        </p>

        <h2 className="pt-4 text-xl font-bold text-navy">Registro e uso do WhatsApp</h2>
        <p>
          Ao selecionar “Continuar pelo WhatsApp”, o site prepara a mensagem e encaminha você ao
          WhatsApp. O texto inclui os produtos e informações selecionadas e eventuais
          observações, mas não inclui os dados de contato preenchidos nos campos do formulário.
          Ele integra o link aberto para preencher a conversa e pode ser processado pelo serviço
          do WhatsApp antes do envio. O envio ao destinatário depende da sua confirmação no
          próprio aplicativo ou site; a Majesta não envia a mensagem automaticamente. O site
          não mantém um registro separado de novas solicitações em seu banco de dados.
        </p>
        <p>
          A mensagem enviada e o atendimento poderão conter dados pessoais. O tratamento dessas
          informações nas conversas está sujeito às práticas da Majesta e às políticas da
          Meta/WhatsApp. Registros de solicitações eventualmente gravados no site antes da
          mudança deste fluxo não são removidos por esta alteração.
        </p>

        <h2 className="pt-4 text-xl font-bold text-navy">Retenção e exclusão</h2>
        <p>
          A lista de produtos permanece no armazenamento local do navegador até ser removida
          pelo usuário ou apagada por ele nas configurações do navegador. O site não define
          prazo de retenção para novas solicitações porque não as registra no banco. Para dados
          tratados nas conversas de WhatsApp ou em registros anteriores, critérios e prazo de
          retenção definidos pela empresa: <strong>[PENDENTE: informar o prazo e o procedimento
          de exclusão ou anonimização]</strong>.
        </p>

        <h2 className="pt-4 text-xl font-bold text-navy">Direitos e solicitações</h2>
        <p>
          Nos termos da legislação aplicável, inclusive da LGPD, você pode solicitar confirmação
          e acesso aos dados, correção, informação sobre o tratamento, anonimização ou exclusão
          quando cabível, além dos demais direitos previstos em lei. Para exercer seus direitos,
          entre em contato pelo canal oficial indicado acima, ainda pendente de preenchimento.
        </p>
      </section>
    </>
  ),
});
