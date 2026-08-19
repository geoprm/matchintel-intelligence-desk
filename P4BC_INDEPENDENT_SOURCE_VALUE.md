# MatchIntel P4B/C1 — Independent Source + Market Value Foundation

## Objetivo
Adicionar uma segunda família externa de dados esportivos e uma camada separada de mercado/odds sem alterar os princípios canônicos do MatchIntel.

## Regras congeladas
- API-Football continua como fonte esportiva automática primária.
- The Odds API entra em dois papéis logicamente separados:
  - `sports-data`: fixtures/scores, `independenceGroup = the-odds-api`;
  - `market-data`: odds/consenso, não conta como uma terceira fonte esportiva independente.
- Telegram continua sendo evidência/prioridade operacional e não conta como fonte esportiva independente.
- Odds observadas nunca alteram silenciosamente a probabilidade do modelo.
- Ausência de dado não vira zero.
- Strong/Elite continuam sujeitos aos guardrails de qualidade/independência existentes.
- Betano/Bet365 locais não são inferidas quando o feed não as fornece explicitamente.

## P4B — Independent Source
- Provider: The Odds API V4.
- `/sports` descobre esportes ativos.
- `/scores` oferece fixtures/scores para confirmação independente.
- Resolver liga evento externo a MatchSession por equipes + kickoff.
- Liga genérica ambígua sem país não é adivinhada para evitar gasto e associação errada.
- Source Matrix confirma campos individualmente: teams, kickoff, score, phase etc.
- `market-data` fica fora da contagem `independentSportsSources`.

## P4C — Market Value
- Primeira camada: 1X2 (`h2h`) e totals.
- Integração de valor operacional inicial: Over 2.5 quando houver mercado compatível.
- Para cada bookmaker válido, o vigorish é removido antes do consenso.
- Mantidos separadamente:
  - probabilidade MatchIntel;
  - odd observada;
  - probabilidade implícita da odd;
  - probabilidade justa do consenso de mercado;
  - edge em pontos percentuais;
  - timestamp e quantidade de bookmakers.
- Bilhete só recebe `observed_odds` quando a perna possui preço compatível real no feed.
- Odd combinada observada só existe se todas as pernas do bilhete tiverem odds observadas.

## Controle de quota
Configuração inicial econômica:
- região: `eu`;
- mercados: `h2h,totals`;
- máximo: 1 competição/sport key por ciclo;
- intervalo: 8 horas;
- reserva mensal: 120 créditos.

O provider lê os headers de quota e bloqueia chamadas pagas ao atingir a reserva. `/sports`, que é gratuito, também é usado para atualizar o contador após eventual reset mensal.

## Novos endpoints locais
- `GET /external-source-status`
- `GET /market-feed`
- `POST /external-refresh` (autenticado; usar apenas para diagnóstico controlado)

## PWA
- Fontes/Status mostra The Odds API separadamente.
- Match Command Center pode mostrar `Mercado observado`.
- Bilhetes podem mostrar odd observada + edge por perna.
- A interface explica que odds internacionais do feed não significam Betano/Bet365 Brasil.

## Estado de implantação
Gateway alvo: `0.13.0-P4BC`
Cloud Bridge alvo: `1.7-P4BC`
P3 Telegram E2E e P4A Daily Tickets permanecem ativos em paralelo.
