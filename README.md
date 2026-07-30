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
`supabase/migrations/` (atualmente `001` a `028`) pelo Supabase CLI ou SQL
Editor. As migrations incluem clientes, classificações editoriais, alertas,
acervo permanente, proveniências, importações, edições mensais e buckets.

Depois das migrations, use `/sources` para revisar ou cadastrar fontes. A
migration `024_priority_sources.sql` adiciona fontes nacionais e temáticas
prioritárias. A `025_news_qa_and_dashboard.sql` cria o histórico detalhado das
coletas, as regras contextuais de relevância, corrige fontes quebradas e
adiciona os índices usados pelo Painel e pela paginação. Fontes apenas de
referência não têm íntegras coletadas sem acesso autorizado.
A `026_batch_imports_and_report_drafts.sql` acrescenta lotes persistentes,
relatórios de referência, competência editorial de PDFs, triagem, preparação
mensal versionada, seções editáveis e snapshots de marca.
A `027_strategic_qualification_and_inbox.sql` permite selecionar vários
clientes por lote, registra a ficha estratégica de cada publicação e preserva
as linhas qualificadas extraídas de relatórios anteriores.
A `028_report_quality_and_monthly_agenda.sql` separa captura de evidência,
adiciona a agenda obrigatória por competência, verificação independente,
escopo geográfico, indicadores de ruído e portões auditáveis de fechamento.
Ela também separa a validação editorial da conferência da publicação original,
registra a postura narrativa e preserva os snapshots metodológico e de citações
de cada versão aprovada.

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

### Caixa de entrada e importação

Em `/imports`, marque manualmente todos os clientes, escolha competência e
finalidade uma única vez e adicione PDFs, HTMLs, links ou textos recebidos por
e-mail, WhatsApp e chat. Dois arquivos são processados simultaneamente e a
falha de um não interrompe os demais. Cada entrada original é preservada no
Storage privado. O importador reconhece:

- cadernos com sumário e matérias paginadas, como os “Clipping ONS”;
- matérias individuais impressas pelo navegador;
- relatórios anteriores, armazenados como referência sem gerar falsas notícias;
- relatórios HTML estruturados, cujas tabelas qualificadas formam uma base
  histórica auditável;
- páginas públicas e mensagens com uma ou várias notícias;
- arquivos não reconhecidos, que ficam preservados com status de revisão.

SHA-256 impede reenvio do mesmo arquivo. A identidade
`veículo + título + data` e uma verificação conservadora entre cópias importadas
enriquecem artigos existentes sem duplicá-los. Cada arquivo e faixa de páginas
permanece em `article_provenance`.

O mês do lote é uma associação editorial em `article_period_assignments` e
nunca substitui `published_at`. Cada matéria de um lote de notícias é
classificada contra os cinco clientes e fica garantidamente vinculada a todos
os clientes marcados; ausência de regra contextual resulta em revisão, não
descarte. PDFs rasterizados oferecem OCR por IA sob demanda. Se a chave de IA
estiver ausente ou o OCR falhar, o original privado permanece preservado.

### Preparação do relatório mensal

Em `/reports/prepare`:

1. escolha cliente e competência para montar a base completa no servidor;
2. defina a agenda obrigatória do mês e busque tópicos ausentes;
3. execute a triagem de todo o universo e a verificação independente das
   evidências propostas;
4. revise somente a fila de exceções — menções diretas, negativas/críticas,
   evidências parciais, agenda obrigatória e divergências;
5. revise a ficha estratégica — mensagem central, impacto, risco/oportunidade,
   ação recomendada e verificação — e separe base, anexo e exclusões humanas;
6. escolha manualmente a matéria principal e execute os portões de qualidade;
7. gere, edite ou regenere individualmente as seções 1–9;
8. finalize a versão: a seção 10 registra a agenda e a seção 11 contém somente
   a base qualificada;
9. exporte dossiê Markdown, CSV integral, anexo e texto para o Claude Design.

A matéria principal é colocada primeiro no contexto e deve constar nominalmente
no Sumário Executivo e na seção 4.1. Atualizar a base não sobrescreve texto
manual: seções prontas ficam marcadas como desatualizadas. O anexo separa
pendências de contexto/ruído e preserva ambos para auditoria, mas não alimenta
diretamente a redação. Pendências do anexo não bloqueiam, mas nenhuma evidência,
menção direta, matéria negativa/crítica ou pauta obrigatória entra no relatório
sem verificação independente ou decisão humana. Relatórios aprovados e
snapshots de marca são imutáveis; mudanças
como CRTIVE LAB → SAUZ só afetam versões futuras.

O relatório começa com uma Nota de Método calculada sobre todo o snapshot do
servidor — nunca sobre o limite de 100 itens da tela. As evidências recebem
códigos estáveis (`[E001]`, `[E002]`...) e toda afirmação factual das seções
analíticas deve apontar para um desses códigos. A matriz temática da seção 2,
a agenda da seção 10 e a Base Qualificada da seção 11 são montadas
deterministicamente. O fechamento bloqueia citações inexistentes, fatos sem
fonte, generalizações indevidas sobre fontes verificadas e linguagem
incompatível com a postura escolhida.

Disponibilidade e conferência são estados independentes:

- `integral`, `parcial` e `metadados` descrevem quanto texto está disponível;
- `nao_verificada`, `parcial`, `documento_integral` e `fonte_original`
  descrevem a conferência da origem.

O padrão de novos relatórios é **consultivo cauteloso**. O sistema prefere
“há oportunidade” e “pode avaliar” até que o cliente aprove uma postura
executiva mais assertiva.

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
npm run qa:qualification -- https://seu-app.vercel.app 2026-07
```

## Estrutura principal

```text
src/app/imports                         importação múltipla
src/app/reports/prepare                 preparação editorial mensal
src/app/monthly-editions                operação dos fechamentos
src/app/api/import-batches              lotes persistentes
src/app/api/imports                     upload e processamento
src/app/api/report-drafts               base, triagem, seções e exports
src/app/api/monthly-editions            criação, listagem e downloads
src/app/api/internal/monthly-editions   lotes protegidos do worker
src/lib/import/pdf-parser.ts            separação de cadernos e artigos
src/lib/import/html-report.ts           recuperação de bases históricas HTML
src/lib/monthly-editions.ts             universo, snapshots e versões
scripts/render-monthly-clipping.mjs     PDF em duas passagens
scripts/qa-news.mjs                     auditoria pós-rollout das contagens
supabase/migrations/023_*.sql           acervo e edições
supabase/migrations/024_*.sql           fontes prioritárias
supabase/migrations/025_*.sql           coleta rastreável e relevância
supabase/migrations/026_*.sql           lotes e preparação mensal
supabase/migrations/027_*.sql           caixa multicliente e ficha estratégica
supabase/migrations/028_*.sql           agenda, verificação e portões de qualidade
```
