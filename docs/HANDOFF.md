# Handoff do Cortex
Ponto de partida para qualquer chat ou pessoa. Atualizado em 02/11/2026. Leia também `CLAUDE.md` e `docs/playbook/README.md`.

## Como trabalhar com o dono
- Responder em português, de forma direta.
- Tudo vai para o GitHub ao fim de cada etapa.
- Migrations e SQL: entregar o texto **completo**, pronto para colar no SQL Editor do Supabase. Nunca um trecho. O dono aplica.
- O SQL Editor exibe no máximo 100 linhas: exportações usam `limit` e `offset` explícitos.
- Só conectar a Anthropic quando todo o resto estiver pronto.

## Produto
Cortex: monitoramento de imprensa. Serviços: notícias, relatórios (terceiros com link), clipping (íntegra de matérias de autoria própria), boletim e agenda regulatória. Relatórios e boletins são pagos, contratados por neryadministrativo@gmail.com. SAUZ, CRT e Grupo Nery são marcas de entregável.

## Estado
Branch de trabalho: `claude/news-panel-automation-ee1d09`; base `claude/busy-knuth-aynxlz`.

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

## Pendências
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
- `RESEND_API_KEY` se quiser alertas e envio por e-mail.

## Variáveis
Nunca coloque valores neste arquivo.

**Vercel:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.
Opcionais: `RESEND_API_KEY`, `ALERTS_EMAIL_FROM`, `ALERTS_EMAIL_TO` (alertas). Depois: `ANTHROPIC_API_KEY` com `ANTHROPIC_MONTHLY_BUDGET_USD` e `ANTHROPIC_DAILY_CALL_LIMIT` (obrigatórias para a IA rodar); `PEXELS_API_KEY`, `UNSPLASH_ACCESS_KEY` (nomes reservados, ainda sem uso no código).

**GitHub Actions:** `APP_URL`, `CRON_SECRET` (mesmo valor da Vercel).

## Conectores de outro chat
O projeto CORTEX não aparecia no conector Supabase usado até aqui; sem ele, consulte o banco pelo dono, com SQL completo.
