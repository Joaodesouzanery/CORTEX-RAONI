# CORTEX

Plataforma de inteligência de notícias e comunicação estratégica. O CORTEX mantém
um acervo permanente, classifica publicações por cliente e produz dois produtos
independentes:

- relatórios estratégicos editoriais;
- clippings mensais versionados, com síntese, panorama, sumário paginado e todas
  as íntegras legalmente disponíveis.

Os fechamentos automáticos atendem os clientes ativos ONS, CCEE, DAQ/DNIT,
SINDINFOR e SIMINERAL.

## Stack e requisitos

- Next.js 15, React 18 e TypeScript strict;
- Supabase PostgreSQL e Storage privado;
- GitHub Actions como worker de coleta e renderização;
- Anthropic Claude opcional para classificação e relatórios;
- Node.js 20.16 ou superior no desenvolvimento, CI e worker.

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Configuração

Variáveis da aplicação:

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave pública do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | acesso administrativo das API routes |
| `CRON_SECRET` | bearer somente de alertas e fechamentos internos |
| `ANTHROPIC_API_KEY` | classificação e relatórios por IA; opcional |
| `GITHUB_ACTIONS_TOKEN` | token restrito, com `Actions: write`, usado pelos botões de fechamento |
| `GITHUB_REPOSITORY` | repositório no formato `organização/nome` |
| `GITHUB_WORKFLOW_REF` | branch do workflow; padrão `main` |

Secrets do GitHub Actions:

- `APP_URL`: URL pública da aplicação;
- `CRON_SECRET`: o mesmo valor configurado na aplicação.

A interface é aberta e não exige login. A coleta de notícias usa endpoints
públicos, limitados a uma execução por vez e com intervalo mínimo de dez
minutos. Alertas e fechamentos internos continuam protegidos por `CRON_SECRET`;
se ele não estiver configurado, somente esses workers retornam
indisponibilidade. Os buckets
`source-documents` e `monthly-clippings` são privados; uploads e downloads usam
URLs assinadas de curta duração.

## Banco de dados

Aplique, na ordem, todas as migrations versionadas em
`supabase/migrations/` (atualmente `001` a `025`) pelo Supabase CLI ou SQL
Editor. As migrations incluem clientes, classificações editoriais, alertas,
acervo permanente, proveniências, importações, edições mensais e buckets.

Depois das migrations, use `/sources` para revisar ou cadastrar fontes. A
migration `024_priority_sources.sql` adiciona fontes nacionais e temáticas
prioritárias. A `025_news_qa_and_dashboard.sql` cria o histórico detalhado das
coletas, as regras contextuais de relevância, corrige fontes quebradas e
adiciona os índices usados pelo Painel e pela paginação. Fontes apenas de
referência não têm íntegras coletadas sem acesso autorizado.

## Operação

### Coleta e enriquecimento

`.github/workflows/fetch-news.yml` executa a cada seis horas. A coleta:

- grava até 100 itens por fonte em cada passagem;
- processa no máximo quatro fontes por chamada e repete uma fonte uma vez em
  caso de falha;
- registra duração, erros, itens lidos, novos, enriquecidos e duplicados;
- não exclui mais notícias com 90 dias;
- registra proveniência por fonte;
- classifica cada matéria de forma independente para os cinco clientes;
- enriquece em lotes somente páginas públicas;
- marca conteúdo como `integral`, `parcial` ou `metadados`;
- não tenta contornar paywalls.

Notícias, alertas, dossiês e os relatórios estratégicos existentes continuam
disponíveis nas áreas originais.

O botão **Buscar Notícias** usa esse mesmo fluxo sem `CRON_SECRET`, mostra o
progresso real por fonte e respeita o intervalo de dez minutos. Para recalcular
todo o acervo após uma alteração de regra, execute manualmente o workflow com a
opção `reclassify_archive`.

### Importação de PDFs

Em `/imports`, selecione vários PDFs. Cada arquivo é enviado diretamente ao
Storage privado e depois processado. O importador reconhece:

- cadernos com sumário e matérias paginadas, como os “Clipping ONS”;
- matérias individuais impressas pelo navegador;
- arquivos não reconhecidos, que ficam preservados com status de revisão.

SHA-256 impede reenvio do mesmo arquivo. A identidade
`veículo + título + data` e uma verificação conservadora entre cópias importadas
enriquecem artigos existentes sem duplicá-los. Cada arquivo e faixa de páginas
permanece em `article_provenance`.

### Fechamento mensal

Em `/monthly-editions`:

1. escolha o mês;
2. use **Fechar mês** para criar uma versão dos cinco clientes ativos;
3. acompanhe classificação, renderização e contagens;
4. baixe o PDF por URL assinada;
5. use **Regenerar** para criar uma nova versão imutável de um cliente.

O workflow `.github/workflows/monthly-clipping.yml` também roda no primeiro dia
do mês, às 08h de Brasília, fechando o mês anterior. Cada cliente é processado
isoladamente; uma falha não remove os PDFs já concluídos. O PDF é montado em
duas passagens para obter as páginas reais do sumário e numeração global.

Se a IA estiver indisponível, regras locais mantêm o universo, a classificação
básica e o PDF completo. Itens de baixa confiança permanecem em “Outras
ocorrências monitoradas”.

## Qualidade

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

O conjunto de regressão local usa os 14 PDFs fornecidos quando eles estão
presentes em `/Users/joaonery/Downloads`; em outros ambientes, esses testes são
ignorados e os testes sintéticos continuam rodando. A CI
`.github/workflows/ci.yml` executa lint, typecheck, testes e build.

O ensaio pesado do PDF é executado separadamente:

```bash
npm run test:pdf-load
```

Ele gera 500 publicações sintéticas e falha se houver menos páginas de matéria
que itens ou se o heap ultrapassar 1 GB.

Depois do rollout e da reclassificação histórica, gere o relatório de QA com
contagens integrais de 7, 15 e 30 dias:

```bash
npm run qa:news -- https://seu-app.vercel.app
```

## Estrutura principal

```text
src/app/imports                         importação múltipla
src/app/monthly-editions                operação dos fechamentos
src/app/api/imports                     upload e processamento
src/app/api/monthly-editions            criação, listagem e downloads
src/app/api/internal/monthly-editions   lotes protegidos do worker
src/lib/import/pdf-parser.ts            separação de cadernos e artigos
src/lib/monthly-editions.ts             universo, snapshots e versões
scripts/render-monthly-clipping.mjs     PDF em duas passagens
scripts/qa-news.mjs                     auditoria pós-rollout das contagens
supabase/migrations/023_*.sql           acervo e edições
supabase/migrations/024_*.sql           fontes prioritárias
supabase/migrations/025_*.sql           coleta rastreável e relevância
```
