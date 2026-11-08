# Handoff do Cortex
Ponto de partida para qualquer chat ou pessoa. Atualizado em 08/11/2026. Leia também `CLAUDE.md` e `docs/playbook/README.md`.

**Comece por `docs/CONTINUIDADE.md`** (mapa único para retomar em outro chat).

## Como trabalhar com o dono
- Responder em português, de forma direta.
- Tudo vai para o GitHub ao fim de cada etapa.
- Migrations e SQL: entregar o texto **completo**, pronto para colar no SQL Editor do Supabase. Nunca um trecho. O dono aplica.
- O SQL Editor exibe no máximo 100 linhas: exportações usam `limit` e `offset` explícitos.
- Só conectar a Anthropic quando todo o resto estiver pronto.

## Produto
Cortex: monitoramento de imprensa. Serviços: notícias, relatórios (terceiros com link), clipping (íntegra de matérias de autoria própria), boletim e agenda regulatória. Relatórios e boletins são pagos, contratados por neryadministrativo@gmail.com. SAUZ, CRT e Grupo Nery são marcas de entregável.

## Estado
Branch de trabalho: `claude/charming-curie-l39oxa` (Fase 20), a partir de `6c4e5ef` em `claude/busy-knuth-aynxlz` e `claude/news-panel-automation-ee1d09`.

Pronto:
- Temas por cliente no Painel, pacote para Claude, destaques.
- Coleta 3x/dia em `fetch-news.yml`.
- Telas `/bulletins` e `/agenda`.
- Playbook, skills e agents em `.claude/`.

Migrations: até 043 aplicadas pelo dono; 044 entregue; 046 aplicada; 047 entregue; 048, 050 e 051 aplicadas; 049 entregue; **052 pendente** (`news_hero_counts`, índices, `delivered_report_items` com o gabarito). A 051 trouxe: busca por cliente nos grandes veículos (O Globo, Valor, Estadão, CNN, Eixos, Folha, G1, Poder360, InfoMoney, Metrópoles), `client_report_profiles`, `ai_usage_ledger` (teto da IA) e `monthly_report_drafts.period_cutoff`.

Fase 15 (04/11):
- Acervo dos relatórios entregues em `docs/referencia-relatorios/modelo/` (não reorganizar; caminhos relativos).
- `scripts/calibrate-against-reports.mjs`: links do gabarito × acervo. Outubro tem bem menos links que setembro (PRIO 8×16, SindInfor 8×22, CCEE 10×16).
- Filtro por mês em Notícias; coluna lateral da agenda em Últimas notícias.
- Relatório sob demanda: sem cron em `report-automation.yml`; tela Relatórios aceita "Até o dia" (corte).
- Boletim: mínimo de 20 matérias (`MIN_BULLETIN_ITEMS`), completando com "Complemento do setor".
- Teto da IA (`src/lib/ai/budget.ts`): sem `ANTHROPIC_MONTHLY_BUDGET_USD` e `ANTHROPIC_DAILY_CALL_LIMIT` a IA não roda; teto atingido parqueia em waiting_configuration.
- Design: botões pretos e contornados, carrossel por tema e faixas alternadas no Painel, títulos leves.
- **Próximo passo**: resumo diário com tom, porta-voz, link exato, tema/agenda e "por que importa", depois de ligar a chave; gerador no template `.dc.html`; escolha manual de matérias no gerador.

Agenda: só ANTAQ por decisão do dono. Conector automático em `src/lib/agenda/antaq.ts`: acha o boletim mais recente na página oficial, lê o PDF e grava; roda no `fetch-news.yml`; sem boletim novo é no-op. Painel Aquarela não é usado: bloqueia acesso automatizado.

