# MatchIntel P11.0.2 — Live Truth & Freshness Integrity

Correção de segurança operacional após teste E2E do P11.0.1.

## Problema confirmado
O Bridge recebia snapshots esportivos antigos do Gateway e renovava `updated_at` a cada sincronização. A PWA interpretava `bridge_synced_at` como se fosse `provider_fetched_at`, exibindo partidas antigas como FRESH.

## Correções
- LIVE usa timestamp verdadeiro do provider como `updated_at`.
- `stats._matchintel.providerFetchedAt` e `bridgeSyncedAt` ficam separados.
- LIVE sem timestamp esportivo confiável nasce STALE, nunca FRESH.
- Live Operations mostra FRESH / DEGRADED / STALE e a idade da fonte + relay.
- P9.1 só promove quando o timestamp da fonte está FRESH.
- P8 Daily Decision também exige freshness real.
- Scanner amplo mantém reserva 20; Focus LIVE usa reserva separada e throttle quando quota está baixa.
- Labels duplicados de análise foram diferenciados.
- Texto de notificações foi normalizado.

## Guardrails preservados
P7 histórico, P9.2 Telegram × Dados, P9.3 Chat Máfia, P9.4 Backend Alerts, P10/P10.1 e P11 não tiveram thresholds de decisão alterados. BetZord continua apenas OVER 0.5 HT. Chat Máfia FIXADO/APITOU/APITADAÇO continua seguindo as regras aprovadas; dados stale não podem promover o MatchIntel.
