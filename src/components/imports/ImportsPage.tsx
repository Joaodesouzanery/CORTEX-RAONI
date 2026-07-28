'use client'
import { useEffect, useRef, useState } from 'react'
import { Upload, FileText, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { sha256Bytes } from '@/lib/archive'
import type { ImportDocument } from '@/types'

type Progress = { filename: string; label: string }

const STATUS: Record<ImportDocument['status'], string> = {
  enviado: 'Enviado',
  processando: 'Processando',
  concluido: 'Concluído',
  revisao: 'Requer revisão',
  erro: 'Erro',
}

export default function ImportsPage() {
  const [documents, setDocuments] = useState<ImportDocument[]>([])
  const [progress, setProgress] = useState<Progress | null>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function load() {
    const res = await fetch('/api/imports')
    const data = await res.json().catch(() => [])
    setDocuments(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    load()
  }, [])

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return
    setError('')
    const storage = createClient().storage.from('source-documents')
    try {
      for (const file of Array.from(files)) {
        if (!/\.pdf$/i.test(file.name)) throw new Error(`${file.name}: apenas PDF é aceito.`)
        setProgress({ filename: file.name, label: 'Calculando impressão digital…' })
        const bytes = await file.arrayBuffer()
        const sha256 = await sha256Bytes(bytes)
        setProgress({ filename: file.name, label: 'Preparando upload privado…' })
        const initRes = await fetch('/api/imports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, size: file.size, sha256 }),
        })
        const init = await initRes.json().catch(() => null)
        if (!initRes.ok) throw new Error(init?.error || `Falha ao preparar ${file.name}`)
        if (init.duplicate) continue

        setProgress({ filename: file.name, label: 'Enviando PDF…' })
        const { error: uploadError } = await storage.uploadToSignedUrl(init.upload.path, init.upload.token, file, {
          contentType: 'application/pdf',
        })
        if (uploadError) throw uploadError

        setProgress({ filename: file.name, label: 'Extraindo matérias…' })
        const processRes = await fetch(`/api/imports/${init.document.id}/process`, { method: 'POST' })
        const processed = await processRes.json().catch(() => null)
        if (!processRes.ok) throw new Error(processed?.error || `Falha ao processar ${file.name}`)
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha na importação.')
      await load()
    } finally {
      setProgress(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-light tracking-tight">Importações</h1>
          <p className="text-sm text-gray-500 mt-1">
            PDFs licenciados, cadernos de clipping e matérias impressas. Arquivos repetidos não são reimportados.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => inputRef.current?.click()} disabled={!!progress}>
            <Upload className="w-4 h-4 mr-2" />
            Importar PDFs
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="hidden"
            onChange={(e) => uploadFiles(e.target.files)}
          />
        </div>
      </div>

      {progress && (
        <div className="border border-blue-200 bg-blue-50 px-4 py-3 text-sm mb-4">
          <strong>{progress.filename}</strong> — {progress.label}
        </div>
      )}
      {error && <div className="border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm mb-4">{error}</div>}

      <div className="border border-gray-200 divide-y divide-gray-100">
        {documents.length === 0 ? (
          <p className="text-center text-gray-400 py-16">Nenhum documento importado.</p>
        ) : (
          documents.map((doc) => (
            <div key={doc.id} className="p-4 flex items-start gap-3">
              <FileText className="w-5 h-5 mt-0.5 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{doc.filename}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {doc.document_type} · {doc.page_count ?? '—'} páginas · {doc.imported_article_count} matérias
                </p>
                {doc.error && <p className="text-xs text-red-600 mt-1">{doc.error}</p>}
                {Array.isArray(doc.metadata?.warnings) &&
                  (doc.metadata.warnings as string[]).map((w, i) => (
                    <p key={i} className="text-xs text-amber-700 mt-1">
                      {w}
                    </p>
                  ))}
              </div>
              <span
                className={`text-xs px-2 py-1 border ${
                  doc.status === 'concluido'
                    ? 'border-green-200 text-green-700'
                    : doc.status === 'erro'
                      ? 'border-red-200 text-red-700'
                      : 'border-amber-200 text-amber-700'
                }`}
              >
                {STATUS[doc.status]}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
