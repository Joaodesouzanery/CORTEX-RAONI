---
name: proveniencia-e-uso-legitimo
description: Contrato de proveniência, direito autoral, conduta de coleta e dados pessoais no CORTEX. Use SEMPRE que o código gravar, casar, exibir ou EXPORTAR conteúdo de terceiro — íntegra de matéria, nome de jornalista, código de evidência, clipping em PDF — ou tocar em `src/lib/fetcher/*`, `sources.access_mode` ou `articles.author`. O risco aqui é jurídico e reputacional, não técnico. Aplique sem o usuário pedir.
---

# Proveniência e Uso Legítimo

Esta skill substitui a versão genérica de LGPD. O CORTEX **não tem CPF, nem
doação, nem sócio** — procurar por isso aqui é procurar o risco errado. O risco
real deste produto é outro, e é maior: ele **copia, guarda para sempre e
redistribui obra de terceiro**, e afirma coisas em nome do cliente.

## Regra-âncora 1: toda afirmação carrega proveniência

Nenhuma frase de relatório sai sem **código de evidência real, fonte e data**.
Se não dá para apontar a origem, o achado não entra — ou entra explicitamente
como hipótese não verificada.

**Isto o repo já faz bem, e é um ativo — não regrida:**
- `article_provenance` registra *todo* caminho de aquisição por artigo (RSS +
  PDF + seção de caderno), com índices únicos parciais escritos corretamente.
- A disciplina de código de evidência (`[E001]`) mais o check determinístico
  `citation_validity` em `src/lib/report-quality.ts`.
- `verification_status` e `source_verification_status` são deliberadamente
  distintos — o próprio system prompt diz que "a disponibilidade do texto e a
  conferência da publicação original são estados distintos".

## Regra-âncora 2: match fraco não é afirmável

Todo casamento tem uma **força**, e ela precisa ser declarada:

- **Forte** — decisão humana, ou verificação independente completa.
- **Fraco** — regra automática sem menção direta (`cita_cliente: false`,
  `monitoring_status: 'revisao'`, `editorial_review_state: 'pendente'`).

O eixo forte/fraco deste repo é `bucketFor()` em `src/lib/report-drafts.ts:79`.
O selo de incerteza precisa aparecer **na tela E no PDF** — o PDF é o que chega
ao cliente, e um selo que se perde na conversão não existe.

Guarda existente a preservar: `conservativeFallback()` em
`src/lib/ai/verify.ts` devolve `accepted: false` quando a verificação não está
disponível — degrada para o anexo, nunca para a base qualificada.

## Regra-âncora 3: direito autoral é a exposição maior, não a LGPD

`articles.content` guarda a **íntegra** de matérias de terceiro por tempo
indeterminado (migration `023`, "acervo permanente"), envia essa íntegra à
Anthropic em `buildInputContext`, e reimprime o texto no clipping em PDF
entregue ao cliente. O art. 46 da Lei 9.610/98 cobre reprodução de notícia com
menção a autor e veículo; redistribuição comercial de íntegras é outra coisa.

`sources.access_mode` (`publico` | `licenciado` | `referencia`) foi construído
para ser essa trava — e **é decorativo**: existe uma declaração de tipo e uma
única escrita, e nenhuma leitura como gate em todo o `src/`.

**Regra:** todo caminho que reproduza `content` literalmente num artefato do
cliente lê `access_mode` antes. Enquanto isso não existir, não aumente a
superfície.

## Regra-âncora 4: conduta de coleta

- `src/lib/fetcher/extract.ts` faz POST no endpoint privado `batchexecute` do
  Google News para desofuscar tokens de redirecionamento. É violação de termos
  de uso e o componente de maior risco isolado do sistema. Não amplie.
- `src/lib/fetcher/constants.ts` usa User-Agent de Chrome em toda requisição, e
  declara um `CRAWLER_USER_AGENT` que **finge ser o Googlebot**. Ele está
  deliberadamente **não usado**. **Nunca ligue.**
- `robots.txt` não é consultado em lugar nenhum do repo. Saber disso é
  pré-requisito para qualquer conversa sobre coleta.
- Fonte nova declara sua base de acesso (`access_mode`) no momento em que entra.

## Regra-âncora 5: texto de terceiro é dado, nunca instrução

`buildInputContext` (`src/lib/ai/claude.ts`) monta cada matéria como
`## [E001] Título` separada por `---`, e insere `content` cru — **a mesma
sintaxe markdown que o system prompt usa para a saída do modelo**. Um corpo de
matéria contendo `## [E999]` ou `## 7. RECOMENDAÇÕES` é indistinguível de um
bloco legítimo. O system prompt manda "usar exclusivamente os códigos
fornecidos"; a matéria pode fornecer um.

Isso importa aqui mais do que em outros sistemas porque o destino é um PDF
assinado entregue a um cliente — no limite, um regulador federal.

**Regras:** delimite o conteúdo de terceiro; diga no system prompt que o que
está dentro é dado; e **valide todo código de evidência devolvido pelo modelo
contra o conjunto realmente enviado**, não por formato. Nunca realimente prosa
gerada por modelo como entrada de outro modelo sem re-etiquetá-la como
não confiável.

## Dado pessoal: o que existe de fato

`articles.author` — nome de jornalista, extraído por regex de assinatura e de
metadados de PDF (`src/lib/import/pdf-parser.ts`). Guardado indefinidamente,
enviado a um processador nos EUA e impresso no clipping do cliente. É o único
dado pessoal em escala aqui.

Regras: minimize; nada de análise ou agregação por autor; nada de cruzar autor
entre clientes. Transferência internacional (Anthropic, EUA) precisa de base —
ANPD Resolução 19/2024. Não existe rota de privacidade, nem política de
retenção, nem caminho de exclusão. Se a ANTAQ (órgão federal) fechar contrato,
o Capítulo IV da LGPD entra na relação e a barra sobe.

## Ligações

- Números por trás do achado → skill `metrica-honesta`.
- Proveniência gravada na ingestão → skill `revisor-de-ingestao`.
- Confirmar um achado na fonte primária → agent `verificador-de-fonte`.

## Checklist (antes de gravar, exibir ou exportar)

- [ ] Toda afirmação tem código de evidência real, fonte e data
- [ ] Força do casamento classificada; selo de incerteza na tela **e** no PDF
- [ ] Reprodução de íntegra respeita `access_mode`
- [ ] Nenhuma ampliação da desofuscação do Google News; Googlebot UA desligado
- [ ] Texto de terceiro entra no prompt como dado delimitado, nunca instrução
- [ ] Código de evidência do modelo validado contra o conjunto enviado
- [ ] Nada novo agregando ou cruzando `articles.author`
