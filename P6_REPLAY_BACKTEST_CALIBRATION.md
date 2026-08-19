# MatchIntel P6 — Replay / Backtest / Calibration Engine

## Objetivo
Transformar o journal P5 em laboratório de validação sem lookahead. O P6 não altera thresholds automaticamente.

## Duas trilhas de replay
1. **Audit Replay** — usa somente previsões P5 liquidadas, com snapshot anterior ao resultado. Predições capturadas já em FT/AET/PEN/FINISHED são excluídas. Repetições do mesmo match+market são deduplicadas pelo primeiro snapshot.
2. **Walk-Forward Pré-Live** — reexecuta mercados de placar (Over 1.5, Over 2.5, BTTS, mandante 1+, visitante 1+) sobre o histórico, usando exclusivamente fixtures anteriores ao kickoff de cada alvo. Não recria odds históricas e, portanto, não calcula ROI sintético.

## Grid de thresholds
- Probabilidade mínima: 50 / 60 / 65 / 70 / 75 / 80%
- DQ mínimo: 0 / 60 / 70 / 80
- Fontes esportivas: 0 / 2
- Edge mínimo quando existe odd observada: sem filtro / 3 / 6 p.p.
- Contexto global, por módulo e por mercado quando há amostra

## Proteção contra overfitting
- Split temporal: 70% treino / 30% validação, nunca aleatório.
- Gate conservador de promoção: >=120 total, >=80 treino, >=36 validação, estabilidade <=8 p.p., erro de calibração <=8 p.p. e Wilson inferior >=52%.
- Regras dependentes de edge ainda exigem >=25 apostas com odd observada e yield positivo na validação.
- Resultado: `PROMOTION_CANDIDATE` significa **revisão manual**, nunca alteração automática.

## Calibração
Reliability bins de 10 p.p., ECE e taxa suavizada. Recomendações só aparecem em bins com >=30 ocorrências e erro >=5 p.p.; continuam consultivas.

## Regra de ouro
Nenhum dado posterior ao alvo pode entrar no cálculo do replay. Nenhuma odd de bookmaker é inventada para jogos históricos.
