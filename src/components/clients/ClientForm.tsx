'use client'
import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { Client, Source } from '@/types'

interface Props {
  client?: Client | null
  open: boolean
  onClose: () => void
  onSaved: (client: Client) => void
}

export default function ClientForm({ client, open, onClose, onSaved }: Props) {
  const [name, setName] = useState(client?.name || '')
  const [sector, setSector] = useState(client?.sector || '')
  const [contratante, setContratante] = useState(client?.contratante || '')
  const [context, setContext] = useState(client?.context || '')
  const [reportPrompt, setReportPrompt] = useState(client?.report_prompt || '')
  const [keywords, setKeywords] = useState<string[]>(client?.keywords || [])
  const [synonyms, setSynonyms] = useState(client?.synonyms || '')
  const [feedNames, setFeedNames] = useState<string[]>(client?.feed_names || [])
  const [alertRecipient, setAlertRecipient] = useState(client?.alert_recipient || '')
  const [sources, setSources] = useState<Source[]>([])
  const [kwInput, setKwInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Load available sources so the user can mark which feeds belong to this client.
  useEffect(() => {
    if (!open) return
    fetch('/api/sources')
      .then((r) => r.json())
      .then((d) => setSources(Array.isArray(d) ? d : []))
      .catch(() => setSources([]))
  }, [open])

  function toggleFeed(name: string) {
    setFeedNames((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]))
  }

  const isEdit = !!client

  function addKeyword() {
    const kw = kwInput.trim()
    if (kw && !keywords.includes(kw)) setKeywords([...keywords, kw])
    setKwInput('')
  }

  function removeKeyword(kw: string) {
    setKeywords(keywords.filter((k) => k !== kw))
  }

  async function save() {
    if (!name.trim()) { setError('Nome é obrigatório'); return }
    setLoading(true)
    setError('')
    try {
      const url = isEdit ? `/api/clients/${client.id}` : '/api/clients'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          sector: sector.trim() || null,
          contratante: contratante.trim() || null,
          context: context.trim() || null,
          report_prompt: reportPrompt.trim() || null,
          keywords: keywords.length ? keywords : null,
          synonyms: synonyms.trim() || null,
          feed_names: feedNames.length ? feedNames : null,
          alert_recipient: alertRecipient.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro ao salvar'); return }

      // Upload logo if selected
      if (fileRef.current?.files?.[0]) {
        const formData = new FormData()
        formData.append('logo', fileRef.current.files[0])
        const logoRes = await fetch(`/api/clients/${data.id}/logo`, { method: 'POST', body: formData })
        const logoData = await logoRes.json()
        if (logoData.logo_url) data.logo_url = logoData.logo_url
      }

      onSaved(data)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          <div>
            <Label htmlFor="cname">Nome *</Label>
            <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: ONS" className="mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="csector">Setor / Segmento</Label>
              <Input
                id="csector"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="Ex: Setor elétrico"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="ccontratante">Contratante</Label>
              <Input
                id="ccontratante"
                value={contratante}
                onChange={(e) => setContratante(e.target.value)}
                placeholder="CRTIVE LAB..."
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="crecipient">Destinatário dos alertas</Label>
            <p className="text-xs text-gray-500 mb-1">
              Para quem enviar o digest de alertas deste cliente — você envia manualmente na aba Alertas. Ex.: Fulano da ASCOM &lt;fulano@orgao.gov.br&gt;.
            </p>
            <Input id="crecipient" value={alertRecipient} onChange={(e) => setAlertRecipient(e.target.value)} placeholder="Nome <email@dominio>" className="mt-1" />
          </div>

          <div>
            <Label htmlFor="ctx">Contexto (background do cliente)</Label>
            <Textarea
              id="ctx"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Descreva o cliente, seu setor, sensibilidades reputacionais, temas prioritários..."
              rows={4}
              className="mt-1 resize-none"
            />
          </div>

          <div>
            <Label htmlFor="rprompt">Inteligência setorial e direcionamento</Label>
            <p className="text-xs text-gray-500 mb-1">
              Base de conhecimento do setor (temas-âncora, riscos típicos, oportunidades, stakeholders) + foco deste cliente. Entra no system prompt do relatório e do dossiê. Semeado pela migration 019 a partir de prompts/*.md.
            </p>
            <Textarea
              id="rprompt"
              value={reportPrompt}
              onChange={(e) => setReportPrompt(e.target.value)}
              placeholder="Ex: Priorize segurança energética, transição e modernização do setor. Trate riscos de apagão como tema-âncora."
              rows={5}
              className="mt-1 resize-none"
            />
          </div>

          <div>
            <Label>Palavras-chave para filtrar notícias</Label>
            <p className="text-xs text-gray-500 mb-1">Pressione Enter ou clique + para adicionar</p>
            <div className="flex gap-2">
              <Input
                value={kwInput}
                onChange={(e) => setKwInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }}
                placeholder="Ex: energia, ONS, setor elétrico"
              />
              <Button type="button" variant="outline" onClick={addKeyword}>+</Button>
            </div>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {keywords.map((kw) => (
                  <span key={kw} className="inline-flex items-center gap-1 bg-gray-100 text-xs px-2 py-1 border border-gray-200">
                    {kw}
                    <button onClick={() => removeKeyword(kw)} className="text-gray-400 hover:text-black">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="synonyms">Termos equivalentes / sinônimos</Label>
            <p className="text-xs text-gray-500 mb-1">
              Um grupo por linha, separados por vírgula. Todos os termos também são usados para filtrar (ex: <em>apagão, blecaute, desligamento</em>).
            </p>
            <Textarea
              id="synonyms"
              value={synonyms}
              onChange={(e) => setSynonyms(e.target.value)}
              placeholder={'apagão, blecaute, desligamento\ndragagem, desassoreamento'}
              rows={3}
              className="mt-1 resize-none"
            />
          </div>

          <div>
            <Label>Feeds temáticos deste cliente</Label>
            <p className="text-xs text-gray-500 mb-2">
              Toda notícia vinda dos feeds marcados conta como relevante para este cliente (além das palavras-chave).
            </p>
            <div className="max-h-40 overflow-y-auto border border-gray-100 p-2 flex flex-col gap-1">
              {sources.length === 0 ? (
                <span className="text-xs text-gray-400">Carregando fontes…</span>
              ) : (
                sources.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={feedNames.includes(s.name)} onChange={() => toggleFeed(s.name)} />
                    <span className="truncate">{s.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="logo">Logo (PNG/JPG)</Label>
            {client?.logo_url && (
              <Image
                src={client.logo_url}
                alt={`Logo de ${client.name}`}
                width={200}
                height={40}
                unoptimized
                className="h-10 w-auto mb-2 object-contain"
              />
            )}
            <Input id="logo" type="file" accept="image/*" ref={fileRef} className="mt-1" />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <Button onClick={save} disabled={loading} className="w-full">
            {loading ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Criar Cliente'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
