// Section groups for the report's sectioned generation. Pure data (no server
// deps) so both the server (claude.ts) and the client (ReportBuilder) can import
// it — the client needs the count/labels to drive the progress UI.
//
// The nine analytical sections are produced one group at a time so each API
// call finishes under Vercel Hobby's 60s function limit. The monthly workflow
// appends agenda (10) and qualified evidence (11) deterministically.

export interface ReportSectionGroup {
  id: number
  label: string
  /** Describes exactly which report sections this group must produce. */
  instruction: string
  /** Only the first group emits the report title/header. */
  includeHeader: boolean
}

export const REPORT_SECTION_GROUPS: ReportSectionGroup[] = [
  { id: 0, label: 'Sumário Executivo', includeHeader: true, instruction: 'o título/cabeçalho do relatório seguido da seção "## 1. SUMÁRIO EXECUTIVO" (incluindo o bloco "### Top Insights do Mês")' },
  { id: 1, label: 'Temas Estratégicos', includeHeader: false, instruction: 'a seção "## 2. TEMAS ESTRATÉGICOS DO MÊS"' },
  { id: 2, label: 'Leitura Reputacional', includeHeader: false, instruction: 'a seção "## 3. LEITURA REPUTACIONAL DO AMBIENTE EXTERNO" com as subseções 3.1, 3.2 e 3.3' },
  { id: 3, label: 'Análise Temática', includeHeader: false, instruction: 'a seção "## 4. ANÁLISE TEMÁTICA APROFUNDADA"' },
  { id: 4, label: 'Riscos Reputacionais', includeHeader: false, instruction: 'APENAS a seção "## 5. RISCOS REPUTACIONAIS PRIORITÁRIOS"' },
  { id: 5, label: 'Oportunidades', includeHeader: false, instruction: 'APENAS a seção "## 6. OPORTUNIDADES DE POSICIONAMENTO INSTITUCIONAL"' },
  { id: 6, label: 'Recomendações', includeHeader: false, instruction: 'APENAS a seção "## 7. RECOMENDAÇÕES EXECUTIVAS"' },
  { id: 7, label: 'Cenários Prospectivos', includeHeader: false, instruction: 'APENAS a seção "## 8. CENÁRIOS PROSPECTIVOS"' },
  { id: 8, label: 'Demonstração dos Serviços', includeHeader: false, instruction: 'APENAS a seção "## 9. DEMONSTRAÇÃO DOS SERVIÇOS". NÃO produza seções posteriores nem o rodapé final — eles são anexados deterministicamente pelo sistema' },
]