Fase 16 (04/11):
- Clipping diário por cliente em `/clipping` (blocos Cliente e Setor, automático, sem 'revisao'; cobertura das fontes do dia).
- Classificador: regra de setor só vale com termo no título/resumo; fonte temática sozinha não marca mais (tirou PEC da Segurança, eleição nos EUA). "Só o relevante" = confirmado ou candidato. Reclassificar out/nov.
- Gabarito: `scripts/extract-report-evidence.mjs` → `docs/referencia-relatorios/gabarito.json` (608 itens, 255 links). Auditoria: `scripts/audit-reports.mjs` → `docs/auditoria/` (46 links com veículo ≠ domínio, 27 de outro mês; PRIO set 20/20, CCEE set 18/20).
- Gerador no template: `/api/report-drafts/[id]/dc-html` (HTML) e `?format=md` (pacote Claude Design), com validador do playbook (`src/lib/report-dc-html.ts`). Scripts do template em `public/report-template/`.
- Saúde: checa as RPCs `dashboard_client_counts` e `news_hero_counts` e avisa cliente sem menção em 30h (dia útil).
- Links do Google News resolvidos logo após a coleta (ordem do `fetch-news.yml`).
- Design: ícones por setor, manchete inteira nos cards, imagem só quando é da matéria, data em pt-BR, faixa cinza de cabeçalho (`.band-bleed`) em todas as telas.
- `docs/fontes-bloqueadas.md`: lista para o sócio (Brasil Energia sem cobertura; paywalls só título+link).

Fase 17 (04/11):
- Relatórios de outubro refeitos (20 notícias verificadas por cliente): `docs/relatorios-refeitos/2026-10/` (.md e .docx; RESUMO.md). Conversor: `scripts/md-to-docx.py` (python-docx).
- 052b em 3 partes (gabarito). 053: feeds oficiais Valor, Estadão, CNN, Folha, G1, Poder360, InfoMoney, Metrópoles (is_general).
- Pendente de decisão: SINDINFOR é a entidade de MG (sindinfor.org.br) ou o SINFOR/DF?
- Próximo: recusar item fora da janela/sem data, conferir título da URL final, fontes Brasil Mineral/CanalEnergia/Convergência/TI Inside/Teletime, novos termos por cliente (RESUMO.md).

Fase 18 (04/11):
- Engenharia reversa de outubro: `docs/fluxo-relatorio-mensal.md` (CSV com 65–93% de links do Google News e 0 qualificadas → o modelo escolheu só o que tinha link direto).
- `src/lib/report-selection.ts`: seleção determinística das 20 (link exato, do mês, cliente primeiro, grandes veículos, sem repetir pauta). Usada no pacote do Claude Design quando a triagem por IA não qualificou nada.
- Snapshot e CSV com URL resolvida + coluna `link_status`; validador pega `?p=`, mais de 20 itens, fora do mês, marca errada e frases negativas.
- `fetch-news.yml`: 120 lotes de links e job de 75 min.
- Acervo: zip completo (178) em `docs/referencia-relatorios/modelo/` e outubro final em `docs/referencia-relatorios/2026-10-final/`.
- Orçamento: `docs/orcamento.md`. Preços em `src/lib/ai/budget.ts` atualizados (Haiku/Sonnet/Opus 5.5).

Fase 20 (08/11): as notícias do setor de volta, todas as fontes e o pacote do mês automático.
Plano em cinco etapas. A coleta não tinha parado: o setor sumia da tela.
- **Etapa 1 (feita):**
  - **Abas em Notícias** (`scope`): Cliente + Setor (padrão, com revisão), Cita o cliente, Setor, Tudo. A lista, o Panorama e o CSV usam o mesmo filtro (`citaClienteFilter`).
  - **Classificador:** setor só no corpo volta como `revisao`, com peso 1, se vier de fonte temática ou citar 2 termos de setor distintos.
  - **Ruído:** esporte, entretenimento e celebridade saem pela seção do link (`src/lib/noise.ts`), só para regras de setor. A menção direta ao cliente sempre passa.
  - **Botão Buscar Notícias:** um laço só, com espera em lote vazio, nova tentativa em 502/504 e recarga da lista mesmo com erro.
  - **Reclassificação:** respeita `period`; no workflow vem desligada por padrão.
  - **Migration 056:** tira "novela" das exclusões e desliga as cópias de InfoMoney e MegaWhat.
