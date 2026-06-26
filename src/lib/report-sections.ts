// Section groups for the report's sectioned generation. Pure data (no server
// deps) so both the server (claude.ts) and the client (ReportBuilder) can import
// it — the client needs the count/labels to drive the progress UI.
//
// The 10-section report is produced one group at a time so each API call
// finishes under Vercel Hobby's 60s function limit. Large sections (2 and 4)
// get their own group.

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
  { id: 4, label: 'Riscos e Oportunidades', includeHeader: false, instruction: 'as seções "## 5. RISCOS REPUTACIONAIS PRIORITÁRIOS" e "## 6. OPORTUNIDADES DE POSICIONAMENTO INSTITUCIONAL"' },
  { id: 5, label: 'Recomendações e Cenários', includeHeader: false, instruction: 'as seções "## 7. RECOMENDAÇÕES EXECUTIVAS" e "## 8. CENÁRIOS PROSPECTIVOS"' },
  { id: 6, label: 'Demonstração dos Serviços', includeHeader: false, instruction: 'APENAS a seção "## 9. DEMONSTRAÇÃO DOS SERVIÇOS". NÃO produza a seção 10 (Base de Evidências) nem o rodapé final — eles são anexados automaticamente pelo sistema' },
]
