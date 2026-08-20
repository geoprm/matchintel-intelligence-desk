# MatchIntel P11.0.5.2 — Live Phase Freshness Authority

## Regra central
Uma partida com fase `1H / HT / 2H / ET / P / BT` é LIVE para fins de freshness,
mesmo quando o estado/radar esteja rotulado como `PROMISING`, `ACTIVE`, `MONITORAR` ou equivalente.

## Bridge 2.6
Para LIVE:
- `providerFetchedAt` é obtido somente de campos explicitamente ligados ao provider/source matrix;
- `updated_at`, `updatedAt`, `source_matrix.updatedAt` e `bridgeSyncedAt` NÃO podem substituir o tempo esportivo;
- `freshnessBasis = PROVIDER` apenas quando há timestamp esportivo;
- sem timestamp: `freshnessBasis = PROVIDER_MISSING`;
- `updated_at` publicado para LIVE usa o timestamp real do provider ou epoch de segurança.

O state cloud é normalizado para `LIVE` quando a fase é autoritativamente LIVE.
O estado original continua preservado em `stats._matchintel.sourceState` e pode continuar aparecendo em `radar_state`.

## Lifecycle Supabase
Migration `p11_0_5_2_live_phase_freshness_authority` aplicada:
- LIVE ATIVO exige `provider_fetched_at`;
- exige `freshness_basis = PROVIDER`;
- provider age <= 7 minutos;
- futuro máximo tolerado: 2 minutos;
- sem provider time / basis incorreta / >7 min => EXPIRADO.

PRELIVE mantém P11.0.4:
- kickoff válido;
- tolerância -15 min;
- até +14 dias.

## P9 Live Operations
Nunca usa `updated_at` como fallback do provider.
`FRESH`: <=150 s.
`DEGRADED`: >150 s e <=7 min.
`STALE/UNKNOWN`: fora disso ou provider authority ausente.

## P9.1 Opportunity Engine
Promoção exige:
- timestamp esportivo;
- `freshnessBasis = PROVIDER`;
- age <=150 s;
- demais gates P9.1 existentes.

## Critérios E2E obrigatórios
- active_live_without_provider_time = 0
- active_live_stale = 0
- active_live_bridge_freshness = 0
- cloud_duplicates = 0
- noncanonical_active = 0

## Não alterado
Telegram, Chat Máfia, BetZord (somente OVER 0.5 HT), P7, P10, P10.1, P11,
thresholds de qualidade/probabilidade e promoção automática.
