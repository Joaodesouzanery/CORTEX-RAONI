'use client'
import { useEffect, useState } from 'react'
import ClientsPage from '@/components/clients/ClientsPage'
import SourcesPage from '@/components/sources/SourcesPage'

const TABS = [
  { key: 'fontes', label: 'Fontes' },
  { key: 'clientes', label: 'Clientes' },
] as const

/** Clientes mora aqui: as duas telas configuram de onde vem e para quem vai cada matéria. */
export default function SourcesAndClients() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('fontes')
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'clientes') setTab('clientes')
  }, [])
  return (
    <div>
      <div className="mx-auto max-w-screen-xl px-6 pt-8">
        <div className="flex gap-6 border-b border-slate-200" role="tablist">
          {TABS.map((item) => (
            <button
              key={item.key}
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => setTab(item.key)}
              className={`focus-ring -mb-px border-b-2 pb-3 text-base ${tab === item.key ? 'border-sky-700 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'fontes' ? <SourcesPage /> : <ClientsPage />}
    </div>
  )
}
