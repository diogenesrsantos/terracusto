# Implantação e operação

Para o mapa consolidado dos módulos, regras, dados e limites do produto,
consulte `docs/INVENTARIO-SISTEMA.md`. Este arquivo trata especificamente da
instalação, publicação, backup, restauração e diagnóstico.

## Topologia de produção

- Domínio: `terracusto.provizi.net.br`
- Aplicação: `/var/www/terracusto`
- Processo: usuário/grupo `terracusto`, serviço `terracusto.service`
- Porta local: `3120`, não exposta diretamente ao público
- Proxy/TLS: Nginx e certificado Let's Encrypt
- Banco: PostgreSQL local, base `terracusto`
- Segredos: `/etc/terracusto.env`, modo recomendado `600`, proprietário root
- Credenciais iniciais: `/root/terracusto-credentials.txt`, fora do Git
- Backups: `/var/backups/terracusto`

Os arquivos versionados neste diretório são modelos canônicos. Antes de copiar
um deles para `/etc/systemd/system`, `/etc/nginx` ou `/usr/local/sbin`, revise o
diff com a versão ativa da VPS para não sobrescrever ajustes operacionais.

## Primeira instalação

1. Instale Node.js/npm, PostgreSQL, Nginx e Certbot.
2. Crie usuário e banco PostgreSQL `terracusto` com senha forte.
3. Crie o usuário Linux `terracusto` e `/var/www/terracusto` sob sua propriedade.
4. Sincronize o repositório, excluindo `.git`, `.env`, `node_modules` e `.next`.
5. Crie `/etc/terracusto.env` com `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAIL`,
   `ADMIN_PASSWORD` e `NEXT_PUBLIC_APP_URL`.
6. Proteja os segredos com `chmod 600 /etc/terracusto.env`.
7. Execute `npm ci`, `npx prisma migrate deploy`, `npm run db:seed` e
   `npm run build` como usuário da aplicação.
8. Instale e habilite `terracusto.service`.
9. Instale a configuração Nginx, valide com `nginx -t` e recarregue o serviço.
10. Emita o certificado do domínio com Certbot.
11. Instale o script, serviço e timer de backup; habilite o timer.
12. Guarde as credenciais iniciais fora do repositório e solicite que o
    administrador altere a senha no primeiro acesso.

## Atualização normal

Antes de iniciar, registre o commit atual e confirme o estado do serviço. Se
houver alteração de schema, gere o backup antes de qualquer migration.

1. Valide localmente com `npm run typecheck` e `npm run build`.
2. Sincronize o código sem `.env`, `.git`, `node_modules`, `.next`, dumps ou
   arquivos de credenciais.
3. Na VPS, dentro de `/var/www/terracusto`, execute `npm ci`.
4. Execute `npx prisma migrate deploy`.
5. Execute `npm run build`.
6. Reinicie `terracusto.service`.
7. Valide serviço, health check, domínio público e smoke test.
8. Registre o novo commit e os resultados em `docs/ESTADO-ATUAL.md`.

Não use `prisma db push` em produção. O seed é idempotente, mas só deve ser
executado em produção quando houver intenção de atualizar dados iniciais.

## Validação pós-deploy

```bash
systemctl --no-pager --full status terracusto.service
journalctl -u terracusto.service -n 100 --no-pager
curl -fsS http://127.0.0.1:3120/api/health
curl -I https://terracusto.provizi.net.br/
nginx -t
systemctl status terracusto-backup.timer --no-pager
```

O health check esperado retorna HTTP 200 com `status: ok` e `database: ok`. A
raiz pública sem sessão deve responder com redirecionamento para `/login`.

Para o teste funcional completo, carregue as variáveis de forma segura no
ambiente e execute `npm run smoke`. Não imprima nem coloque as credenciais na
linha de comando, pois isso pode expô-las ao histórico e à lista de processos.
Como o seed não redefine a senha de um administrador existente, o smoke falhará
depois que essa senha for alterada se `ADMIN_PASSWORD` continuar com o valor
inicial. Prefira futuramente um usuário técnico dedicado ao smoke, com acesso e
credencial gerenciados especificamente para esse teste.

