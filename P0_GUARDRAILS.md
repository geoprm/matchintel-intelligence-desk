# MatchIntel P0 — Freshness & Deduplication Guard

Status: aprovado e implementado em 18/08/2026.

## Invariantes operacionais
1. Um snapshot já presente quando o Cloud Bridge inicia é BASELINE, nunca sinal novo.
2. PIN/APITOU só entra em "Prioridade Agora" por no máximo 5 minutos.
3. Qualquer sinal operacional expira do painel atual em 10 minutos.
4. O mesmo sinal usa fingerprint estável e não é reenviado a cada polling.
5. Quando existe ID da mensagem/evento do Telegram, ele integra a identidade do sinal.
6. Um baseline só pode voltar a ser elegível após desaparecer por pelo menos 2 ciclos.
7. O Cloud Ingest rejeita sinais com timestamp ausente, futuro absurdo ou idade > 10 minutos.
8. A PWA aplica a última barreira: sinal velho não aparece como atual mesmo que outra camada falhe.
9. Partida LIVE só aparece operacionalmente se o Gateway estiver fresco e a sessão tiver atualização <= 90 s.
10. Cache/service worker é network-first e não pode ressuscitar dados operacionais antigos.

## Defesa em profundidade
Gateway/Bridge -> Cloud Ingest/Supabase -> PWA.

O caso Roma x Lazio é o teste de regressão canônico do P0.
