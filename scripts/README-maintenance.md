# Teste de integração da manutenção

Use somente uma base descartável em PostgreSQL local, porta 18432. O script
recusa outros hosts/portas. Ele grava dados de teste e não limpa registros.

1. Obtenha o schema anterior com `git show f458fcf:prisma/schema.prisma` e
   salve em um arquivo temporário `baseline.prisma`.
2. Crie uma base vazia no servidor de teste. Defina `DATABASE_URL` para ela.
3. Execute `npx prisma db push --schema CAMINHO/baseline.prisma --skip-generate`.
4. Aplique `scripts/maintenance-fixtures.sql` com `psql -v ON_ERROR_STOP=1`.
5. Aplique somente `prisma/migrations/20261014120000_maintenance_workflows/migration.sql`
   com `psql -v ON_ERROR_STOP=1`.
6. Execute `npx prisma generate` e `npm run test:maintenance`.

Isso verifica a migration sobre o schema anterior com uma ordem legada concluída.
As migrations históricas dependem de contas previamente criadas pelo seed e não
podem ser aplicadas de ponta a ponta em base vazia sem esses dados iniciais.

O teste carrega as ações reais e usa Prisma/PostgreSQL reais. Substitui apenas a
autenticação e a revalidação/redirecionamento que exigem uma requisição Next.js.
Não substitui regras de negócio nem operações de banco. Ao terminar, pare e
descarte o PostgreSQL de teste.

Para verificar as páginas, inicie o build com `PORT=18433`, `DATABASE_URL` da
mesma base e um `AUTH_SECRET` exclusivo de teste. Execute
`node scripts/test-maintenance-http.mjs` com essas mesmas variáveis. O teste
cria um perfil temporário, assina a sessão de teste e verifica listagem,
filtros, detalhes, relatório, centro de custos e proteção sem sessão.
