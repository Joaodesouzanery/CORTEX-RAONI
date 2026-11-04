# Orçamento: Anthropic e e-mail

Preços da Anthropic consultados em 04/11/2026, em US$ por milhão de tokens (entrada / saída):

| Modelo | Entrada | Saída |
|---|---|---|
| Haiku 5.5 | 0,10 | 0,50 |
| Sonnet 5.5 | 2 | 10 |
| Opus 5.5 | 4 | 20 |

A Batch API (processamento assíncrono) dá 50% de desconto. Os valores de e-mail são do Resend e precisam ser conferidos em resend.com/pricing antes de assinar.

**Volume real de outubro:** cerca de 2.200 matérias marcadas para 6 clientes, segundo os CSVs. Com a ANTAQ e a coleta nova, **use 3.000 por mês**. São **8 entregáveis**: 7 clientes, sendo o SindInfor em duas versões.

## Anthropic: por tarefa

| Tarefa | Premissa | Sonnet 5.5 | Haiku 5.5 |
|---|---|---|---|
| Triagem das matérias (tom, porta-voz, "por que importa") | 3.000 matérias × ~600 tokens de entrada e 150 de saída | US$ 8 / mês | US$ 0,40 / mês |
| Relatório mensal (9 seções + verificação) | 8 entregáveis × 10 chamadas × ~30 mil de entrada e 3 mil de saída | US$ 7 / mês (Opus 5.5: US$ 14) | não recomendado |
| Resumo **diário** por cliente | 8 × 22 dias úteis × ~13 mil de entrada e 2 mil de saída | US$ 8 / mês | US$ 0,40 / mês |
| Resumo **semanal** por cliente | 8 × 4,3 semanas × ~65 mil de entrada e 4 mil de saída | US$ 6 / mês | US$ 0,30 / mês |

**Cenários mensais:**
- **Diário, com Sonnet 5.5 em tudo:** cerca de **US$ 25 por mês**.
- **Semanal, com Sonnet 5.5 em tudo:** cerca de **US$ 20 por mês**.
- **Mais barato:** Haiku 5.5 na triagem e no resumo, Sonnet 5.5 no relatório. Cerca de **US$ 8 por mês**.
- **Relatório com Opus 5.5:** some cerca de US$ 7.

Recomendação: **Haiku 5.5 na triagem, Sonnet 5.5 no resumo diário e no relatório**, cerca de **US$ 16 por mês**.

**Valores para a Vercel:**
- `ANTHROPIC_MONTHLY_BUDGET_USD=40`: folga de cerca de duas vezes a estimativa.
- `ANTHROPIC_DAILY_CALL_LIMIT=300`: no dia de gerar os 8 relatórios são cerca de 80 chamadas; triagem e resumo somam menos de 100 por dia.
- No console da Anthropic, um limite mensal de **US$ 50**, como última barreira.

O teto já está no código (`src/lib/ai/budget.ts`). Passou dele, o pipeline para e mostra o motivo na tela.

## E-mail (Resend)

| Plano | Limite | Preço |
|---|---|---|
| Free | 3.000 e-mails por mês e **100 por dia** | US$ 0 |
| Pro | 50.000 por mês, sem limite diário relevante | cerca de US$ 20 por mês |

A premissa é N destinatários por cliente, com 8 entregáveis.

| Destinatários por cliente | Diário (22 dias úteis) | Semanal | Plano |
|---|---|---|---|
| 5 (40 no total) | 880 por mês, 40 por dia | 172 por mês | Free nos dois |
| 12 (96 no total) | 2.112 por mês, 96 por dia | 413 por mês | Free (no limite do dia) |
| 15 ou mais (120 ou mais) | mais de 100 por dia | 516 por mês | **Pro** no diário; Free no semanal |

Exige um domínio verificado, com SPF e DKIM, para não cair no spam. Use `RESEND_API_KEY` e um remetente do domínio da marca (por exemplo, `boletim@...`).

## Resumo

| Cenário | Anthropic | E-mail | Total por mês |
|---|---|---|---|
| Diário, até 12 destinatários por cliente | cerca de US$ 16 a 25 | US$ 0 | **cerca de US$ 16 a 25** |
| Diário, 15 ou mais destinatários por cliente | cerca de US$ 16 a 25 | cerca de US$ 20 | **cerca de US$ 36 a 45** |
| Semanal | cerca de US$ 14 a 20 | US$ 0 | **cerca de US$ 14 a 20** |
