# Formato do clipping diário que a ONS recebe do fornecedor

Regras extraídas do texto colado pelo dono em 08/11/2026 e dos PDFs de 19 e 20/10. Nem o texto do fornecedor nem os PDFs ficam no repositório: são material comercial de terceiro, e os PDFs trazem íntegras. É o modelo da Etapa 4 (`src/lib/clipping-text.ts`) e do e-mail diário (Etapa 5).

**Estrutura de cada dia:**
1. **Menções ao cliente**, um parágrafo por fato:
   - A abertura nomeia o veículo ou os veículos: "A CNN e a Reuters divulgaram que…", "O MegaWhat informou que…", "Em artigo no Valor, X afirmou que…".
   - Quando ajuda, vem uma citação curta entre aspas, com o nome e o cargo do porta-voz.
   - O parágrafo fecha com o tom: "A menção foi técnica.", "A matéria foi positiva ao destacar…" ou "O contexto foi negativo."
2. Um separador (`---`).
3. **Setor**: dois ou três parágrafos sem o cliente, abertos por "Em setor,", "Na cobertura setorial," ou "Entre as matérias sobre o setor,". **Não levam tom.**

**Convenções:**
- O mesmo fato em vários veículos vira um parágrafo só, com os veículos listados: "A Folha de S.Paulo, Uol, Brasil Energia e Agência Infra divulgaram que…".
- Tom em três valores: técnica (neutra), positiva e negativa. Positiva sempre diz por quê ("ao destacar…", "ao explicar…").
- Artigo de opinião: "Em artigo no Valor, [autor], [cargo], afirma que…".
- O PDF do fornecedor tem sumário "Título – VEÍCULO/PRAÇA" e depois a íntegra de cada matéria. **O Cortex não reproduz a íntegra**: dá título, veículo, data, link e um resumo curto próprio.

**Volume observado:**
- Entre 19 e 30/10, as 10 edições somam 510 manchetes, cerca de 50 por dia.
- Veículos mais frequentes: MegaWhat, Cenário Energia, Agência Infra, Canal Energia, CNN, O Globo, Brasil Energia, Agência Brasil, UOL, Poder360 e Estadão (`docs/evidencias/2026-10/gabarito-ons/README.md`).
