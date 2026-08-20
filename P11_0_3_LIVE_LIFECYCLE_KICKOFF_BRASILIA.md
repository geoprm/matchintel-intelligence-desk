# MatchIntel P11.0.3 — Live Lifecycle + Kickoff Brasília

## Correção 1 — Ao Vivo usa lifecycle, não tabela bruta
P9 Live Operations e P9.1 Opportunity Engine passam a consultar `matchintel_match_lifecycle` com `lifecycle_state=ATIVO`.

Consequência:
- FINALIZADO não aparece no Ao Vivo;
- EXPIRADO não aparece no Ao Vivo;
- esses jogos permanecem no Histórico/Intelligence Hub;
- um relay recente nunca reativa visualmente uma partida que o lifecycle já encerrou.

## Correção 2 — Horário pré-live
O Gateway já possui `startTimestamp` em milissegundos. O Bridge P11.0.2 não o incluía na função `scheduledAt`, por isso a nuvem recebia `scheduledAt=null`.

P11.0.3:
- preserva `startTimestamp`;
- também aceita `sourceMatrix.fields.kickoff`;
- grava `stats._matchintel.scheduledAt`;
- PWA exibe `HH:mm` e `DD/MM · Brasília`;
- timezone de exibição: `America/Sao_Paulo`.

## Horário local da partida
Não é inferido nesta versão.

Motivo: a fonte consultada é normalizada para o timezone configurado do MatchIntel e não há, no objeto cloud atual, um timezone de estádio/localidade suficientemente confiável. Inferir por país seria incorreto em países com múltiplos fusos, especialmente EUA.

Quando houver timezone local confiável do venue, ele poderá ser mostrado como informação secundária sem mudar o horário-base de Brasília.

## Sem mudança de inteligência
P9.2/P9.3/P9.4, Chat Máfia, BetZord, P10/P10.1, P11, P7, thresholds e regras de promoção permanecem intactos.
