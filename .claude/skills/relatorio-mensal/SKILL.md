---
name: relatorio-mensal
description: Como gerar o relatório mensal no modelo real do Cortex. Use ao mexer em geração, seções, evidências ou pacote para o Claude Design.
---

# Relatório mensal
Siga `docs/playbook/modelo-relatorio.md`. Design fica no Claude Design.
- Geração por seção (limite de 60s).
- Evidência só com link verificado; código validado contra o conjunto enviado.
- Respeite o guardrail institucional do cliente.
- Marca do entregável é parâmetro.
- Antes do PDF, use o agent `verificador-de-fonte`.
