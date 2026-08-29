# TerraCusto

PWA para gestão de obras de terraplenagem. O sistema centraliza pessoas, funções
e permissões, obras, equipamentos, lançamentos contábeis, fechamentos mensais,
combustível, almoxarifado e manutenção.

## Estado atual

- Produção: <https://terracusto.provizi.net.br>
- Branch das evoluções implantadas: `chore/registro-projeto-20260829`
- Última versão implantada: `b6b1ad8` (logomarca institucional no menu e
  suporte validado a SVG)
- Versão inicial de referência: commit `66a7b02` (`feat: implementa sistema TerraCusto`)
- Stack: Next.js 16, React 19, TypeScript, Prisma 6 e PostgreSQL
- Processo: systemd em `terracusto.service`, porta interna `3120`
- Proxy e TLS: Nginx e Let's Encrypt
- Backup: diário, com retenção local de 14 dias

O estado de produção acima foi validado em 29/08/2026, com 14 migrations
aplicadas, 24 rotas geradas e health check de aplicação/banco `ok`. Consulte
[docs/ESTADO-ATUAL.md](docs/ESTADO-ATUAL.md) antes de uma nova alteração.

## Desenvolvimento local

Requisitos: Node.js compatível com Next.js 16, npm e PostgreSQL.

1. Copie `.env.example` para `.env` e substitua todos os valores de exemplo.
2. Execute `npm install`.
3. Execute `npm run db:push` e `npm run db:seed`.
4. Inicie com `npm run dev`.

O seed cria ou atualiza o administrador informado em `ADMIN_EMAIL` e
`ADMIN_PASSWORD`. Nunca use os valores padrão do seed em produção.

### Comandos

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Gera Prisma Client e build de produção |
| `npm start` | Inicia o build de produção |
| `npm run typecheck` | Validação TypeScript |
| `npm run smoke` | Testa login, painel, banco e recursos PWA |
| `npm run db:push` | Sincroniza o schema sem gerar migration; uso local |
| `npm run db:migrate` | Aplica migrations existentes; uso em produção |
| `npm run db:seed` | Carga inicial idempotente |

O smoke test exige `NEXT_PUBLIC_APP_URL`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` no
ambiente. Ele autentica de verdade; não registre a saída de variáveis ou
credenciais em logs.

## Documentação

- [Inventário completo](docs/INVENTARIO-SISTEMA.md): mapa consolidado de
  módulos, fluxos, dados, ações, segurança, produção e pendências.
- [Guia funcional](docs/GUIA-FUNCIONAL.md): módulos, regras e permissões.
- [Arquitetura técnica](docs/ARQUITETURA.md): componentes, dados, segurança e
  decisões de implementação.
- [Estado atual](docs/ESTADO-ATUAL.md): versão implantada e evidências da última
  validação.
- [Implantação e operação](deployment/README.md): atualização, diagnóstico,
  backup e restauração.

## Segredos

O repositório contém somente `.env.example`. Em produção, os segredos ficam em
`/etc/terracusto.env`, com acesso restrito. As credenciais iniciais ficam fora
do repositório, em `/root/terracusto-credentials.txt` na VPS. Não copie o
conteúdo desses arquivos para documentação, commits, tickets ou logs.
