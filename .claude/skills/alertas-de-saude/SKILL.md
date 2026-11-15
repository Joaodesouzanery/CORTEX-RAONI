---
name: alertas-de-saude
description: Checagem de saúde do Cortex depois de qualquer deploy, migration ou mudança em coleta, Painel, Notícias, Boletim ou Agenda. Use SEMPRE ao fechar uma etapa e sempre que o dono relatar tela com erro. Erro silencioso em tela é o que mais custou neste projeto.
---

# Alertas de saúde
O que roda sozinho:
- **`watchdog.yml`, a cada 3 h** (`scripts/watchdog.mjs`): é o vigia que **não depende do app**. Olha os workflows no GitHub, o `APP_URL` e a produção, e o banco direto. Abre ou fecha a Issue `saude` e manda e-mail quando a Issue abre. Foi criado porque a coleta ficou parada de 15/09 a 14/11/2026 sem alerta nenhum.
- **`POST /api/internal/health`**, passo do `fetch-news.yml`: rotas das telas, idade e status da última coleta, fontes com erro (por nome), links pendentes, agenda e teto da IA a 80%. Grava em `operational_alerts`, mantendo o "reconhecido", e o Painel mostra a faixa "Alertas operacionais". Atenção: roda dentro do mesmo pipeline, então verde aqui não prova saúde.

Diagnóstico por área: `saude-dos-workflows`, `saude-do-deploy`, `saude-da-coleta`, `saude-das-entregas` e `saude-do-orcamento-ia`, ou o agente `diagnosticador-de-saude`, que roda todas na ordem.

Checklist manual ao fechar etapa:
1. `typecheck`, `lint`, `test`, `build` verdes.
2. Migration nova entregue completa e confirmada como aplicada pelo dono **antes** de o código depender dela.
3. Abrir (ou pedir ao dono) Painel, Notícias, Boletim, Agenda e Fontes; qualquer "Falha ao carregar" vira correção imediata, com o status HTTP na mensagem.
4. Conferir em Actions o último `fetch-news` **e o último `watchdog`**, os dois verdes.
5. Registrar no `docs/HANDOFF.md` o que mudou e o que falta.

Regra: nenhuma mensagem de erro genérica. Toda falha mostra causa ou código.
