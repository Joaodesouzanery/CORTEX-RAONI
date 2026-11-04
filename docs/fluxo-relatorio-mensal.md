# Fluxo do relatório mensal: engenharia reversa de outubro/2026

Material: `docs/referencia-relatorios/2026-10-final/`
- `csv-cortex/`: o que o Cortex exportou;
- `md-claude-chat/`: o que o Claude Chat escreveu a partir do CSV;
- `pdf/`: o que o Claude Design entregou.

## Como os relatórios de outubro foram feitos

```
Coleta do Cortex → CSV (65 a 771 linhas por cliente) → Claude Chat escolhe e escreve → Claude Design diagrama → PDF
```

| Cliente | Linhas no CSV | Link do Google News sem resolver | Qualificadas pelo Cortex |
|---|---|---|---|
| CCEE | 611 | 426 (70%) | 0 |
| ONS | 771 | 506 (66%) | 0 |
| PRIO | 65 | 59 (91%) | 0 |
| SINDINFOR | 188 | 145 (77%) | 0 |
| SIMINERAL | 449 | 290 (65%) | 0 |
| DAQ | 136 | 121 (89%) | 0 |

**O que aconteceu.** Sem triagem por IA, nada virou "qualificada": tudo saiu como anexo. O Claude Chat precisava de link exato e escolheu as matérias que tinham um, ou seja, as dos feeds especializados (Agência iNFRA, Cenário Energia, Radar Mineração, Convergência Digital). As matérias que **citavam o cliente** chegaram, em geral, pelo Google News, e ficaram de fora. Exemplos:
- **SIMINERAL:** a Carta Santarém estava no CSV, mas o `.md` saiu sobre Minas Gerais e mineração global.
- **DAQ:** a dragagem do Careiro estava no CSV, mas o `.md` trouxe a BR-153 (rodovia), a Ultrapar e transmissão de energia.
- **PRIO:** só 65 linhas, e 59 delas com link do Google News.

A seleção do Cortex aplicada aos mesmos CSVs, sem resolver os links, reproduz o viés: a PRIO fica com 6 matérias, a DAQ com 10 e a CCEE com nenhuma que cite o cliente.

**O que o Claude Design consertou.** Na diagramação entraram os temas certos: Carta Santarém, Magnetita e Hematita, Careiro. A estrutura de 10 seções e a capa também ficaram certas.

**O que ainda chegou ao cliente nos PDFs:**
- links `news.google.com` clicáveis (PRIO, SIMINERAL, DAQ);
- links `?p=` (Agência iNFRA, O Fator), que abrem outra matéria;
- matéria de 2023 como se fosse de outubro (Exame, seca na Zona Franca);
- **PRIO assinada como "SAUZ"**, quando a marca é VX;
- base da PRIO com 22 itens, acima dos 20 combinados;
- nos `.md`: DAQ "Responsável: VORTEX" (deveria ser SAUZ), itens de 01/11, frases "Não há registro…" e "Nenhum porta-voz…".

## PRIO: o que mudou da versão anterior para a de outubro, e por quê

| Mudança | Por quê |
|---|---|
| O fato do mês passa a ser a compra de Magnetita e Hematita (07/10), com 8 matérias | A versão anterior não tinha coleta própria do mês; a conferência buscou nos grandes veículos |
| A base vai de 10 para 20 matérias, todas de outubro e com link direto (15 da companhia, 5 do setor; 11 de grandes veículos) | Antes, 9 de 10 estavam erradas (fora do mês, título inexistente, portal que nem cita a PRIO) |
| Entra a CNN de 05/10 ("Prio eleva a 17,15 milhões vendas…") | Era a matéria perdida da reclamação; o feed da CNN entrou na 053 |
| Números novos: 17,15 milhões de barris, 192,6 mil boe/d, preço-alvo de R$ 74 (BofA), prévias BTG e Safra/XP | Vieram das matérias verificadas |
| Sai "Goldman Sachs e hedge cambial" | Vinha de links de outros meses |
| O imposto de exportação volta como ponto de atenção (Camex, 05/11) | Tema vivo no mês |
| Mantidos: marca VX, sem porcentagens, sem "Tom" na síntese, verbos de assessoria | Regras do playbook |

## Fluxo proposto (o que o código passa a fazer)

```
Coleta (feeds oficiais 053/054 + busca por cliente 051 + setoriais)
  → resolução dos links do Google News (logo após a coleta, 120 lotes)
  → classificação Cliente/Setor (termo no título/resumo; fonte sozinha não marca)
  → seleção das 20 (src/lib/report-selection.ts: link exato, do mês, cliente primeiro,
    grandes veículos, sem repetir pauta; faltando, diz quantas faltam)
  → pacote único para o Claude Design (/api/report-drafts/[id]/dc-html?format=md):
    regras, marca certa, as 20 com link e "não troque nem acrescente links"
  → Claude Design diagrama
  → conferência final pelo validador (marca, 20 itens, mês, ?p=, Google News, tom)
```

**Recomendação:** tirar o Claude Chat do meio. Ele escolhia as notícias a partir de 600 linhas, e foi aí que entrou o viés. Com a seleção feita pelo Cortex, o Claude Design só diagrama o que já está verificado. Quando a `ANTHROPIC_API_KEY` estiver ligada, o texto das seções 1 a 9 também sai do Cortex (`generateReportSection`), dentro do teto de gasto.

**O que o dono precisa fazer de diferente:**
1. Exportar o **pacote para o Claude Design** (botão em "Gerar relatório"), e não o CSV.
2. Instruir o Claude Design a não trocar nem acrescentar links.
3. Antes de enviar, abrir "Abrir no template" e conferir os avisos do validador.
