import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/site/Layout";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
        <h2 className="pt-4 text-xl font-bold text-navy">Responsável pelo tratamento</h2>

        <p>
          A Majesta Embalagens é um empreendimento comercial em fase inicial, operado por pessoa física, ainda sem CNPJ.
        </p>

        <p>
          Responsável: <strong>Marcelo Afonso da Siva</strong>. Para dúvidas sobre privacidade, acesso, correção ou
          exclusão de dados pessoais, entre em contato pelo canal oficial:
          <strong>marceloacessft@gmail.com</strong>.
        </p>

        <h2 className="pt-4 text-xl font-bold text-navy">Dados coletados e finalidade</h2>
        <p>
          Para preparar uma solicitação, o formulário utiliza nome, cidade e WhatsApp para contato; empresa, e-mail e
          observações são opcionais. O e-mail é validado quando preenchido, mas não é usado na mensagem. A lista de
          produtos, quantidades e variações é mantida no armazenamento local do navegador. Os dados de contato,
          incluindo o e-mail, ficam apenas temporariamente na memória da página e não são salvos pelo site em
          armazenamento persistente do navegador.
        </p>
        <p>
          Os dados de contato são usados para validar o formulário; somente os produtos, quantidades, variações e
          eventuais observações são usados para montar a mensagem de orçamento que você poderá revisar e enviar à
          Majesta pelo WhatsApp. Nome, empresa, cidade, WhatsApp e e-mail não são incluídos no texto gerado. Não informe
          dados pessoais de terceiros nas observações.
        </p>

        <h2 className="pt-4 text-xl font-bold text-navy">Registro e uso do WhatsApp</h2>
        <p>
          Ao selecionar “Continuar pelo WhatsApp”, o site prepara a mensagem e encaminha você ao WhatsApp. O texto
          inclui os produtos e informações selecionadas e eventuais observações, mas não inclui os dados de contato
          preenchidos nos campos do formulário. Ele integra o link aberto para preencher a conversa e pode ser
          processado pelo serviço do WhatsApp antes do envio. O envio ao destinatário depende da sua confirmação no
          próprio aplicativo ou site; a Majesta não envia a mensagem automaticamente. O site não mantém um registro
          separado de novas solicitações em seu banco de dados.
        </p>
        <p>
          A mensagem enviada e o atendimento poderão conter dados pessoais. O tratamento dessas informações nas
          conversas está sujeito às práticas da Majesta e às políticas da Meta/WhatsApp. Registros de solicitações
          eventualmente gravados no site antes da mudança deste fluxo não são removidos por esta alteração.
        </p>

        <h2 className="pt-4 text-xl font-bold text-navy">Retenção e exclusão</h2>

        <p>
          A lista de produtos selecionados permanece armazenada no navegador do visitante até ser removida por ele ou
          apagada nas configurações do navegador.
        </p>

        <p>
          A Majesta Embalagens não registra novas solicitações de orçamento em seu banco de dados. As conversas
          comerciais realizadas pelo WhatsApp poderão ser conservadas por até 12 meses após o último atendimento, salvo
          quando houver necessidade de conservação por obrigação legal ou exercício regular de direitos.
        </p>

        <p>
          Registros históricos de solicitações, caso existentes, serão submetidos à revisão e exclusão quando não houver
          finalidade legítima para sua manutenção.
        </p>
        <h2 className="pt-4 text-xl font-bold text-navy">Direitos e solicitações</h2>
        <p>
          Nos termos da legislação aplicável, inclusive da LGPD, você pode solicitar confirmação e acesso aos dados,
          correção, informação sobre o tratamento, anonimização ou exclusão quando cabível, além dos demais direitos
          previstos em lei. Para exercer seus direitos, entre em contato pelo canal oficial indicado acima, ainda
          pendente de preenchimento.
        </p>
      </section>
    </>
  ),
});
