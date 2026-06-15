'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import SourceForm from './SourceForm'
import type { Source } from '@/types'
import { Pencil, Trash2, Plus } from 'lucide-react'

interface Props {
  sources: Source[]
  onRefresh: () => void
}

export default function SourceTable({ sources, onRefresh }: Props) {
  const [editing, setEditing] = useState<Source | undefined>()
  const [adding, setAdding] = useState(false)

  async function deleteSource(id: string) {
    if (!confirm('Tem certeza?')) return
    await fetch(`/api/sources/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Fontes de Notícias</h2>
        <Button onClick={() => setAdding(true)}>
          <Plus className="w-4 h-4 mr-2" /> Adicionar Fonte
        </Button>
      </div>

      {sources.length === 0 ? (
        <p className="text-gray-500 text-center py-12">Nenhuma fonte configurada.</p>
      ) : (
        <div className="border border-gray-200">
          {sources.map((source, i) => (
            <div key={source.id} className={`flex items-center justify-between p-4 ${i > 0 ? 'border-t border-gray-200' : ''}`}>
              <div>
                <p className="font-medium">{source.name}</p>
                <p className="text-sm text-gray-500 truncate max-w-md">{source.url}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={source.type === 'rss' ? 'default' : 'secondary'} className="text-xs uppercase">
                  {source.type}
                </Badge>
                <Badge variant={source.active ? 'default' : 'outline'} className="text-xs">
                  {source.active ? 'Ativa' : 'Inativa'}
                </Badge>
                <button onClick={() => setEditing(source)} className="p-1 hover:text-black text-gray-400">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => deleteSource(source.id)} className="p-1 hover:text-red-600 text-gray-400">
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
