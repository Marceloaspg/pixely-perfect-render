# Aplicar a migração 0002_homepage_banners

## Estado confirmado
- O arquivo `drizzle/migrations/0002_homepage_banners.sql` existe na branch e está registrado no journal do Drizzle (índice 2, após 0000 e 0001).
- A tabela `public.homepage_banners` **não existe** no banco (verificado com consulta direta).
- Ou seja: a migração foi versionada, mas nunca aplicada ao banco.

## Plano
1. Ler o conteúdo completo de `drizzle/migrations/0002_homepage_banners.sql`.
2. Aplicar **exclusivamente** esse SQL pelo mecanismo oficial do projeto (ferramenta de migração do Lovable Cloud), sem recriar, sem reaplicar 0000/0001 e sem tocar em dados existentes — a migração é apenas DDL de criação (tabela, políticas de acesso, função de reordenação), sem alteração de dados.
3. Verificar o resultado:
   - confirmar que a tabela `public.homepage_banners` passou a existir;
   - confirmar o número de migrações registradas no histórico do Drizzle (esperado: 3).
4. Regenerar os tipos do banco, se necessário, para o código do painel de banners compilar contra o novo schema.
5. Reportar: resultado da execução, existência da tabela e total de migrações registradas.

## Garantias
- Nenhum dado existente será alterado (a migração não contém INSERT/UPDATE/DELETE em tabelas de dados).
- Nenhuma migração anterior será reaplicada.
- Se a aplicação falhar, nada fica parcialmente aplicado e o impedimento será explicado.
