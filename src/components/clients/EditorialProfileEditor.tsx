'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type {
  Client,
  ClientEditorialProfile,
  ClientFeedback,
  CaptureCoverageSummary,
  DirectiveCategory,
  DirectiveSeverity,
  EditorialDirective,
  EditorialMemoryItem,
  ReportPosture,
} from '@/types'

type TopicTemplate = {
  id?: string
  title: string
  rationale: string
  inclusion_terms: string[]
  exclusion_terms: string[]
  required: boolean
}

export default function EditorialProfileEditor({ client, onClose }: { client: Client; onClose: () => void }) {
  const [profile, setProfile] = useState<Partial<ClientEditorialProfile>>({
    permanent_axes: [],
    inclusion_guidelines: '',
    exclusion_guidelines: '',
    style_guidelines: '',
    default_posture: 'consultivo_cauteloso',
  })
  const [topics, setTopics] = useState<TopicTemplate[]>([])
  const [memory, setMemory] = useState<EditorialMemoryItem[]>([])
  const [directives, setDirectives] = useState<EditorialDirective[]>([])
  const [feedback, setFeedback] = useState<ClientFeedback[]>([])
  const [coverage, setCoverage] = useState<CaptureCoverageSummary | null>(null)
  const [directive, setDirective] = useState<{
    category: DirectiveCategory
    severity: DirectiveSeverity
    title: string
    instruction: string
  }>({ category: 'narrativa', severity: 'prefer', title: '', instruction: '' })
  const [example, setExample] = useState({ kind: 'evidencia', topic: '', reason: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const [response, directiveResponse, coverageResponse] = await Promise.all([
      fetch(`/api/clients/${client.id}/editorial-profile`),
      fetch(`/api/clients/${client.id}/editorial-directives`),
      fetch(`/api/clients/${client.id}/capture-coverage`),
    ])
    const [data, directiveData] = await Promise.all([
      response.json().catch(() => null),
      directiveResponse.json().catch(() => null),
    ])
    if (!response.ok) throw new Error(data?.error || 'Falha ao carregar a memória editorial.')
    if (!directiveResponse.ok) throw new Error(directiveData?.error || 'Falha ao carregar as diretivas.')
    setProfile(data.profile || {})
    setTopics(data.topics || [])
    setMemory(data.memory || [])
    setDirectives(directiveData.directives || [])
    setFeedback(directiveData.feedback || [])
    if (coverageResponse.ok) setCoverage(await coverageResponse.json())
  }

  useEffect(() => {
    load().catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar.'))
    // `client.id` identifica integralmente o editor aberto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id])

  function changeTopic(index: number, patch: Partial<TopicTemplate>) {
    setTopics((current) => current.map((topic, itemIndex) => itemIndex === index ? { ...topic, ...patch } : topic))
  }

  async function save() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/clients/${client.id}/editorial-profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permanent_axes: profile.permanent_axes || [],
          inclusion_guidelines: profile.inclusion_guidelines || '',
          exclusion_guidelines: profile.exclusion_guidelines || '',
          style_guidelines: profile.style_guidelines || '',
          default_posture: profile.default_posture || 'consultivo_cauteloso',
          active: true,
          topics,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'Falha ao salvar o perfil.')
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Falha ao salvar.')
    } finally {
      setBusy(false)
    }
  }

  async function addExample() {
    if (!example.reason.trim()) return
    setBusy(true)
    try {
      const response = await fetch(`/api/clients/${client.id}/editorial-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...example, snapshot: { description: example.reason } }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'Falha ao manter o exemplo.')
      setExample({ kind: 'evidencia', topic: '', reason: '' })
      await load()
    } catch (exampleError) {
      setError(exampleError instanceof Error ? exampleError.message : 'Falha ao manter o exemplo.')
    } finally {
      setBusy(false)
    }
  }

  async function removeExample(id: string) {
    await fetch(`/api/clients/${client.id}/editorial-profile/memory/${id}`, { method: 'DELETE' })
    setMemory((current) => current.filter((item) => item.id !== id))
  }

  async function addDirective() {
    if (!directive.title.trim() || !directive.instruction.trim()) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/clients/${client.id}/editorial-directives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...directive, scope: 'permanent', source: 'operador' }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'Falha ao salvar a diretiva.')
      setDirective({ category: 'narrativa', severity: 'prefer', title: '', instruction: '' })
      await load()
    } catch (directiveError) {
      setError(directiveError instanceof Error ? directiveError.message : 'Falha ao salvar a diretiva.')
    } finally {
      setBusy(false)
    }
  }

  async function removeDirective(id: string) {
    const response = await fetch(`/api/clients/${client.id}/editorial-directives`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directive_id: id }),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => null)
      setError(data?.error || 'Falha ao desativar a diretiva.')
      return
    }
    setDirectives((current) => current.filter((item) => item.id !== id))
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4 md:p-10">
      <div className="mx-auto max-w-5xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-light">Memória editorial · {client.name}</h2>
            <p className="mt-1 text-xs text-gray-500">Somente decisões humanas, relatórios aprovados e exemplos mantidos aqui alimentam a memória.</p>
          </div>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </div>
        {error && <p className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {coverage && <div className="mt-5 grid grid-cols-2 gap-2 border border-gray-200 p-3 text-sm md:grid-cols-6"><div><p className="text-xs text-gray-500">Monitoradas</p><p className="text-xl">{coverage.monitored}</p></div><div><p className="text-xs text-gray-500">Evidências</p><p className="text-xl">{coverage.qualified}</p></div><div><p className="text-xs text-gray-500">Menções diretas</p><p className="text-xl">{coverage.direct_mentions}</p></div><div><p className="text-xs text-gray-500">Texto integral</p><p className="text-xl">{coverage.integral}</p></div><div><p className="text-xs text-gray-500">Tópicos pendentes</p><p className="text-xl">{coverage.pending_topics}</p></div><div><p className="text-xs text-gray-500">Alertas de fontes</p><p className="text-xl">{coverage.source_alerts}</p></div></div>}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <Label>Eixos permanentes (um por linha)</Label>
            <Textarea rows={5} value={(profile.permanent_axes || []).join('\n')} onChange={(event) => setProfile((current) => ({ ...current, permanent_axes: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) }))} />
          </div>
          <div>
            <Label>Postura padrão</Label>
            <select className="h-10 w-full border border-gray-300 bg-white px-3 text-sm" value={profile.default_posture || 'consultivo_cauteloso'} onChange={(event) => setProfile((current) => ({ ...current, default_posture: event.target.value as ReportPosture }))}>
              <option value="consultivo_cauteloso">Consultivo cauteloso</option>
              <option value="executivo_assertivo">Executivo assertivo</option>
              <option value="somente_descritivo">Somente descritivo</option>
            </select>
          </div>
          <div><Label>Critérios de inclusão</Label><Textarea rows={6} value={profile.inclusion_guidelines || ''} onChange={(event) => setProfile((current) => ({ ...current, inclusion_guidelines: event.target.value }))} /></div>
          <div><Label>Critérios de exclusão</Label><Textarea rows={6} value={profile.exclusion_guidelines || ''} onChange={(event) => setProfile((current) => ({ ...current, exclusion_guidelines: event.target.value }))} /></div>
          <div className="md:col-span-2"><Label>Postura e linguagem</Label><Textarea rows={4} value={profile.style_guidelines || ''} onChange={(event) => setProfile((current) => ({ ...current, style_guidelines: event.target.value }))} /></div>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Tópicos permanentes da agenda</h3>
            <Button size="sm" variant="outline" onClick={() => setTopics((current) => [...current, { title: '', rationale: '', inclusion_terms: [], exclusion_terms: [], required: true }])}>Adicionar tópico</Button>
          </div>
          <div className="mt-3 space-y-3">
            {topics.map((topic, index) => (
              <div key={topic.id || index} className="grid gap-2 border border-gray-200 p-3 md:grid-cols-2">
                <Input placeholder="Título" value={topic.title} onChange={(event) => changeTopic(index, { title: event.target.value })} />
                <Input placeholder="Justificativa" value={topic.rationale} onChange={(event) => changeTopic(index, { rationale: event.target.value })} />
                <Input placeholder="Inclusão, separada por vírgula" value={topic.inclusion_terms.join(', ')} onChange={(event) => changeTopic(index, { inclusion_terms: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} />
                <div className="flex gap-2"><Input placeholder="Exclusão, separada por vírgula" value={topic.exclusion_terms.join(', ')} onChange={(event) => changeTopic(index, { exclusion_terms: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} /><Button size="sm" variant="outline" onClick={() => setTopics((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remover</Button></div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <h3 className="font-semibold">Regras estruturadas por camada</h3>
          <p className="mt-1 text-xs text-gray-500">Captação e qualificação controlam a base; narrativa, terminologia, métricas, estrutura e design controlam somente o produto final.</p>
          <div className="mt-3 grid gap-2 md:grid-cols-[11rem_9rem_14rem_1fr_auto]">
            <select className="h-10 border border-gray-300 bg-white px-2 text-sm" value={directive.category} onChange={(event) => setDirective((current) => ({ ...current, category: event.target.value as DirectiveCategory }))}>
              <option value="captacao">Captação</option><option value="qualificacao">Qualificação</option><option value="narrativa">Narrativa</option><option value="terminologia">Terminologia</option><option value="metrica">Métricas</option><option value="estrutura">Estrutura</option><option value="visual">Design</option>
            </select>
            <select className="h-10 border border-gray-300 bg-white px-2 text-sm" value={directive.severity} onChange={(event) => setDirective((current) => ({ ...current, severity: event.target.value as DirectiveSeverity }))}>
              <option value="prefer">Preferir</option><option value="warn">Alertar</option><option value="block">Bloquear</option>
            </select>
            <Input placeholder="Nome da regra" value={directive.title} onChange={(event) => setDirective((current) => ({ ...current, title: event.target.value }))} />
            <Input placeholder="Instrução objetiva" value={directive.instruction} onChange={(event) => setDirective((current) => ({ ...current, instruction: event.target.value }))} />
            <Button onClick={addDirective} disabled={busy || !directive.title.trim() || !directive.instruction.trim()}>Adicionar</Button>
          </div>
          <div className="mt-3 max-h-80 divide-y overflow-y-auto border border-gray-200">
            {directives.filter((item) => item.active).map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 p-3 text-sm">
                <div><p className="font-medium">{item.category} · {item.severity} · {item.title}</p><p className="mt-1 text-xs text-gray-600">{item.instruction}</p><p className="mt-1 text-[11px] text-gray-400">{item.scope === 'permanent' ? 'Permanente' : item.period_month} · versão {item.version} · {item.source}</p></div>
                <Button size="sm" variant="outline" onClick={() => removeDirective(item.id)}>Desativar</Button>
              </div>
            ))}
            {!directives.some((item) => item.active) && <p className="p-3 text-sm text-gray-500">Nenhuma regra estruturada.</p>}
          </div>
        </div>

        <div className="mt-8">
          <h3 className="font-semibold">Exemplos mantidos explicitamente</h3>
          <div className="mt-3 grid gap-2 md:grid-cols-[10rem_12rem_1fr_auto]">
            <select className="h-10 border border-gray-300 bg-white px-2 text-sm" value={example.kind} onChange={(event) => setExample((current) => ({ ...current, kind: event.target.value }))}><option value="evidencia">Evidência</option><option value="contexto">Contexto</option><option value="ruido">Ruído</option><option value="estilo">Estilo</option></select>
            <Input placeholder="Tema" value={example.topic} onChange={(event) => setExample((current) => ({ ...current, topic: event.target.value }))} />
            <Input placeholder="Por que este exemplo deve ser lembrado?" value={example.reason} onChange={(event) => setExample((current) => ({ ...current, reason: event.target.value }))} />
            <Button onClick={addExample} disabled={busy || !example.reason.trim()}>Manter</Button>
          </div>
          <div className="mt-3 max-h-64 divide-y overflow-y-auto border border-gray-200">
            {memory.slice(0, 30).map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 p-3 text-sm">
                <div><p className="font-medium">{item.kind} · {item.topic || 'sem tema'} · {item.source}</p><p className="mt-1 text-xs text-gray-500">{item.reason}</p></div>
                {item.source === 'curado' && <Button size="sm" variant="outline" onClick={() => removeExample(item.id)}>Remover</Button>}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <h3 className="font-semibold">Histórico de feedback</h3>
          <div className="mt-3 max-h-52 divide-y overflow-y-auto border border-gray-200">
            {feedback.map((item) => <div key={item.id} className="p-3 text-sm"><p className="font-medium">{item.category} · {item.status}{item.promoted ? ' · regra permanente' : ''}</p><p className="mt-1 text-xs text-gray-600">{item.feedback}</p></div>)}
            {!feedback.length && <p className="p-3 text-sm text-gray-500">Nenhum feedback registrado.</p>}
          </div>
        </div>

        <div className="mt-6 flex justify-end"><Button onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Salvar nova versão do perfil'}</Button></div>
      </div>
    </div>
  )
}
