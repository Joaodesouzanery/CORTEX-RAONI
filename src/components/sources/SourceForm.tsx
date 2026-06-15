'use client'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Source } from '@/types'

interface Props {
  source?: Source
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export default function SourceForm({ source, open, onClose, onSaved }: Props) {
  const [name, setName] = useState(source?.name || '')
  const [url, setUrl] = useState(source?.url || '')
  const [type, setType] = useState<'rss' | 'scrape'>(source?.type || 'rss')
  const [loading, setLoading] = useState(false)

  async function save() {
    setLoading(true)
    const method = source ? 'PUT' : 'POST'
    const endpoint = source ? `/api/sources/${source.id}` : '/api/sources'
    await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url, type }),
    })
    onSaved()
    onClose()
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{source ? 'Editar Fonte' : 'Nova Fonte'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-4">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Reuters" className="mt-1" />
          </div>
          <div>
            <Label>URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://feeds.reuters.com/reuters/topNews" className="mt-1" />
          </div>
          <div>
            <Label>Tipo</Label>
            <div className="flex gap-4 mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={type === 'rss'} onChange={() => setType('rss')} />
                <span className="text-sm">RSS Feed</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={type === 'scrape'} onChange={() => setType('scrape')} />
                <span className="text-sm">Web Scraping</span>
              </label>
            </div>
          </div>
          <Button onClick={save} disabled={loading || !name || !url}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
