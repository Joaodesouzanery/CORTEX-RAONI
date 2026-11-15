# Prompt mestre como classificador

**O que faz.** Depois de cada coleta, o prompt mestre de cada cliente revisa as matérias que a regra deixou em "revisão". Para cada uma ele decide:
- se interessa ao cliente;
- se cita o cliente;
- o tema, escolhido entre os temas fixos do cliente;
- o tom.

A matéria irrelevante sai da tela (fica "excluída", e a curadoria pode reverter). O que uma pessoa marcou nunca é alterado, e a coleta seguinte não desfaz a decisão da IA.

Código: `src/lib/ai/classify-master.ts`, a rota `/api/internal/classify-ai` e o passo "Classify with master prompt" em `fetch-news.yml`.

**Hoje está desligado.** Sem a chave, o passo responde "não configurado" e sai sem erro. A classificação por regra e por tema continua valendo.

## Para ligar, nesta ordem
1. **Console da Anthropic** (console.anthropic.com): crie a chave e ponha um limite de gasto mensal na organização, por exemplo US$ 50. É a última barreira.
2. **Vercel** (projeto cortexintel → Settings → Environment Variables, ambiente Production):
   - `ANTHROPIC_MONTHLY_BUDGET_USD` = `40` (teto do app, abaixo do teto do console);
   - `ANTHROPIC_DAILY_CALL_LIMIT` = `300`.
3. **Só então** `ANTHROPIC_API_KEY`, na Vercel.
4. Revise o direcionamento de cada cliente (`clients.report_prompt`). É o texto que o prompt mestre usa para decidir o que interessa. Hoje ele foi escrito para o relatório e pode ficar mais curto e objetivo para classificar.
5. **Teste:** rode o `fetch-news` à mão e confira no log do passo "Classify with master prompt" quantas matérias foram revisadas por cliente. Depois veja o Painel e a aba Setor.

## Custo estimado
- **Modelo:** Claude Opus 5.5 em esforço baixo, a US$ 4 por milhão de tokens de entrada e US$ 20 por milhão de saída. Se o pedido for recusado, o servidor tenta o Opus 4.8.
- **Lote:** 25 matérias com título e resumo dão cerca de 4 mil tokens de entrada e 2 mil de saída, perto de **US$ 0,06 por lote**.
- **Volume:** 7 clientes × até 4 lotes × 3 coletas por dia dão até 84 lotes por dia, o que fica **abaixo de US$ 5 por dia**.
  - Na prática é bem menos: só entra o que ficou em revisão, e cada lote fica vazio quando não há o que revisar.
  - O teto diário de 300 chamadas e o mensal de US$ 40 cortam antes.
- **Ao atingir o teto:** o passo para e avisa ("teto atingido"). A regra segue valendo.

## Segurança
- Título e resumo das matérias vão como dado, dentro de `<materias>`.
- A resposta só é aceita com um id enviado e um tema da lista. Uma matéria com "ignore as regras" no título não muda nada.
