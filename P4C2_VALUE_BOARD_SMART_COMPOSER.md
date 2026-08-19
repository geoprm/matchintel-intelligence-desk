# MatchIntel P4C2 — Value Board + Smart Ticket Composer

## Objetivo
Transformar a camada de odds do P4C1 em inteligência operacional sem misturar probabilidade do modelo com preço de mercado.

## Value Board
- Só publica oportunidades quando existe probabilidade MatchIntel + odd observada compatível.
- Usa consenso sem margem do feed externo como referência de mercado.
- Classificações: SEM VALOR, MONITORAR, VALOR, FORTE VALOR.
- `FORTE VALOR` exige edge, vantagem de preço, qualidade, amostra e duas fontes esportivas independentes.
- Odds com mais de 6h não entram no ranking.
- A UI deixa explícito que a melhor odd observada pode vir de bookmaker internacional do feed e não representa necessariamente Betano/Bet365 Brasil.

## Smart Ticket Composer
- Mantém uma perna por partida.
- Limita exposição à mesma liga, mesmo mercado e mesma janela de kickoff.
- Segurança prioriza probabilidade/qualidade e rejeita preço fortemente deteriorado quando conhecido.
- Equilíbrio mistura probabilidade, qualidade e preço sem obrigar odd observada.
- Valor exige odd observada, edge >= 3 p.p. e vantagem de preço >= 4% em todas as pernas escolhidas.
- Bingo continua de alta variância, com diversificação e sem depender de zebras aleatórias.
- Tudo permanece em SHADOW até calibração.

## Cloud
Canal dedicado: `matchintel_value_opportunities` + Edge Function `matchintel-value-ingest`.
A probabilidade do MatchIntel nunca é recalculada a partir da odd.
