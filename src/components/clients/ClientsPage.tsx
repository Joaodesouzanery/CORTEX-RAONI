'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import type { Client } from '@/types'
import ClientForm from './ClientForm'

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)

  useEffect(() => { loadClients() }, [])

  async function loadClients() {
    setLoading(true)
    const res = await fetch('/api/clients')
    const data = await res.json()
    setClients(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  async function deleteClient(id: string) {
    if (!confirm('Excluir este cliente? Os relatórios associados não serão excluídos.')) return
    await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    setClients((prev) => prev.filter((c) => c.id !== id))
  }

  function onSaved(client: Client) {
    setClients((prev) => {
      const idx = prev.findIndex((c) => c.id === client.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = client; return next }
      return [client, ...prev]
    })
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-light tracking-tight">Clientes</h1>
          <p className="text-sm text-gray-500 mt-1">Cadastre clientes para filtrar notícias e personalizar relatórios</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true) }}>+ Novo Cliente</Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 animate-pulse" />)}
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>Nenhum cliente cadastrado ainda.</p>
          <p className="text-sm mt-1">Clique em &quot;Novo Cliente&quot; para começar.</p>
        </div>
      ) : (
        <div className="divide-y border border-gray-200">
          {clients.map((client) => (
            <div key={client.id} className="flex items-center gap-4 p-4">
              {client.logo_url ? (
                <img src={client.logo_url} alt={client.name} className="h-10 w-20 object-contain flex-shrink-0" />
              ) : (
                <div className="h-10 w-20 bg-gray-100 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">Sem logo</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{client.name}</p>
                {client.keywords?.length ? (
                  <p className="text-xs text-gray-500 truncate">{client.keywords.join(', ')}</p>
                ) : null}
                {client.context ? (
                  <p className="text-xs text-gray-400 truncate">{client.context}</p>
                ) : null}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setEditing(client); setFormOpen(true) }}
                >
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => deleteClient(client.id)}
                >
                  Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ClientForm
        client={editing}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={onSaved}
      />
    </div>
  )
}
