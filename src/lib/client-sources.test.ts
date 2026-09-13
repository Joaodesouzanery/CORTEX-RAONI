import { describe, expect, it } from 'vitest'
import { syncClientThematicSources } from './client-sources'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Fake encadeável mínimo. O repo não tem biblioteca de mock de Supabase; os
 * testes são todos node puro. Este registra as chamadas para podermos afirmar
 * QUAL método de escrita foi usado — que é exatamente a regressão em questão.
 */
function fakeSupabase(sources: Array<{ id: string; priority: number | null }>) {
  const calls: Array<{ table: string; method: string; payload?: unknown; options?: unknown }> = []
  const client = {
    from(table: string) {
      const chain = {
        delete() {
          calls.push({ table, method: 'delete' })
          return chain
        },
        eq() {
          return chain
        },
        select() {
          calls.push({ table, method: 'select' })
          return chain
        },
        in() {
          return Promise.resolve({ data: sources, error: null })
        },
        insert(payload: unknown) {
          calls.push({ table, method: 'insert', payload })
          return Promise.resolve({ error: null })
        },
        upsert(payload: unknown, options: unknown) {
          calls.push({ table, method: 'upsert', payload, options })
          return Promise.resolve({ error: null })
        },
        then(resolve: (v: { error: null }) => void) {
          return Promise.resolve({ error: null }).then(resolve)
        },
      }
      return chain
    },
  }
  return { client: client as unknown as SupabaseClient, calls }
}

describe('syncClientThematicSources', () => {
  it('usa upsert, não insert — insert colide com a PK e derruba o save do cliente', async () => {
    // O delete só remove is_thematic = true. Um vínculo não-temático do mesmo
    // par (a migration 034 cria vários) sobrevive e colide com a PK. Com
    // insert, o PUT virava 500 e o POST apagava o cliente recém-criado.
    const { client, calls } = fakeSupabase([{ id: 's1', priority: 95 }])
    await syncClientThematicSources(client, 'c1', ['Institucional — ANTAQ (menção direta)'])

    const write = calls.find((c) => c.method === 'insert' || c.method === 'upsert')
    expect(write?.method).toBe('upsert')
    expect(write?.options).toEqual({ onConflict: 'client_id,source_id' })
  })

  it('monta as linhas com priority do source e is_thematic true', async () => {
    const { client, calls } = fakeSupabase([
      { id: 's1', priority: 95 },
      { id: 's2', priority: null },
    ])
    await syncClientThematicSources(client, 'c1', ['A', 'B'])

    expect(calls.find((c) => c.method === 'upsert')?.payload).toEqual([
      { client_id: 'c1', source_id: 's1', priority: 95, is_thematic: true },
      // priority nulo cai no default 50, igual ao que a migration 034 grava
      { client_id: 'c1', source_id: 's2', priority: 50, is_thematic: true },
    ])
  })

  it('sem feed_names apenas remove os vínculos e não escreve nada', async () => {
    for (const feeds of [null, undefined, [], ['']]) {
      const { client, calls } = fakeSupabase([{ id: 's1', priority: 50 }])
      await syncClientThematicSources(client, 'c1', feeds)
      expect(calls.some((c) => c.method === 'delete')).toBe(true)
      expect(calls.some((c) => c.method === 'insert' || c.method === 'upsert')).toBe(false)
    }
  })

  it('deduplica nomes repetidos em feed_names', async () => {
    const { client, calls } = fakeSupabase([{ id: 's1', priority: 50 }])
    await syncClientThematicSources(client, 'c1', ['A', 'A', 'A'])
    expect((calls.find((c) => c.method === 'upsert')?.payload as unknown[]).length).toBe(1)
  })
})
