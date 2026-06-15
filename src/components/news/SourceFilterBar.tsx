'use client'
import { cn } from '@/lib/utils'

interface Props {
  sources: string[]
  active: string | null
  onChange: (source: string | null) => void
}

export default function SourceFilterBar({ sources, active, onChange }: Props) {
  if (sources.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <button
        onClick={() => onChange(null)}
        className={cn(
          'px-3 py-1 text-xs uppercase tracking-widest border transition-colors',
          !active ? 'bg-black text-white border-black' : 'border-gray-300 text-gray-600 hover:border-black hover:text-black'
        )}
      >
        Todas
      </button>
      {sources.map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={cn(
            'px-3 py-1 text-xs uppercase tracking-widest border transition-colors',
            active === s ? 'bg-black text-white border-black' : 'border-gray-300 text-gray-600 hover:border-black hover:text-black'
          )}
        >
          {s}
        </button>
      ))}
    </div>
  )
}
