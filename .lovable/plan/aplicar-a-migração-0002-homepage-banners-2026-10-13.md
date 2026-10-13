# Aplicar a migração 0002_homepage_banners

## Estado confirmado
- O arquivo `drizzle/migrations/0002_homepage_banners.sql` existe na branch e está no journal do Drizzle (índice 2, após 0000 e 0001).
- A tabela `public.homepage_banners` **não existe** no banco (verificado por consulta direta): a migração foi versionada, mas nunca aplicada.

## Plano (aprovado pelo usuário)
1. Aplicar **exclusivamente** o SQL de `drizzle/migrations/0002_homepage_banners.sql`, byte a byte, pela ferramenta oficial de migração do Lovable Cloud — sem recriar, sem reaplicar 0000/0001, sem gerar segunda migração equivalente.
2. A execução é transacional: em caso de falha, nada fica parcialmente aplicado e o arquivo/journal são revertidos.
3. A migração contém apenas DDL (tabela, índices, grants, RLS, políticas, função de reordenação, trigger) — nenhum dado existente é alterado.
4. Verificar e reportar:
   - existência de `public.homepage_banners`;
   - total de migrações registradas no Drizzle (esperado: 3);
   - resultado da execução e eventuais erros.
5. Os tipos TypeScript (`src/integrations/supabase/types.ts`) já incluem `homepage_banners` (gerados anteriormente); só serão regenerados se a ferramenta indicar divergência, com explicação.

## Garantias
- Nenhum dado existente será alterado.
- Nenhuma migração anterior será reaplicada.
- Nenhum arquivo do projeto será modificado desnecessariamente.
