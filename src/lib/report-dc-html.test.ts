import { describe, expect, it } from 'vitest'
import { buildDcHtml, lintPlaybook, markdownToDcHtml } from './report-dc-html'

const base = {
  clientDisplayName: 'PRIO S.A.',
  brand: 'VX',
  periodLabel: 'Outubro de 2026',
  sections: [{ title: 'Sumário Executivo', markdown: '## Destaque\n- **Produção** cresce [E001]' }],
  evidence: [{ code: 'E001', date: '2026-10-03', outlet: 'Valor', title: 'PRIO <b>amplia</b> produção', url: 'https://valor.globo.com/x/2026/10/03/prio.ghtml', weak: true }],
}

describe('buildDcHtml', () => {
  it('usa o template da consultoria e escapa texto de terceiro', () => {
    const html = buildDcHtml(base)
    expect(html).toContain('./support.js')
    expect(html).toContain('doc-page.js')
    expect(html).toContain('PRIO &lt;b&gt;amplia&lt;/b&gt;')
    expect(html).toContain('match fraco')
    expect(html).toContain('vx-logo-white.png')
  })

  it('converte o markdown do modelo', () => {
    expect(markdownToDcHtml('- **a** b')).toContain('<strong>a</strong>')
  })
})

describe('lintPlaybook', () => {
  it('aponta porcentagem em cenário, nome proibido, link de página inicial e código inexistente', () => {
    const issues = lintPlaybook(
      {
        ...base,
        sections: [
          { title: 'Cenários Prospectivos', markdown: 'Cenário 01 com 40% de chance [E009]. PetroRecôncavo.' },
        ],
        evidence: [{ code: 'E001', date: null, outlet: 'X', title: 't', url: 'https://valor.globo.com/' }],
      },
      { forbiddenNames: ['PetroRecôncavo'] }
    )
    const rules = issues.map((issue) => issue.rule)
    expect(rules).toContain('Sem porcentagens nos cenários')
    expect(rules).toContain('Nome correto do cliente')
    expect(rules).toContain('Link só da matéria exata')
    expect(rules).toContain('Nunca inventar')
  })
})
