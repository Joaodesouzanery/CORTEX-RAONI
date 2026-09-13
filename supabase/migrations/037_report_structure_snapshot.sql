-- 037: estrutura do relatorio em JSON, ao lado de citation_snapshot.
--
-- Preenchida no finalize por buildReportStructure(), que PARSEIA o markdown que
-- o proprio prompt dita (secoes 1, 2, 5, 7 e 8) e que auditReportStructure()
-- trava antes de deixar finalizar. Nao e uma segunda geracao pela IA: seria
-- custo dobrado e uma segunda fonte de verdade que diverge assim que o
-- consultor edita report_sections.content.
--
-- E o mesmo objeto entregue como 10_ESTRUTURA_RELATORIO.json no ZIP do
-- claude-package -- o handoff para o Claude Design. Sem ele, a matriz de risco
-- 2D e a linha do tempo exigiriam reparsear prosa no lado do design.
--
-- Nullable e sem default: relatorios finalizados antes desta migration ficam
-- com NULL, e GET /api/reports ja tolera coluna ausente pela escada generica de
-- selects (selectWithOptionalColumns), entao a ordem de aplicacao nao importa.

ALTER TABLE reports ADD COLUMN IF NOT EXISTS structure_snapshot JSONB;

COMMENT ON COLUMN reports.structure_snapshot IS
  'Estrutura parseada do relatorio (numero do mes, insights, temas, riscos com probabilidade/impacto, oportunidades, recomendacoes por prazo, cenarios, linha do tempo). Origem: buildReportStructure() em src/lib/report-structure.ts.';
