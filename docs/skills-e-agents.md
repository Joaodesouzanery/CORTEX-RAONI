# Skills e agents do repositório

Ficam em `.claude/`. O Claude Code os carrega sozinho quando o repositório é aberto, em qualquer conta, então não é preciso instalar nada. Cada `SKILL.md` diz quando ele se aplica.

## Skills (`.claude/skills/<nome>/SKILL.md`)

| Skill | Quando usar |
|---|---|
| supabase-error-contract | Toda chamada ao Supabase: tratar `error`, paginar acima de 1000, nunca ramificar por mensagem |
| revisor-de-ingestao | Antes de mexer em coleta, scraper, importação ou reprocessamento |
| proveniencia-e-uso-legitimo | Ao gravar, exibir ou exportar conteúdo de terceiro; direito autoral; `access_mode` |
| metrica-honesta | Todo número que vai à tela ou ao PDF: janela, denominador, truncamento |
| seguranca-de-rotas | Rota nova ou alterada; service role; chamada paga à Anthropic |
| alertas-de-saude | Depois de deploy, migration ou mudança em coleta e telas |
| calibracao-contra-gabarito | Ao mudar fontes ou regras, ou ao afirmar que a cobertura melhorou |
| relatorio-mensal | Geração, seções, evidências e pacote para o Claude Design |
| boletim-e-agenda | Serviços de boletim e agenda regulatória |
| onboarding-de-cliente | Cliente, tema, regra ou fonte nova |
| acesso-por-plano | Controle de acesso por serviço e cliente (futuro login) |
| lgpd-e-dados-pessoais | Dado de pessoa natural (jornalista, porta-voz) |
| imagens-e-licencas | Imagem em notícia, clipping, boletim ou relatório |
| conteudo-autoral-com-ia | Matéria própria gerada com IA |
| direito-de-resposta-e-correcoes | Correção, retirada e direito de resposta |
| periodo-eleitoral | Conteúdo sobre candidatos, partidos e governos |

## Agents (`.claude/agents/<nome>.md`)

| Agent | Quando usar |
|---|---|
| verificador-de-fonte | Confirmar na fonte se a matéria sustenta a frase do relatório |
| auditor-de-numero | Rastrear um número da tela ou do PDF até a query |
| checador-de-fatos | Conferir as afirmações de um texto antes de aprovar |
| gerador-de-relatorio | Montar o relatório do mês no modelo, pronto para o Claude Design |
| redator-de-materia | Matéria longa própria a partir de um dossiê |
| revisor-de-originalidade | Cópia, paráfrase próxima e dependência de uma única fonte |
| revisor-juridico-preliminar | Difamação, LGPD, direito autoral, período eleitoral (não substitui advogado) |

## Ferramentas externas usadas neste projeto
- **Firecrawl (conector MCP):** usado para abrir e conferir os links de notícias nos relatórios refeitos. Na conta nova, conecte em Settings → Connectors. Sem ele, use WebFetch e WebSearch, com menor cobertura.
- **python-docx e pypdf:** usados por `scripts/md-to-docx.py` e `scripts/extract-pdf-links.py`. Instale com `pip install python-docx pypdf`.

## Scripts úteis

| Script | O que faz |
|---|---|
| `node scripts/export-all-links.mjs` | Gera `docs/links/todas-as-noticias.csv` com todos os links de notícia |
| `node scripts/export-sources.mjs` | Gera `docs/fontes/todas-as-fontes.csv` com o catálogo de feeds |
| `node scripts/extract-report-evidence.mjs` | Extrai o gabarito dos `.dc.html` entregues |
| `node scripts/audit-reports.mjs` | Audita os links dos relatórios entregues (`docs/auditoria/`) |
| `node scripts/calibrate-against-reports.mjs` | Compara o gabarito com o acervo do banco |
| `python scripts/md-to-docx.py arquivo.md` | Converte um relatório `.md` em `.docx` com links |
| `python scripts/extract-pdf-links.py <pasta>` | Extrai os links clicáveis de PDFs |
