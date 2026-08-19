# MatchIntel P4A — Daily Ticket Engine

## Objetivo
Publicar diariamente quatro perfis na Home: Segurança, Equilíbrio, Valor e Bingo.

## Guardrails congelados
- Nunca inventar odd de bookmaker.
- `fair_odds` = odd justa derivada da probabilidade do modelo; não é odd observada.
- `min_value_odds` = limiar mínimo de valor do modelo; precisa ser comparado com odd real antes de qualquer decisão.
- Sem base histórica suficiente, o cartão fica `INSUFFICIENT`; o motor não força palpite.
- V1 usa somente partidas diferentes em um mesmo bilhete para reduzir correlação óbvia.
- Shadow Mode permanece ativo até calibração/backtest.
- Telegram não altera a probabilidade pré-live por si só.

## Motor V1
Base histórica local de fixtures encerrados da API-Football, com backfill protegido por quota. Estima Over 1.5, Over 2.5, BTTS e equipe 1+ gol com suavização bayesiana combinando liga e histórico recente das equipes.

## Quota
O backfill só ocorre quando a quota diária conhecida está acima do piso de segurança P4A (default 60). Com a quota atual abaixo do piso, nenhuma chamada histórica extra é feita. O motor continua mostrando os quatro slots e aguardando dados.

## Cloud
- tabela: `public.matchintel_daily_tickets`
- Edge Function: `matchintel-ticket-ingest`
- Bridge: v1.6-P4A
- Gateway: v0.12.0-P4A

## Perfis
- SAFETY: 2 legs, alta probabilidade individual.
- BALANCED: 3 legs, equilíbrio entre probabilidade e retorno.
- VALUE: 3 legs, maior retorno com critérios mínimos de qualidade.
- BINGO: 6 legs, alta variância e odd justa combinada alta.
