# MatchIntel P7 — Historical Expansion / Backfill Intelligence

## Objetivo
Expandir automaticamente a base histórica usada por Daily Tickets e Walk-Forward sem sacrificar a quota do radar operacional.

## Guardrails
- Janela histórica: 35 dias por padrão.
- 1 request da API-Football por data consultada.
- Lotes máximos: 8 datas por ciclo.
- Floor diário: 60 requests restantes.
- Reserva de minuto: 2 requests.
- Se a quota estiver desconhecida após a virada UTC, uma primeira chamada pode descobrir a nova quota; as chamadas seguintes obedecem imediatamente aos floors.
- Nenhum histórico sintético e nenhuma odd histórica inventada.

## Marcos
- 80 fixtures: base mínima de candidatos.
- 120 fixtures: walk-forward começa a ter chance de produzir amostra.
- 300 fixtures: fase de aprendizado.
- 600 fixtures: alvo principal de expansão/calibração.
- Mesmo após 600, o P7 pode completar os 35 dias se a quota permitir.

## Agenda
Enquanto houver dias faltantes, o P7 tenta um ciclo a cada 10 minutos. Se a quota estiver abaixo do floor, apenas registra PAUSED_QUOTA e não gasta chamadas. Após cobrir a janela, passa para ciclo de manutenção de 6 horas.
