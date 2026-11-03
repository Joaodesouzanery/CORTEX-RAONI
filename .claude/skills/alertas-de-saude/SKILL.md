---
name: alertas-de-saude
description: Checagem de saúde do Cortex depois de qualquer deploy, migration ou mudança em coleta, Painel, Notícias, Boletim ou Agenda. Use SEMPRE ao fechar uma etapa e sempre que o dono relatar tela com erro. Erro silencioso em tela é o que mais custou neste projeto.
---

# Alertas de saúde
O que roda sozinho: `POST /api/internal/health` (passo diário do `fetch-news.yml`) testa as rotas das telas, a idade da última coleta, fontes com erro, links pendentes e a agenda, e grava em `operational_alerts`. O Painel mostra a faixa "Alertas operacionais".

Checklist manual ao fechar etapa:
1. `typecheck`, `lint`, `test`, `build` verdes.
2. Migration nova entregue completa e confirmada como aplicada pelo dono **antes** de o código depender dela.
3. Abrir (ou pedir ao dono) Painel, Notícias, Boletim, Agenda e Fontes; qualquer "Falha ao carregar" vira correção imediata, com o status HTTP na mensagem.
4. Conferir em Actions o último `fetch-news`: coleta, links, agenda e saúde verdes.
5. Registrar no `docs/HANDOFF.md` o que mudou e o que falta.

Regra: nenhuma mensagem de erro genérica. Toda falha mostra causa ou código.