- **Etapa 2 (feita):**
  - **Destaques de outubro** de cada cliente e o formato do clipping diário da ONS em `docs/referencia-relatorios/2026-10-destaques/`. O texto do fornecedor e os PDFs ficam fora do Git.
  - **Catálogo de fontes corrigido:** eram 116 fontes, agora são 148. O script lia só parte dos `INSERT` e ignorava as desativações; agora aplica também as desativações e as trocas de URL feitas por migrations posteriores (coluna `ativa_apos_migrations`).
  - **`scripts/diff-outlets.mjs` → `docs/fontes/faltantes.md`:** de 259 veículos citados no que foi entregue, 111 cobertos depois da 057 e 145 sem fonte, quase todos com 1 ou 2 menções.
  - **Migration 057:** buscas por cliente nos veículos entregues, 26 regras aprendidas e 27 temas.
- **Etapa 5 (feita):** clipping diário por e-mail (`docs/email.md`).
  - Usa Resend, que já estava em `src/lib/email.ts`, agora com `to`, `bcc` e `reply_to`.
  - HTML em `src/lib/clipping-email.ts`. Prévia pública em `/api/clipping-email/preview`, que não envia nada (botão "Ver e-mail do dia" em Clipping).
  - Envio em `/api/internal/clipping-email`, protegido por `CRON_SECRET`, nos modos revisão (só para o dono) e envio (destinatários do cliente em cópia oculta). É idempotente por cliente, dia e modo.
  - Migration 058: `client_email_recipients` e `clipping_email_sends`, com RLS e sem policies.
  - Workflow `daily-clipping-email.yml`, só manual.
- **Etapa 4 (feita):** o pacote do mês ganhou seleção principal com termos e exclusões do cliente, destaques do mês (`report-highlights.ts`), clipping das selecionadas (`clipping-text.ts`), prompt de diagramação (`design-prompt.ts`), boletim da SindInfor e o workflow manual `monthly-package.yml`. O resumo diário agora traz o tom no lugar de "Tom: pendente", e a síntese do clipping mensal perdeu o "Não foram identificadas…".
- **Etapa 3 (feita):** `docs/calibracao/recall-2026-10.sql`, gerado por `scripts/build-calibration-sql.mjs`, mede por cliente o que foi coletado e etiquetado, a concordância de bloco e a de tom. A referência vai embutida no SQL (150 refeitos e 510 manchetes da ONS). Testado num Postgres local com todas as migrations aplicadas; a 056 e a 057 aplicam sem erro e podem ser coladas de novo sem duplicar nada.

## Pendências
- **Corte por seção e Google News:** em matéria que chega pelo Google News, o corte por seção do link (`src/lib/noise.ts`) só vale depois que o link é resolvido. Na classificação da coleta só o título é testado, e o passo "Resolve Google News links" não reclassifica. Por isso, depois da coleta, rode o `fetch-news` com reclassificação do mês. Melhor ainda: fazer o resolve reclassificar os artigos que acabou de resolver.
- **Tom no clipping e no e-mail:** só é afirmado quando foi revisado por pessoa (ou IA). A regra grava `neutro` por padrão, e isso aparece como "Tom a revisar.", ou não aparece no e-mail ao cliente. Para o tom sair no e-mail do cliente, revise o tom na tela ou ligue a IA.
- Regras do playbook da consultoria (README do zip de relatórios): máx. 20 páginas; tom positivo, riscos como pontos de atenção; verbos auxilia/assessora/subsidia/apoia; sem % nos cenários; sem coluna Tom na síntese; link só da matéria exata; capa nova por mês; ONS=CRT, PRIO=VX (PRIO S.A.), CCEE/SIMINERAL/DAQ/SINDINFOR=SAUZ, ANTAQ=CORTEX; SindInfor em formato boletim, Brasília/DF.
- Gerador de relatório no template HTML A4 da consultoria (`support.js`, `doc-page.js`) + pacote para Claude Design: a fazer.
- Menu: Notícias, Relatórios, Boletins, Agenda; Painel, Fontes e clientes, Importações no topo. Preparação automática pelo `report-automation.yml` (religado).
- Cobertura ONS: 510 manchetes, 84 coletadas, 39 marcadas (03/11). Reexecutar `docs/evidencias/2026-10/gabarito-ons/gabarito-ons.sql` após 2 dias com a paginação WordPress e a 049.
- Design: tokens, fonte e cards aplicados em Notícias e Painel; faltam Preparação, Clientes, Fontes, Importações.
- Saúde: `/api/internal/health` grava alertas; Painel exibe. Falta e-mail de saúde (Resend).
- Resumo diário (aba em Boletim) no formato que a ONS recebe: falta tom e frase-resumo, que dependem de IA ou editor.
- Marca da DAQ e dos demais clientes: confirmar com o dono.
- Gabarito da ONS: 510 manchetes de 19 a 30/10 em clippings de fornecedor (PDFs confidenciais, não versionados). Brasil Energia (16) não tem feed nem itens no Google News.
0. Evidência fraca (sem texto integral) já marcada no Painel e no pacote; falta levar a marca ao relatório e ao PDF.
1. Teste SIMINERAL: 291 matérias recebidas (173 confirmadas, 89 mencionam Pará, 224 links Google News, 6 citam o cliente); ajustar regras (excesso de mineração fora do Pará) e reclassificar; redigir relatório e 2-3 matérias neste chat, com aprovação humana.
2. Resolver links `news.google.com` para a URL real antes de usar como evidência (53 de 100 na amostra).
3. Conferir com a consultoria os links dos relatórios DAQ e ONS de setembro (muitos 404).
4. Conferir se InfoMoney e Diário do Transporte voltaram e se a coleta das 12h e 18h roda.
5. Bancos de imagem: Pexels, Unsplash, Agência Brasil, Wikimedia; conferir termos e integrar.
6. Conteúdo próprio e clipping autoral: tabelas, fluxo e aprovação ainda não existem.
7. Login e acesso por serviço e cliente, antes de vender e antes da chave da Anthropic.
8. Interface inspirada no modelo enviado: ainda não aplicada.
9. Trocar `claude-sonnet-4-6` por `claude-sonnet-5-5` ao conectar a Anthropic.

