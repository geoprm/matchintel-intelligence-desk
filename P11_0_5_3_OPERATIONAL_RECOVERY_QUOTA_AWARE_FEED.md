# MatchIntel P11.0.5.3 — Operational Recovery + Quota-Aware Feed

## Objetivo
Estabilizar a operação depois dos guardrails P11.0.5.2 sem voltar a aceitar dados falsos.

## Mudanças
- PRELIVE legítimo fica cacheado no Bridge até o kickoff (+15 min).
- Lookahead da chamada diária: 24h sem request adicional.
- Quota <=20: PAUSED_QUOTA; reserva LIVE preservada.
- Rollover UTC: detectado localmente a cada 5 min; então o scanner reabre o slate.
- LIVE continua provider-only.
- Epoch em s/ms/us/ns é normalizado; anos fora de 2020–2100 são rejeitados.
- P8 usa a mesma autoridade provider-time do P9/P9.1.
- P10 só chama de bilhete liberado quando READY/LOCKED existir.
- Estados vazios deixam de parecer spinner travado.
- Topbar separa Gateway/Telegram do estado da quota do provider.

## Backend já saneado
2 scheduledAt impossíveis foram removidos do campo operacional e preservados em `_matchintel.scheduleRejected`.

## Preservado
Identidade canônica, Pre-live Truth, Chat Máfia, BetZord somente OVER 0.5 HT, P7, P10.1, P11 e SHADOW.
