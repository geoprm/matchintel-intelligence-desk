# MatchIntel P11.0.4 — Canonical Match Identity + Pre-live Truth Gate

## Backend já aplicado
A view `matchintel_match_lifecycle` foi atualizada no Supabase para que PRELIVE só seja `ATIVO` quando:
- há kickoff confiável em `stats._matchintel.scheduledAt`;
- o kickoff não passou mais de 15 minutos;
- o kickoff está no máximo 14 dias à frente;
- o registro foi sincronizado recentemente.

PRELIVE sem horário deixa de ser operacional e vira `EXPIRADO`.

## Identidade canônica no Bridge
O Bridge v2.4:
- prefere `provider_match_id`;
- agrupa alias e oficial pelo par normalizado casa/fora;
- quando o alias não tem kickoff, a identidade oficial vence;
- quando ambos têm kickoff, só são tratados como a mesma partida se estiverem dentro de 6 horas;
- dados úteis de radar podem ser fundidos no registro oficial;
- PRELIVE sem kickoff futuro válido deixa de ser publicado.

## Pre-live da PWA
A Home só considera pré-live:
- `lifecycle_state=ATIVO`;
- não LIVE/finalizado/cancelado;
- kickoff válido;
- kickoff >= agora - 15 min;
- kickoff <= agora + 14 dias.

O card mantém `HH:mm` e `DD/MM · Brasília`.

## Regra de segurança
- jogo encerrado não ressuscita por alias `time::time`;
- alias sem hora não entra em pré-live;
- rematch futuro não é fundido automaticamente com jogo antigo se os kickoffs forem diferentes;
- Histórico continua preservando evidência;
- P9/P9.1 continuam usando somente lifecycle ATIVO.

## Não alterado
Telegram, Chat Máfia, BetZord (somente OVER 0.5 HT), P7, P10, P10.1, P11, thresholds e promoção automática.
