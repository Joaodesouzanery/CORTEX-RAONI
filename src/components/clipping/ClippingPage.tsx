'use client'

import { useEffect, useState } from 'react'
import { Band } from '@/components/ui/band'
import { SectionTitle } from '@/components/ui/section-title'
import { safeExternalUrl } from '@/lib/url'
import type { ClippingDay, ClippingItem } from '@/lib/clipping'

type ClientOption = { id: string; name: string }

function todayInSaoPaulo() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

function time(value: string | null) {
  return value ? new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '--:--'
}

function Block({ title, subtitle, items, empty }: { title: string; subtitle: string; items: ClippingItem[]; empty: string }) {
  return (
    <div>
      <SectionTitle title={`${title} (${items.length})`} subtitle={subtitle} />
      {items.length === 0 && <p className="text-sm text-neutral-500">{empty}</p>}
      <ol className="divide-y divide-neutral-200 border-y border-neutral-200 bg-white">
        {items.map((item) => {
          const href = safeExternalUrl(item.url)
          return (
            <li key={item.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[4rem_1fr]">
              <span className="font-mono text-xs text-neutral-500">{time(item.published_at)}</span>
              <div>
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">{item.title}</a>
                ) : (
                  <span className="font-medium">{item.title}</span>
                )}
                <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-neutral-500">
                  <span className="uppercase tracking-wide">{item.publisher || 'veículo não informado'}</span>
                  {item.tema && <span>· {item.tema}</span>}
                  {item.content_status !== 'integral' && (
                    <span className="rounded border border-amber-300 bg-amber-50 px-1.5 text-amber-800" title="Sem texto integral: fonte com bloqueio, paywall ou só título no Google News">
                      só título
                    </span>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default function ClippingPage() {
  const [clients, setClients] = useState<ClientOption[]>([])
  const [clientId, setClientId] = useState('')
  const [date, setDate] = useState(todayInSaoPaulo())
  const [data, setData] = useState<ClippingDay | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/clients')
      .then(async (res) => {
        const body = await res.json().catch(() => null)
        if (!res.ok) throw new Error(body?.error || 'Falha ao carregar clientes.')
        const list = ((Array.isArray(body) ? body : body?.clients) || []) as Array<ClientOption & { active?: boolean }>
        const active = list.filter((client) => client.active !== false)
        setClients(active)
        setClientId((current) => current || active[0]?.id || '')
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar clientes.'))
  }, [])

  useEffect(() => {
    if (!clientId || !date) return
    setLoading(true)
    setError('')
    fetch(`/api/clipping?client_id=${clientId}&date=${date}`, { cache: 'no-store' })
      .then(async (res) => {
        const body = await res.json().catch(() => null)
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`)
        setData(body)
      })
      .catch((err) => {
        setData(null)
        setError(err instanceof Error ? err.message : 'Falha ao montar o clipping.')
      })
      .finally(() => setLoading(false))
  }, [clientId, date])

  const clientName = clients.find((client) => client.id === clientId)?.name || 'cliente'
  return (
    <>
      <Band tone="brand">
        <h1 className="text-4xl font-light tracking-tight md:text-5xl">Clipping diário</h1>
        <p className="mt-2 max-w-2xl text-white/80">Tudo o que saiu sobre o cliente e sobre o setor e os temas dele no dia, coletado e classificado automaticamente, com link para a matéria.</p>
        {data && (
          <p className="mt-3 text-sm text-white/90">
            {data.client.length + data.sector.length} matérias no dia · {data.client.length} citam o cliente · {data.sector.length} do setor e temas
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <select aria-label="Cliente" value={clientId} onChange={(event) => setClientId(event.target.value)} className="h-10 rounded border border-white/30 bg-white px-3 text-sm text-black">
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
          <input type="date" aria-label="Dia" value={date} max={todayInSaoPaulo()} onChange={(event) => setDate(event.target.value)} className="h-10 rounded border border-white/30 bg-white px-3 text-sm text-black" />
          {clientId && (
            // Prévia do e-mail do dia no nosso formato. Não envia nada
            // (o envio é pelo workflow daily-clipping-email.yml).
            <a
              href={`/api/clipping-email/preview?client_id=${encodeURIComponent(clientId)}&date=${encodeURIComponent(date)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center rounded border border-white/60 px-3 text-sm text-white hover:bg-white hover:text-black"
            >
              Ver e-mail do dia
            </a>
          )}
        </div>
      </Band>
      {error && (
        <Band><p className="text-sm text-red-600">{error}</p></Band>
      )}
      {loading && !data && (
        <Band><p className="text-sm text-neutral-500">Montando o clipping…</p></Band>
      )}
      {data && (
        <>
          <Band tone="gray">
            <Block title={clientName} subtitle="Matérias que citam o cliente, seus porta-vozes ou siglas." items={data.client} empty="Nenhuma matéria citou o cliente neste dia até agora." />
          </Band>
          <Band>
            <Block title="Setor e temas do cliente" subtitle="Não precisa citar o cliente: entra o que é do setor e dos temas que ele acompanha (regras do cliente com o termo no título ou no resumo)." items={data.sector} empty="Nenhuma matéria do setor qualificada neste dia." />
          </Band>
          <Band tone="gray">
            <SectionTitle title="Cobertura do dia" subtitle="Situação da coleta: fonte fora do ar é falha da coleta, não ausência de notícia." />
            <p className="text-sm">{data.sources.ok} fontes coletadas sem erro · {data.sources.failed.length} com falha.</p>
            {data.sources.failed.length > 0 && (
              <ul className="mt-3 grid gap-1 text-sm text-red-700">
                {data.sources.failed.map((source) => <li key={source.name}>{source.name}{source.error ? `: ${source.error.slice(0, 140)}` : ''}</li>)}
              </ul>
            )}
          </Band>
        </>
      )}
    </>
  )
}
