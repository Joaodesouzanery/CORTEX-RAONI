'use client'
import { useState } from 'react'
import { Newspaper } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { Article } from '@/types'

interface Props {
  articles: Article[]
  clientId?: string | null
  clientName?: string | null
  logoUrl?: string | null
  className?: string
}

interface ClipItem {
  n: number
  title: string
  veiculo: string
  data: string
  url: string
  paragraphs: string[]
}

const DEFAULT_CLASS =
  'bg-white text-black border border-black px-5 py-3 flex items-center gap-2 shadow-xl hover:bg-gray-50 transition-colors disabled:opacity-50'

// Curated clipping in PDF (cover + Sumário + matérias na íntegra). Fetches the
// full text from /api/reports/clipping, then renders client-side with react-pdf —
// same engine as the report PDF. Deterministic, no AI.
export default function ClippingPdfButton({ articles, clientId, clientName, logoUrl, className }: Props) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  async function generate() {
    if (!articles.length) return
    setLoading(true)
    try {
      const res = await fetch('/api/reports/clipping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_ids: articles.map((a) => a.id), client_id: clientId || null }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        toast({ title: 'Falha ao gerar o clipping', description: data?.error || `HTTP ${res.status}`, variant: 'destructive' })
        return
      }
      const items: ClipItem[] = data?.items || []
      if (!items.length) {
        toast({ title: 'Nenhuma matéria para o clipping', variant: 'destructive' })
        return
      }
      await renderPdf(items, data.clientName || clientName || null)
      const notEnriched = data?.meta?.notEnriched || 0
      if (notEnriched > 0) {
        toast({
          title: 'Clipping gerado',
          description: `${notEnriched} matéria(s) sem texto completo (limite de extração) — saíram com o resumo.`,
        })
      }
    } catch (e) {
      toast({ title: 'Falha ao gerar o clipping', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  async function renderPdf(items: ClipItem[], name: string | null) {
    const { pdf, Document, Page, Text, View, Image, StyleSheet } = await import('@react-pdf/renderer')

    const ACCENT = '#111111'
    const MUTED = '#6b7280'
    const s = StyleSheet.create({
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
      page: { paddingTop: 54, paddingBottom: 64, paddingHorizontal: 56, fontSize: 10.5, fontFamily: 'Helvetica', lineHeight: 1.5, color: '#1f2937' },
      sumarioTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: ACCENT, marginBottom: 12 },
      tocRow: { flexDirection: 'row', marginBottom: 6 },
      tocNum: { width: 20, fontFamily: 'Helvetica-Bold', color: ACCENT },
      tocTitle: { flex: 1, fontSize: 10 },
      tocVeiculo: { color: MUTED },
      artTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: ACCENT, marginBottom: 4, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
      artMeta: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: MUTED, marginBottom: 1 },
      artUrl: { fontSize: 8.5, color: '#2563eb', marginBottom: 8 },
      artPara: { marginBottom: 6, textAlign: 'justify' },
      footer: { position: 'absolute', bottom: 30, left: 56, right: 56, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 6, fontSize: 8, color: MUTED },
    })

    const hoje = new Date().toLocaleDateString('pt-BR')
    const label = name || 'CORTEX'

    const doc = (
      <Document>
        {/* Capa */}
        <Page size="A4" style={s.cover}>
          <View style={s.coverBand} />
          <View style={s.coverInner}>
            <Text style={s.brand}>CORTEX</Text>
            {logoUrl ? <Image src={logoUrl} style={s.logo} /> : null}
            <Text style={s.coverTitle}>Clipping de Notícias</Text>
            <View style={s.coverRule} />
            {name ? <Text style={s.coverClient}>{name}</Text> : null}
            <Text style={s.coverMeta}>{hoje}</Text>
            <Text style={s.coverMeta}>
              {items.length} {items.length === 1 ? 'matéria' : 'matérias'}
            </Text>
            <Text style={s.confidencial}>CONFIDENCIAL</Text>
          </View>
          <Text style={s.coverFooter}>Gerado em {hoje} · CORTEX — Inteligência de Comunicação</Text>
        </Page>

        {/* Sumário + matérias na íntegra */}
        <Page size="A4" style={s.page} wrap>
          <Text style={s.sumarioTitle}>Sumário</Text>
          {items.map((it) => (
            <View key={`t${it.n}`} style={s.tocRow} wrap={false}>
              <Text style={s.tocNum}>{it.n}.</Text>
              <Text style={s.tocTitle}>
                {it.title}
                <Text style={s.tocVeiculo}> — {it.veiculo}</Text>
              </Text>
            </View>
          ))}
          {items.map((it) => (
            <View key={`m${it.n}`} break>
              <Text style={s.artTitle}>
                {it.n}. {it.title}
              </Text>
              <Text style={s.artMeta}>
                {it.veiculo} · {it.data}
              </Text>
              {it.url ? <Text style={s.artUrl}>{it.url}</Text> : null}
              {it.paragraphs.map((p, k) => (
                <Text key={k} style={s.artPara}>
                  {p}
                </Text>
              ))}
            </View>
          ))}
          <Text
            style={s.footer}
            fixed
            render={({ pageNumber, totalPages }) => `${label}  ·  CONFIDENCIAL  ·  ${pageNumber}/${totalPages}`}
          />
        </Page>
      </Document>
    )

    const slug = (name || 'cortex')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    const blob = await pdf(doc).toBlob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `clipping-${slug || 'cortex'}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button onClick={generate} disabled={loading || !articles.length} className={className || DEFAULT_CLASS}>
      <Newspaper className="w-4 h-4" />
      {loading ? 'Gerando clipping…' : `Clipping PDF (${articles.length})`}
    </button>
  )
}
