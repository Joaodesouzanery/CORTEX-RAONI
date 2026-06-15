'use client'
import { useState } from 'react'

export function useArticleSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = (ids: string[]) => setSelected(new Set(ids))
  const clearAll = () => setSelected(new Set())

  return { selected, toggle, selectAll, clearAll }
}