## Falta conectar (repetir ao dono em toda resposta)
- Colar `docs/calibracao/recall-2026-10.sql` (linha de base), depois as migrations 056 e 057, rodar `fetch-news` com reclassificação de 2026-10 e colar o SQL de novo.
- Conferir `SELECT count(*) FROM delivered_report_items;` (545); se faltar, colar 052b partes 1–3.
- Colar a migration 053.
- Rodar `fetch-news` manual com `reclassify_archive` para 2026-10 e 2026-11 (novas regras de setor).
- Enviar ao GitHub o commit do acervo (o envio automático foi bloqueado) e deixar o repositório privado.
- `ANTHROPIC_MONTHLY_BUDGET_USD` e `ANTHROPIC_DAILY_CALL_LIMIT` (Vercel), além do limite no console da Anthropic, antes da chave.
- Tornar o repositório privado antes de subir os PDFs de clipping (hoje é público).
- Rodar `gabarito-ons.sql` (local, fora do Git) para medir a cobertura das manchetes dos clippings diários da ONS.
- Rodar `fetch-news` manual com `reclassify_archive` e período 2026-10.
- Conferir em Actions se `fetch-news` roda 3x/dia e o passo da agenda.
- Chaves `PEXELS_API_KEY` e `UNSPLASH_ACCESS_KEY`.
- Login, antes da `ANTHROPIC_API_KEY`.
- E-mail (`docs/email.md`): conta no Resend com domínio verificado; `RESEND_API_KEY`, `ALERTS_EMAIL_FROM` e `ALERTS_EMAIL_TO` na Vercel; colar a 058; cadastrar destinatários; rodar `Daily clipping email` em `review` e depois em `send`. Dizer se prefere envio diário ou semanal.

## Variáveis
Nunca coloque valores neste arquivo.

**Vercel:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.
Opcionais: `RESEND_API_KEY`, `ALERTS_EMAIL_FROM`, `ALERTS_EMAIL_TO` (alertas). Depois: `ANTHROPIC_API_KEY` com `ANTHROPIC_MONTHLY_BUDGET_USD` e `ANTHROPIC_DAILY_CALL_LIMIT` (obrigatórias para a IA rodar); `PEXELS_API_KEY`, `UNSPLASH_ACCESS_KEY` (nomes reservados, ainda sem uso no código).

**GitHub Actions:** `APP_URL`, `CRON_SECRET` (mesmo valor da Vercel).

## Conectores de outro chat
O projeto CORTEX não aparecia no conector Supabase usado até aqui; sem ele, consulte o banco pelo dono, com SQL completo.
