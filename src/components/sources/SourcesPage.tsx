'use client'
import { useState, useEffect } from 'react'
import SourceTable from './SourceTable'
import type { Source } from '@/types'

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([])

  async function load() {
    const res = await fetch('/api/sources')
    const data = await res.json()
    setSources(Array.isArray(data) ? data : [])
  }

  useEffect(() => { load() }, [])

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <SourceTable sources={sources} onRefresh={load} />
    </div>
  )
}
