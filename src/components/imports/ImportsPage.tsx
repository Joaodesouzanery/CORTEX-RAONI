'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Upload, FileText, RefreshCw, ScanText, CheckCircle2, AlertTriangle, Link2, MessageSquareText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { sha256Bytes } from '@/lib/archive'
import type { Client, ImportBatch, ImportDocument, ImportIntent } from '@/types'

type FileProgress = {
  filename: string
  label: string
  status: 'waiting' | 'working' | 'complete' | 'review' | 'error'
  error?: string
}

const STATUS: Record<ImportDocument['status'], string> = {
  enviado: 'Enviado',
  processando: 'Processando',
  concluido: 'Concluído',
  revisao: 'Requer revisão',
  erro: 'Erro',
}

function currentPeriod() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function ImportsPage() {
  const [documents, setDocuments] = useState<ImportDocument[]>([])
  const [batches, setBatches] = useState<ImportBatch[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [clientIds, setClientIds] = useState<string[]>([])
  const [period, setPeriod] = useState(currentPeriod())
  const [intent, setIntent] = useState<ImportIntent>('noticias')
  const [progress, setProgress] = useState<FileProgress[]>([])
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [urls, setUrls] = useState('')
  const [messageText, setMessageText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function load() {
    const [documentsRes, batchesRes, clientsRes] = await Promise.all([
      fetch('/api/imports'),
      fetch('/api/import-batches'),
      fetch('/api/clients?active=true'),
    ])
    const [documentsData, batchesData, clientsData] = await Promise.all([
      documentsRes.json().catch(() => []),
      batchesRes.json().catch(() => []),
      clientsRes.json().catch(() => []),
    ])
    setDocuments(Array.isArray(documentsData) ? documentsData : [])
    setBatches(Array.isArray(batchesData) ? batchesData : [])
    setClients(Array.isArray(clientsData) ? clientsData : [])
    if (!clientIds.length && Array.isArray(clientsData) && clientsData.length) setClientIds([clientsData[0].id])
  }

  useEffect(() => {
    load()
    // Initial bootstrap only; subsequent changes are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function updateFile(filename: string, patch: Partial<FileProgress>) {
    setProgress((current) => current.map((item) => (item.filename === filename ? { ...item, ...patch } : item)))
  }

  async function processFile(file: File, batchId: string) {
    let documentId: string | null = null
    let attemptedProcessing = false
    try {
      if (!/\.(pdf|html?)$/i.test(file.name)) throw new Error('Envie um PDF ou HTML.')
      updateFile(file.name, { status: 'working', label: 'Calculando SHA-256…' })
      const bytes = await file.arrayBuffer()
      const sha256 = await sha256Bytes(bytes)
      updateFile(file.name, { label: 'Preparando upload privado…' })
      const initRes = await fetch('/api/imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, size: file.size, sha256, batch_id: batchId }),
      })
      const init = await initRes.json().catch(() => null)
      if (!initRes.ok) throw new Error(init?.error || 'Falha ao preparar o arquivo.')
      documentId = init.document.id

      if (!init.duplicate) {
        updateFile(file.name, { label: 'Enviando para o acervo privado…' })
        const storage = createClient().storage.from('source-documents')
        const { error: uploadError } = await storage.uploadToSignedUrl(
          init.upload.path,
          init.upload.token,
          file,
          {
            contentType: /\.html?$/i.test(file.name) ? 'text/html' : 'application/pdf',
            upsert: Boolean(init.upload.upsert),
          }
        )
        if (uploadError) throw uploadError
      }

      if (init.already_processed) {
        updateFile(file.name, {
          status: 'complete',
          label: 'Documento já processado neste lote.',
        })
        return
      }

      updateFile(file.name, {
        label: init.duplicate ? 'Reutilizando documento sem duplicar…' : 'Extraindo e classificando matérias…',
      })
      const processRes = await fetch(`/api/imports/${init.document.id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batchId }),
      })
      attemptedProcessing = true
      const processed = await processRes.json().catch(() => null)
      if (!processRes.ok) throw new Error(processed?.error || 'Falha ao processar o PDF.')
      const review = processed?.document?.status === 'revisao' || processed?.ocr_required
      updateFile(file.name, {
        status: review ? 'review' : 'complete',
        label: processed?.reference
          ? review
            ? 'Referência preservada; OCR disponível sob demanda.'
            : 'Relatório salvo como referência (nenhuma notícia criada).'
          : `${processed?.articles || 0} matéria(s) vinculada(s) e classificada(s).`,
      })
    } catch (fileError) {
      const message = fileError instanceof Error ? fileError.message : 'Falha na importação.'
      if (documentId && !attemptedProcessing) {
        await fetch(`/api/imports/${documentId}/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batch_id: batchId }),
        }).catch(() => null)
      }
      updateFile(file.name, { status: 'error', label: 'Falha', error: message })
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length || !clientIds.length || !period) return
    const selected = Array.from(files)
    setError('')
    setRunning(true)
    setProgress(selected.map((file) => ({ filename: file.name, label: 'Na fila', status: 'waiting' })))
    try {
      const batchRes = await fetch('/api/import-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_ids: clientIds, period, intent, total_files: selected.length }),
      })
      const batch = await batchRes.json().catch(() => null)
      if (!batchRes.ok) throw new Error(batch?.error || 'Falha ao criar o lote.')

      let nextIndex = 0
      const worker = async () => {
        while (nextIndex < selected.length) {
          const file = selected[nextIndex++]
          await processFile(file, batch.id)
        }
      }
      await Promise.all([worker(), worker()])
      await load()
    } catch (batchError) {
      setError(batchError instanceof Error ? batchError.message : 'Falha ao criar o lote.')
    } finally {
      setRunning(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function submitManualInputs() {
    if (!clientIds.length || !period || intent !== 'noticias') return
    const uniqueUrls = Array.from(
      new Set(
        urls
          .split(/\s+/)
          .map((value) => value.trim())
          .filter((value) => /^https?:\/\//i.test(value))
      )
    )
    const items = [
      ...uniqueUrls.map((value) => ({ kind: 'url' as const, value })),
      ...(messageText.trim()
        ? [{ kind: 'text' as const, value: messageText.trim(), label: 'Notícias recebidas' }]
        : []),
    ]
    if (!items.length) {
      setError('Cole ao menos um link ou uma mensagem.')
      return
    }
    setRunning(true)
    setError('')
    try {
      const batchRes = await fetch('/api/import-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_ids: clientIds, period, intent: 'noticias', total_files: items.length }),
      })
      const batch = await batchRes.json().catch(() => null)
      if (!batchRes.ok) throw new Error(batch?.error || 'Falha ao criar o lote.')
      const processRes = await fetch(`/api/import-batches/${batch.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const result = await processRes.json().catch(() => null)
      if (!processRes.ok) throw new Error(result?.error || 'Falha ao processar as entradas.')
      const failures = Array.isArray(result?.results)
        ? result.results.filter((row: { status?: string }) => row.status === 'error')
        : []
      if (failures.length) {
        setError(`${failures.length} entrada(s) exigem nova tentativa. As demais foram preservadas.`)
      } else {
        setUrls('')
        setMessageText('')
      }
      await load()
    } catch (manualError) {
      setError(manualError instanceof Error ? manualError.message : 'Falha ao adicionar notícias.')
    } finally {
      setRunning(false)
    }
  }

  async function runOcr(documentId: string) {
    setError('')
    setDocuments((rows) => rows.map((row) => (row.id === documentId ? { ...row, ocr_status: 'processing' } : row)))
    const res = await fetch(`/api/imports/${documentId}/ocr`, { method: 'POST' })
    const data = await res.json().catch(() => null)
    if (!res.ok) setError(data?.error || 'Falha no OCR.')
    if (res.ok && Array.isArray(data?.reprocess_batch_ids)) {
      for (const batchId of data.reprocess_batch_ids) {
        await fetch(`/api/imports/${documentId}/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batch_id: batchId }),
        })
      }
    }
    await load()
  }

  const activeClient = clients.find((client) => client.id === clientIds[0])

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-4xl font-light tracking-tight">Importações em lote</h1>
          <p className="text-sm text-gray-500 mt-1">
            Escolha todos os clientes e a competência uma vez. Arquivos, links e mensagens entram no mesmo acervo.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <div className="border border-gray-200 p-4 mb-6">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <Label>Clientes do lote</Label>
            <div className="mt-1 border border-gray-300 p-2 space-y-1 max-h-36 overflow-y-auto">
              {clients.map((client) => (
                <label key={client.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clientIds.includes(client.id)}
                    onChange={(event) =>
                      setClientIds((current) =>
                        event.target.checked
                          ? [...current, client.id]
                          : current.filter((id) => id !== client.id)
                      )
                    }
                    disabled={running}
                  />
                  {client.name}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="import-period">Mês editorial</Label>
            <Input
              id="import-period"
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="mt-1"
              disabled={running}
            />
          </div>
          <div>
            <Label htmlFor="import-intent">Finalidade</Label>
            <select
              id="import-intent"
              value={intent}
              onChange={(event) => setIntent(event.target.value as ImportIntent)}
              className="mt-1 h-10 w-full border border-gray-300 bg-white px-3 text-sm"
              disabled={running}
            >
              <option value="noticias">Notícias para acervo, clipping e dossiê</option>
              <option value="relatorio_referencia">Relatório anterior — somente referência</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-4 flex-wrap">
          <Button onClick={() => inputRef.current?.click()} disabled={running || !clientIds.length || !period}>
            <Upload className="w-4 h-4 mr-2" />
            Selecionar PDFs ou HTMLs
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,text/html,.pdf,.html,.htm"
            multiple
            className="hidden"
            onChange={(event) => uploadFiles(event.target.files)}
          />
          {activeClient && (
            <>
              <Link href={`/news?client=${activeClient.id}&period=30`}>
                <Button variant="outline">Ver notícias do cliente</Button>
              </Link>
              <Link href={`/reports/prepare?client=${activeClient.id}&period=${period}`}>
                <Button variant="outline">Abrir preparação mensal</Button>
              </Link>
            </>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-3">
          O mês é uma associação editorial e não altera a data real de publicação. Arquivos repetidos reutilizam o
          original e acrescentam a nova proveniência.
        </p>
      </div>

      <div className="border border-gray-200 p-4 mb-6">
        <h2 className="text-lg font-semibold mb-1">Adicionar notícias recebidas</h2>
        <p className="text-xs text-gray-500 mb-4">
          Cada link é processado separadamente. Textos de e-mail, WhatsApp ou chat podem conter várias matérias.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="manual-urls">Links — um por linha</Label>
            <Textarea
              id="manual-urls"
              value={urls}
              onChange={(event) => setUrls(event.target.value)}
              rows={7}
              placeholder={'https://veiculo.com.br/materia-1\nhttps://veiculo.com.br/materia-2'}
              disabled={running || intent !== 'noticias'}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="manual-message">Texto recebido</Label>
            <Textarea
              id="manual-message"
              value={messageText}
              onChange={(event) => setMessageText(event.target.value)}
              rows={7}
              placeholder="Cole aqui uma ou várias notícias. Use uma linha com --- se quiser indicar uma separação."
              disabled={running || intent !== 'noticias'}
              className="mt-1"
            />
          </div>
        </div>
        <Button
          className="mt-3"
          onClick={submitManualInputs}
          disabled={running || !clientIds.length || !period || intent !== 'noticias'}
        >
          {urls.trim() ? <Link2 className="w-4 h-4 mr-2" /> : <MessageSquareText className="w-4 h-4 mr-2" />}
          Salvar e qualificar notícias
        </Button>
      </div>

      {progress.length > 0 && (
        <div className="border border-gray-200 divide-y mb-6">
          {progress.map((item) => (
            <div key={item.filename} className="px-4 py-3 flex gap-3 items-start text-sm">
              {item.status === 'complete' ? (
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
              ) : item.status === 'error' || item.status === 'review' ? (
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
              ) : (
                <RefreshCw className={`w-4 h-4 mt-0.5 ${item.status === 'working' ? 'animate-spin' : ''}`} />
              )}
              <div>
                <p className="font-medium">{item.filename}</p>
                <p className="text-gray-500">{item.label}</p>
                {item.error && <p className="text-red-600">{item.error}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
      {error && <div className="border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm mb-4">{error}</div>}

      <h2 className="text-xl font-semibold mb-3">Lotes recentes</h2>
      <div className="border border-gray-200 divide-y mb-8">
        {batches.length === 0 ? (
          <p className="text-center text-gray-400 py-10">Nenhum lote criado.</p>
        ) : (
          batches.map((batch) => (
            <div key={batch.id} className="p-4 flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">
                  {(batch.selected_clients?.map((client) => client.name).join(', ') || batch.clients?.name || 'Cliente')}
                  {' · '}{batch.period_month.slice(0, 7)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {batch.intent === 'noticias' ? 'Notícias' : 'Relatório de referência'} · {batch.completed_files} concluído(s)
                  · {batch.review_files} em revisão · {batch.failed_files} falha(s) · {batch.article_count} matéria(s)
                </p>
              </div>
              <span className="text-xs uppercase tracking-wider border px-2 py-1">{batch.status}</span>
            </div>
          ))
        )}
      </div>

      <h2 className="text-xl font-semibold mb-3">Documentos preservados</h2>
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
                  (doc.metadata.warnings as string[]).map((warning, index) => (
                    <p key={index} className="text-xs text-amber-700 mt-1">{warning}</p>
                  ))}
              </div>
              {(doc.status === 'revisao' || doc.ocr_status === 'pending' || doc.ocr_status === 'error') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runOcr(doc.id)}
                  disabled={doc.ocr_status === 'processing'}
                >
                  <ScanText className="w-4 h-4 mr-2" />
                  {doc.ocr_status === 'processing' ? 'Executando OCR…' : 'OCR por IA'}
                </Button>
              )}
              <span className="text-xs px-2 py-1 border">{STATUS[doc.status]}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
