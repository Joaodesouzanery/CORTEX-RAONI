'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

interface Props {
  prompt: string
  content: string
  createdAt: string
  logoUrl?: string | null
}

interface Block {
  type: 'h2' | 'h3' | 'li' | 'hr' | 'space' | 'p' | 'table'
  text?: string
  rows?: string[][]
}

function stripInline(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/`([^`]+)`/g, '$1')
}

// Split the report into a cover (title + client/contratante/month/CONFIDENCIAL
// from the markdown header) and the body (everything after the first ---).
function parseReport(content: string) {
  const lines = content.split('\n')
  let i = 0
  while (i < lines.length && lines[i].trim() === '') i++
  let title = 'Relatório de Comunicação Estratégica'
  if (lines[i]?.startsWith('# ')) {
    title = stripInline(lines[i].slice(2))
    i++
  }
  const coverLines: string[] = []
  while (i < lines.length && !lines[i].startsWith('---')) {
    const t = stripInline(lines[i].trim())
    if (t) coverLines.push(t)
    i++
  }
  if (lines[i]?.startsWith('---')) i++
  return { title, coverLines, body: lines.slice(i).join('\n') }
}

function parseBlocks(content: string): Block[] {
  const lines = content.split('\n')
  const blocks: Block[] = []
  const isTableRow = (l: string) => l.trim().startsWith('|') && l.includes('|')
  const isSeparatorRow = (cells: string[]) => cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c.trim()))

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (isTableRow(line)) {
      const rows: string[][] = []
      while (i < lines.length && isTableRow(lines[i])) {
        const cells = lines[i].split('|').map((c) => c.trim())
        if (cells.length && cells[0] === '') cells.shift()
        if (cells.length && cells[cells.length - 1] === '') cells.pop()
        if (!isSeparatorRow(cells)) rows.push(cells.map(stripInline))
        i++
      }
      if (rows.length) blocks.push({ type: 'table', rows })
      continue
    }
    if (line.startsWith('### ')) blocks.push({ type: 'h3', text: line.slice(4) })
    else if (line.startsWith('## ')) blocks.push({ type: 'h2', text: line.slice(3) })
    else if (line.startsWith('# ')) blocks.push({ type: 'h2', text: line.slice(2) })
    else if (line.startsWith('- ') || line.startsWith('* ')) blocks.push({ type: 'li', text: line.slice(2) })
    else if (line.startsWith('---')) blocks.push({ type: 'hr' })
    else if (line.trim() === '') blocks.push({ type: 'space' })
    else blocks.push({ type: 'p', text: line })
    i++
  }
  return blocks
}

export default function ReportPdfButton({ prompt, content, createdAt, logoUrl }: Props) {
  const [loading, setLoading] = useState(false)

  async function exportPdf() {
    setLoading(true)
    try {
      const { pdf, Document, Page, Text, View, Image, StyleSheet } = await import('@react-pdf/renderer')

      const ACCENT = '#111111'
      const MUTED = '#6b7280'
      const s = StyleSheet.create({
        // Cover
        cover: { fontFamily: 'Helvetica', position: 'relative' },
        coverBand: { position: 'absolute', top: 0, left: 0, right: 0, height: 14, backgroundColor: ACCENT },
        coverInner: { padding: 56, paddingTop: 110, height: '100%', flexDirection: 'column' },
        brand: { fontSize: 12, fontFamily: 'Helvetica-Bold', letterSpacing: 3, color: ACCENT },
        logo: { maxHeight: 54, maxWidth: 200, marginTop: 28, marginBottom: 8, objectFit: 'contain' },
        coverTitle: { fontSize: 30, fontFamily: 'Times-Bold', color: ACCENT, marginTop: 120, lineHeight: 1.15 },
        coverRule: { width: 64, height: 3, backgroundColor: ACCENT, marginVertical: 18 },
        coverClient: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: ACCENT, marginBottom: 4 },
        coverMeta: { fontSize: 11, color: MUTED, marginBottom: 2 },
        confidencial: { marginTop: 22, alignSelf: 'flex-start', borderWidth: 1, borderColor: ACCENT, paddingVertical: 4, paddingHorizontal: 10, fontSize: 9, fontFamily: 'Helvetica-Bold', letterSpacing: 2, color: ACCENT },
        coverFooter: { position: 'absolute', bottom: 48, left: 56, right: 56, borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 8, fontSize: 9, color: MUTED },
        // Body
        page: { paddingTop: 54, paddingBottom: 64, paddingHorizontal: 56, fontSize: 10.5, fontFamily: 'Helvetica', lineHeight: 1.5, color: '#1f2937' },
        prompt: { fontSize: 10, fontFamily: 'Helvetica-Oblique', color: MUTED, marginBottom: 16, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: ACCENT },
        h2: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: ACCENT, marginTop: 16, marginBottom: 6, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
        h3: { fontSize: 11.5, fontFamily: 'Helvetica-Bold', color: ACCENT, marginTop: 10, marginBottom: 3 },
        p: { marginBottom: 6, textAlign: 'justify' },
        li: { marginBottom: 4, marginLeft: 12, flexDirection: 'row' },
        bullet: { width: 10 },
        hr: { borderBottomWidth: 1, borderBottomColor: '#eee', marginVertical: 8 },
        space: { height: 5 },
        table: { marginVertical: 10, borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#d1d5db' },
        tr: { flexDirection: 'row' },
        th: { flex: 1, padding: 5, fontSize: 9.5, fontFamily: 'Helvetica-Bold', backgroundColor: ACCENT, color: '#fff', borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#d1d5db' },
        td: { flex: 1, padding: 5, fontSize: 9.5, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#d1d5db' },
        footer: { position: 'absolute', bottom: 30, left: 56, right: 56, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 6, fontSize: 8, color: MUTED },
      })

      // Inline bold (**...**) rendering for paragraphs / list items.
      const inline = (text: string) =>
        text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
          part.startsWith('**') && part.endsWith('**') ? (
            <Text key={i} style={{ fontFamily: 'Helvetica-Bold' }}>{part.slice(2, -2)}</Text>
          ) : (
            <Text key={i}>{part}</Text>
          )
        )

      const { title, coverLines, body } = parseReport(content)
      const cliente = coverLines[0] || ''
      const meta = coverLines.slice(1).filter((l) => l.toUpperCase() !== 'CONFIDENCIAL')
      const hasConfidencial = coverLines.some((l) => l.toUpperCase() === 'CONFIDENCIAL')
      const blocks = parseBlocks(body)

      const doc = (
        <Document>
          {/* Cover */}
          <Page size="A4" style={s.cover}>
            <View style={s.coverBand} />
            <View style={s.coverInner}>
              <Text style={s.brand}>CORTEX</Text>
              {logoUrl ? <Image src={logoUrl} style={s.logo} /> : null}
              <Text style={s.coverTitle}>{title}</Text>
              <View style={s.coverRule} />
              {cliente ? <Text style={s.coverClient}>{cliente}</Text> : null}
              {meta.map((m, i) => (
                <Text key={i} style={s.coverMeta}>{m}</Text>
              ))}
              {hasConfidencial ? <Text style={s.confidencial}>CONFIDENCIAL</Text> : null}
            </View>
            <Text style={s.coverFooter}>Gerado em {createdAt} · CORTEX — Inteligência de Comunicação</Text>
          </Page>

          {/* Body */}
          <Page size="A4" style={s.page} wrap>
            {prompt ? <Text style={s.prompt}>{prompt}</Text> : null}
            {blocks.map((b, i) => {
              if (b.type === 'hr') return <View key={i} style={s.hr} />
              if (b.type === 'space') return <View key={i} style={s.space} />
              if (b.type === 'h2') return <Text key={i} style={s.h2}>{stripInline(b.text || '')}</Text>
              if (b.type === 'h3') return <Text key={i} style={s.h3}>{stripInline(b.text || '')}</Text>
              if (b.type === 'li')
                return (
                  <View key={i} style={s.li}>
                    <Text style={s.bullet}>•</Text>
                    <Text style={{ flex: 1 }}>{inline(b.text || '')}</Text>
                  </View>
                )
              if (b.type === 'table' && b.rows)
                return (
                  <View key={i} style={s.table}>
                    {b.rows.map((row, r) => (
                      <View key={r} style={s.tr}>
                        {row.map((cell, c) => (
                          <Text key={c} style={r === 0 ? s.th : s.td}>{cell}</Text>
                        ))}
                      </View>
                    ))}
                  </View>
                )
              return <Text key={i} style={s.p}>{inline(b.text || '')}</Text>
            })}
            <Text
              style={s.footer}
              fixed
              render={({ pageNumber, totalPages }) => `${cliente || 'CORTEX'}  ·  CONFIDENCIAL  ·  ${pageNumber}/${totalPages}`}
            />
          </Page>
        </Document>
      )

      const blob = await pdf(doc).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'cortex-relatorio.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={exportPdf} disabled={loading}>
      <Download className="w-4 h-4 mr-2" />
      {loading ? 'Gerando PDF...' : 'Exportar PDF'}
    </Button>
  )
}
