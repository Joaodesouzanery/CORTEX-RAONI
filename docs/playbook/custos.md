# Custos estimados da API Anthropic
Estimativa de 01/11/2026, não medição. Preços em dólar da API: Sonnet 5.5 US$ 2/US$ 10 por milhão de tokens (entrada/saída), Haiku 5.5 US$ 0,10/US$ 0,50, conforme tabela de 06/10/2026. Confira o preço vigente antes de orçar. Atualize com o custo real do teste.

| Item | Premissa | Unidade | Cenário inicial/mês |
|---|---|---|---|
| Matéria longa (redigir e checar) | ~40 mil entrada, ~12 mil saída | ~US$ 0,20 | 60 = US$ 12 |
| Relatório mensal | 9 seções, ~270 mil entrada, ~20 mil saída, sem cache | ~US$ 0,75 | 7 = US$ 5 |
| Boletim | ~15 mil entrada, ~3 mil saída | ~US$ 0,06 | 30 = US$ 2 |
| Triagem com Haiku | ~1 mil entrada, ~100 saída, por matéria e cliente | ~US$ 0,00015 | 20 mil = US$ 3 |

Total inicial: **~US$ 22/mês**; com 200 matérias, **~US$ 50/mês**. Use o dobro como margem: thinking, novas tentativas e textos maiores variam. Batch (50%) e cache reduzem. Não inclui Supabase, Vercel, banco de imagens nem câmbio.

Proteja as rotas públicas antes da chave: hoje um visitante pode disparar gasto. Defina limite de gasto no Console.
