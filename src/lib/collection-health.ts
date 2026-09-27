/**
 * O veredito da coleta em uma frase — e a frase certa.
 *
 * O banner antigo listava "0/74 fontes saudáveis, 74 atrasadas" quando o que
 * tinha acontecido era outra coisa: o ciclo de coleta parou de rodar por cinco
 * dias (setembro/2026). Setenta e quatro fontes "atrasadas" descreve o sintoma
 * e esconde a causa — manda o operador auditar fonte por fonte quando o
 * problema é um só, e é do agendador.
 *
 * A ordem de prioridade abaixo é a regra: primeiro o que explica todo o resto.
 */

/**
 * Meta de frescor acordada: toda fonte visitada a cada 24 h.
 *
 * O limiar anterior era 8 h literal, contra um cron de 6 h — margem de 2 h, na
 * qual um único ciclo perdido pintava as 74 fontes de vermelho. Como o desenho
 * varre todas as fontes a cada disparo (o workflow itera /process até o run
 * fechar), 24 h tolera três ciclos perdidos antes de acusar a fonte.
 */
export const SOURCE_FRESHNESS_MS = 24 * 60 * 60 * 1000

/** Intervalo do cron em .github/workflows/fetch-news.yml (`0 *\/6 * * *`). */
export const COLLECTION_CYCLE_MS = 6 * 60 * 60 * 1000

/**
 * A partir de quando a ausência de execução é o problema principal.
 * Dois ciclos: um pode falhar por azar, dois seguidos é padrão.
 */
export const STALLED_RUN_MS = 2 * COLLECTION_CYCLE_MS

export interface CollectionHealthInput {
  active_sources: number
  healthy_sources: number
  stale_sources: number
  failed_sources: number
  /** Opcional no DashboardSummary: versões antigas do payload não o traziam. */
  empty_sources?: number
  never_fetched_sources: number
  last_success_at: string | null
  latest_run: { status: string; created_at: string; finished_at: string | null } | null
}

export interface CollectionHealthVerdict {
  level: 'ok' | 'atencao'
  /** A causa, em uma frase. */
  headline: string
  /** O detalhe que o operador usa para agir. */
  detail: string
}

/** "5 dias", "14 horas", "40 minutos" — sem biblioteca, sem falsa precisão. */
export function humanizeDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return 'tempo desconhecido'
  const minutes = Math.floor(ms / 60_000)
  // Arredonda para cima antes de decidir o plural: com 30 s, `minutes` é 0 e a
  // concordância tem de seguir o número EXIBIDO, não o calculado.
  if (minutes < 60) {
    const shown = Math.max(minutes, 1)
    return `${shown} ${shown === 1 ? 'minuto' : 'minutos'}`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours} ${hours === 1 ? 'hora' : 'horas'}`
  const days = Math.floor(hours / 24)
  return `${days} dias`
}

export function describeCollectionHealth(
  health: CollectionHealthInput,
  now: number = Date.now()
): CollectionHealthVerdict {
  const { active_sources: total, latest_run: run } = health
  const emptySources = health.empty_sources || 0

  if (!total) {
    return {
      level: 'atencao',
      headline: 'Nenhuma fonte ativa cadastrada.',
      detail: 'Sem fonte ativa não há o que coletar. Cadastre ou reative fontes em Fontes.',
    }
  }

  if (!run) {
    return {
      level: 'atencao',
      headline: 'A coleta nunca foi executada.',
      detail: `${total} fontes ativas aguardando a primeira execução.`,
    }
  }

  // Um run ainda em andamento não é atraso: é trabalho acontecendo.
  const running = run.status === 'pendente' || run.status === 'executando'
  const reference = run.finished_at || run.created_at
  const sinceRun = reference ? now - new Date(reference).getTime() : Number.POSITIVE_INFINITY

  if (!running && sinceRun >= STALLED_RUN_MS) {
    // ESTA é a mensagem que faltava em setembro/2026. Enquanto o ciclo não
    // roda, contar fonte atrasada é contar consequência.
    return {
      level: 'atencao',
      headline: `A coleta não conclui uma execução há ${humanizeDuration(sinceRun)}.`,
      detail:
        'Enquanto o ciclo não roda, todas as fontes envelhecem juntas — o atraso por fonte é consequência, não causa. Confira o workflow "Fetch news" no GitHub Actions.',
    }
  }

  if (health.failed_sources > 0) {
    return {
      level: 'atencao',
      headline: `${health.failed_sources} de ${total} fontes falharam na última coleta.`,
      detail: 'Abra Fontes para ver o erro de cada uma. Fonte fora do ar é falha honesta, não ausência de notícia.',
    }
  }

  if (health.never_fetched_sources > 0) {
    return {
      level: 'atencao',
      headline: `${health.never_fetched_sources} de ${total} fontes nunca foram coletadas.`,
      detail: 'Fontes recém-cadastradas entram na próxima execução; se persistir, confira a URL em Fontes.',
    }
  }

  if (health.stale_sources > 0) {
    return {
      level: 'atencao',
      headline: `${health.stale_sources} de ${total} fontes fora da janela de 24 h.`,
      detail: `Última execução ${running ? 'em andamento' : `concluída há ${humanizeDuration(sinceRun)}`}. A meta é visitar toda fonte a cada 24 h.`,
    }
  }

  // "Sem itens" não bloqueia: feed vazio é um estado legítimo do dia.
  const empty = emptySources
    ? ` ${emptySources} ${emptySources === 1 ? 'fonte voltou' : 'fontes voltaram'} sem itens.`
    : ''
  return {
    level: 'ok',
    headline: `${health.healthy_sources} de ${total} fontes dentro da janela de 24 h.`,
    detail: `Última execução ${running ? 'em andamento' : `concluída há ${humanizeDuration(sinceRun)}`}.${empty}`,
  }
}
