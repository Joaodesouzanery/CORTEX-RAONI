---
name: metrica-honesta
description: Contrato de honestidade para todo número que vai à tela, ao PDF ou ao relatório do cliente — declarar janela, denominador, truncamento e composição antes de exibir. Use SEMPRE que calcular, agregar, rankear ou exibir métrica, score, contagem, percentual ou variação. No CORTEX os números saem num entregável assinado; um número que engana é dano ao cliente, não bug de tela. Aplique sem o usuário pedir.
---

# Métrica Honesta

Um número num relatório entregue a um órgão regulador ou a uma estatal carrega
autoridade que ele frequentemente não merece. Aqui os números atravessam para
um **PDF assinado pela consultoria** — o custo de um número enganoso não é uma
tela errada, é uma afirmação errada com o nome do cliente.

## Regra-âncora: nenhum número sai sem os quatro carimbos

1. **Janela** — de quando a quando?
2. **Denominador** — é contagem ou taxa? sobre que universo?
3. **Truncamento** — o dado por trás foi cortado (teto de 1000, top-N, filtro)?
   Se sim, o número é **piso**, não total — diga isso.
4. **Composição** — o que está *dentro* do número?

Se você não sabe os quatro, o número não está pronto para ser exibido.

## Armadilha 1 — a janela escondida no rótulo

`qualified_count` é calculado a partir de `cutoff` em
`src/app/api/dashboard/route.ts:47` (padrão: 30 dias), atravessa todas as
chamadas de `monitoredCount()` e chega ao card em
`src/components/dashboard/ClientAutomationCard.tsx`, renderizado como um número
gigante rotulado apenas **"evidências qualificadas"**. O seletor de período é
um controle separado, longe do número.

Esta classe já vazou uma vez neste repo: o commit `96984ee` chama-se
*"fix(dashboard): surface the rolling qualified count, not just the draft"*.

**Regra:** a janela vai junto do número, não em nota de rodapé.

## Armadilha 2 — score que é volume renomeado

`match_score` em `src/lib/client-relevance.ts` começa em 0 (`:99`) e acumula
`rule.weight` por regra que casou (`:113`). É **soma pura, não normalizada**:
uma matéria que tropeça em cinco regras setoriais fracas supera uma que casou
uma única regra direta forte. Depois disso, `>= 5` vira `confirmado`.

Se o "score" cresce monotonicamente com a quantidade de eventos, ele é uma
contagem com outro nome. Um score de risco precisa normalizar por
exposição/base.

## Armadilha 3 — a mesma coluna com duas procedências

`editorial_score` tem dois pais e nenhum marcador. Em
`src/lib/report-drafts.ts:72`, se o modelo escreveu um valor, ele é usado; se
não, uma escada determinística sintetiza um (`cita_cliente` → 90,
`relevancia alta` → 80, ...). Mesma coluna, mesma tela, dois significados.

E a composição de verdade está em `bucketFor()` (`report-drafts.ts:79`):
`qualified` exige `report_role === 'evidencia'` **e** (aprovação humana **ou**
`qa_checked_at` + `editorial_confidence >= 0.85` + `verification_status ===
'verificada'`). "Evidências qualificadas" significa **isso** — não "matérias
relevantes". Quem lê o card não sabe disso.

## Armadilha 4 — variação contaminada por falha de coleta

`variation_percent` (`dashboard/route.ts:222`) compara uma janela que ainda
está enchendo contra uma janela anterior completa do mesmo tamanho: é
estruturalmente enviesada para baixo.

Pior: uma queda de fonte — que o fetcher registra como run bem-sucedido com
zero itens — aparece no Painel como **queda reputacional real**. O cliente lê
"−40%" e entende que saiu menos notícia sobre ele.

**Regra:** cobertura degradada ⇒ a variação vira `null` e a tela diz por quê.

## Armadilha 5 — truncamento tem nome próprio aqui

Qualquer contagem que possa bater em 1000 é um piso. Ver a skill
`supabase-error-contract` e o helper `fetchAll`.

## O contra-exemplo a copiar

`src/lib/report-quality.ts` já escreve o denominador **na prosa do relatório**:

> "O universo desta competência reúne **N ocorrências monitoradas no
> servidor**, sem limitação aos itens carregados na interface. Após triagem e
> verificação editorial, **N** compõem a Base Qualificada e **N** permanecem no
> Anexo."

São os quatro carimbos, no artefato que chega ao cliente. É o padrão.

## A última milha é o PDF

Um carimbo que existe na tela e some em `scripts/render-monthly-clipping.mjs`
ou nas seções do relatório **não é um carimbo**. O PDF é o que chega ao
cliente. Toda vez que um número atravessar para lá, confira se a janela, o
denominador e o aviso de truncamento atravessaram junto.

## Ligações

- Truncamento de consulta → skill `supabase-error-contract`.
- Rastrear um número exibido até a query → agent `auditor-de-numero`.

## Checklist (todo número exibido)

- [ ] Janela declarada junto do número
- [ ] Denominador declarado (contagem ou taxa? de quê?)
- [ ] Truncamento verificado e sinalizado
- [ ] Composição conferida; categoria dominante revelada
- [ ] "Score" normalizado, não é volume renomeado
- [ ] Procedência única — ou marcada, se houver mais de uma
- [ ] Variação anulada quando a coleta degradou
- [ ] Os carimbos atravessaram para o PDF
