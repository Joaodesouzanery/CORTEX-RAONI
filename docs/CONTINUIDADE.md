# Continuidade: como retomar o Cortex em outro chat

Leia este arquivo, depois `docs/HANDOFF.md` (detalhe técnico por fase), `CLAUDE.md` (regras do repositório) e `docs/playbook/README.md`.

## O produto
O Cortex é monitoramento de imprensa por cliente. Ele faz:
- clipping diário com blocos Cliente e Setor;
- boletim;
- relatório mensal de 10 seções;
- agenda regulatória da ANTAQ.

A interface é aberta, sem login. Usa Next.js 15, Supabase e GitHub Actions (coleta 3 vezes por dia).

- **Branch de trabalho:** `claude/news-panel-automation-ee1d09`.
- **Branch principal:** `claude/busy-knuth-aynxlz`. Sempre faça push nas duas.

## Decisões do dono (não reabrir)

**Marcas por cliente:**

| Cliente | Marca | Observação |
|---|---|---|
| ONS | CRT | |
| PRIO | VX | Nome "PRIO S.A.", nunca PetroRecôncavo |
| CCEE, SIMINERAL, DAQ | SAUZ | |
| SINDINFOR | SAUZ | Sindicato de **Minas Gerais** (Belo Horizonte), formato boletim, duas versões: Empresa e Associados |
| ANTAQ | CORTEX | |

**Regras do relatório e do clipping:**
- **20 notícias** por relatório, todas do mês e com link exato. Se faltar, o relatório diz quantas faltaram; não completa com item fraco.
- Clipping por cliente, **100% automático**, com dois blocos: Cliente (cita o cliente) e Setor e temas (não precisa citar).
- **Nunca raspar paywall** nem contornar bloqueio. Grandes veículos entram pelos feeds oficiais (053/054) e pela busca por cliente (051). O texto completo depende de assinatura (ver `docs/fontes-bloqueadas.md`).
- Regras do playbook:
  - máximo de 20 páginas;
  - tom positivo, riscos como pontos de atenção;
  - verbos auxilia, assessora, subsidia e apoia;
  - sem porcentagens nos cenários;
  - sem coluna Tom na síntese;
  - capa nova a cada mês;
  - nunca inventar.

**Combinados de trabalho:**
- Migrations são entregues **completas para colar** no SQL Editor do Supabase; quem aplica é o dono.
- A Anthropic é ligada **por último**, com teto: `ANTHROPIC_MONTHLY_BUDGET_USD`, `ANTHROPIC_DAILY_CALL_LIMIT` e só então `ANTHROPIC_API_KEY`. Orçamento em `docs/orcamento.md`.

## Migrations
Aplicadas até a **054**, incluindo as três partes da 052b; o gabarito tem 545 linhas.

## Onde está cada coisa

| Material | Caminho |
|---|---|
| Template e relatórios entregues de junho a outubro (zip completo, 178 arquivos; não reorganizar) | `docs/referencia-relatorios/modelo/` |
| Outubro final: PDFs do Claude Design, `.md` do Claude Chat, CSVs do Cortex | `docs/referencia-relatorios/2026-10-final/` |
| Gabarito extraído dos `.dc.html` | `docs/referencia-relatorios/gabarito.json` |
| Relatórios de outubro refeitos (20 notícias verificadas por cliente) | `docs/relatorios-refeitos/2026-10/` |
| Auditoria de links dos relatórios entregues | `docs/auditoria/` |
| Evidências de outubro (gabarito ONS, resumos, `.md` antigos) | `docs/evidencias/2026-10/` |
| Fluxo do relatório e engenharia reversa | `docs/fluxo-relatorio-mensal.md` |
| Fontes bloqueadas, paywall e feeds | `docs/fontes-bloqueadas.md` |
| Orçamento (Anthropic e e-mail) | `docs/orcamento.md` |

## Fluxo atual recomendado
1. O Cortex coleta e classifica.
2. Em "Gerar relatório", escolher o cliente e o mês (e, se quiser, "Até o dia").
3. Baixar o **Pacote Claude Design**. Ele já traz as 20 matérias selecionadas e verificadas, a marca e as regras.
4. O Claude Design diagrama no template.
5. Conferir os avisos do validador em "Abrir no template".

## Pendências
- Ligar a Anthropic com teto. Primeiro uso: triagem e resumo diário com tom, porta-voz, link exato, ligação com tema e agenda, e "por que importa".
- `RESEND_API_KEY` e domínio verificado, para o e-mail diário ou semanal.
- Deixar o repositório privado: ele contém material de clientes e capas licenciadas.
- Reclassificar o acervo de 2026-10 e 2026-11 (Actions → Fetch news → reclassify archive).
- Novas fontes sugeridas na conferência: Canal Energia (o feed não traz itens), Portos e Navios (paywall), O Tempo e Estado de Minas (sem feed).
- Pedir ao SindInfor-MG o envio das notícias próprias: o site bloqueia acesso automático.
