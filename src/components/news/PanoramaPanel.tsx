'use client'
import { useMemo } from 'react'
import { computePanorama, pct, comparePanoramas, shareOfVoice, type Panorama, type PanoramaRow } from '@/lib/panorama'
import type { QualificationFunnel } from '@/types'

// Live, deterministic mirror of the report's "Panorama Quantitativo" (section
// 2.1). Same numbers the dossier ships to Claude — computed here from the
// active client's tags over the monitored set. No AI.

interface Props {
  rows: PanoramaRow[]
  clientName?: string | null
  prevRows?: PanoramaRow[]
  prevPartial?: boolean
  panorama?: Panorama | null
  funnel?: QualificationFunnel | null
}

// One period-over-period delta, colored by whether the change is good or bad for
// the client (more negatives = bad; more positives = good; total/cita = neutral).
function TrendChip({ label, value, pctChange, good }: { label: string; value: number; pctChange?: number | null; good: 'up' | 'down' | 'neutral' }) {
  const positive = good === 'up' ? value > 0 : good === 'down' ? value < 0 : false
  const negative = good === 'up' ? value < 0 : good === 'down' ? value > 0 : false
  const color = positive ? 'text-emerald-600' : negative ? 'text-red-600' : 'text-gray-600'
  const arrow = value > 0 ? '▲' : value < 0 ? '▼' : '–'
  return (
    <span className="text-gray-400">
      {label}{' '}
      <span className={`${color} font-medium tabular-nums`}>
        {arrow} {value > 0 ? '+' : ''}
        {value}
        {pctChange != null ? ` (${pctChange > 0 ? '+' : ''}${pctChange}%)` : ''}
      </span>
    </span>
  )
}

function Bar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs mb-1">
        <span className="uppercase tracking-wider text-gray-600">{label}</span>
        <span className="tabular-nums text-gray-900 font-medium">
          {value}
          <span className="text-gray-400 font-normal"> · {pct(value, total)}%</span>
        </span>
      </div>
      <div className="h-1.5 bg-gray-100">
        <div className={color} style={{ width: `${pct(value, total)}%`, height: '100%' }} />
      </div>
    </div>
  )
}

