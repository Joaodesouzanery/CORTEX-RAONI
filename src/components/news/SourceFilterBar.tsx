'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import SourceHealthBadge, { isStaleSource } from '@/components/sources/SourceHealthBadge'
import type { Source, SourceCategoria } from '@/types'

/**
 * Filtro de fonte como combobox com busca.
 *
 * Substitui uma barra que renderizava UM CHIP POR FONTE, sem teto: com ~50-80
 * fontes e nomes de 60 caracteres ("Google News — SINDINFOR/Vacatio dos
 * Decretos 12.975 e 12.976"), a parede de chips dominava a página inteira.
 *
 * Busca é a única interação que escala para 25+ feeds do Google News cujos
 * nomes só diferem no SUFIXO — um `select` nativo trunca exatamente a parte
 * que distingue um do outro.
 *
 * O componente recebia `string[]` e perdia categoria, prioridade e saúde no
 * caminho; agora recebe `Source[]` e agrupa com o que sempre esteve lá.
 */
type ClientLink = { priority: number; is_thematic: boolean }

interface Props {
  sources: Source[]
  activeSourceId: string | null
  onChange: (sourceId: string | null) => void
  clientLinks?: Map<string, ClientLink> | null
}

const CATEGORIA_LABEL: Record<SourceCategoria, string> = {
  imprensa: 'Imprensa',
  institucional: 'Institucional',
  agente: 'Agente',
}

function Item({
  source,
  activeSourceId,
  onSelect,
}: {
  source: Source
  activeSourceId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <button
      onClick={() => onSelect(source.id)}
      className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-xs hover:bg-gray-50 ${
        source.id === activeSourceId ? 'bg-gray-100 font-semibold' : ''
      } ${isStaleSource(source) ? 'text-gray-400' : ''}`}
    >
      <span className="truncate">{source.name}</span>
      <span className="flex-shrink-0">
        <SourceHealthBadge source={source} />
      </span>
    </button>
  )
}

function Grupo({
  titulo,
  itens,
  activeSourceId,
  onSelect,
}: {
  titulo: string
  itens: Source[]
  activeSourceId: string | null
  onSelect: (id: string) => void
}) {
  if (!itens.length) return null
  return (
    <div className="border-t border-gray-100 first:border-t-0">
      <p className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-widest text-gray-400">{titulo}</p>
      {itens.map((source) => (
        <Item key={source.id} source={source} activeSourceId={activeSourceId} onSelect={onSelect} />
      ))}
    </div>
  )
}

export default function SourceFilterBar({ sources, activeSourceId, onChange, clientLinks }: Props) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onEsc = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const active = sources.filter((source) => source.active)

  // Rótulo lido da lista COMPLETA, não da filtrada: se a fonte selecionada for
  // desativada, o botão precisa dizer isso em vez de mentir "Todas" enquanto a
  // consulta ainda filtra por ela.
  const activeLabel = activeSourceId
    ? sources.find((source) => source.id === activeSourceId)?.name ?? 'Fonte removida'
    : 'Todas'

  const grupos = useMemo(() => {
    const busca = term.trim().toLowerCase()
    const visiveis = busca ? active.filter((s) => s.name.toLowerCase().includes(busca)) : active
    const porPrioridade = (a: Source, b: Source) =>
      (b.priority ?? 50) - (a.priority ?? 50) || a.name.localeCompare(b.name, 'pt-BR')

    const doCliente = clientLinks
      ? visiveis
          .filter((s) => clientLinks.has(s.id))
          .sort(
            (a, b) =>
              (clientLinks.get(b.id)!.priority ?? 50) - (clientLinks.get(a.id)!.priority ?? 50) ||
              a.name.localeCompare(b.name, 'pt-BR')
          )
      : []
    const jaListadas = new Set(doCliente.map((s) => s.id))
    const resto = visiveis.filter((s) => !jaListadas.has(s.id))

    const saudaveis = resto.filter((s) => !isStaleSource(s))
    const paradas = resto.filter(isStaleSource)

    const porCategoria = (['imprensa', 'institucional', 'agente'] as SourceCategoria[])
      .map((categoria) => ({
        titulo: CATEGORIA_LABEL[categoria],
        itens: saudaveis.filter((s) => (s.categoria ?? 'imprensa') === categoria).sort(porPrioridade),
      }))
      .filter((grupo) => grupo.itens.length)

    return {
      // "Fontes deste cliente", não "Temáticas": is_thematic tem DEFAULT true e
      // o sync sempre escreve true, então na prática significa só "vinculada".
      doCliente: doCliente.sort(porPrioridade),
      porCategoria,
      paradas: paradas.sort(porPrioridade),
    }
  }, [active, term, clientLinks])

  const selecionar = (id: string | null) => {
    onChange(id)
    setOpen(false)
    setTerm('')
  }

  const nenhum =
    !grupos.doCliente.length && !grupos.porCategoria.length && !grupos.paradas.length

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 border border-gray-300 px-3 py-1 text-xs uppercase tracking-widest text-gray-600 hover:border-black"
      >
        <span className="max-w-64 truncate">Fonte: {activeLabel}</span>
        <ChevronDown className="h-3 w-3 flex-shrink-0" />
      </button>
      {activeSourceId && (
        <button
          onClick={() => selecionar(null)}
          aria-label="Limpar filtro de fonte"
          className="absolute -right-5 top-1.5 text-gray-400 hover:text-black"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {open && (
        <div className="absolute left-0 z-40 mt-1 max-h-96 w-[28rem] overflow-y-auto border border-gray-300 bg-white shadow-lg">
          <div className="sticky top-0 flex items-center gap-2 border-b border-gray-200 bg-white px-3 py-2">
            <Search className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
            <input
              autoFocus
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Buscar fonte…"
              className="w-full text-xs outline-none"
            />
          </div>
          <button
            onClick={() => selecionar(null)}
            className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-50 ${
              activeSourceId === null ? 'bg-gray-100 font-semibold' : ''
            }`}
          >
            Todas as fontes
          </button>
          <Grupo titulo="Fontes deste cliente" itens={grupos.doCliente} activeSourceId={activeSourceId} onSelect={selecionar} />
          {grupos.porCategoria.map((grupo) => (
            <Grupo key={grupo.titulo} titulo={grupo.titulo} itens={grupo.itens} activeSourceId={activeSourceId} onSelect={selecionar} />
          ))}
          {/* Esmaecidas, não escondidas: esconder faz o operador achar que a
              fonte não existe, quando ela existe e está quebrada. */}
          <Grupo
            titulo={`Sem coleta recente (${grupos.paradas.length})`}
            itens={grupos.paradas}
            activeSourceId={activeSourceId}
            onSelect={selecionar}
          />
          {nenhum && <p className="px-3 py-4 text-center text-xs text-gray-400">Nenhuma fonte encontrada.</p>}
        </div>
      )}
    </div>
  )
}
