'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

interface Props {
  prompt: string
  content: string
  createdAt: string
}

// Parse simple markdown into PDF-friendly blocks
function parseBlocks(content: string) {
  return content.split('\n').map((line) => {
    if (line.startsWith('### ')) return { type: 'h3', text: line.slice(4) }
    if (line.startsWith('## ')) return { type: 'h2', text: line.slice(3) }
    if (line.startsWith('# ')) return { type: 'h1', text: line.slice(2) }
    if (line.startsWith('- ') || line.startsWith('* ')) return { type: 'li', text: line.slice(2) }
    if (line.startsWith('---')) return { type: 'hr', text: '' }
    if (line.trim() === '') return { type: 'space', text: '' }
    return { type: 'p', text: line }
  })
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
