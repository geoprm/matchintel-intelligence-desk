# MatchIntel P11 — Intelligence Learning Loop

## Objetivo
Transformar resultados auditáveis em aprendizado organizado sem permitir que o sistema altere regras sozinho.

## Fontes
- `matchintel_performance_records`: previsões e settlements do P5.
- `matchintel_backtest_runs`: gate P6 / walk-forward.
- `matchintel_signals`: diagnóstico de resolução Telegram.
- `matchintel_ticket_executions`: feedback daquilo que foi realmente executado.
- P7 é lido pelo `fixture_count` do último backtest.

## Higiene auditável
O P11 aceita como aprendizado de performance somente:
1. resultado WON / LOST / VOID;
2. `locked_at` e `generated_at` anteriores ao kickoff;
3. outcome disponível para WON/LOST;
4. primeira previsão por match+market;
5. sem resultado UNSUPPORTED.

## Candidate Rule Lab
Estados:
- OBSERVAR: amostra abaixo de 40;
- TESTAR: 40–119;
- CANDIDATO: >=120 + Wilson lower >=50% + erro de calibração <=12 p.p.;
- REJEITADO: amostra >=120 sem estabilidade mínima.

Mesmo `CANDIDATO`:
- `auto_promotable = false`;
- exige P6;
- não altera thresholds;
- não altera o motor em runtime.

## Dimensões iniciais
- mercado;
- faixa de DQ;
- faixa de probabilidade;
- perfil de ticket;
- provider quando houver proveniência auditável.

## Learning Journal
Expõe:
- o que aprendemos;
- amostra;
- evidência a favor;
- evidência contra;
- confiança;
- impacto;
- status.

## Telegram
P11 mede cobertura/resolução por fonte. Resultado de Chat Máfia/BetZord só entra como performance quando existir ligação auditável ao jogo/mercado e outcome posterior.

## Execução real
P10/P10.1 permanece separado do shadow teórico. O P11 usa o volume de execuções como feedback, mas não mistura execução real com backtest.
