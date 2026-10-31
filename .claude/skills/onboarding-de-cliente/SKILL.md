---
name: onboarding-de-cliente
description: Passo a passo para cadastrar cliente ou setor novo. Use ao adicionar cliente, tema, regra ou fonte.
---

# Onboarding de cliente
Um tema só funciona com três camadas: fonte, `client_relevance_rules` e `client_report_topic_templates`. Regra e tema entram por migration (molde: 034, 039).
- Registre aliases, grafias alternativas e dirigentes.
- Termos longos: tema casa por substring ("ONS" casa "consumo"). Exclusão veta o documento inteiro.
- `required = FALSE` no primeiro ciclo; `MAX(position)+1`; pós-condição que falha alto.
- Defina guardrail institucional e marca do entregável.
- Entregue o SQL para o usuário colar. Depois meça com `calibracao-contra-gabarito`.
