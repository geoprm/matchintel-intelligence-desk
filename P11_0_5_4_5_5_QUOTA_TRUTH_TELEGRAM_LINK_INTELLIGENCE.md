# MatchIntel P11.0.5.4 + P11.0.5.5

## P11.0.5.4 — Quota Truth + Feed Recovery

- Cada chamada real da API-Football passa a gerar um registro de auditoria local.
- O registro guarda operação, rota, início/fim, HTTP status, limite diário/minuto,
  saldo anterior e posterior, delta observado e detecção de rollover.
- A agenda do dia é cacheada: ciclos repetidos do scanner reutilizam o slate local
  e não gastam uma nova chamada `/fixtures?date=...`.
- O scanner amplo passa a detalhar no máximo 2 LIVE por ciclo.
- PRELIVE distante recebe cadence econômica.
- Focus LIVE busca estatísticas completas apenas nas janelas críticas ou quando
  Telegram/radar elevam a prioridade.
- `/quota-truth`, `/quota-audit` e `/quota-probe` ficam disponíveis no Gateway.
- `/quota-probe` é deliberadamente manual porque consome exatamente 1 request real.

## P11.0.5.5 — Telegram Link Intelligence

- Telegram passa a capturar URL visível, TextUrl escondida, preview e botões de link.
- Chat Máfia:
  link = discovery/radar de alta prioridade; nunca é aposta automática.
- FIXADO/APITOU/APITADAÇO continuam sendo tratados pela semântica já aprovada.
- Resenhas Bet:
  entra como COMMUNITY_DISCOVERY e confirmationWeight=0.
  Mensagens/links podem iniciar investigação, mas nunca contam como fonte confirmatória.
- Autor do Resenhas Bet é preservado para reputação futura por autor/mercado.
- Links ficam auditáveis em `matchintel_telegram_links`.

## Cloud

A infraestrutura cloud `matchintel_provider_quota_audit`,
`matchintel_telegram_links` e `matchintel-observability-ingest`
já foi preparada antes deste instalador.

## Guardrails preservados

- LIVE provider-only.
- Nenhum relay/updated_at vira freshness esportiva.
- Sem fallback silencioso.
- Sem scraping de bookmaker.
- BetZord continua exclusivamente OVER 0.5 HT.
- Chat Máfia divergente continua visível, mas não é promovido automaticamente.
- Resenhas Bet nunca confirma o modelo por si só.
