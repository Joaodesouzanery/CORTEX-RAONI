'use client'
import { useEffect, useMemo, useState } from 'react'
import { AGENCIES, SECTORS } from '@/lib/sectors'
import { safeExternalUrl } from '@/lib/url'

type Item = { id: string; agency: string; title: string; item_type: string; phase: string | null; deadline: string | null; official_url: string; client_names: string[]; checked_at: string }

/** Horizonte da linha do tempo. */
const TIMELINE_DAYS = 60
/** Prazo em destaque, igual ao alerta. */
const URGENT_DAYS = 7
const DAY = 24 * 60 * 60 * 1000

const br = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR')

export default function AgendaPage() {
  const [items, setItems] = useState<Item[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sectorKey, setSectorKey] = useState('')

  useEffect(() => {
    fetch('/api/agenda')
      .then(async (res) => {
        const body = await res.json().catch(() => null)
        if (!res.ok) throw new Error(body?.error || 'Falha ao ler a agenda.')
        setItems(body.items)
      })
      .catch((err: Error) => setError(err.message))
  }, [])

  const today = useMemo(() => new Date(new Date().toDateString()).getTime(), [])
  const sector = SECTORS.find((item) => item.key === sectorKey)
  const agencies: readonly string[] = sector ? sector.agencies : AGENCIES
  const visible = (items ?? []).filter((item) => agencies.includes(item.agency))
  const dayOffset = (deadline: string) => Math.round((new Date(`${deadline}T00:00:00`).getTime() - today) / DAY)
  const lanes = agencies.filter((agency) => visible.some((item) => item.agency === agency && item.deadline && dayOffset(item.deadline) >= 0 && dayOffset(item.deadline) <= TIMELINE_DAYS))

  return (
    <div className="mx-auto max-w-screen-xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-5xl font-light tracking-tight">Agenda regulatória</h1>
          <p className="mt-1 text-xs text-gray-500">Prazos só entram quando constam na fonte oficial.</p>
        </div>
        <select aria-label="Setor" className="rounded border px-2 py-1 text-sm" value={sectorKey} onChange={(event) => setSectorKey(event.target.value)}>
          <option value="">Todos os setores</option>
          {SECTORS.filter((item) => (item.agencies as readonly string[]).some((agency) => items?.some((row) => row.agency === agency))).map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!items && !error && <p className="text-sm text-gray-500">Carregando agenda…</p>}
      {items && (
        <div className="grid gap-8">
          <section>
            <h2 className="mb-2 text-xl font-light">Próximos {TIMELINE_DAYS} dias</h2>
            {lanes.length === 0 && <p className="text-sm text-gray-500">Nenhum prazo com data neste período.</p>}
            <div className="overflow-x-auto">
              <div className="grid min-w-[720px] gap-2">
                {lanes.map((agency) => (
                  <div key={agency} className="grid grid-cols-[80px_1fr] items-center gap-2">
                    <span className="text-sm font-medium">{agency}</span>
                    <div className="relative h-10 rounded bg-gray-100">
                      {visible.filter((item) => item.agency === agency && item.deadline && dayOffset(item.deadline) >= 0 && dayOffset(item.deadline) <= TIMELINE_DAYS).map((item) => {
                        const offset = dayOffset(item.deadline as string)
                        return (
                          <span
                            key={item.id}
                            title={`${item.title} · ${br(item.deadline as string)}`}
                            className={`absolute top-1 h-8 w-2 rounded ${offset <= URGENT_DAYS ? 'bg-red-600' : 'bg-gray-800'}`}
                            style={{ left: `${(offset / TIMELINE_DAYS) * 100}%` }}
                          />
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {lanes.length > 0 && <p className="mt-1 text-xs text-gray-500">Início da faixa: hoje. Vermelho: até {URGENT_DAYS} dias.</p>}
          </section>
          <section>
            <h2 className="mb-2 text-xl font-light">Fases da agenda</h2>
            {/* A maioria dos temas não tem prazo oficial: a fase é o que mostra o andamento. */}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(visible.reduce<Record<string, number>>((all, item) => ({ ...all, [item.phase ?? item.item_type]: (all[item.phase ?? item.item_type] ?? 0) + 1 }), {}))
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .map(([phase, count]) => (
                  <div key={phase} className="rounded-lg border p-3 text-sm"><strong className="text-xl">{count}</strong><div className="text-xs text-gray-500">{phase}</div></div>
                ))}
            </div>
            <p className="mt-1 text-xs text-gray-500">{visible.length} temas no filtro atual.</p>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-light">Itens ({visible.length})</h2>
            {visible.length === 0 && <p className="text-sm text-gray-500">Ainda não há itens conectados para este filtro.</p>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs uppercase text-gray-500"><tr><th className="py-2">Prazo</th><th>Agência</th><th>Item</th><th>Fase</th><th>Afeta</th><th>Conferido</th></tr></thead>
                <tbody>
                  {visible.map((item) => {
                    const href = safeExternalUrl(item.official_url)
                    return (
                      <tr key={item.id} className="border-t align-top">
                        <td className="py-2 whitespace-nowrap">{item.deadline ? br(item.deadline) : 'sem data oficial'}</td>
                        <td>{item.agency}</td>
                        <td>{href ? <a className="underline" href={href} target="_blank" rel="noopener noreferrer">{item.title}</a> : item.title}</td>
                        <td>{item.phase ?? item.item_type}</td>
                        <td>{item.client_names.join(', ') || '—'}</td>
                        <td className="whitespace-nowrap">{new Date(item.checked_at).toLocaleDateString('pt-BR')}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h2 className="mb-2 text-xl font-light">Cobertura por agência</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {AGENCIES.filter((agency) => items.some((item) => item.agency === agency)).map((agency) => (
                <div key={agency} className="rounded border p-2 text-sm"><strong>{agency}</strong><div className="text-xs text-gray-500">{items.filter((item) => item.agency === agency).length} itens</div></div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
