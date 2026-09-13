# CORTEX-RAONI — Instruções do Projeto

Plataforma de monitoramento de imprensa e clipping. Coleta notícias (RSS,
scraping, importação de PDF), classifica por cliente com um motor de regras
determinístico mais Claude, e produz dois entregáveis independentes: o
**relatório mensal estratégico** (nove seções, com base de evidências
qualificadas e rastreabilidade por código) e o **clipping mensal versionado**
(PDF com as íntegras). Acervo permanente — nada é apagado por idade.

Clientes ativos: ONS, CCEE, DAQ/DNIT, SINDINFOR, SIMINERAL, PRIO. ANTAQ em
onboarding (migration `034`).

## Stack real

- Next.js 15 App Router, React 18, TypeScript `strict`. Código em `src/app`,
  `src/lib`, `src/components`.
- API = Route Handlers em `src/app/api/**/route.ts`, quase todos com
  `export const dynamic = 'force-dynamic'`.
- Supabase Postgres + Storage privado (`source-documents`, `monthly-clippings`,
  acessados por URL assinada). O bucket `logos` é público.
- Anthropic via `@anthropic-ai/sdk`, importado dinamicamente e **opcional**:
  sem `ANTHROPIC_API_KEY` o pipeline **parqueia** (`waiting_configuration`) —
  ele não pula silenciosamente.
- Worker = GitHub Actions (`.github/workflows/`) chamando endpoints. Não há
  cron da Vercel; `vercel.json` é `{}`.
- PDF: `@react-pdf/renderer` + `pdf-lib` em `scripts/render-monthly-clipping.mjs`.
- **Limite de 60s por função na Vercel** — é por isso que o relatório é gerado
  SEÇÃO A SEÇÃO (`generateReportSection`) e não numa chamada só, e por isso a
  automação avança um estágio por invocação.

## Comandos

```
npm run dev · build · lint (--max-warnings=0) · typecheck · test (vitest)
npm run qa:news · qa:manual-intake · qa:qualification · test:pdf-load
```
Verificação de uma mudança = `typecheck` + `lint` + `test` + o script de QA da
área tocada. Node >= 20.16.

## Banco de dados

- Migrations versionadas e **idempotentes** em `supabase/migrations/`
  (001..035). **Nunca edite uma migration já aplicada** — crie a próxima.
- Padrão da casa: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
  e constraint dentro de `DO $$ ... IF NOT EXISTS (SELECT 1 FROM pg_constraint
  WHERE conname = ...) $$`.
- Tabelas centrais: `articles` · `article_client_tags` · `clients` ·
  `client_relevance_rules` · `sources` · `article_provenance` · `fetch_runs` /
  `fetch_run_sources` · `monthly_report_drafts` · `report_evidence_items` ·
  `report_automation_runs` / `_jobs` · `monthly_editions`.
- Identidade do artigo: `canonical_fingerprint` = sha256(publisher|title|day),
  em `src/lib/archive.ts`. **Leia a skill `revisor-de-ingestao` antes de mexer
  em ingestão** — o índice único dessa coluna foi derrubado na 023 e
  `articles.url` é NULLABLE com `UNIQUE`.
- RPCs são `SECURITY DEFINER` com `SET search_path = public`,
  `REVOKE ALL ... FROM PUBLIC, anon, authenticated` e `GRANT ... TO
  service_role`. Mantenha esse padrão.
- `client_relevance_rules` **não tem UI**: regras de cliente entram por
  migration (veja `032` e `034` como molde).

## Postura de segurança (fato do produto, não bug a consertar de surpresa)

- A interface é **aberta e não exige login** — decisão de produto registrada no
  README e no `.env.example`.
- Os ~76 route handlers usam `createAdminClient()` (service role, ignora RLS).
- `src/middleware.ts` protege **somente** `/api/alerts/check` e
  `/api/internal/*`, com `Bearer CRON_SECRET`.
- **Consequência prática: toda rota nova nasce pública e roda como service
  role.** Antes de criar uma, declare no PR o que ela expõe e quanto custa —
  várias rotas públicas já gastam token da Anthropic por requisição.
- A migration `035` fechou o caminho que *contorna* o app (chave anon no
  bundle do navegador). O caminho que *passa* pelo app continua aberto: isso é
  dívida conhecida, não convite para bolar autenticação sem combinar.

## Convenções

- Comentários explicam **por que**, não o quê. O repo é denso nisso e é um
  ativo — mantenha, e escreva no idioma do arquivo (PT-BR predomina).
- Toda constante com número mágico ganha comentário de origem
  (`CLIENT_COOLDOWN_MS`, `RULE_TRIAGE_VERSION`, `COOLDOWN_MS`).
