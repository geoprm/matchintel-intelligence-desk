# MatchIntel P1 — Alertas Push + Ação Imediata

## Congelado
- MONITORAR: somente dentro da PWA, sem push crítico.
- MatchIntel FORTE: Web Push + som padrão do Android + vibração suportada.
- MatchIntel ELITE: push crítico, alta urgência, requireInteraction quando suportado.
- CHAT MÁFIA TOP 1: PIN/APITOU/FIXADO fresco pode gerar push crítico.
- Chat Máfia usa SOMENTE Bet365. O botão usa o link original validado do Telegram; se não houver URL Bet365 válida, não inventa link.
- BETZORD VIP/PREMIUM: família única para dedupe. Alertas P1 focam GOAL_HT/FORTE/ELITE. Casa: Betano.
- BetZord usa link Betano válido recebido; sem link direto, abre a página base Betano.
- Nenhum alerta é disparado por replay histórico.
- P0 continua soberano: sinal stale nunca gera push.

## Segurança de links
Links clicáveis são restritos a hosts aprovados:
Bet365: bet365.bet.br / bet365.com
Betano: betano.bet.br / betanobr.com (compatibilidade com mensagens históricas)

## Som
- App aberto: beep duplo MatchIntel após ativação/interação do usuário.
- App fechado/background: notificação Web Push não silenciosa; o som é controlado pelo canal/configuração de notificações do Android/Chrome.

## Infraestrutura cloud
- matchintel_push_subscriptions
- matchintel_push_log
- matchintel-push-subscribe
- matchintel-push-test
- matchintel-ingest v5 com dispatch e cooldown/dedupe
