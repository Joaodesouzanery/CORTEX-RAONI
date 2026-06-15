'use client'
interface Props {
  selectedCount: number
  totalCount: number
  onSelectAll: () => void
  onClear: () => void
}

export default function SelectAllBar({ selectedCount, totalCount, onSelectAll, onClear }: Props) {
  if (selectedCount === 0) return null
  return (
    <div className="flex items-center gap-4 bg-black text-white px-4 py-2 text-sm">
      <span>{selectedCount} artigo(s) selecionado(s)</span>
      {selectedCount < totalCount && (
        <button onClick={onSelectAll} className="underline hover:no-underline">
          Selecionar todos ({totalCount})
        </button>
      )}
      <button onClick={onClear} className="underline hover:no-underline">
        Limpar
      </button>
    </div>
  )
}
