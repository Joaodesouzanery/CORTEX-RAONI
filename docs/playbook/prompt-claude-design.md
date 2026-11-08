# Prompt de diagramação para o Claude Design

**Fonte única:** `src/lib/design-prompt.ts`. O texto é montado por cliente e por mês e vai no topo de cada pacote (`/api/report-drafts/[id]/dc-html?format=md`). Mude lá, não aqui.

**Por que existe.** Em outubro, o Claude Design recebeu o CSV e o prompt de redação, escolheu as matérias e trocou links (`docs/fluxo-relatorio-mensal.md`). Agora o Cortex escolhe as 20 matérias e os links, e o Claude Design só diagrama.

**O que o pacote leva, em ordem:**
1. O prompt de diagramação, com a marca, a estrutura (relatório ou boletim da SindInfor) e as regras do playbook.
2. Os pontos a corrigir apontados pelo validador. Nunca aparecem no PDF.
3. O prompt mestre de redação, com o mês preenchido, só enquanto as seções não forem escritas pelo Cortex, ou seja, sem a chave da Anthropic.
4. Os destaques do mês (`src/lib/report-highlights.ts`): de 4 a 8 eixos, cada um com contagem, denominador e links.
5. As seções escritas, quando houver.
6. O clipping das matérias selecionadas, por dia (`src/lib/clipping-text.ts`), no formato do fornecedor da ONS.
7. A base de evidências: 20 matérias, só com link exato e do mês, com o tom em palavra.

**Como gerar:** em `/reports/prepare`, use o botão "Pacote Claude Design". Para todos os clientes de uma vez, rode o workflow **Monthly Claude Design packages** em Actions: ele é só manual e guarda os `.md` como artefato.
