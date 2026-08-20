# MatchIntel P11.0.5 — Canonical Cloud Cleanup + Provider-ID Authority

## Backend aplicado antes da entrega do pacote
A view `matchintel_match_lifecycle` agora deduplica operacionalmente por `provider_match_id`.
A tabela bruta `matchintel_matches` continua preservada para auditoria, mas a camada operacional expõe apenas uma linha por identidade do provider.

Critério de escolha:
1. registro mais recente;
2. em empate, chave canônica `api:<provider_match_id>`;
3. chave estável como desempate final.

Resultado esperado:
- 2 partidas reais ativas = 2 linhas ATIVAS;
- `cloud_duplicates = 0` na view operacional.

## Bridge v2.5
A autoridade do provider deixa de ser apenas uma preferência de deduplicação.

Quando existe `provider_match_id`:
- `match_key = api:<provider_match_id>` obrigatoriamente;
- a chave antiga recebida do Gateway fica apenas em `stats._matchintel.incomingMatchKey`;
- `stats._matchintel.canonicalMatchKey` registra a chave usada na nuvem.

Assim, um item recebido como:
`match:seattle sounders|austin`
com provider id:
`api-football:1490401`

é publicado como:
`api:api-football:1490401`

## Pre-live
P11.0.5 corrige uma lacuna do P11.0.4:
PRELIVE inválido também é bloqueado quando o item JÁ possui provider_match_id.

Logo:
- oficial + kickoff vencido -> não publica;
- alias + kickoff vencido/ausente -> não publica;
- futuro válido -> publica;
- LIVE/FINALIZADO continuam seguindo freshness/lifecycle.

## Histórico
Nenhum registro bruto é apagado.
A limpeza é operacional/canônica, não destrutiva.

## PWA
P9 e P9.1 continuam lendo somente `matchintel_match_lifecycle` ATIVO.
P11.0.4 Pre-live Truth Gate permanece intacto.
Apenas o cache do Service Worker muda para forçar a versão nova.

## Não alterado
- Chat Máfia
- BetZord: somente OVER 0.5 HT
- Telegram
- P7
- P10/P10.1
- P11 Learning Loop
- thresholds
- gates
- promoção automática
