'use client'
import { useEffect, useState } from 'react'
import { AlertTriangle, Copy, Info, TrendingUp } from 'lucide-react'
import { computeAlertsFromCounts, PANEL_THRESHOLDS, renderDigestText, type Alert } from '@/lib/alerts'
import type { Client, NewsQualificationSummary } from '@/types'
import { useToast } from '@/hooks/use-toast'

/**
 * A faixa "Sinais" — o que sobrou útil do módulo /alerts.
 *
 * Fica ACIMA do Panorama, na mesma tela que produziu os números, e não numa
 * gaveta: esconder o número atrás de um clique foi exatamente o que matou a
 * página antiga, cujo único botão nem funcionava (o middleware bloqueia
 * /api/alerts/check no navegador).
 *
 * Duas honestidades embutidas:
 *  1. Os números vêm de /api/articles/summary, calculados no SERVIDOR sobre o
 *     filtro inteiro — não sobre a página carregada.
 *  2. `computePanorama` deliberadamente NÃO adivinha tom de artigo não
 *     classificado, enquanto o cron do e-mail adivinha. Então a faixa reporta
 *     MENOS negativos que o digest. Por isso ela mostra a taxa de classificação
 *     junto: "0 negativos" com 12 de 300 classificados não significa nada.
 */
const ICON: Record<Alert['type'], typeof Info> = {
  pico_volume: TrendingUp,
  sentimento_negativo: AlertTriangle,
  alta_relevancia: Info,
}

const TONE: Record<Alert['severity'], string> = {
  alta: 'border-red-300 bg-red-50 text-red-800',
  media: 'border-amber-300 bg-amber-50 text-amber-900',
  info: 'border-gray-300 bg-gray-50 text-gray-700',
}

export default function SignalsStrip({
  client,
  summary,
}: {
  client: Client
  summary: NewsQualificationSummary | null
}) {
  const { toast } = useToast()
  const [baseline, setBaseline] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    // Linha de base montada DO ZERO, nunca derivada do filtro da tela: se
    // herdasse período, fonte e status, o denominador seria o mesmo do
    // numerador e o pico jamais dispararia.
    // `published_before = agora-24h` exclui a janela recente da própria base,
    // como o cron faz — sem isso o pico infla o próprio denominador.
    const ontem = new Date(Date.now() - 86_400_000).toISOString()
    const query = new URLSearchParams({
      paginated: 'true',
      limit: '1',
      client_id: client.id,
      days: '8',
      published_before: ontem,
    })
    fetch(`/api/articles?${query}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        const total = typeof data?.total === 'number' ? data.total : null
        setBaseline(total === null ? null : total / 7)
      })
      .catch(() => {
        if (!cancelled) setBaseline(null)
      })
    return () => {
      cancelled = true
    }
  }, [client.id])

  if (!summary) return null
  const { panorama } = summary
  const negativos = (panorama.porTom.negativo || 0) + (panorama.porTom.critico || 0)
  const alertas = computeAlertsFromCounts(
    { total: panorama.total, negativos, alta: panorama.porRelevancia.alta || 0 },
    baseline ?? 0,
    PANEL_THRESHOLDS
  )

  const classificacao = `${panorama.tagged} de ${panorama.total} classificados`
  const parcial = panorama.total > 0 && panorama.tagged < panorama.total

  async function copiar() {
    await navigator.clipboard.writeText(
      renderDigestText(
        [{ clientName: client.name, recipient: client.alert_recipient ?? null, alerts: alertas }],
        'filtro atual'
      )
    )
    toast({ title: 'Resumo copiado' })
  }

  return (
    <div className="mb-4 border border-gray-200 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[11px] uppercase tracking-widest text-gray-500">Sinais</span>
        <span className="text-[11px] text-gray-400">{classificacao}</span>
        {parcial && (
          <span className="text-[11px] text-amber-700">
            — tom não é adivinhado para item sem classificação; os números abaixo contam só o que foi triado
          </span>
        )}
        {alertas.length > 0 && (
          <button onClick={copiar} className="ml-auto flex items-center gap-1 text-[11px] text-gray-500 hover:text-black">
            <Copy className="h-3 w-3" /> Copiar resumo
          </button>
        )}
      </div>

      {alertas.length === 0 ? (
        <p className="text-xs text-gray-400">
          Nada fora do padrão no filtro atual
          {baseline === null ? '' : ` (baseline ~${baseline.toFixed(1)} itens/dia)`}.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {alertas.map((alerta) => {
            const Icone = ICON[alerta.type]
            return (
              <p
                key={alerta.type}
                className={`flex items-start gap-2 border px-2 py-1 text-xs ${TONE[alerta.severity]}`}
              >
                <Icone className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>{alerta.message}</span>
              </p>
            )
          })}
        </div>
      )}

      {client.alert_recipient ? (
        <p className="mt-2 text-[11px] text-gray-400">Digest diário para {client.alert_recipient}</p>
      ) : (
        <p className="mt-2 text-[11px] text-amber-700">
          Sem destinatário de alerta — defina no cadastro do cliente para receber o digest diário.
        </p>
      )}
    </div>
  )
}
