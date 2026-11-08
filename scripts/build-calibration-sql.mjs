#!/usr/bin/env node
// Gera docs/calibracao/recall-<mês>.sql: o SQL que o dono cola no Supabase para
// medir quanto o Cortex chega do que foi entregue ao cliente.
//
// Por quê: até aqui o único número era o da ONS (510 manchetes → 84 coletadas,
// 39 marcadas, em 03/11). "Melhorou a cobertura" sem medida é opinião (skill
// calibracao-contra-gabarito). A referência vai EMBUTIDA no SQL, extraída
// das tabelas dos refeitos e das manchetes do clipping da ONS. Assim a medida
// não depende da 055 estar aplicada e traz o bloco Cliente/Setor e o tom, que a
// 055 não grava.
//
// Uso: node scripts/build-calibration-sql.mjs 2026-10
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const period = process.argv[2] || '2026-10'
if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
  console.error('Uso: node scripts/build-calibration-sql.mjs YYYY-MM')
  process.exit(2)
}
const [year, month] = period.split('-').map(Number)
const nextPeriod = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`

const q = (value) => (value == null || value === '' ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`)
const rows = []
const seen = new Set()

// 1) Refeitos: a referência verificada (link aberto, título e data conferidos).
const refeitosDir = `docs/relatorios-refeitos/${period}`
for (const file of readdirSync(refeitosDir).filter((name) => name.endsWith('.md') && name !== 'RESUMO.md')) {
  const client = file.replace(/\.md$/, '').split('_')[0]
  const md = readFileSync(join(refeitosDir, file), 'utf8')
  for (const line of md.split('\n')) {
    if (!/^\|\s*\d+\s*\|/.test(line)) continue
    const cells = line.split('|').map((cell) => cell.trim())
    const link = cells[4]?.match(/^\[(.+)\]\((https?:\/\/[^)\s]+)\)/)
    if (!link) continue
    const bloco = /^cliente/i.test(cells[5]) ? 'Cliente' : /^setor/i.test(cells[5]) ? 'Setor' : null
    const tom = (cells[6] || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    // SINDINFOR tem dois refeitos (Empresa e Associados) com notícias em comum:
    // a mesma matéria conta uma vez no denominador do cliente.
    const key = `${client}|${link[2]}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push([client, 'refeito', link[1], link[2], bloco, ['positivo', 'neutro', 'negativo'].includes(tom) ? tom : null])
  }
}
const refeitos = rows.length

// 2) Manchetes do clipping do fornecedor da ONS (sem link; casa pelo título).
const onsFile = `docs/evidencias/${period}/gabarito-ons/manchetes-clipping-ons-${period}.json`
let ons = 0
try {
  for (const [, title] of JSON.parse(readFileSync(onsFile, 'utf8'))) {
    rows.push(['ONS', 'clipping-fornecedor', title, null, null, null])
    ons++
  }
} catch {
  console.warn(`Sem ${onsFile}; a origem clipping-fornecedor fica de fora.`)
}

// Chaves de casamento, em SQL puro (o SQL Editor não cria função sem migration).
const ACCENTS = ['áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn']
const urlKey = (expr) =>
  `NULLIF(regexp_replace(regexp_replace(lower(${expr}), '^https?://(www\\d?\\.|m\\.)?', ''), '([?#].*$)|(/+$)', '', 'g'), '')`
const titleKey = (expr) =>
  `array_to_string((regexp_split_to_array(trim(regexp_replace(translate(lower(${expr}), '${ACCENTS[0]}', '${ACCENTS[1]}'), '[^a-z0-9]+', ' ', 'g')), ' '))[1:7], ' ')`

const values = rows.map((row) => `  (${row.map(q).join(', ')})`).join(',\n')

const sql = `-- Calibração ${period}: quanto o Cortex chega do que foi entregue ao cliente.
-- Gerado por: node scripts/build-calibration-sql.mjs ${period}
-- Cole no SQL Editor do Supabase. Só leitura: não grava nada.
--
-- Referência (denominador), embutida abaixo:
--   refeito             ${refeitos} notícias verificadas (docs/relatorios-refeitos/${period}), com bloco e tom
--   clipping-fornecedor ${ons} manchetes do clipping diário da ONS (sem link)
--   entregue            o que está em delivered_report_items para o mês (052b), exceto a variante 'refeito'
-- Janela de busca no acervo: publicadas de ${period}-01 −5 dias até ${nextPeriod}-01 +7 dias (data de
-- publicação do veículo e do RSS divergem; o clipping registra no dia seguinte).
--
-- Casamento: URL normalizada (sem protocolo, www, query e barra final), contra url e resolved_url;
-- ou as 7 primeiras palavras do título, sem acento, com pelo menos 4 palavras. Título de impresso
-- reescrito não casa: "coletadas" é PISO, não teto.
--
-- Colunas:
--   itens          denominador da linha
--   coletadas      a matéria existe em articles
--   etiquetadas    existe etiqueta para o cliente, fora 'excluido'
--   em_revisao     dessas, quantas estão em 'revisao' (aparecem na aba Setor, não entram no relatório)
--   bloco_ok       Cliente/Setor da etiqueta = do refeito (cita_cliente), sobre as etiquetadas com bloco
--   tom_ok         tom da etiqueta = do refeito, sobre as etiquetadas com tom no refeito
-- Totais por cliente e origem; cabe nas 100 linhas do SQL Editor.

WITH ref(cliente, origem, titulo, url, bloco, tom) AS (
VALUES
${values}
UNION ALL
SELECT d.client_name, 'entregue', d.title, d.url, NULL, NULL
FROM delivered_report_items d
WHERE d.period_month = DATE '${period}-01' AND d.variant <> 'refeito'
),
r AS (
  SELECT ref.*, c.id AS client_id,
         ${urlKey('ref.url')} AS uk,
         ${titleKey('ref.titulo')} AS tk
  FROM ref
  LEFT JOIN clients c ON c.name = ref.cliente OR c.name LIKE ref.cliente || ' %'
),
art AS (
  SELECT a.id,
         ${urlKey('a.url')} AS uk,
         ${urlKey('a.resolved_url')} AS uk_resolved,
         ${titleKey('a.title')} AS tk
  FROM articles a
  WHERE a.published_at >= TIMESTAMPTZ '${period}-01 00:00-03' - INTERVAL '5 days'
    AND a.published_at <  TIMESTAMPTZ '${nextPeriod}-01 00:00-03' + INTERVAL '7 days'
),
m AS (
  SELECT r.*,
         (SELECT art.id FROM art
          WHERE (r.uk IS NOT NULL AND (art.uk = r.uk OR art.uk_resolved = r.uk))
             OR (array_length(string_to_array(r.tk, ' '), 1) >= 4 AND art.tk = r.tk)
          LIMIT 1) AS article_id
  FROM r
),
t AS (
  SELECT m.*, tag.cita_cliente, tag.tom AS tag_tom, tag.monitoring_status
  FROM m
  LEFT JOIN article_client_tags tag
    ON tag.article_id = m.article_id AND tag.client_id = m.client_id AND tag.monitoring_status <> 'excluido'
)
SELECT cliente,
       origem,
       count(*) AS itens,
       count(article_id) AS coletadas,
       round(100.0 * count(article_id) / NULLIF(count(*), 0)) AS pct_coletadas,
       count(monitoring_status) AS etiquetadas,
       round(100.0 * count(monitoring_status) / NULLIF(count(*), 0)) AS pct_etiquetadas,
       count(*) FILTER (WHERE monitoring_status = 'revisao') AS em_revisao,
       count(*) FILTER (WHERE bloco IS NOT NULL AND monitoring_status IS NOT NULL
                          AND (bloco = 'Cliente') = COALESCE(cita_cliente, FALSE)) || '/' ||
         count(*) FILTER (WHERE bloco IS NOT NULL AND monitoring_status IS NOT NULL) AS bloco_ok,
       count(*) FILTER (WHERE tom IS NOT NULL AND monitoring_status IS NOT NULL
                          AND (tom = tag_tom OR (tom = 'negativo' AND tag_tom = 'critico'))) || '/' ||
         count(*) FILTER (WHERE tom IS NOT NULL AND monitoring_status IS NOT NULL) AS tom_ok
FROM t
GROUP BY cliente, origem
ORDER BY cliente, origem;
`

mkdirSync('docs/calibracao', { recursive: true })
writeFileSync(`docs/calibracao/recall-${period}.sql`, sql)
console.log(`docs/calibracao/recall-${period}.sql: ${refeitos} refeitos + ${ons} manchetes da ONS embutidos.`)
