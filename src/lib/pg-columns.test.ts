import { describe, expect, it, vi } from 'vitest'
import { missingColumnFrom, selectWithOptionalColumns } from './pg-columns'

const OPCIONAIS = ['metadata', 'brand_snapshot', 'narrative_posture']

describe('missingColumnFrom', () => {
  it('extrai o nome da coluna da mensagem do Postgres', () => {
    expect(missingColumnFrom('column reports.brand_snapshot does not exist', OPCIONAIS)).toBe('brand_snapshot')
    expect(missingColumnFrom('column "narrative_posture" does not exist', OPCIONAIS)).toBe('narrative_posture')
  })

  it('entende também o formato de cache de schema do PostgREST', () => {
    expect(
      missingColumnFrom("Could not find the 'metadata' column of 'reports' in the schema cache", OPCIONAIS)
    ).toBe('metadata')
  })

  it('devolve null para erro que não é de coluna — é o que faz a escada PARAR', () => {
    // Sem isso a escada entraria em laço engolindo o erro de verdade.
    expect(missingColumnFrom('connection terminated unexpectedly', OPCIONAIS)).toBeNull()
    expect(missingColumnFrom('permission denied for table reports', OPCIONAIS)).toBeNull()
    expect(missingColumnFrom(undefined, OPCIONAIS)).toBeNull()
  })

  it('ignora coluna que não está na lista de opcionais', () => {
    // Uma coluna OBRIGATÓRIA ausente não pode ser removida silenciosamente.
    expect(missingColumnFrom('column reports.id does not exist', OPCIONAIS)).toBeNull()
  })
})

describe('selectWithOptionalColumns', () => {
  it('remove só as colunas que faltam e devolve quais caíram', async () => {
    const attempt = vi.fn(async (select: string) => {
      if (select.includes('brand_snapshot')) {
        return { data: null, error: { message: 'column reports.brand_snapshot does not exist' } }
      }
      if (select.includes('metadata')) {
        return { data: null, error: { message: "Could not find the 'metadata' column of 'reports' in the schema cache" } }
      }
      return { data: [{ id: '1' }], error: null }
    })
    const result = await selectWithOptionalColumns('id', OPCIONAIS, attempt)
    expect(result.error).toBeNull()
    expect(result.dropped.sort()).toEqual(['brand_snapshot', 'metadata'])
    expect(result.data).toEqual([{ id: '1' }])
  })

  it('acerta de primeira quando o schema está completo', async () => {
    const attempt = vi.fn(async () => ({ data: [{ id: '1' }], error: null }))
    const result = await selectWithOptionalColumns('id', OPCIONAIS, attempt)
    expect(attempt).toHaveBeenCalledTimes(1)
    expect(result.dropped).toEqual([])
  })

  it('propaga erro real sem tentar de novo', async () => {
    const attempt = vi.fn(async () => ({ data: null, error: { message: 'connection terminated' } }))
    const result = await selectWithOptionalColumns('id', OPCIONAIS, attempt)
    expect(attempt).toHaveBeenCalledTimes(1)
    expect(result.error?.message).toBe('connection terminated')
  })

  it('termina em no máximo opcionais+1 tentativas', async () => {
    // Erro de coluna que se repete não pode virar laço infinito.
    const attempt = vi.fn(async () => ({
      data: null,
      error: { message: 'column reports.metadata does not exist' },
    }))
    await selectWithOptionalColumns('id', OPCIONAIS, attempt)
    expect(attempt.mock.calls.length).toBeLessThanOrEqual(OPCIONAIS.length + 1)
  })
})
