// Deterministic "Panorama Quantitativo" — the report's section 2.1 numbers
// (234 itens; 79/119/36 por tom; 93/70/71 por relevância; 66/124 cita-cliente).
//
// Pure module (no React/Supabase deps) so the SAME counts run in the browser
// (live panel), in the dossier API route (briefing package), and in Vitest —
// one source of truth for the metrics, à la relevance.ts. No AI.

import type { Tom, Relevancia, SourceCategoria } from '@/types'

export const TOM_VALUES: Tom[] = ['positivo', 'neutro', 'negativo', 'critico']
export const RELEVANCIA_VALUES: Relevancia[] = ['alta', 'media', 'baixa']
export const CATEGORIA_VALUES: SourceCategoria[] = ['imprensa', 'institucional', 'agente']

/** One monitored item, reduced to just what the panorama counts. */
export interface PanoramaRow {
  tom?: Tom | null
  relevancia?: Relevancia | null
  cita_cliente?: boolean | null
  categoria?: SourceCategoria | null
}

export interface Panorama {
  total: number
  /** Items with at least one reputational tag (tom/relevância/cita) set. */
  tagged: number
  porTom: Record<Tom, number>
  semTom: number
  porRelevancia: Record<Relevancia, number>
  semRelevancia: number
  porTipoFonte: Record<SourceCategoria, number>
  citamCliente: number
  sobOutroProtagonista: number
  semCitacao: number
}

function zero<K extends string>(keys: K[]): Record<K, number> {
  return keys.reduce((acc, k) => ((acc[k] = 0), acc), {} as Record<K, number>)
}

/**
 * Count a set of monitored items into the fixed panorama buckets. Untagged
 * dimensions fall into `semTom`/`semRelevancia`/`semCitacao` instead of being
 * guessed — the panel shows curation progress honestly.
 */
export function computePanorama(rows: PanoramaRow[]): Panorama {
  const p: Panorama = {
    total: rows.length,
    tagged: 0,
    porTom: zero(TOM_VALUES),
    semTom: 0,
    porRelevancia: zero(RELEVANCIA_VALUES),
    semRelevancia: 0,
    porTipoFonte: zero(CATEGORIA_VALUES),
    citamCliente: 0,
    sobOutroProtagonista: 0,
    semCitacao: 0,
  }

  for (const r of rows) {
    if (r.tom) p.porTom[r.tom]++
    else p.semTom++

    if (r.relevancia) p.porRelevancia[r.relevancia]++
    else p.semRelevancia++

    // Source category defaults to press when unknown (mirrors the DB default).
    p.porTipoFonte[r.categoria ?? 'imprensa']++

    if (r.cita_cliente === true) p.citamCliente++
    else if (r.cita_cliente === false) p.sobOutroProtagonista++
    else p.semCitacao++

    if (r.tom || r.relevancia || r.cita_cliente != null) p.tagged++
  }

  return p
}

/** Share (0–100, rounded) of `value` within `total`; 0 when total is 0. */
export function pct(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0
}

export interface PanoramaDelta {
  totalCur: number
  totalPrev: number
  totalDelta: number
  totalPct: number | null // % change vs. previous; null when previous is 0
  positivoDelta: number
  negativoDelta: number // (negativo + crítico) delta — the reputational-risk direction
  altaDelta: number // alta relevância delta
  citamClienteDelta: number
}

/** Period-over-period (e.g. mês vs. mês anterior) delta between two panoramas. */
export function comparePanoramas(cur: Panorama, prev: Panorama): PanoramaDelta {
  const negCur = cur.porTom.negativo + cur.porTom.critico
  const negPrev = prev.porTom.negativo + prev.porTom.critico
  return {
    totalCur: cur.total,
    totalPrev: prev.total,
    totalDelta: cur.total - prev.total,
    totalPct: prev.total > 0 ? Math.round(((cur.total - prev.total) / prev.total) * 100) : null,
    positivoDelta: cur.porTom.positivo - prev.porTom.positivo,
    negativoDelta: negCur - negPrev,
    altaDelta: cur.porRelevancia.alta - prev.porRelevancia.alta,
    citamClienteDelta: cur.citamCliente - prev.citamCliente,
  }
}

/**
 * Share of voice: % of the sector coverage that cites the client DIRECTLY, among
 * the items classified for citation (cita_cliente set). Null when none are yet
 * classified. It's the "cliente × resto do setor" benchmark the reports carry.
 */
export function shareOfVoice(p: Panorama): number | null {
  const base = p.citamCliente + p.sobOutroProtagonista
  return base > 0 ? pct(p.citamCliente, base) : null
}
