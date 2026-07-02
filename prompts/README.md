# Prompts setoriais + template de relatório

Este diretório contém os **prompts mestres por área** e um **template de design fixo** para gerar os relatórios mensais no **Claude Code** — a partir do dossiê exportado pelo CORTEX.

## Fluxo end-to-end

```
CORTEX (/news)                Claude Code                     PDF / Design
─────────────────            ─────────────────────           ─────────────
1. Selecionar cliente   →    3. Colar prompt da área    →    5. Preencher o
   + período                    (prompts/<area>.md)             template HTML
2. "Exportar dossiê"    →    4. Colar o dossiê (.md)     →    6. Imprimir → PDF
   → copiar/baixar .md         → gerar as 10 seções            (ou Express/Canva)
```

1. **No CORTEX** (`/news`): escolha o cliente, ajuste o período, selecione as matérias e clique **"Exportar dossiê"**. Copie ou baixe o `.md` — ele traz as matérias com **texto completo** + contexto do cliente + métricas do mês.
2. **No Claude Code**: abra uma conversa e cole, nesta ordem:
   - o conteúdo de **`prompts/<area>.md`** (o prompt mestre da área);
   - logo abaixo, o **dossiê** exportado (as matérias).
   - Peça: *"Gere o relatório completo, nas 10 seções."*
3. **Design fixo**: peça *"Preencha os slots `{{...}}` de `prompts/_template-relatorio.html` com este relatório, sem alterar o CSS nem a estrutura."* Abra o HTML no navegador → **Imprimir → Salvar em PDF**. (Alternativa: usar o botão de PDF que já existe no CORTEX, ou exportar o HTML para Adobe Express/Canva.)

## Mapa cliente → prompt

| Cliente            | Arquivo                      | Setor                                  |
|--------------------|------------------------------|----------------------------------------|
| ONS                | `ons.md`                     | Setor elétrico / operação do SIN       |
| CCEE               | `ccee.md`                    | Comercialização de energia             |
| Gás Natural        | `gas-natural.md`             | Gás natural / energia                  |
| Mineração          | `mineracao.md`               | Mineração                              |
| DNIT Aquaviária    | `dnit-aquaviaria.md`         | Infraestrutura hidroviária/portuária   |
| DNIT Rodoviária    | `dnit-rodoviaria.md`         | Infraestrutura rodoviária              |
| SindInfor          | `sindinfor.md`               | Sindical / representação de categoria  |

## Sobre os prompts

Cada prompt configura o Claude como **sócio-diretor de uma consultoria Tier-1 de inteligência reputacional**, com a metodologia (inteligência ≠ clipping, análise de framing, antecipação, rigor factual) e a **base de conhecimento do setor** (temas-âncora, riscos reputacionais típicos, oportunidades de posicionamento, stakeholders e órgãos-chave). Todos produzem a **mesma estrutura de 10 seções** do relatório.

Placeholders a preencher no topo (o próprio Claude Code faz ao gerar):
`{cliente}` · `{contratante}` (= **CRTIVE LAB**) · `{mês de referência}`.

## Sobre o template

`_template-relatorio.html` mantém **o design em um só lugar** (cores, fontes, capa, rodapé) e expõe apenas slots de conteúdo (`{{SUMARIO_EXECUTIVO}}`, `{{RISCOS}}`, …). Assim, **o layout nunca muda** — só o texto de cada mês. Para mudar a identidade visual (ex.: cor da marca), edite as variáveis CSS no topo do arquivo (`--destaque`, `--tinta`).
