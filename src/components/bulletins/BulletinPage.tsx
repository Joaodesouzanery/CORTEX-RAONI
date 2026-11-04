'use client'
import { useEffect, useState } from 'react'
import { DailyDigestPanel } from '@/components/bulletins/DailyDigestPanel'
import { sectorForClient } from '@/lib/sectors'
import { safeExternalUrl } from '@/lib/url'
import type { PanelThemesResult } from '@/lib/panel-themes'
import type { Client } from '@/types'

type Bulletin = PanelThemesResult & { start: string; end: string; highlights: Array<PanelThemesResult['themes'][number]['articles'][number] & { complement?: boolean }> }

const date = (value: string | null) => (value ? new Date(value).toLocaleDateString('pt-BR') : 'sem data')

export default function BulletinPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [data, setData] = useState<Bulletin | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'semanal' | 'diario'>('semanal')

  useEffect(() => {
    fetch('/api/clients')
      .then(async (res) => {
        const body = await res.json().catch(() => null)
        if (!res.ok) throw new Error(body?.error || 'Falha ao carregar clientes.')
        const list: Client[] = Array.isArray(body) ? body : body?.clients ?? []
        setClients(list)
        setClientId(list[0]?.id ?? '')
      })
      .catch((err: Error) => setError(err.message))
  }, [])

  useEffect(() => {
    if (!clientId) return
    let stale = false
    setData(null)
    setError(null)
    fetch(`/api/bulletins?client=${clientId}`)
      .then(async (res) => {
        const body = await res.json().catch(() => null)
        if (!res.ok) throw new Error(body?.error || 'Falha ao montar o boletim.')
        if (!stale) setData(body)
      })
      .catch((err: Error) => { if (!stale) setError(err.message) })
    return () => { stale = true }
  }, [clientId])

  const client = clients.find((item) => item.id === clientId)
  const sector = sectorForClient(client?.sector)
  const active = data?.themes.filter((theme) => theme.articles.length).sort((a, b) => b.articles.length - a.articles.length) ?? []

  return (
    <div className="mx-auto max-w-screen-lg px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-5xl font-light tracking-tight">Boletim</h1>
        <select aria-label="Cliente" className="rounded border px-2 py-1 text-sm" value={clientId} onChange={(event) => setClientId(event.target.value)}>
          {clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>
      <div className="mb-6 flex gap-4 border-b">
        {(['semanal', 'diario'] as const).map((item) => (
          <button key={item} onClick={() => setMode(item)} className={`border-b-2 pb-2 text-sm ${mode === item ? 'border-sky-600 text-slate-900' : 'border-transparent text-slate-500'}`}>
            {item === 'semanal' ? 'Boletim semanal' : 'Resumo diário'}
          </button>
        ))}
      </div>
      {mode === 'diario' && client && <DailyDigestPanel clientId={client.id} clientName={client.name} />}
      {mode === 'semanal' && error && <p className="text-sm text-red-600">{error}</p>}
      {mode === 'semanal' && !data && !error && <p className="text-sm text-gray-500">Montando boletim…</p>}
      {mode === 'semanal' && data && (
        <article className="grid gap-6">
          <header className="relative overflow-hidden rounded-lg p-8 text-white" style={{ background: sector.color }}>
            <svg aria-hidden="true" viewBox="0 0 1000 300" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-70">
              {Array.from({ length: 8 }, (_, line) => (
                <path key={line} d={`M350 ${300 - line * 14} C 560 ${180 - line * 16}, 640 ${380 - line * 14}, 1000 ${70 + line * 14}`} fill="none" stroke={sector.accent} strokeWidth="1.5" />
              ))}
            </svg>
            <div className="relative">
            <p className="text-xs uppercase tracking-widest">Boletim semanal · {sector.label}</p>
            <h2 className="mt-2 text-3xl font-semibold">{client?.name}</h2>
            <p className="mt-2 text-sm">{date(data.start)} a {date(data.end)}: {data.total_tagged} matérias marcadas, {data.highlights.length} em destaque, {data.unthemed} sem tema.</p>
            </div>
          </header>
          <section>
            <h3 className="mb-2 text-xl font-light">Destaques</h3>
            {data.highlights.length === 0 && <p className="text-sm text-gray-500">Nenhuma matéria citou o cliente nesta semana.</p>}
            <ul className="grid gap-4 sm:grid-cols-2">
              {data.highlights.slice(0, 20).map((article) => {
                const href = safeExternalUrl(article.url)
                return (
                  <li key={article.id} className="overflow-hidden rounded-lg border text-sm">
                    {article.image && (
                      // Imagem da própria matéria, de domínio variável: next/image exigiria liberar todo host.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={article.image} alt="" loading="lazy" className="h-36 w-full object-cover" />
                    )}
                    <div className="p-3">
                    {href ? <a className="font-medium underline" href={href} target="_blank" rel="noopener noreferrer">{article.title}</a> : <span className="font-medium">{article.title}</span>}
                    <div className="text-xs text-gray-500">{article.publisher ?? 'veículo não informado'} · {date(article.published_at)}</div>
                    {article.complement && (
                      <span className="mt-1 inline-block rounded border border-amber-300 bg-amber-50 px-1.5 text-[10px] uppercase tracking-wide text-amber-800" title="Matéria do setor que não cita o cliente; entra para completar o mínimo de 20">
                        Complemento do setor
                      </span>
                    )}
                    <p className="mt-1 text-xs text-gray-500">Por que importa: pendente de análise.</p>
                    </div>
                  </li>
                )
              })}
            </ul>
            {data.highlights.length > 20 && <p className="mt-2 text-xs text-gray-500">Mostrando 20 de {data.highlights.length}.</p>}
          </section>
          <section>
            <h3 className="mb-2 text-xl font-light">Radar por tema</h3>
            {active.length === 0 && <p className="text-sm text-gray-500">Nenhum tema com matéria nesta semana.</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {active.map((theme) => (
                <div key={theme.title} className="rounded border p-3 text-sm" style={{ borderLeft: `4px solid ${sector.accent}` }}>
                  <strong>{theme.title}</strong>
                  <div className="text-xs text-gray-500">{theme.articles.length} matérias</div>
                </div>
              ))}
            </div>
          </section>
        </article>
      )}
    </div>
  )
}
