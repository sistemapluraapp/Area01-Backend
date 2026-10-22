# Area01-Backend

Backend da **Área 01 (Usuário/Público)** da Plura — Hono 4 em Cloudflare Workers.
Atende o site público `plura.app.br` (Area01-Frontend).

## Funções
- Busca de páginas e página pública completa (visitante navega sem login)
- Cadastro e login (1 conta por CPF), confirmação de e-mail e recuperação de senha
- Perfil pessoal: dados, avatar, necessidades de acessibilidade, colaborações
- Avaliar páginas, histórico das próprias avaliações e aviso de resposta
- Favoritos (páginas) e locais favoritos (cidades/estados) com aviso por e-mail
- Agenda cultural, “Tenho interesse” em eventos, denúncia de informação errada
- Link de compartilhamento com prévia (`/s/:id`) e verificação pública de certificado (`/verificar/:codigo`)
- Landing page de `plura.app.br` (conteúdo editado no ADM; formulário, visitas e cliques)

## Stack e estrutura
```
src/index.ts            todas as rotas (Hono)
src/middleware/auth.ts  requireAuth / optionalAuth
src/lib/                supabase.ts (cliente com o JWT do usuário), cpf.ts, limite.ts
src/routes/             um arquivo por recurso
```
O backend nunca usa a `service_role`: toda consulta vai ao Supabase com o JWT do
usuário (ou anônimo), então as políticas de RLS sempre valem.

## Rodar localmente
```
npm install
npm run dev          # wrangler dev → http://localhost:8787
npm run typecheck
```
O `wrangler dev` usa o Supabase real (`grupo.01`): não há banco local.

## Configuração
| Nome | Tipo | Descrição |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | var (`wrangler.toml`) | Projeto `grupo.01`. A chave é a *publishable key*, pública por natureza (a proteção é o RLS) |
| `AREA`, `FRONTEND_URL` | var | `"01"` e o site usado no link `/s/:id` |
| `CERTIFICACOES` | binding R2 | Bucket `plura-certificacoes` (só o prefixo `landing/` é servido) |
| `LIMITE` | binding ratelimit | 20 tentativas/min por IP em cadastro, login e senha (`src/lib/limite.ts`) |
| `CSC_API_KEY` | secret (opcional) | CountryStateCity, para estados/cidades fora do Brasil |

## Segurança
- Rotas de autenticação limitadas por IP; acima do limite a resposta é `429` com `codigo: "limite_tentativas"`.
- As funções do banco usadas sem login (`cpf_em_uso`, `verificar_certificacao`,
  `avaliacoes_publicas`, `certificacoes_publicas_pagina`) são públicas de propósito;
  as demais tiveram o `EXECUTE` revogado de visitantes em 2026-10-22
  (migrations em `Area04-Backend/db/migrations/20261022_*`).

## Deploy
GitHub Actions a cada push:
- produção (`main`, `claude/great-franklin-kisti3`): `.github/workflows/deploy.yml` → Worker `area01-backend`
- teste (`claude/clever-knuth-bx0368`, `claude/stoic-babbage-0gea8e`): `deploy-teste.yml` → `area01-backend-teste`

Secrets do repositório: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` e, opcional, `CSC_API_KEY`.

## Banco de dados
Supabase `grupo.01` (`uoembacxxnkuwldmdgcu`). As migrations versionadas ficam em
`Area02-Backend/db/migrations` e `Area04-Backend/db/migrations`.
