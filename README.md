# Area01-Backend

Backend da Área 01 (Usuário/Público) da Plura — Hono em Cloudflare Workers.

Funções desta área (ver `areas-e-repositorios.md` do projeto de gestão):
- Busca de Páginas
- Login e criação de conta (1 conta por CPF)
- Criação/edição do perfil pessoal
- Comentar e avaliar Páginas
- Histórico das próprias avaliações
- Aviso quando uma avaliação for respondida

Banco de dados: Supabase `grupo.01` (`https://uoembacxxnkuwldmdgcu.supabase.co`).

## Deploy
O workflow `.github/workflows/deploy.yml` roda `wrangler deploy` a cada push.
Precisa dos secrets do repositório: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

## Secrets do Worker (nunca no código)
```
wrangler secret put SUPABASE_ANON_KEY
```