export default function PanoramaPanel({ rows, clientName, prevRows, prevPartial, panorama, funnel }: Props) {
  const computed = useMemo(() => computePanorama(rows), [rows])
  const p = panorama || computed
  const prev = useMemo(() => (prevRows && prevRows.length ? computePanorama(prevRows) : null), [prevRows])
  const delta = prev && prev.total > 0 ? comparePanoramas(p, prev) : null
  const sov = shareOfVoice(p)
  if (p.total === 0) return null

  // Stacked tom bar: classified segments + an untagged tail, all as % of total.
  const tomSegments = [
    { v: p.porTom.positivo, cls: 'bg-emerald-600', label: 'Positivos' },
    { v: p.porTom.neutro, cls: 'bg-gray-400', label: 'Neutros' },
    { v: p.porTom.negativo, cls: 'bg-red-600', label: 'Negativos' },
    { v: p.porTom.critico, cls: 'bg-orange-500', label: 'Críticos' },
    { v: p.semTom, cls: 'bg-gray-100', label: 'Sem tom' },
  ]
  const negTotal = p.porTom.negativo + p.porTom.critico

  return (
    <div className="border border-gray-200 bg-white p-5 mb-6">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-xs uppercase tracking-[0.2em] text-gray-500">
          Panorama do mês{clientName ? ` · ${clientName}` : ''}
        </h2>
        <span className="text-[11px] text-gray-400">
          {p.tagged} de {p.total} itens classificados
        </span>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <div>
          <div className="text-3xl font-light tabular-nums">{p.total}</div>
          <div className="text-[10px] uppercase tracking-widest text-gray-400">candidatas detectadas</div>
        </div>
        <div>
          <div className="text-3xl font-light tabular-nums">
            {p.porRelevancia.alta}
            <span className="text-base text-gray-400"> · {pct(p.porRelevancia.alta, p.total)}%</span>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-gray-400">alta relevância</div>
        </div>
        <div>
          <div className="text-3xl font-light tabular-nums text-emerald-700">{p.porTom.positivo}</div>
          <div className="text-[10px] uppercase tracking-widest text-gray-400">positivos</div>
        </div>
        <div>
          <div className="text-3xl font-light tabular-nums text-red-700">{negTotal}</div>
          <div className="text-[10px] uppercase tracking-widest text-gray-400">negativos / críticos</div>
        </div>
      </div>

      {/* Tendência vs. período anterior */}
      {delta && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-5 -mt-1 text-[11px]">
          <span className="uppercase tracking-widest text-gray-400">
            vs. período anterior{prevPartial ? ' (base parcial)' : ''}:
          </span>
          <TrendChip label="total" value={delta.totalDelta} pctChange={delta.totalPct} good="neutral" />
          <TrendChip label="positivos" value={delta.positivoDelta} good="up" />
          <TrendChip label="negativos" value={delta.negativoDelta} good="down" />
          <TrendChip label="cita cliente" value={delta.citamClienteDelta} good="neutral" />
        </div>
      )}

      {/* Distribuição por tom (barra empilhada) */}
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-1.5">Distribuição por tom</div>
        <div className="flex h-5 w-full overflow-hidden border border-gray-100">
          {tomSegments.map(
            (s) =>
              s.v > 0 && (
                <div
                  key={s.label}
                  className={`${s.cls} flex items-center justify-center`}
                  style={{ width: `${pct(s.v, p.total)}%` }}
                  title={`${s.label}: ${s.v}`}
                >
                  {pct(s.v, p.total) >= 8 && (
                    <span className="text-[10px] text-white/90 tabular-nums">{s.v}</span>
                  )}
                </div>
              )
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
          {tomSegments.map((s) => (
            <span key={s.label} className="flex items-center gap-1 text-[10px] text-gray-500">
              <span className={`inline-block w-2 h-2 ${s.cls}`} /> {s.label} · {s.v}
            </span>
          ))}
        </div>
      </div>

      {/* Relevância + tipo de fonte + citação */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-widest text-gray-400">Por relevância</div>
          <Bar label="Alta" value={p.porRelevancia.alta} total={p.total} color="bg-gray-900" />
          <Bar label="Média" value={p.porRelevancia.media} total={p.total} color="bg-gray-500" />
          <Bar label="Baixa" value={p.porRelevancia.baixa} total={p.total} color="bg-gray-300" />
        </div>
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-widest text-gray-400">Por tipo de fonte</div>
          <Bar label="Imprensa" value={p.porTipoFonte.imprensa} total={p.total} color="bg-teal-700" />
          <Bar label="Institucional" value={p.porTipoFonte.institucional} total={p.total} color="bg-teal-500" />
          <Bar label="Agente do setor" value={p.porTipoFonte.agente} total={p.total} color="bg-teal-300" />
        </div>
      </div>

      {/* Cita cliente vs. sob outro protagonista */}
      <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-gray-100">
        <div>
          <div className="text-2xl font-light tabular-nums">{p.citamCliente}</div>
          <div className="text-[10px] uppercase tracking-widest text-gray-400">citam o cliente diretamente</div>
        </div>
        <div>
          <div className="text-2xl font-light tabular-nums">{p.sobOutroProtagonista}</div>
          <div className="text-[10px] uppercase tracking-widest text-gray-400">tema sob outro protagonista</div>
        </div>
        {sov != null && (
          <div className="col-span-2 text-[11px] text-gray-500">
            Share of voice: <strong className="text-gray-700">{sov}%</strong> da cobertura classificada do setor cita o cliente diretamente.
          </div>
        )}
      </div>
      {funnel && (
        <div className="mt-5 border-t border-gray-100 pt-4">
          <div className="mb-2 text-[10px] uppercase tracking-widest text-gray-400">
            Funil de qualificação editorial
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-5">
            <div><strong className="block text-lg">{funnel.detected}</strong>detectadas</div>
            <div><strong className="block text-lg">{funnel.triaged}</strong>triadas</div>
            <div><strong className="block text-lg">{funnel.verified}</strong>verificadas</div>
            <div><strong className="block text-lg">{funnel.qualified}</strong>evidências</div>
            <div><strong className="block text-lg">{funnel.review}</strong>em revisão</div>
          </div>
        </div>
      )}
    </div>
  )
}
