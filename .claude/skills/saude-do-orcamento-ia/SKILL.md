---
name: saude-do-orcamento-ia
description: Confere o gasto e os limites da Anthropic (teto mensal, chamadas por dia, chamadas paradas). Use antes de ligar a IA, quando o passo "Classify with master prompt" responder 503, ou quando o Painel mostrar alerta de orçamento.
---

# Saúde do orçamento da IA
1. **Gasto do mês:** `SELECT purpose, count(*), round(sum(cost_usd)::numeric, 2) FROM ai_usage_ledger WHERE created_at >= date_trunc('month', now()) GROUP BY 1 ORDER BY 3 DESC;`
2. **Limites na Vercel:** `ANTHROPIC_MONTHLY_BUDGET_USD` e `ANTHROPIC_DAILY_CALL_LIMIT`. Sem eles a IA não roda, de propósito.
3. **Respostas 503 do passo de IA:**
   - "não configurado": falta a chave ou os limites.
   - "teto atingido": esperar o mês virar ou subir o teto (decisão do dono).
4. O alerta de 80% do teto aparece no Painel (`health_ai_budget`).

**Regra:** a chave da Anthropic só é ligada depois dos dois limites e do teto no console.
