# Agenda regulatória das agências dos clientes (desenho, Fase 22)

**Decisão do dono (17/11/2026):** começar pelas agências dos clientes. A plataforma regulatória do PDF de outubro (`docs/referencia-relatorios/outros/plataforma-regulatoria-2026-10.md`) é a referência de cobertura e de método: só fonte pública, link em cada item, nada de captcha nem login.

**O que já existe**
- **Tabela:** `regulatory_agenda_items` (043) guarda agência, título, tipo, fase, prazo, link oficial e clientes, sem duplicar por (agência, link, título).
- **Conector da ANTAQ:** `src/lib/agenda/antaq.ts` lê o boletim mais recente da Agenda Regulatória. Usa `safeFetch` e o User-Agent de navegador, e roda no `fetch-news`.
- **Telas:** a Agenda e a lateral do Painel.

**Agências por cliente**

| Agência | Clientes | O que acompanhar |
|---|---|---|
| ANEEL | ONS, CCEE | Pauta das reuniões públicas da diretoria, consultas e tomadas de subsídio, e a Agenda Regulatória |
| ANP | PRIO | Pauta das reuniões de diretoria, resoluções, consultas públicas e rodadas e leilões |
| ANM | SIMINERAL | Reuniões da diretoria colegiada, resoluções e consultas públicas, e a Agenda Regulatória |
| ANATEL e ANPD | SINDINFOR | Pautas do Conselho Diretor (ANATEL), resoluções e consultas da ANPD (dados e IA) |
| ANTAQ | DAQ, ANTAQ | Já existe: o boletim da Agenda Regulatória |

**Como cada conector é feito**, no molde de `antaq.ts`:
1. Lê a página oficial de pautas ou consultas da agência, sempre com `safeFetch`. Confere o `res.status` e a falha aparece; não vira "sem itens".
2. Extrai título, tipo (reunião, consulta, resolução), data ou prazo e o link oficial.
3. Grava em `regulatory_agenda_items` com `client_names` da tabela acima, de forma idempotente.
4. Faz uma checagem de formato, como o `MIN_THEMES` da ANTAQ: se a página mudar de layout, o conector falha visível, em vez de gravar zero.
5. Tem um teste com um HTML de amostra salvo em `src/lib/agenda/__fixtures__`.

**Antes de codar cada agência:** testar a página a partir do GitHub Actions, porque o container do Claude não alcança os sites. Com a URL confirmada, o conector entra numa PR própria.

**Onde aparece**
- **Agenda:** um filtro por cliente.
- **Painel:** "Agenda da semana" do cliente.
- **E-mail diário:** uma seção "Agenda regulatória" quando houver prazo nos próximos 7 dias.
- **Relatório:** na seção de Cenários, como contexto. A agência regula; o cliente não é a agência, e esse guardrail continua valendo.

**Ordem sugerida:** ANEEL (2 clientes), ANP, ANM, ANATEL e ANPD.

---

# Relatório em PDF direto, sem o Claude Design (aguardando o modelo)

Quando o dono mandar o modelo fixo:
- **Motor:** `@react-pdf/renderer`, que já gera o clipping mensal (`scripts/render-monthly-clipping.mjs`).
- **Estrutura:** capa com a marca do cliente (CRT, VX ou SAUZ), sumário, as seções do modelo e a Base de evidências clicável (só link exato).
- **Texto:** vem das seções escritas (`generateReportSection`, com a chave) ou das seções coladas na preparação.
- **Validador:** o mesmo `lintPlaybook` roda antes de gerar. Ponto aberto bloqueia o PDF, não vai para o cliente.
- **Onde fica:** um botão "Gerar PDF" ao lado de "Pacote Claude Design", e o PDF no bucket privado `monthly-clippings` (URL assinada).
