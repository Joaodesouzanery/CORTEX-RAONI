---
name: supabase-error-contract
description: Contrato obrigatório para toda chamada ao Supabase neste repo — nunca desestruturar sem tratar `error`, escrita sem retorno atribuído não é escrita confirmada, decidir explicitamente entre fatal e degrada, paginar acima de 1000 e nunca ramificar por `error.message`. Use SEMPRE que tocar `supabase.from(...)`, `.select`, `.insert`, `.update`, `.upsert`, `.rpc`. É a maior fonte de bug silencioso do CORTEX — aplique sem o usuário pedir.
---

# Contrato de Erro do Supabase

O modo de falha desta base não é o erro que aparece. É o erro que **vira
sucesso vazio** e ninguém vê. Uma auditoria recente encontrou ~90
desestruturações sem `error` e ~106 escritas cujo retorno não é atribuído.
Os exemplos abaixo são todos deste repositório.

## Regra-âncora 1: nunca desestruture sem o `error`

```ts
// PROIBIDO — o erro some, o bug fica invisível
const { data } = await supabase.from('articles').select('*')

// OBRIGATÓRIO — o erro é capturado e uma decisão é tomada
const { data, error } = await supabase.from('articles').select('*')
if (error) { /* fatal ou degrada — ver abaixo */ }
```

**O caso que justifica esta skill inteira:** `finishRunIfNeeded` em
`src/lib/report-automation-worker.ts:160`. A versão anterior fazia
`const { data: jobs } = await supabase.from('report_automation_jobs')...`. Numa
falha de banco, `jobs` vinha `null`, então `completed`, `failed` e `waiting`
davam todos 0, e a linha

```ts
const terminal = completed + failed + waiting === (jobs || []).length  // 0 === 0
```

era **`true`**. O run mensal inteiro era carimbado `'complete'`, com
`finished_at` preenchido, sem nada ter sido feito. O cliente receberia um mês
vazio marcado como pronto. Hoje a função propaga (`:166`).

Dois vizinhos da mesma família, também corrigidos: o lookup de `activeRun`
(erro engolido criava um run **duplicado**, anulando a proteção anti-duplo
clique) e o de `recentDrafts` (erro engolido esvaziava o cooldown e
**regastava token da Anthropic** em todos os clientes).

## Regra-âncora 2: escrita sem retorno atribuído é escrita não confirmada

```ts
// PROIBIDO — não há sequer um `error` para ignorar
await supabase.from('article_client_tags').upsert(payload)
```

Isto é pior que o caso anterior e é mais comum aqui (~106 ocorrências). Um
exemplo com consequência real: `src/app/api/clients/route.ts` faz um delete
compensatório depois de um insert que falhou — se *esse* delete falhar em
silêncio, sobra um cliente órfão.

## Regra-âncora 3: fatal ou degrada, explicitamente

- **Fatal** — a operação não pode continuar. Propague. **Não devolva `[]` ou
  `null` disfarçado de sucesso.**
- **Degrada** — pode seguir parcial, mas o degradê é **visível**: log
  estruturado e um sinal na saída.

O terceiro caminho — capturar e devolver vazio sem ninguém saber — é o que
produziu todos os bugs acima.

**O contra-exemplo a copiar está em `src/lib/articles.ts:22-26`.** O comentário
lá documenta que um erro virava `[]` e a tela renderizava *"Nenhuma notícia
ainda."*, escondendo a falha; foi deliberadamente trocado por `throw`. Esse
raciocínio já foi aceito neste repo uma vez. Aplique-o.

## Regra-âncora 4: nunca ramifique por `error.message`

`src/app/api/articles/tag/route.ts` compensa deriva de schema testando
`error.message.includes('manual_intake')` para tentar de novo com menos
colunas. O problema: um erro de conexão, timeout ou permissão cuja mensagem
**não** contenha aquelas strings cai fora do tratamento; e um que por acaso
contenha dispara a degradação e devolve **200 com forma reduzida**, que a UI
não tem como distinguir do normal.

Se precisar de fallback por schema: ramifique por `error.code`, e marque a
resposta com um campo `degraded` explícito. Isso é dívida conhecida naquele
arquivo — **não replique o padrão em rota nova**.

## Regra-âncora 5: pagine acima de 1000

O PostgREST corta em ~1000 linhas **sem erro**. Uma consulta "simples" que
devolve exatamente 1000 está quase certamente truncada.

Use o helper que já existe: `fetchAll` em `src/lib/report-drafts.ts:96`.
`src/lib/articles.ts` também avisa ao bater no teto em vez de truncar calado.

O caso vivo: `articles/tag/route.ts` lia **todas** as tags de um cliente sem
`.range()`. Passando de 1000, a tela de curadoria mostrava matéria etiquetada
como não-etiquetada, em quatro superfícies. Corrigido, mas a classe existe em
outros lugares.

## Fronteira com a IA

`src/lib/ai/classify.ts` faz `catch { return [] }` no parse do JSON do modelo.
Assim, "Claude devolveu JSON quebrado" fica **indistinguível** de "nenhum
artigo casou". Um caminho 100% quebrado parece decisão editorial. Separe os
dois casos.

## Fronteira com a rede

`src/lib/fetcher/scraper.ts` devolvia `null`/`[]` num `catch` sem conferir
`res.status`. Um site fora do ar virava run **bem-sucedido** com
`parsed_count: 0`. Hoje o status é conferido — mantenha assim (ver a skill
`revisor-de-ingestao`).

## Checklist (toda chamada Supabase)

- [ ] `error` desestruturado e tratado — sem exceção
- [ ] Escrita tem retorno atribuído e conferido
- [ ] Decisão fatal-ou-degrada explícita; nada de sucesso vazio silencioso
- [ ] Ramificação por `error.code`, nunca por `error.message`
- [ ] Consulta grande pagina via `fetchAll`; contagem redonda é suspeita
- [ ] Falha de rede distinguida de falha de dado antes de nomear a causa
