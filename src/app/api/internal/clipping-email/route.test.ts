import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Supabase falso, em memória: só o que a rota usa. A tabela de envios respeita a
// chave única (cliente, dia, modo) como a migration 058, devolvendo 23505.
type Row = Record<string, unknown>
const db: Record<string, Row[]> = {}
let nextId = 1

function query(table: string) {
  const filters: Array<(row: Row) => boolean> = []
  let op: 'select' | 'insert' | 'update' = 'select'
  let payload: Row = {}
  let single: 'single' | 'maybe' | null = null
  const builder = {
    select: () => builder,
    order: () => builder,
    range: () => builder,
    eq: (column: string, value: unknown) => {
      // Filtro em tabela embutida ("articles.published_at") não se aplica aqui.
      if (!column.includes('.')) filters.push((row) => row[column] === value)
      return builder
    },
    neq: (column: string, value: unknown) => {
      if (!column.includes('.')) filters.push((row) => row[column] !== value)
      return builder
    },
    gte: () => builder,
    lt: () => builder,
    in: (column: string, values: unknown[]) => {
      filters.push((row) => values.includes(row[column]))
      return builder
    },
    insert: (row: Row) => {
      op = 'insert'
      payload = row
      return builder
    },
    update: (row: Row) => {
      op = 'update'
      payload = row
      return builder
    },
    single: () => {
      single = 'single'
      return builder
    },
    maybeSingle: () => {
      single = 'maybe'
      return builder
    },
    then: (resolve: (value: unknown) => void) => resolve(run()),
  }
  function run() {
    const rows = (db[table] ||= [])
    if (op === 'insert') {
      if (table === 'clipping_email_sends' && rows.some((row) => row.client_id === payload.client_id && row.day === payload.day && row.mode === payload.mode)) {
        return { data: null, error: { code: '23505', message: 'duplicate key' } }
      }
      const row = { id: nextId++, ...payload }
      rows.push(row)
      return { data: single ? row : [row], error: null }
    }
    const matched = rows.filter((row) => filters.every((filter) => filter(row)))
    if (op === 'update') matched.forEach((row) => Object.assign(row, payload))
    if (single) return { data: matched[0] ?? null, error: single === 'single' && !matched[0] ? { code: 'PGRST116', message: 'no rows' } : null }
    return { data: matched, error: null }
  }
  return builder
}

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => ({ from: (table: string) => query(table) }) }))

const CLIENT = '11111111-1111-4111-8111-111111111111'

function seed() {
  for (const key of Object.keys(db)) delete db[key]
  db.clients = [{ id: CLIENT, name: 'ONS', contratante: 'CRT', active: true }]
  db.client_report_profiles = [{ client_id: CLIENT, brand: 'CRT', display_name: 'ONS' }]
  db.client_email_recipients = [
    { client_id: CLIENT, email: 'a@cliente.com.br', active: true },
    { client_id: CLIENT, email: 'b@cliente.com.br', active: false },
  ]
  db.article_client_tags = [
    {
      client_id: CLIENT,
      article_id: 'a1',
      monitoring_status: 'confirmado',
      cita_cliente: true,
      tom: 'positivo',
      classification_source: 'humano',
      impact_summary: null,
      articles: {
        title: 'ONS premia empresas com melhor desempenho na operação',
        url: 'https://www.cnnbrasil.com.br/economia/ons-premia-empresas-desempenho-operacao/',
        resolved_url: null,
        publisher: 'CNN Brasil',
        published_at: '2026-10-22T14:00:00Z',
        sources: { name: 'CNN Brasil — feed oficial' },
      },
    },
  ]
}

const resend = vi.fn()

async function call(body: Record<string, unknown>) {
  const { POST } = await import('./route')
  const res = await POST(new Request('http://x/api/internal/clipping-email', { method: 'POST', body: JSON.stringify(body) }))
  return { status: res.status, json: await res.json() }
}