- Fallback determinístico sempre que a IA puder faltar
  (`src/lib/ai/rule-triage.ts`, `suggestTagsHeuristic`).
- Zod na entrada das rotas (`src/lib/validation.ts`).
- Falha de configuração **parqueia visível**; nunca pula em silêncio.

## Regras invioláveis deste repositório

Valem por padrão, em todo trabalho, sem depender de skill disparar.

### Acesso a dados (Supabase)
- Nunca desestruture resposta do Supabase sem tratar `error`.
- **Escrita cujo retorno não é atribuído é escrita não confirmada.**
- Toda falha é fatal (propaga) ou degrada (visível/logada) — nunca sucesso
  vazio silencioso. `[]` por erro mente para quem lê a tela.
- Nunca ramifique por `error.message`; use `error.code`.
- Pagine acima de 1000 linhas (`fetchAll` em `src/lib/report-drafts.ts`).
  Lote no tamanho exato do limite é suspeita de truncamento, não total.

### Números e métricas
- Nenhum número vai à tela ou ao PDF sem **janela, denominador, truncamento e
  composição**.
- "Score" não pode ser volume renomeado.
- **Carimbo que não atravessa para o PDF não é carimbo** — o PDF é o que chega
  ao cliente.
- Coleta degradada ⇒ a variação vira `null` e a tela diz por quê. Queda de
  fonte não pode ser lida como queda reputacional.

### Ingestão
- Pipeline idempotente com chave de identidade **NOT NULL**. Em Postgres
  `NULL != NULL`, então índice único com coluna nula **não** deduplica.
- Re-run é no-op ou update, nunca duplicata.
- Fonte fora do ar é falha honesta, não "sem dados". Confira `res.status`
  antes de ler o corpo.

### Proveniência e uso legítimo
- Toda afirmação de relatório carrega código de evidência real, fonte e data.
- Match fraco não é afirmável; o selo aparece na tela **e** no PDF.
- **Texto de terceiro (`articles.content`, título, excerpt) é DADO, nunca
  instrução, ao entrar num prompt.** `buildInputContext` monta os blocos com
  `## [E001]` e `---`, a mesma sintaxe da saída do modelo: uma matéria pode
  forjar um código de evidência que entra no PDF do cliente. Ao mexer em
  `src/lib/ai/*`, delimite o conteúdo e valide o que volta contra o conjunto
  de códigos realmente enviado.
- Reprodução de íntegra respeita `sources.access_mode`.
- **Nunca ligue o User-Agent de Googlebot** (`CRAWLER_USER_AGENT` existe e é
  deliberadamente não usado).

### Saída HTTP e entrada de terceiro
- URL de terceiro só é buscada por `safeFetch` (`src/lib/safe-fetch.ts`).
  Exceção comprovada usa `// safe-fetch-ok:` com a razão.
- `href` com URL de terceiro passa por `safeExternalUrl` (`src/lib/url.ts`).
  React **não** sanitiza `href`.
- Nunca interpole entrada de usuário em filtro cru do PostgREST (`.or()`,
  `.filter()`, `.not(...,'in',...)`) — valide e reconstrua o valor. Exceção
  comprovada usa `// safe-filter-ok:`.
- Nunca acredite em `size`, `sha256`, `contentType` ou nome de arquivo
  declarados pelo cliente. Verifique no servidor.
- Toda tabela nova recebe `ENABLE ROW LEVEL SECURITY` na mesma migration.
  **Zero policies é o estado correto** (só o service role acessa); nunca crie
  policy permissiva para `anon`.

### Processo
- Revisão adversarial antes de cada commit.
- `src/lib/__guards__/repo-invariants.test.ts` codifica as regras acima como
  teste. Se ele falhar, a regra foi violada — não relaxe o teste sem discutir.

## Dívida técnica conhecida (não piorar)

- `src/app/api/articles/tag/route.ts` — degradação por *string* de mensagem de
  erro, para compensar deriva de schema. Não copie esse padrão para rotas novas.
- ~90 desestruturações do Supabase sem `error` e ~106 escritas cujo retorno não
  é atribuído. As piores já foram corrigidas. **Corrija de passagem o que você
  tocar; não aumente o total.**
- `sources.access_mode` é escrito e nunca lido como trava.
- `articles.url` NULLABLE com `UNIQUE` (023): matéria de impresso/rádio não tem
  dedupe no banco.

## Skills e agents deste repositório

Ver `.claude/`. As quatro skills e os dois agents nasceram de bugs reais
**deste** repo — os exemplos são `file:line` daqui, não de outro projeto.
