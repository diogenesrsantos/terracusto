# Implantação

Produção usa o usuário Linux `terracusto`, diretório `/var/www/terracusto`,
serviço `terracusto.service`, porta local 3120 e Nginx em
`terracusto.provizi.net.br`.

Segredos ficam somente em `/etc/terracusto.env` (modo 600). As credenciais
iniciais são mantidas em `/root/terracusto-credentials.txt` na VPS.

## Atualização

1. Sincronize o código sem `.env`, `.git`, `node_modules` e `.next`.
2. Execute `npm ci`, `npx prisma migrate deploy`, `npm run build`.
3. Reinicie `terracusto.service` e valide `/api/health`.

Antes de alterações de banco, crie backup com `pg_dump`.
