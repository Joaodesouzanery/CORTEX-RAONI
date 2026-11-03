'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { digestText, type DailyDigest } from '@/lib/daily-digest-core'
import { safeExternalUrl } from '@/lib/url'

const yesterday = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

export function DailyDigestPanel({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [day, setDay] = useState(yesterday)
  const [digest, setDigest] = useState<DailyDigest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!clientId) return
    let stale = false
    setDigest(null)
    setError(null)
    setCopied(false)
    fetch(`/api/bulletins/daily?client=${clientId}&day=${day}`)
      .then(async (res) => {
        const body = await res.json().catch(() => null)
        if (!res.ok) throw new Error(body?.error || `Falha ao montar o resumo diário (HTTP ${res.status}).`)
        if (!stale) setDigest(body)
      })
      .catch((err: Error) => { if (!stale) setError(err.message) })
    return () => { stale = true }
  }, [clientId, day])

  async function copy() {
    if (!digest) return
    try {
      await navigator.clipboard.writeText(digestText(clientName, digest))
      setCopied(true)
    } catch {
      setError('Não foi possível copiar. Verifique a permissão de área de transferência do navegador.')
    }
  }

  const list = (title: string, stories: DailyDigest['client']) => (
    <section>
      <h3 className="mb-2 text-xl font-light">{title} ({stories.length})</h3>
      {stories.length === 0 && <p className="text-sm text-gray-500">Nenhuma matéria neste dia.</p>}
      <ul className="grid gap-3">
        {stories.map((story) => {
          const href = safeExternalUrl(story.links[0])
          return (
            <li key={story.title} className="rounded-lg border p-3 text-sm">
              <p className="text-xs text-gray-500">{story.publishers.join(', ')}</p>
              {href ? <a className="underline" href={href} target="_blank" rel="noopener noreferrer">{story.title}</a> : story.title}
              <p className="mt-1 text-xs text-amber-800">Tom e resumo: pendentes de análise.</p>
            </li>
          )
        })}
      </ul>
    </section>
  )

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">Dia <input type="date" className="ml-2 rounded border px-2 py-1" value={day} onChange={(event) => setDay(event.target.value)} /></label>
        <Button variant="outline" onClick={copy} disabled={!digest}>{copied ? 'Texto copiado' : 'Copiar texto'}</Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!digest && !error && <p className="text-sm text-gray-500">Montando resumo…</p>}
      {digest && (
        <>
          <p className="text-sm text-gray-600">{digest.total} matérias marcadas para o cliente no dia, agrupadas em {digest.client.length + digest.sector.length} fatos.</p>
          {list('Menções ao cliente', digest.client)}
          {list('No setor', digest.sector)}
        </>
      )}
    </div>
  )
}
