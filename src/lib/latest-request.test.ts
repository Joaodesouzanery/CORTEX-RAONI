import { describe, expect, it } from 'vitest'
import { createLatestGuard } from './latest-request'

describe('createLatestGuard', () => {
  it('invalida a requisição antiga quando uma nova começa', () => {
    // É o caso exato do bug: a busca sem client_id (antiga) não pode escrever
    // estado depois que a busca com client_id (nova) já começou.
    const guard = createLatestGuard()
    const antiga = guard.begin()
    const nova = guard.begin()
    expect(guard.isCurrent(antiga)).toBe(false)
    expect(guard.isCurrent(nova)).toBe(true)
  })

  it('mantém a mais recente válida por quantas rodadas forem', () => {
    const guard = createLatestGuard()
    let ultima = 0
    for (let i = 0; i < 5; i++) ultima = guard.begin()
    expect(guard.isCurrent(ultima)).toBe(true)
  })

  it('guardas independentes não interferem entre si', () => {
    const a = createLatestGuard()
    const b = createLatestGuard()
    const tokenA = a.begin()
    b.begin()
    b.begin()
    expect(a.isCurrent(tokenA)).toBe(true)
  })

  it('token nunca emitido não é corrente', () => {
    const guard = createLatestGuard()
    guard.begin()
    expect(guard.isCurrent(99)).toBe(false)
    expect(guard.isCurrent(0)).toBe(false)
  })
})
