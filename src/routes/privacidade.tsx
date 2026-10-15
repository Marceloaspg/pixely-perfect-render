import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/site/Layout";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Política de Privacidade | Majesta Embalagens" },
      {
        name: "description",
        content: "Como a Majesta Embalagens trata as informações enviadas pelo site.",
      },
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
          Majesta Embalagens é o nome comercial de um empreendimento operado por pessoa física,
          ainda sem CNPJ. Não há razão social ou CNPJ informado nesta política.
        </p>
        <p>
          Responsável pessoa física: <strong>Marcelo Afonso da Silva</strong>. O canal oficial para
          dúvidas e solicitações sobre privacidade é{" "}
          <a href="mailto:marceloacessft@gmail.com" className="font-medium text-navy underline">
            marceloacessft@gmail.com
          </a>
          .
        </p>

        <h2 className="pt-4 text-xl font-bold text-navy">Dados coletados e finalidade</h2>
        <p>
          Se você escolher “Registrar orçamento”, o formulário coleta nome, cidade e WhatsApp para
          contato; empresa, e-mail e observações são opcionais. O e-mail é validado quando
          preenchido, mas não é incluído na mensagem do WhatsApp. Para acompanhar essa solicitação,
          os dados informados e um retrato dos produtos solicitados — incluindo nomes, códigos/SKUs,
          modelos, materiais, quantidades e unidades, quando disponíveis — são armazenados no banco
          de dados Supabase/Lovable Cloud. O acesso aos registros é restrito a administradores
          autorizados.
        </p>
        <p>
          Esses dados são usados para atender e acompanhar a solicitação comercial. O retrato dos
          produtos preserva as informações do pedido no momento do registro, mesmo que o catálogo
          seja atualizado depois. Não informe dados pessoais de terceiros nas observações.
        </p>
        <p>
          A lista de produtos e suas quantidades também fica armazenada localmente no navegador para
          manter seu carrinho entre visitas. Essa lista pode ser removida pelo próprio usuário ou
          apagada nas configurações do navegador. Para reduzir envios automatizados no fluxo de
          registro, usamos Cloudflare Turnstile: a validação ocorre no servidor, e a Cloudflare
          recebe o token do desafio e o endereço IP da conexão. O sistema aplica limites
          persistentes por meio de uma chave derivada e protegida por HMAC, sem armazenar o IP em
          texto puro na tabela de limite.
        </p>

        <h2 className="pt-4 text-xl font-bold text-navy">Registro e uso do WhatsApp</h2>
        <p>
          Depois de registrar o orçamento, você pode escolher abrir uma conversa no WhatsApp. Também
          é possível usar a alternativa “Solicitar orçamento pelo WhatsApp” diretamente: nesse caso,
          a mensagem contém os produtos, códigos/SKUs, modelos, materiais e quantidades disponíveis
          na lista, mas não inclui os dados pessoais dos campos do formulário nem grava um novo
          orçamento no painel administrativo. A solicitação feita por essa alternativa será tratada
          na conversa e não ficará registrada como orçamento no painel.
        </p>
        <p>
          Em ambos os fluxos, o site abre o WhatsApp para que você revise a mensagem. Abrir a
          conversa não envia a mensagem automaticamente: ela só é enviada quando você confirma o
          envio no WhatsApp. O conteúdo transmitido ao WhatsApp pode ser processado pela Meta e está
          sujeito às políticas do serviço. Se você compartilhar outros dados durante a conversa,
          eles serão tratados também conforme o atendimento prestado por esse canal.
        </p>

        <h2 className="pt-4 text-xl font-bold text-navy">Retenção e exclusão</h2>

        <p>
          A lista de produtos selecionados permanece no armazenamento local do navegador até ser
          removida pelo usuário ou apagada nas configurações do navegador. Ela não é, por si só, um
          registro no painel administrativo.
        </p>

        <p>
          O responsável revisará manualmente os registros de orçamento a cada três meses. Os
          orçamentos sem compra serão avaliados para exclusão após 12 meses da solicitação, desde
          que não haja negociação ativa, obrigação legal ou outra justificativa legítima para
          conservá-los. Os orçamentos em negociação serão mantidos enquanto forem necessários ao
          atendimento e estarão sujeitos a revisão periódica. Os registros de compras finalizadas
          serão conservados pelos prazos legais e fiscais aplicáveis.
        </p>
        <p>
          Solicitações de exclusão e demais pedidos relacionados à privacidade serão analisados
          manualmente pelo responsável e atendidos quando cabíveis, observadas as obrigações legais.
          Para encaminhar uma solicitação, use o canal oficial de privacidade informado nesta
          política.
        </p>
        <h2 className="pt-4 text-xl font-bold text-navy">Direitos e solicitações</h2>
        <p>
          Nos termos da legislação aplicável, inclusive da LGPD, você pode solicitar confirmação e
          acesso aos dados, correção, informação sobre o tratamento, anonimização ou exclusão quando
          cabível, além dos demais direitos previstos em lei. Encaminhe pedidos e dúvidas sobre
          privacidade para{" "}
          <a href="mailto:marceloacessft@gmail.com" className="font-medium text-navy underline">
            marceloacessft@gmail.com
          </a>
          .
        </p>
      </section>
    </>
  ),
});
