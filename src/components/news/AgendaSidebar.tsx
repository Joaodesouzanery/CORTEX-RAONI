'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { safeExternalUrl } from '@/lib/url'

type Item = { id: string; agency: string; title: string; deadline: string | null; official_url: string }

// Quantos prazos cabem na coluna sem rolar a página; o resto fica em /agenda.
const SIDEBAR_ITEMS = 6

// Coluna lateral de "Últimas notícias": próximos prazos da agenda regulatória.
export default function AgendaSidebar() {
  const [items, setItems] = useState<Item[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/agenda', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
        const today = new Date().toISOString().slice(0, 10)
        setItems(((data?.items || []) as Item[]).filter((item) => item.deadline && item.deadline >= today).slice(0, SIDEBAR_ITEMS))
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Falha ao ler a agenda.'))
  }, [])

  return (
    <aside className="rounded-lg bg-neutral-100 p-5">
      <h3 className="text-xl font-light">Agenda regulatória</h3>
      <p className="mt-1 text-xs text-neutral-500">Próximos prazos oficiais.</p>
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      {!items && !error && <p className="mt-3 text-xs text-neutral-500">Carregando…</p>}
      {items && items.length === 0 && <p className="mt-3 text-xs text-neutral-500">Nenhum prazo futuro cadastrado.</p>}
      <ul className="mt-4 grid gap-4">
        {items?.map((item) => {
          const href = safeExternalUrl(item.official_url)
          return (
            <li key={item.id} className="border-l-2 border-[hsl(var(--brand))] pl-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-neutral-500">
                {item.agency} · {new Date(`${item.deadline}T12:00:00`).toLocaleDateString('pt-BR')}
              </div>
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline">{item.title}</a>
              ) : (
                <span>{item.title}</span>
              )}
            </li>
          )
        })}
      </ul>
      <Link href="/agenda" className="mt-5 inline-block border border-black px-4 py-2 text-xs hover:bg-black hover:text-white">
        Ver agenda completa
      </Link>
    </aside>
  )
}
