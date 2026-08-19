# MatchIntel P5 — Settlement, Performance & Calibration

## Objetivo
Transformar previsões, Value Board e Bilhetes do Dia em um journal mensurável, sem look-ahead e sem inventar ROI.

## Regras congeladas
- SHADOW MODE permanece ativo.
- Um bilhete é congelado na primeira vez em que fica READY, antes do primeiro kickoff.
- Uma oportunidade de valor é congelada na primeira vez em que atinge VALUE/STRONG_VALUE, antes do kickoff.
- Resultados são liquidados somente depois de uma partida encerrada aparecer nas Match Sessions ou no histórico local.
- Nenhuma chamada extra de API é necessária para settlement.
- ROI/yield usa somente odds realmente observadas e aposta flat de 1 unidade.
- Bilhetes sem odd observada completa entram em hit-rate/calibração, mas não em ROI.
- Mercados que exigem granularidade de eventos não são marcados como RED por ausência de evento; ficam UNSUPPORTED quando a captura não é suficiente.

## Mercados com settlement automático v1
Determinísticos por placar final:
- OVER_15_FT
- OVER_25_FT
- BTTS
- HOME_O05
- AWAY_O05

Com snapshot/halftime disponível:
- GOAL / GOAL_FT / LATE_GOAL
- GOAL_HT
- OVER_05_2H
- OVER_15_2H
- HT_00_OVER_15_2H

Mercados de corner/instant/player/card permanecem fora do auto-settlement negativo v1 quando não houver cobertura de eventos completa.

## Métricas
- settled count
- hit rate
- Brier score
- flat-unit profit
- observed yield
- por módulo
- por mercado
- por perfil de bilhete
- por provider/origem
- bins de calibração

## Cloud
O P5 usa:
- matchintel_performance_records
- matchintel_performance_snapshots
- Edge Function matchintel-performance-ingest

A infraestrutura cloud foi criada antes da entrega deste pacote.
