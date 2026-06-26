'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      const from = new URLSearchParams(window.location.search).get('from')
      window.location.href = from && from.startsWith('/') ? from : '/'
      return
    }
    const data = await res.json().catch(() => null)
    setError(data?.error || 'Falha ao entrar')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight">CORTEX</h1>
          <p className="text-sm text-gray-500 mt-1">Acesso restrito</p>
        </div>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha"
          autoFocus
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading || !password} className="w-full">
          {loading ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </div>
  )
}
