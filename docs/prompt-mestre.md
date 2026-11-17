# Prompt mestre como classificador

**Quando roda (decisão do dono, 17/11/2026):** só quando você gera o relatório, pelo botão **Qualificar com IA** em Relatórios → Preparar. A coleta e a classificação por regra e por tema continuam diárias e sem custo.

**Sem a chave, o mesmo trabalho é feito à mão:**
1. Em Preparar, clique em **Pacote de qualificação**. Baixa um `.md` com o prompt mestre do cliente, os temas e todas as matérias do mês (data, veículo, título, resumo curto, link).
2. Cole o arquivo inteiro num chat do Claude e peça para seguir as instruções.
3. Copie o JSON que ele devolver e use **Importar qualificação** para colar.
4. O Cortex só aceita as matérias do pacote e os temas da lista; o resto é descartado. Grava como `ia` e não toca no que você marcou à mão.

**O que faz.** O prompt mestre de cada cliente revisa as matérias que a regra deixou marcadas. Para cada uma ele decide:
- se interessa ao cliente;
- se cita o cliente;
- o tema, escolhido entre os temas fixos do cliente;
- o tom.

A matéria irrelevante sai da tela (fica "excluída", e a curadoria pode reverter). O que uma pessoa marcou nunca é alterado, e a coleta seguinte não desfaz a decisão da IA.

Código: `src/lib/ai/classify-master.ts`, `src/lib/qualification.ts` e a rota `/api/report-drafts/[id]/qualify` (pacote, importação e IA). `/api/internal/classify-ai` continua disponível, mas saiu do `fetch-news` diário.

**Hoje está desligado.** Sem a chave, o botão responde "não configurado" e indica o pacote.

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
- **Volume, sob demanda:** um cliente com 300 matérias no mês dá 12 lotes, perto de **US$ 0,75 por cliente por relatório**. Sete clientes ficam em cerca de US$ 5 a 10 por mês.
  - O teto diário de 300 chamadas e o mensal de US$ 40 cortam antes.
- **Ao atingir o teto:** o passo para e avisa ("teto atingido"). A regra segue valendo.

## Segurança
- Título e resumo das matérias vão como dado, dentro de `<materias>`.
- A resposta só é aceita com um id enviado e um tema da lista. Uma matéria com "ignore as regras" no título não muda nada.