describe('POST /api/internal/clipping-email', () => {
  beforeEach(() => {
    seed()
    process.env.RESEND_API_KEY = 're_test'
    process.env.ALERTS_EMAIL_TO = 'dono@exemplo.com'
    process.env.ALERTS_EMAIL_FROM = 'Clipping <clipping@exemplo.com>'
    resend.mockReset()
    resend.mockResolvedValue(new Response(JSON.stringify({ id: 'msg_1' }), { status: 200 }))
    vi.stubGlobal('fetch', resend)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('revisão vai só para o dono e o segundo disparo do dia é no-op', async () => {
    const first = await call({ date: '2026-10-22', mode: 'review' })
    expect(first.json.outcomes[0]).toMatchObject({ status: 'enviado', recipients: 1 })
    const sent = JSON.parse(resend.mock.calls[0][1].body)
    expect(sent.to).toEqual(['dono@exemplo.com'])
    expect(sent.subject).toBe('[Revisão] Clipping ONS — 22/10/2026')
    expect(sent.html).toContain('A menção foi positiva.')

    const second = await call({ date: '2026-10-22', mode: 'review' })
    expect(second.json.outcomes[0]).toMatchObject({ status: 'ja_enviado' })
    expect(resend).toHaveBeenCalledTimes(1)
  })

  it('envio ao cliente vai em cópia oculta, só para os ativos', async () => {
    const result = await call({ date: '2026-10-22', mode: 'send' })
    expect(result.json.outcomes[0]).toMatchObject({ status: 'enviado', recipients: 1 })
    const sent = JSON.parse(resend.mock.calls[0][1].body)
    expect(sent.to).toEqual(['clipping@exemplo.com'])
    expect(sent.bcc).toEqual(['a@cliente.com.br'])
    expect(sent.reply_to).toBe('dono@exemplo.com')
  })

  it('no envio ao cliente, tom não revisado não é afirmado', async () => {
    db.article_client_tags[0].classification_source = 'regra'
    await call({ date: '2026-10-22', mode: 'send' })
    const sent = JSON.parse(resend.mock.calls[0][1].body)
    expect(sent.html).not.toContain('A menção foi')
    expect(sent.html).not.toContain('Tom a revisar')
  })

  it('envio que falhou fica registrado como erro e pode ser refeito', async () => {
    resend.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'domínio não verificado' }), { status: 403 }))
    const failed = await call({ date: '2026-10-22', mode: 'send' })
    expect(failed.status).toBe(207)
    expect(failed.json.outcomes[0]).toMatchObject({ status: 'erro', detail: 'domínio não verificado' })
    const retry = await call({ date: '2026-10-22', mode: 'send' })
    expect(retry.json.outcomes[0]).toMatchObject({ status: 'enviado' })
    expect(db.clipping_email_sends).toHaveLength(1)
  })

  it('reserva presa em "enviando" há mais de 10 min é retomada; recente não', async () => {
    db.clipping_email_sends = [{ id: 99, client_id: CLIENT, day: '2026-10-22', mode: 'review', status: 'enviando', updated_at: new Date().toISOString() }]
    const fresh = await call({ date: '2026-10-22', mode: 'review' })
    expect(fresh.json.outcomes[0]).toMatchObject({ status: 'ja_enviado', detail: 'enviando' })
    db.clipping_email_sends[0].updated_at = new Date(Date.now() - 11 * 60 * 1000).toISOString()
    const stale = await call({ date: '2026-10-22', mode: 'review' })
    expect(stale.json.outcomes[0]).toMatchObject({ status: 'enviado' })
    expect(resend).toHaveBeenCalledTimes(1)
  })

  it('dia sem matéria não manda e-mail vazio', async () => {
    db.article_client_tags = []
    const result = await call({ date: '2026-10-23', mode: 'review' })
    expect(result.json.outcomes[0]).toMatchObject({ status: 'sem_materia' })
    expect(resend).not.toHaveBeenCalled()
  })

  it('sem chave do Resend parqueia visível', async () => {
    delete process.env.RESEND_API_KEY
    const result = await call({ mode: 'review' })
    expect(result.status).toBe(503)
    expect(result.json.status).toBe('nao_configurado')
  })

  it('envio ao cliente sem remetente verificado parqueia visível', async () => {
    delete process.env.ALERTS_EMAIL_FROM
    const result = await call({ mode: 'send' })
    expect(result.status).toBe(503)
    expect(resend).not.toHaveBeenCalled()
  })
})
