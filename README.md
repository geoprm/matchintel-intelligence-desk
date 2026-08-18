# MatchIntel Intelligence Desk

PWA pessoal para inteligência esportiva baseada exclusivamente em dados reais enviados pelo Gateway MatchIntel.

## Arquitetura

Gateway local → `matchintel-ingest` (Supabase Edge Function) → tabelas `matchintel_*` → PWA HTTPS no Vercel.

## Regra de produção

Nenhum jogo, placar, odd, estatística, sinal ou probabilidade é inventado. Empty state é exibido quando não há dados reais.

## Deploy GitHub → Vercel

1. Suba este diretório para um repositório GitHub.
2. No Vercel: **Add New → Project → Import Git Repository**.
3. Framework preset: **Other**.
4. Build command: `node scripts/build.mjs`
5. Output directory: `dist`
6. Deploy.

Não há variáveis de ambiente obrigatórias para o frontend. A chave Supabase usada no navegador é **publishable**, limitada por RLS a leitura das tabelas sanitizadas.

## Gateway

Copie o conteúdo de `gateway-cloud-bridge/` para dentro da pasta atual do Gateway MatchIntel e siga `PASSO_A_PASSO_PC.txt`.

Nunca envie `.env.cloud` ao GitHub.
