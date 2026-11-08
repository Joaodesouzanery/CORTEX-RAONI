# Calibração: quanto o Cortex chega do que foi entregue

O SQL `recall-2026-10.sql` mede, por cliente, quantas notícias do que chegou ao cliente o Cortex coletou e etiquetou. Ele é gerado por `node scripts/build-calibration-sql.mjs 2026-10`. Para outro mês, rode o script com o mês: ele precisa de `docs/relatorios-refeitos/<mês>/`.

**Como usar**
1. Cole `recall-2026-10.sql` no SQL Editor do Supabase. Ele só lê e devolve uma linha por cliente e origem.
2. Rode **antes** de colar a 056 e a 057, e de novo **depois** da próxima coleta completa com reclassificação do mês. Selecione `reclassify_archive` e o período `2026-10` no `fetch-news`.
3. Anote os números abaixo, com a data.

**O que cada coluna quer dizer.** A janela é de 26/09 a 07/11, porque a data do RSS e a do clipping divergem da data de publicação.

| Coluna | Denominador | Leitura |
|---|---|---|
| `itens` | é o denominador | notícias da referência daquela origem |
| `coletadas` | `itens` | a matéria está em `articles`, por URL normalizada ou pelas 7 primeiras palavras do título |
| `etiquetadas` | `itens` | tem etiqueta para o cliente, fora `excluido` |
| `em_revisao` | `etiquetadas` | aparece na aba Setor e não entra na base qualificada |
| `bloco_ok` | etiquetadas com bloco no refeito | Cliente/Setor da etiqueta igual ao do refeito |
| `tom_ok` | etiquetadas com tom no refeito | tom igual ao do refeito (crítico conta como negativo) |

**Origens**
- `refeito`: 150 notícias de outubro, uma por linha e por cliente, com link aberto e título, veículo e data conferidos (`docs/relatorios-refeitos/2026-10`). É a referência confiável.
- `clipping-fornecedor`: 510 manchetes dos clippings diários da ONS de 19 a 30/10. Não têm link e casam só pelo título, então o número é **piso**: título de impresso reescrito não casa.
- `entregue`: o que está em `delivered_report_items` para outubro (052b). Os links têm os problemas apontados em `docs/auditoria/`.

**Limites**
- O casamento por título também conta a mesma manchete republicada em outro veículo. Isso é desejado, porque o Cortex tem a notícia, mas não é a mesma URL.
- O SQL não diz por que uma notícia faltou. Para isso, use `docs/evidencias/2026-10/gabarito-ons/diagnostico-por-veiculo.sql` e `docs/fontes/faltantes.md`.

## Linha de base

| Data | Cliente | Origem | Itens | Coletadas | Etiquetadas | Fonte |
|---|---|---|---|---|---|---|
| 03/11/2026 | ONS | clipping-fornecedor | 510 | 84 (16%) | 39 (8%) | `docs/evidencias/2026-10/gabarito-ons/README.md` (casamento por prefixo de 7 palavras, como aqui) |

Medições novas entram nesta tabela.
