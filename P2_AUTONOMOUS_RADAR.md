# MatchIntel P2 — Autonomous Radar Core

## Regra central
Se Telegram ficar totalmente silencioso, o MatchIntel continua útil.

## Estratégia
- O Gateway continua responsável pelo provider/API-Football e pelos motores.
- O Bridge P2 não consome quota esportiva adicional.
- Ele descobre Match Sessions de forma recursiva em várias rotas locais e publica tudo no Cloud Relay.
- PRELIVE e LIVE passam a ser entidades visíveis na PWA.
- Telegram permanece como evidência adicional/acelerador, nunca dependência.

## Rotas locais sondadas
/radar, /matches, /match-sessions, /sessions, /prelive, /live, /focus, /scanner, /auto-scan.
Rotas inexistentes são simplesmente ignoradas.

## Guardrails
- P0 freshness continua obrigatório.
- Não inventar partida nem estatística.
- Nenhuma chamada externa extra para API-Football no Bridge P2.
- Dedupe por provider_match_id ou identidade da partida.
- Estado PRELIVE/LIVE/FINISHED normalizado.
- Horário pré-live preservado dentro de stats._matchintel.scheduledAt.
