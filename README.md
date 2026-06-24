# CORTEX

Plataforma de **inteligência de notícias e comunicação estratégica**. Agrega feeds RSS/scraping de fontes brasileiras, permite curar e selecionar artigos por fonte/período/cliente, e gera relatórios mensais analíticos via IA (Claude), salvando o histórico.

## Stack

- **Next.js 14** (App Router) · **TypeScript** (strict) · **React 18**
- **Tailwind CSS** + **Radix UI** (shadcn)
- **Supabase** (PostgreSQL + Storage)
- **Anthropic Claude SDK** (geração de relatórios; opcional — sem a key roda em modo mock)
- **rss-parser** + **cheerio** (parsing de feeds e scraping)
- **Zod** (validação de entrada nas API routes)
- **Vitest** (testes)

## Pré-requisitos

- Node.js 20+
- Projeto Supabase (URL + chaves)
- (Opcional) `ANTHROPIC_API_KEY` para geração real de relatórios

## Setup

```bash
npm install
cp .env.example .env.local   # preencha as variáveis
```

### Variáveis de ambiente (`.env.local`)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | sim | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sim | Chave pública (anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | sim | Service role key — usada pelas API routes (bypassa RLS). **As rotas falham explicitamente sem ela.** |
| `ANTHROPIC_API_KEY` | não | Geração real de relatórios; sem ela, usa modo mock |
| `CRON_SECRET` | não | Protege o endpoint de busca automática de notícias |

### Banco de dados

Aplique as migrations em `supabase/migrations/` no SQL editor do Supabase (ou via Supabase CLI).

> ⚠️ **Atenção (schema fora de sincronia):** o repositório versiona apenas `001_initial_schema.sql` e `002_report_metadata.sql`. A tabela `clients`, a coluna `reports.client_id` (+FK) e o bucket de Storage `logos` são usados pelo código mas **não têm migration versionada** — devem existir no banco (aplicados manualmente). Recomenda-se criar uma migration `003` idempotente (`IF NOT EXISTS`) para alinhar repo↔banco.

Depois, popule as 16 fontes padrão:

```bash
curl -X POST http://localhost:3000/api/sources/seed
```

## Rodando

```bash
npm run dev          # dev server em http://localhost:3000
npm run build        # build de produção
npm start            # roda o build
```

## Qualidade

```bash
npm run lint         # ESLint (next lint)
npm run typecheck    # tsc --noEmit
npm test             # Vitest (test unitários)
npm run format       # Prettier (escreve)
npm run format:check # Prettier (apenas checa)
```

CI (GitHub Actions) roda lint → typecheck → test → build em cada push/PR (`.github/workflows/ci.yml`).

## Fluxo de uso

1. **/sources** — gerencie as fontes RSS/scrape (16 padrão via seed).
2. Em **/news**, clique em **Buscar Notícias** → busca paralela de todas as fontes ativas, com diagnóstico por fonte.
3. Filtre por período/datas/cliente/fonte e selecione os artigos.
4. Clique em **Gerar Relatório**, preencha os dados do período e gere o relatório com a IA.
5. **/clients** — cadastre clientes com contexto + palavras-chave (filtro automático) + logo.
6. **/reports** — histórico de relatórios gerados.

## Estrutura

```
src/
├── app/            # App Router (páginas + API routes)
│   └── api/        # articles, sources, clients, reports
├── components/     # UI (news, sources, clients, report, ui)
├── lib/
│   ├── ai/         # integração Claude + prompt mestre
│   ├── fetcher/    # rss, scraper, constants, dispatcher
│   ├── supabase/   # clients (browser/admin)
│   └── validation.ts  # schemas Zod das API routes
├── hooks/          # useViewMode, useArticleSelection
└── types/          # Source, Article, Report, Client
```
