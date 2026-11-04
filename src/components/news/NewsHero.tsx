'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { SECTORS } from '@/lib/sectors'
import { SectorIcon } from './SectorIcon'

type Row = { id: string; name: string; total: number | null; direct: number | null }

/** Faixa de abertura de Notícias: setores e um painel curto por cliente. */
export default function NewsHero({ onPickClient }: { onPickClient: (clientId: string) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/panel/hero-counts')
      .then(async (res) => {
        const body = await res.json().catch(() => null)
        if (!res.ok) throw new Error(body?.error || `Contagens indisponíveis (HTTP ${res.status}).`)
        setRows(body.clients ?? [])
        setWarning(body.counts_warning ?? null)
      })
      .catch((err: Error) => setError(err.message))
  }, [])

  // Setores com cliente ativo primeiro; os demais ficam visíveis para venda futura.
  const sectors = SECTORS.slice(0, 6)
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-sky-950 via-sky-900 to-slate-800 text-white">
      <div className="mx-auto max-w-screen-xl px-6 py-14">
        <h1 className="text-center text-4xl font-light tracking-tight sm:text-5xl">Inteligência de imprensa por setor</h1>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sky-100">As notícias que importam para cada cliente, separadas por tema, com link para a matéria original.</p>
        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {sectors.map((sector) => (
            <Link key={sector.key} href={`/bulletins?setor=${sector.key}`} className="focus-ring rounded-lg border border-white/15 bg-white/5 px-3 py-4 text-center text-sm transition hover:bg-white/15">
              <SectorIcon sector={sector.key} className="mx-auto mb-2 h-8 w-8" style={{ color: sector.accent }} />
              {sector.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="mx-auto max-w-screen-xl px-6 pb-8">
        <div className="rounded-t-lg bg-white p-5 text-slate-900 shadow-lg">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xl font-light">Clientes · últimos 30 dias</h2>
            <Link href="/dashboard" className="text-sm text-sky-700 hover:underline">Painel completo</Link>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {warning && <p className="mb-2 text-sm text-amber-700">{warning}</p>}
          {!rows && !error && <p className="text-sm text-slate-500">Carregando…</p>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
            {rows?.map((row) => (
              <button key={row.id} onClick={() => onPickClient(row.id)} className="focus-ring card-hover rounded-lg border border-slate-200 p-3 text-left">
                <p className="truncate text-sm font-medium">{row.name}</p>
                <p className="mt-1 text-2xl font-light tabular-nums">{row.total ?? '—'}</p>
                <p className="text-xs text-slate-500">{row.direct == null ? 'sem contagem' : `${row.direct} citam o cliente`}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
