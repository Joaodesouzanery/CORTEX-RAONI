# Todos os links de notícia do projeto

Gerado por `node scripts/export-all-links.mjs`. O arquivo é `todas-as-noticias.csv`, com uma linha por notícia e cliente, deduplicada por URL.

## Por cliente

| Cliente | Notícias | Link exato | Verificadas (refeitos) | Google News sem resolver | Link suspeito (?p=, seção) | Sem link |
|---|---|---|---|---|---|---|
| ANTAQ | 49 | 20 | 20 | 0 | 0 | 29 |
| CCEE | 700 | 226 | 20 | 426 | 3 | 45 |
| DAQ | 264 | 64 | 20 | 121 | 4 | 75 |
| ONS | 1366 | 333 | 20 | 506 | 2 | 525 |
| PRIO | 140 | 62 | 20 | 59 | 2 | 17 |
| SIMINERAL | 513 | 201 | 20 | 290 | 1 | 21 |
| SINDINFOR | 403 | 135 | 30 | 145 | 6 | 117 |
| **Total** | **3435** | **1041** | **150** | **1547** | **18** | **829** |

## Por origem (antes de deduplicar)

| Origem | Itens | Confiança |
|---|---|---|
| refeito | 160 | **Alta.** Cada link foi aberto, com título, veículo e data conferidos (docs/relatorios-refeitos/2026-10) |
| entregue | 608 | Baixa nos links. Ver docs/auditoria/ (veículo diferente do domínio, link de outro mês) |
| cortex-csv | 2220 | Média. Classificação automática, sem triagem; muitos links do Google News |
| claude-chat | 154 | Média. Escolhidos do CSV; links diretos, mas com viés para portais especializados |
| pdf-final | 287 | Média. Inclui links do Google News e ?p= que chegaram ao cliente |
| clipping-fornecedor | 510 | Manchetes do clipping da ONS (19 a 30/10), sem link |

## Como usar

- **Para relatório ou clipping:** filtre `link_status = exato`, de preferência `verificado = sim`.
- **`google_news`:** o Cortex resolve a URL real na coleta (passo "Resolve Google News links" do fetch-news). Não use esse link como evidência.
- **`id_curto` e `secao`:** não servem como link de matéria (regra 6 do playbook).
