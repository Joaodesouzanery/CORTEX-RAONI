---
name: revisor-de-ingestao
description: Checklist obrigatório antes de criar ou alterar qualquer pipeline de ingestão, scraper, importação ou reprocessamento no CORTEX. Exige provar idempotência, comportamento em re-run, queda de fonte e truncamento ANTES de mexer, e cobre a saída HTTP para URL de terceiro. Use SEMPRE que tocar `src/lib/fetch-run.ts`, `src/lib/fetcher/*`, as rotas de import, ou o RPC `ingest_source_articles`. Dispara sozinha — não espere ser chamada.
---

# Revisor de Ingestão

Pipeline roda de novo. Sempre — por retry, por cron de 6 em 6 horas, por
reprocessamento manual, por falha no meio. A pergunta não é "e se rodar duas
vezes", é "**quando** rodar duas vezes, o que acontece?".

## Regra-âncora: idempotência provada, não presumida

A identidade do artigo aqui é `canonical_fingerprint` =
sha256(publisher|title|day), em `src/lib/archive.ts`.

**E ela não é imposta pelo banco.** A migration `023` derrubou o índice único
dessa coluna (`023:116`, `DROP INDEX IF EXISTS articles_fingerprint_unique`) e
o substituiu por um índice de consulta comum. A deduplicação passou a ser
inteiramente responsabilidade do código da aplicação.

### O caso `NULL != NULL`, na própria migration

Sete linhas separam estas duas decisões em `023`:

```sql
-- 023:92
ALTER TABLE articles ALTER COLUMN url DROP NOT NULL;
-- 023:99
ALTER TABLE articles ADD CONSTRAINT articles_url_key UNIQUE (url);
```

Em Postgres, `NULL` nunca é igual a `NULL`, então **um índice único sobre uma
coluna nula não deduplica nada**. Matéria de impresso, rádio e TV — importada
por PDF, sem URL — é exatamente a classe onde a dedupe por fingerprint mais
importa, e é exatamente a que ficou **sem nenhuma garantia de banco**.

O comentário da própria migration afirma que "a constraint UNIQUE continua
deduplicando URLs reais e o PostgreSQL permite vários NULLs". A premissa está
certa; a conclusão é o bug.

### A serialização é desigual

O caminho RSS/scrape é protegido por `pg_advisory_xact_lock` dentro do RPC
`ingest_source_articles` (`025:200`) — isso está certo. Mas o RPC só aceita
`'rss'` e `'scrape'`, então **as duas rotas de import passam por fora**:
`src/app/api/imports/[id]/process/route.ts` e
`src/app/api/import-batches/[id]/items/route.ts`. Duas importações
simultâneas do mesmo clipping inserem o artigo duas vezes.

Naquelas rotas, os lookups de dedupe **são** a deduplicação. Um erro engolido
ali vira "não encontrei" e insere duplicata — por isso hoje eles propagam.

## As quatro perguntas, respondidas por escrito no PR

1. **Idempotente?** Qual é a chave? Ela é NOT NULL em todas as colunas?
2. **Roda duas vezes?** No-op, update ou duplicata? (só as duas primeiras valem)
3. **Fonte cai?** Timeout, 5xx, página de manutenção, HTML no lugar de JSON —
   falha honesta ou lixo gravado como sucesso?
4. **Trunca?** Lote no tamanho exato do limite é **parcial**, não total.

## Fonte fora do ar não é "sem dados"

`src/lib/fetcher/scraper.ts` capturava tudo num `catch` e devolvia `null`/`[]`
sem conferir `res.status`. Um veículo fora do ar era registrado como run
**bem-sucedido** com `parsed_count: 0` — e isso vira queda de cobertura no
Painel, lida como queda reputacional (ver a skill `metrica-honesta`).

Confira `res.status` **antes** de ler o corpo. Sempre.

## Buscar de fora: toda URL de terceiro passa por `safeFetch`

`POST /api/sources` aceita qualquer URL de qualquer pessoa, e o coletor depois
a busca. Sem guarda, dava para apontar uma fonte para a rede interna, disparar
a coleta e **ler o resultado de volta** — `scrapeOpenGraph` grava `<title>` e
`og:description` na linha do artigo, que sai por `GET /api/articles`.

Regras:
- Use `safeFetch` de `src/lib/safe-fetch.ts`. Ele valida **cada salto** de
  redirecionamento — revalidar por hop é a parte que costuma faltar.
- Leia o corpo com `readCappedText`. `await res.text()` não tem teto.
- Host fixo e comprovado pode usar `fetch` direto, com
  `// safe-fetch-ok: <razão>` na linha anterior. O marcador é greppável.
- Ao harvestar links de uma listagem, compare por **host**, não por prefixo de
  string: com prefixo, `http://exemplo.com` casa `http://exemplo.com.interno/`.

## O que já está certo — não regrida

- **Enriquecimento é monotônico** (`025:93-119`): `COALESCE` e comparação de
  comprimento. Um re-run só pode melhorar a linha, nunca apagar dado bom.
- **`fetch_run_sources.error`** é uma trilha de erro durável e por entidade.
- **`fetch_runs_single_active_idx`** (`025`) é um índice único parcial escrito
  corretamente — use-o como modelo do que o `articles_url_key` deveria ser.
- **`article_provenance`** registra todo caminho de aquisição por artigo.
- **Fallback determinístico** (`src/lib/ai/rule-triage.ts`) e parqueamento
  visível (`waiting_configuration`) em vez de pulo silencioso.

## Ligações

- Todo acesso a banco aqui segue a skill `supabase-error-contract`.
- Marca de proveniência por registro → skill `proveniencia-e-uso-legitimo`.

## Checklist de saída (antes do commit no pipeline)

- [ ] Chave de identidade definida e NOT NULL nas colunas dela
- [ ] Re-run é no-op ou update — testado, não presumido
- [ ] Concorrência considerada (o advisory lock cobre este caminho?)
- [ ] `res.status` conferido antes de ler o corpo
- [ ] Queda/manutenção da fonte → falha honesta, não sucesso vazio
- [ ] Truncamento detectado; lote no tamanho-limite tratado como parcial
- [ ] URL de terceiro só por `safeFetch`; corpo por `readCappedText`
- [ ] Proveniência gravada por registro
