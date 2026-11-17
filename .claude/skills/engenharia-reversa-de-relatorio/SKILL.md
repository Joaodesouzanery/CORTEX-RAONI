---
name: engenharia-reversa-de-relatorio
description: Compara o relatório que o cliente recebeu com o que o Cortex coletou e montaria, por cliente e mês. Use para afirmar "o Cortex chega ao relatório", para achar fonte ou termo faltando, ou quando chegar relatório novo do dono.
---

# Engenharia reversa de relatório
1. **Extrair o entregue:**
   - `python3 -I scripts/extract-report-pdf.py <pasta> > /tmp/links.json`;
   - depois `python3 -I scripts/build-delivered-pdf-items.py /tmp/links.json` (gera `itens.json` e a migration do gabarito). O PDF não vai para o Git.
2. **Recuperar o mês no acervo**, se a coleta falhou: `fetch-news` com `backfill_period=AAAA-MM`.
3. **Medir:** `node scripts/build-calibration-sql.mjs AAAA-MM [CLIENTE]` e colar o SQL. Coletadas e etiquetadas contra o entregue, com denominador.
4. **Para cada matéria que faltou, nesta ordem:**
   - veículo sem fonte: `diff-outlets` e skill `curadoria-de-fontes`;
   - termo ausente: regra ou tema, por migration;
   - link do Google News: resolve.
5. **Reportar com números honestos** (piso pelo casamento de título) em `docs/calibracao/`.
