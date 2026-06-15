'use client'
import { useState, useEffect } from 'react'

export type ViewMode = 'card' | 'list'

export function useViewMode() {
  const [mode, setMode] = useState<ViewMode>('card')

  useEffect(() => {
    const saved = localStorage.getItem('cortex-view-mode') as ViewMode
    if (saved) setMode(saved)
  }, [])

  const toggle = (m: ViewMode) => {
    setMode(m)
    localStorage.setItem('cortex-view-mode', m)
  }

  return { mode, toggle }
}
