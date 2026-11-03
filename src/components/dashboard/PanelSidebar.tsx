'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type AgendaItem = { id: string; agency: string; title: string; phase: string | null; deadline: string | null }

/** Itens na coluna lateral; a tela da Agenda tem a lista inteira. */
const SIDEBAR_ITEMS = 5

export function PanelSidebar() {
  const [items, setItems] = useState<AgendaItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/agenda')
      .then(async (res) => {
        const body = await res.json().catch(() => null)
        if (!res.ok) throw new Error(body?.error || `Falha ao ler a agenda (HTTP ${res.status}).`)
        setItems(body.items)
      })
      .catch((err: Error) => setError(err.message))
  }, [])

  // Em andamento primeiro: é o que pode mudar logo.
  const active = (items ?? []).filter((item) => !/conclu|não iniciado/i.test(item.phase ?? ''))
  return (
    <aside className="grid content-start gap-8">
      <div>
        <h2 className="text-2xl font-light text-slate-900">Agenda regulatória</h2>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {!items && !error && <p className="mt-2 text-sm text-slate-500">Carregando…</p>}
        {items && active.length === 0 && <p className="mt-2 text-sm text-slate-500">Nenhum tema em andamento.</p>}
        <ul className="mt-3 grid gap-4">
          {active.slice(0, SIDEBAR_ITEMS).map((item) => (
            <li key={item.id}>
              <p className="text-sm text-slate-900">{item.title}</p>
              <p className="text-xs text-slate-500">{item.agency} · {item.phase}{item.deadline ? ` · prazo ${new Date(`${item.deadline}T12:00:00`).toLocaleDateString('pt-BR')}` : ''}</p>
            </li>
          ))}
        </ul>
        {items && <p className="mt-2 text-xs text-slate-500">{Math.min(SIDEBAR_ITEMS, active.length)} de {active.length} em andamento.</p>}
        <Link href="/agenda" className="mt-3 inline-block text-sm text-sky-700 hover:underline">Ver agenda completa</Link>
      </div>
      <div>
        <h2 className="text-2xl font-light text-slate-900">Entregáveis</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          <li><Link className="text-sky-700 hover:underline" href="/bulletins">Boletim semanal</Link></li>
          <li><Link className="text-sky-700 hover:underline" href="/reports/prepare">Preparação do relatório</Link></li>
          <li><Link className="text-sky-700 hover:underline" href="/monthly-editions">Clipping mensal</Link></li>
        </ul>
      </div>
    </aside>
  )
}
