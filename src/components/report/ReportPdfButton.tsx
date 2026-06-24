'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

interface Props {
  prompt: string
  content: string
  createdAt: string
}

interface Block {
  type: 'h1' | 'h2' | 'h3' | 'li' | 'hr' | 'space' | 'p' | 'table'
  text?: string
  rows?: string[][]
}

// @react-pdf has no markdown parser, so strip inline markers it can't render.
function stripInline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
}

// Parse markdown into PDF-friendly blocks, grouping consecutive `| ... |` lines
// into table blocks (used by the "Demonstração dos serviços" section).
function parseBlocks(content: string): Block[] {
  const lines = content.split('\n')
  const blocks: Block[] = []
  const isTableRow = (l: string) => l.trim().startsWith('|') && l.includes('|')
  const isSeparatorRow = (cells: string[]) =>
    cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c.trim()))

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
    if (line.startsWith('### ')) blocks.push({ type: 'h3', text: stripInline(line.slice(4)) })
    else if (line.startsWith('## ')) blocks.push({ type: 'h2', text: stripInline(line.slice(3)) })
    else if (line.startsWith('# ')) blocks.push({ type: 'h1', text: stripInline(line.slice(2)) })
    else if (line.startsWith('- ') || line.startsWith('* ')) blocks.push({ type: 'li', text: stripInline(line.slice(2)) })
    else if (line.startsWith('---')) blocks.push({ type: 'hr' })
    else if (line.trim() === '') blocks.push({ type: 'space' })
    else blocks.push({ type: 'p', text: stripInline(line) })
    i++
  }
  return blocks
}

export default function ReportPdfButton({ prompt, content, createdAt }: Props) {
  const [loading, setLoading] = useState(false)

  async function exportPdf() {
    setLoading(true)
    try {
      const { pdf, Document, Page, Text, View, StyleSheet } = await import('@react-pdf/renderer')

      const styles = StyleSheet.create({
        page: { padding: 48, fontSize: 11, fontFamily: 'Helvetica', lineHeight: 1.5 },
        meta: { fontSize: 9, color: '#666', marginBottom: 8 },
        prompt: { fontSize: 12, fontStyle: 'italic', marginBottom: 20, paddingLeft: 8, borderLeft: '2px solid #000' },
        h1: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 8 },
        h2: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 12, marginBottom: 6 },
        h3: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 4 },
        p: { marginBottom: 6 },
        li: { marginBottom: 4, marginLeft: 12 },
        hr: { borderBottom: '1px solid #ccc', marginVertical: 8 },
        space: { height: 6 },
        table: { marginVertical: 8, borderTop: '1px solid #ccc', borderLeft: '1px solid #ccc' },
        tr: { flexDirection: 'row' },
        th: { flex: 1, padding: 4, fontSize: 10, fontFamily: 'Helvetica-Bold', backgroundColor: '#f3f3f3', borderRight: '1px solid #ccc', borderBottom: '1px solid #ccc' },
        td: { flex: 1, padding: 4, fontSize: 10, borderRight: '1px solid #ccc', borderBottom: '1px solid #ccc' },
      })

      const blocks = parseBlocks(content)

      const doc = (
        <Document>
          <Page size="A4" style={styles.page} wrap>
            <Text style={styles.meta}>CORTEX · {createdAt}</Text>
            <Text style={styles.prompt}>{prompt}</Text>
            {blocks.map((b, i) => {
              if (b.type === 'hr') return <View key={i} style={styles.hr} />
              if (b.type === 'space') return <View key={i} style={styles.space} />
              if (b.type === 'h1') return <Text key={i} style={styles.h1}>{b.text}</Text>
              if (b.type === 'h2') return <Text key={i} style={styles.h2}>{b.text}</Text>
              if (b.type === 'h3') return <Text key={i} style={styles.h3}>{b.text}</Text>
              if (b.type === 'li') return <Text key={i} style={styles.li}>• {b.text}</Text>
              if (b.type === 'table' && b.rows) return (
                <View key={i} style={styles.table}>
                  {b.rows.map((row, r) => (
                    <View key={r} style={styles.tr}>
                      {row.map((cell, c) => (
                        <Text key={c} style={r === 0 ? styles.th : styles.td}>{cell}</Text>
                      ))}
                    </View>
                  ))}
                </View>
              )
              return <Text key={i} style={styles.p}>{b.text}</Text>
            })}
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