## Backup

`backup-terracusto` cria um dump PostgreSQL customizado por execução:

```text
/var/backups/terracusto/terracusto-AAAAMMDD-HHMMSS.dump
```

O timer roda diariamente às 02:30, com atraso aleatório de até 15 minutos. O
script cria o diretório com modo `0700`, executa `pg_dump` como `postgres` e
remove dumps com mais de 14 dias.

Verificação manual sem alterar dados:

```bash
systemctl list-timers terracusto-backup.timer --no-pager
journalctl -u terracusto-backup.service -n 50 --no-pager
ls -lh /var/backups/terracusto
```

Para testar a geração, `systemctl start terracusto-backup.service` cria um novo
dump. Essa execução altera apenas o diretório de backups e deve ser feita com
espaço em disco suficiente.

Backups locais não cobrem perda total da VPS. Mantenha também uma cópia externa,
criptografada, com retenção e teste de restauração definidos.

## Restauração do banco

A restauração substitui dados e deve ocorrer somente com autorização explícita,
janela de manutenção e dump validado.

1. Pare `terracusto.service` para impedir novas escritas.
2. Faça um backup adicional do banco atual.
3. Confira o dump com `pg_restore --list ARQUIVO.dump`.
4. Restaure primeiro em um banco temporário e execute validações.
5. Após aprovação, recrie/limpe o banco alvo e use `pg_restore` com o usuário e
   opções apropriados ao ambiente.
6. Execute `npx prisma migrate deploy`, se necessário.
7. Inicie a aplicação e execute health check e smoke test.

Não há um comando destrutivo pronto neste documento porque banco, proprietário,
conexões e estratégia de troca devem ser confirmados no momento do incidente.

## Rollback da aplicação

Se o schema for compatível com a versão anterior:

1. Pare o serviço.
2. Sincronize o código do commit anterior conhecido.
3. Execute `npm ci` e `npm run build`.
4. Inicie o serviço e valide.

Migrations Prisma não possuem rollback automático. Se a migration não for
compatível com a versão anterior, use uma migration corretiva ou restaure um
backup após avaliar a perda de dados. Nunca reverta somente o código sem conferir
a compatibilidade do schema.

## Diagnóstico rápido

| Sintoma | Verificação |
| --- | --- |
| HTTP 502 | Estado/log do serviço e porta `3120` |
| Health 503 | PostgreSQL, `DATABASE_URL` e migration |
| Login falha para todos | relógio da VPS, `AUTH_SECRET`, usuário ativo e banco |
| Login bloqueado | limite de 8 falhas/IP por 15 min; reinício limpa o estado em memória |
| Mudança não aparece | build implantado, reinício do serviço e cache estático da PWA |
| Formulário rejeita lançamento | permissão, contas analíticas e competência fechada |
| Backup falha | espaço, permissões, PostgreSQL e logs do serviço de backup |

## Renovação TLS e Nginx

O Certbot normalmente instala renovação automática. Verifique periodicamente:

```bash
certbot certificates
systemctl list-timers | grep certbot
nginx -t
```

Na validação de 26/08/2026, o certificado expirava em 24/11/2026. Também havia
avisos de opções TLS redefinidas em outros virtual hosts da VPS. A configuração
era válida e o TerraCusto funcionava, mas esses avisos devem ser corrigidos em
uma manutenção global do Nginx.

## Checklist obrigatório de mudança

- [ ] Branch, commit e árvore de trabalho conferidos.
- [ ] Alterações de banco representadas por migration revisada.
- [ ] Backup criado antes de migration destrutiva ou de risco.
- [ ] Segredos e dados pessoais ausentes do diff.
- [ ] `npm run typecheck` aprovado.
- [ ] `npm run build` aprovado.
- [ ] Serviço reiniciado e ativo.
- [ ] Health check interno retorna aplicação e banco `ok`.
- [ ] HTTPS público e redirecionamento de login validados.
- [ ] Smoke test aprovado.
- [ ] `docs/ESTADO-ATUAL.md` atualizado.
