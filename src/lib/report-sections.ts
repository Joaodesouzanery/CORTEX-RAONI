// Section groups for the report's sectioned generation. Pure data (no server
// deps) so both the server (claude.ts) and the client can import
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
  { id: 0, label: 'Sumário Executivo', includeHeader: true, instruction: 'o título/cabeçalho do relatório seguido da seção "## 1. SUMÁRIO EXECUTIVO", com o bloco "### O NÚMERO DO MÊS" (estatística-âncora citada, ou um CONTRASTE factual quando nenhum número dominar) e o bloco "### Top Insights do Mês" com 7 a 8 insights em duas partes: tese em negrito numa frase, depois a explicação com citação' },
  { id: 1, label: 'Temas Estratégicos', includeHeader: false, instruction: 'a seção "## 2. TEMAS ESTRATÉGICOS DO MÊS", abrindo com a tabela de três colunas TEMA ESTRATÉGICO | RELEV. | SINAL DO MÊS (5 a 10 linhas; RELEV. só aceita Alta ou Média; SINAL é fato datado e citado, nunca rótulo de curadoria), seguida do desenvolvimento de cada tema' },
  { id: 2, label: 'Leitura Reputacional', includeHeader: false, instruction: 'a seção "## 3. LEITURA REPUTACIONAL DO AMBIENTE EXTERNO" com as subseções 3.1, 3.2 e 3.3' },
  { id: 3, label: 'Análise Temática', includeHeader: false, instruction: 'a seção "## 4. ANÁLISE TEMÁTICA APROFUNDADA"' },
  { id: 4, label: 'Riscos Reputacionais', includeHeader: false, instruction: 'APENAS a seção "## 5. RISCOS REPUTACIONAIS PRIORITÁRIOS", com no mínimo 4 riscos no bloco fixo Probabilidade (Média|Média-alta|Alta) / Impacto (Médio|Alto|Muito alto) / "Sinal do mês —" com citação, e sem dois riscos compartilhando o mesmo par probabilidade+impacto' },
  { id: 5, label: 'Oportunidades', includeHeader: false, instruction: 'APENAS a seção "## 6. OPORTUNIDADES DE POSICIONAMENTO INSTITUCIONAL"' },
  { id: 6, label: 'Recomendações', includeHeader: false, instruction: 'APENAS a seção "## 7. RECOMENDAÇÕES EXECUTIVAS", com exatamente três blocos: "### AÇÕES IMEDIATAS (0-15 dias)", "### AÇÕES DE CURTO PRAZO (15-60 dias)" e "### AÇÕES DE MÉDIO PRAZO (2-6 meses)"' },
  { id: 7, label: 'Cenários Prospectivos', includeHeader: false, instruction: 'APENAS a seção "## 8. CENÁRIOS PROSPECTIVOS", com exatamente quatro cenários rotulados CENÁRIO 01, CENÁRIO 02, CENÁRIO 03 e CENÁRIO 04, cada um fechando com "**Resposta recomendada:**"' },
  { id: 8, label: 'Demonstração dos Serviços', includeHeader: false, instruction: 'APENAS a seção "## 9. DEMONSTRAÇÃO DOS SERVIÇOS". NÃO produza seções posteriores nem o rodapé final — eles são anexados deterministicamente pelo sistema' },
]
