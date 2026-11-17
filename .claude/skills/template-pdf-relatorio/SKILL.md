---
name: template-pdf-relatorio
description: Geração do relatório mensal em PDF direto no Cortex, com o modelo fixo do dono, sem passar pelo Claude Design. Use quando o dono mandar o modelo ou ao mexer no gerador de PDF do relatório.
---

# Template de PDF do relatório
- **Desenho:** `docs/agenda-regulatoria.md` (seção final). **Motor:** `@react-pdf/renderer`, como em `scripts/render-monthly-clipping.mjs`.
- **Marca por cliente:** ONS = CRT, PRIO = VX, demais = SAUZ. Base de evidências clicável, só com link exato.
- **`lintPlaybook` antes de gerar:** ponto aberto bloqueia o PDF.
  - máximo de 20 páginas;
  - sem % nos cenários;
  - sem coluna Tom na síntese;
  - nada de "não houve".
- **Carimbo que não atravessa para o PDF não é carimbo:** o selo de evidência fraca vai no PDF.
