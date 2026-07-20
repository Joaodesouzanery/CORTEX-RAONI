'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { renderDigestText, type ClientDigest, type AlertSeverity, type AlertType } from '@/lib/alerts'
import { Bell, Copy, RefreshCw } from 'lucide-react'

type Digest = ClientDigest & { recipient?: string | null }

interface Summary {
  period: string
  clients: number
  clientsWithAlerts: number
  totalAlerts: number
  emailConfigured: boolean
  email: { sent: boolean; skipped?: string; error?: string } | null
  digests: Digest[]
}

const SEV_CLS: Record<AlertSeverity, string> = {
  alta: 'bg-red-600 text-white',
  media: 'bg-orange-500 text-white',
  info: 'bg-teal-700 text-white',
}
const TYPE_LABEL: Record<AlertType, string> = {
  pico_volume: 'Pico de volume',
  sentimento_negativo: 'Sentimento negativo',
  alta_relevancia: 'Alta relevância',
}

export default function AlertsPage() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  async function check() {
    setLoading(true)
    try {
      const res = await fetch('/api/alerts/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manual: true }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Falha ao verificar alertas')
      setSummary(data as Summary)
    } catch (e) {
      toast({ title: 'Erro ao verificar alertas', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  function copyDigest(d: Digest) {
    const body = renderDigestText([d], summary?.period || 'últimas 24h')
    const text = (d.recipient ? `Para: ${d.recipient}\n\n` : '') + body
    navigator.clipboard.writeText(text).then(
      () => toast({ title: 'Copiado', description: 'Cole no seu e-mail e envie.' }),
      () => toast({ title: 'Não foi possível copiar', variant: 'destructive' })
    )
  }

  const active = summary?.digests ?? []

  return (
    <div className="max-w-screen-lg mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-5xl font-light tracking-tight">Alertas</h1>
          <p className="text-xs text-gray-400 mt-1">
            Picos de cobertura, tom negativo e itens de alta relevância — para você enviar manualmente.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={check} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Verificando...' : 'Verificar alertas'}
        </Button>
      </div>

      {!summary ? (
        <div className="text-center py-24 text-gray-400">
          <Bell className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p>
            Clique em <strong>Verificar alertas</strong> para checar as últimas 24h de todos os clientes.
          </p>
        </div>
      ) : active.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p>
            Nenhum alerta nas {summary.period}.{' '}
            <span className="text-gray-300">({summary.clients} cliente(s) verificado(s).)</span>
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-4">
            {summary.totalAlerts} alerta(s) em {summary.clientsWithAlerts} cliente(s) · {summary.period}
            {!summary.emailConfigured && ' · envio por e-mail desligado (manual)'}
          </p>
          <div className="flex flex-col gap-5">
            {active.map((d) => (
              <div key={d.clientName} className="border border-gray-200">
                <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50">
                  <div className="min-w-0">
                    <div className="font-bold">{d.clientName}</div>
                    <div className="text-xs truncate">
                      {d.recipient ? (
                        <span className="text-gray-500">
                          Enviar para: <strong className="text-gray-700">{d.recipient}</strong>
                        </span>
                      ) : (
                        <span className="text-orange-600">Sem destinatário — defina no cadastro do cliente</span>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => copyDigest(d)} className="flex-shrink-0">
                    <Copy className="w-4 h-4 mr-2" /> Copiar
                  </Button>
                </div>
                <div className="px-5 py-4 flex flex-col gap-4">
                  {d.alerts.map((a, i) => (
                    <div key={i}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${SEV_CLS[a.severity]}`}>
                          {TYPE_LABEL[a.type] ?? a.type}
                        </span>
                        <span className="text-sm text-gray-700">{a.message}</span>
                      </div>
                      <ul className="pl-4 flex flex-col gap-1">
                        {a.items.map((it, j) => (
                          <li key={j} className="text-sm leading-snug">
                            <a href={it.url} target="_blank" rel="noopener noreferrer" className="text-teal-800 hover:underline">
                              {it.title}
                            </a>
                            <span className="text-gray-400">
                              {' '}— {it.veiculo}
                              {it.published_at ? ` · ${new Date(it.published_at).toLocaleDateString('pt-BR')}` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
