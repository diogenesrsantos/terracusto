# TerraCusto

PWA para gestão de obras de terraplenagem: pessoas e permissões, custos e
receitas por obra, combustível, almoxarifado e manutenção.

## Desenvolvimento

1. Copie `.env.example` para `.env` e configure o PostgreSQL.
2. Execute `npm install`.
3. Execute `npm run db:push` e `npm run db:seed`.
4. Inicie com `npm run dev`.

O primeiro administrador é criado pelo seed usando `ADMIN_EMAIL` e
`ADMIN_PASSWORD`.

## Produção

O build é gerado com `npm run build` e iniciado com `npm start`. Consulte
`deployment/README.md` para a configuração da VPS.
