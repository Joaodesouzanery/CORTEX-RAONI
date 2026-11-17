---
name: qualificacao-por-cliente
description: Como o prompt mestre de cada cliente decide relevância, tema, Cliente/Setor e tom, e como usar o pacote de qualificação (sem chave) e a importação. Use ao mexer em src/lib/ai/classify-master.ts, src/lib/qualification.ts, temas do cliente ou clients.report_prompt.
---

# Qualificação por cliente
- **Ordem:** regra direta (cita o cliente), depois regra de setor, depois tema do cliente (marcação na coleta, sem IA), e por fim o prompt mestre (sob demanda).
- **A IA só roda quando o dono gera o relatório:** botão "Qualificar com IA" na preparação. Nada de passo diário.
- **Sem chave:** "Pacote de qualificação" (`.md`), colado num chat do Claude, e o JSON de volta em "Importar qualificação".
- **Validação obrigatória:** `validateDecisions` só aceita id enviado e tema da lista. O texto da matéria vai dentro de `<materias>`, como dado.
- **A decisão de pessoa nunca é sobrescrita** (filtro no UPDATE). A decisão `ia` não é desfeita pela regra na coleta seguinte.
- **Tom:** só é afirmado no e-mail ou no clipping quando `classification_source` é `humano` ou `ia`.
