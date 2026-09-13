import { Badge } from '@/components/ui/badge'
import type { Source } from '@/types'

// Feed health from the last fetch, so a dead feed doesn't degrade coverage in
// silence: item count when it returned items, orange "vazio" when it returned
// nothing, muted "sem coleta" before the first run.
//
// Compartilhado entre a tabela de Fontes e o filtro de fontes em Notícias:
// fonte morta aparece esmaecida nos dois lugares, com o mesmo vocabulário —
// "fonte fora do ar é falha honesta, não 'sem dados'".
export default function SourceHealthBadge({ source }: { source: Source }) {
  if (source.last_fetched_at == null) {
    return <span className="text-xs text-gray-400">sem coleta</span>
  }
  if (source.last_fetch_error) {
    return (
      <Badge
        variant="outline"
        className="max-w-40 truncate text-xs text-red-600 border-red-300"
        title={source.last_fetch_error}
      >
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

/** Uma fonte está "sem coleta recente" se falhou ou não traz item há 72 h. */
export function isStaleSource(source: Source): boolean {
  if (source.last_fetch_error) return true
  if (!source.last_success_at) return true
  return Date.now() - new Date(source.last_success_at).getTime() > 72 * 3600 * 1000
}
