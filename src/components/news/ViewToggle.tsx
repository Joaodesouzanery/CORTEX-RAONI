'use client'
import { LayoutGrid, List } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ViewMode } from '@/hooks/useViewMode'

interface Props {
  mode: ViewMode
  onToggle: (m: ViewMode) => void
}

export default function ViewToggle({ mode, onToggle }: Props) {
  return (
    <div className="flex border border-gray-200">
      <button
        onClick={() => onToggle('card')}
        className={cn('p-2', mode === 'card' ? 'bg-black text-white' : 'bg-white text-gray-500 hover:text-black')}
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
      <button
        onClick={() => onToggle('list')}
        className={cn('p-2', mode === 'list' ? 'bg-black text-white' : 'bg-white text-gray-500 hover:text-black')}
      >
        <List className="w-4 h-4" />
      </button>
    </div>
  )
}
