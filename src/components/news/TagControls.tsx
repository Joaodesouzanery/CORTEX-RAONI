'use client'
import type { ArticleTag, Tom, Relevancia } from '@/types'
import { cn } from '@/lib/utils'

// One-click reputational tagging of an article for the active client. Purely
// deterministic curation — it feeds the panorama counts, no AI. Clicking the
// active value again clears it (sends null).

export type TagPatch = Partial<Pick<ArticleTag, 'tom' | 'relevancia' | 'cita_cliente'>>

interface Props {
  tag?: ArticleTag | null
  onChange: (patch: TagPatch) => void
  className?: string
}

const TOM_OPTS: { v: Tom; label: string; on: string }[] = [
  { v: 'positivo', label: 'Positivo', on: 'bg-emerald-600 border-emerald-600 text-white' },
  { v: 'neutro', label: 'Neutro', on: 'bg-gray-400 border-gray-400 text-white' },
  { v: 'negativo', label: 'Negativo', on: 'bg-red-600 border-red-600 text-white' },
  { v: 'critico', label: 'Crítico', on: 'bg-orange-500 border-orange-500 text-white' },
]

const REL_OPTS: { v: Relevancia; label: string }[] = [
  { v: 'alta', label: 'Alta' },
  { v: 'media', label: 'Média' },
  { v: 'baixa', label: 'Baixa' },
]

const pill =
  'px-1.5 py-0.5 text-[10px] uppercase tracking-wider border transition-colors cursor-pointer select-none'
const off = 'border-gray-200 text-gray-500 hover:border-gray-400'

export default function TagControls({ tag, onChange, className }: Props) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', className)}>
      {/* Tom */}
      <div className="flex items-center gap-1">
        <span className="text-[9px] uppercase tracking-widest text-gray-400 mr-0.5">Tom</span>
        {TOM_OPTS.map((o) => {
          const active = tag?.tom === o.v
          return (
            <button
              key={o.v}
              type="button"
              onClick={() => onChange({ tom: active ? null : o.v })}
              className={cn(pill, active ? o.on : off)}
              title={`Tom: ${o.label}`}
            >
              {o.label}
            </button>
          )
        })}
      </div>

      {/* Relevância */}
      <div className="flex items-center gap-1">
        <span className="text-[9px] uppercase tracking-widest text-gray-400 mr-0.5">Relev.</span>
        {REL_OPTS.map((o) => {
          const active = tag?.relevancia === o.v
          return (
            <button
              key={o.v}
              type="button"
              onClick={() => onChange({ relevancia: active ? null : o.v })}
              className={cn(pill, active ? 'bg-black border-black text-white' : off)}
              title={`Relevância: ${o.label}`}
            >
              {o.label}
            </button>
          )
        })}
      </div>

      {/* Cita o cliente diretamente vs. tema sob outro protagonista */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange({ cita_cliente: tag?.cita_cliente === true ? null : true })}
          className={cn(pill, tag?.cita_cliente === true ? 'bg-black border-black text-white' : off)}
          title="Cita o cliente diretamente"
        >
          Cita cliente
        </button>
        <button
          type="button"
          onClick={() => onChange({ cita_cliente: tag?.cita_cliente === false ? null : false })}
          className={cn(pill, tag?.cita_cliente === false ? 'bg-gray-700 border-gray-700 text-white' : off)}
          title="Tema do setor sob outro protagonista"
        >
          Sob outro
        </button>
      </div>
    </div>
  )
}
