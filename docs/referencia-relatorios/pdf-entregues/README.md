# Relatórios em PDF que chegaram ao cliente (pasta "RELATORIOS CORTEX OUTUBRO", 17/11/2026)

**Os PDFs não ficam no Git.** O repositório é público, e eles trazem material de cliente; as matérias avulsas trazem a íntegra de terceiros. Aqui ficam só os dados extraídos.

**O que veio na pasta e o que foi feito**

| Arquivo | O que tem | Uso |
|---|---|---|
| Relatórios de setembro (CCEE, DAQ, PRIO, SIMINERAL, SindInfor e SindInfor Completo) | 20 a 25 matérias cada, com link | Batem com o gabarito (`.dc.html`): nada novo |
| Relatórios de outubro (CCEE, DAQ, ONS, PRIO, SIMINERAL, SindInfor) | Versão final entregue | **Diferem do gabarito**, que tinha os rascunhos `.dc.html`. ONS e SIMINERAL nem tinham rascunho. Entram na migration 060 |
| ONS de junho | 21 links | 3 a mais que o gabarito, na 060 |
| ONS de julho e agosto | Tabela sem link clicável | Já cobertos pelo gabarito |
| 9 clippings da ONS (19 a 29/10) | Sumário e íntegras do fornecedor | São a fonte das 510 manchetes de `docs/evidencias/2026-10/gabarito-ons/`: nada novo |
| 17 matérias avulsas (Valor, Globo Rural, Estado de Minas) | Íntegra de terceiros | Só título e veículo, em `materias-avulsas.json` |
| `Meta_Mensal_Set-Out_2026.pdf` | Não é do projeto | Ignorado, por decisão do dono |

**Arquivos gerados**
- `itens.json`: 262 matérias (cliente, mês, arquivo, data, veículo, título, link, tom), com `in_gabarito` marcando o que já estava no gabarito.
- `supabase/migrations/060_delivered_reports_pdf.sql`: as 117 que faltavam no gabarito, com a variante `pdf-final`.
- `docs/links/todas-as-noticias.csv` regenerado (`scripts/export-all-links.mjs`).
- A calibração (`docs/calibracao/recall-2026-10*.sql`) passa a medir também a origem `entregue-pdf`.

**Como refazer:**

```
python3 -I scripts/extract-report-pdf.py <pasta-com-os-pdfs> > /tmp/report-links.json
python3 -I scripts/build-delivered-pdf-items.py /tmp/report-links.json
node scripts/export-all-links.mjs
```

**Achado.** O que o cliente recebeu em outubro ainda tinha links do Google News: CCEE 8, DAQ 8, ONS 15, PRIO 10, SIMINERAL 12 e SindInfor 5, de 22 a 27 matérias por relatório. Isso reforça a regra do pacote: só link exato.
