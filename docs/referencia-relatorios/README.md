# Referência de relatórios entregues (jun–out/2026)

Acervo dos relatórios mensais já entregues aos clientes. É o **gabarito** que o
gerador do Cortex precisa alcançar: estrutura, tom, links exatos e particularidades
por cliente.

- `modelo/`: conteúdo integral do zip "Relatório adaptado modelo" (155 arquivos).
  **Não reorganize esta pasta.** Os `.dc.html` carregam capas, logos e
  `support.js`/`doc-page.js`/`image-slot.js` por caminho relativo. As regras gerais
  e por cliente estão em `modelo/README.md` e nos playbooks `.docx`.
- `../evidencias/2026-10/`: material de outubro, com o gabarito da ONS, os PDFs de
  clipping e destaques recebidos, os resumos diários e os `.md` gerados em outro
  chat, junto com a conferência dos erros encontrados.

Uso no código:
- `scripts/calibrate-against-reports.mjs` lê os links da base de evidências dos
  `.dc.html` e mede quantos o Cortex capturou no mesmo mês.

> Material de clientes e capas licenciadas (Adobe Stock). O repositório deve ser
> **privado**.
