'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import SourceForm from './SourceForm'
import type { Source } from '@/types'
import { Pencil, Trash2, Plus, Download } from 'lucide-react'

interface Props {
  sources: Source[]
  onRefresh: () => void
}

// Feed health from the last fetch, so a dead feed doesn't degrade coverage in
// silence: item count when it returned items, orange "vazio" when it returned
// nothing, muted "sem coleta" before the first run.
function HealthBadge({ source }: { source: Source }) {
  if (source.last_fetched_at == null) {
    return <span className="text-xs text-gray-400">sem coleta</span>
  }
  if (source.last_fetch_error) {
    return (
      <Badge variant="outline" className="max-w-40 truncate text-xs text-red-600 border-red-300" title={source.last_fetch_error}>
        ✗ {source.last_fetch_error}
      </Badge>
    )
  }
  if (!source.last_fetch_count) {
    return (
      <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
        ⚠ vazio
      </Badge>
    )
  }
  return <span className="text-xs text-emerald-700 tabular-nums">{source.last_fetch_count} itens</span>
}

export default function SourceTable({ sources, onRefresh }: Props) {
  const [editing, setEditing] = useState<Source | undefined>()
  const [adding, setAdding] = useState(false)
  const [seeding, setSeeding] = useState(false)

  async function deleteSource(id: string) {
    if (!confirm('Desativar esta fonte? O acervo e as proveniências serão preservados.')) return
    await fetch(`/api/sources/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  async function seedSources() {
    setSeeding(true)
    try {
      const res = await fetch('/api/sources/seed', { method: 'POST' })
      const data = await res.json()
      alert(data.message || 'Fontes carregadas.')
      onRefresh()
    } catch {
      alert('Erro ao carregar fontes padrão.')
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <h2 className="text-2xl font-bold">Fontes de Notícias</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={seedSources} disabled={seeding}>
            <Download className="w-4 h-4 mr-2" />
            {seeding ? 'Carregando...' : 'Carregar Fontes Padrão'}
          </Button>
          <Button onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4 mr-2" /> Adicionar Fonte
          </Button>
        </div>
      </div>

      {sources.length === 0 ? (
        <div className="text-center py-16 text-gray-400 border border-dashed border-gray-200">
          <p className="text-lg mb-2">Nenhuma fonte configurada.</p>
          <p className="text-sm">Clique em &quot;Carregar Fontes Padrão&quot; para adicionar as 16 fontes pré-configuradas ou adicione manualmente.</p>
        </div>
      ) : (
        <div className="border border-gray-200">
          {sources.map((source, i) => (
            <div key={source.id} className={`flex items-center justify-between p-4 ${i > 0 ? 'border-t border-gray-200' : ''}`}>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{source.name}</p>
                <p className="text-sm text-gray-500 truncate max-w-md">{source.url}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                <Badge variant={source.type === 'rss' ? 'default' : 'secondary'} className="text-xs uppercase">
                  {source.type}
                </Badge>
                <Badge variant={source.active ? 'default' : 'outline'} className="text-xs">
                  {source.active ? 'Ativa' : 'Inativa'}
                </Badge>
                <HealthBadge source={source} />
                <button onClick={() => setEditing(source)} className="p-1 hover:text-black text-gray-400 transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => deleteSource(source.id)} className="p-1 hover:text-red-600 text-gray-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <SourceForm open={adding} onClose={() => setAdding(false)} onSaved={onRefresh} />
      {editing && (
        <SourceForm source={editing} open={!!editing} onClose={() => setEditing(undefined)} onSaved={onRefresh} />
      )}
    </div>
  )
}
