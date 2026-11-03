-- 047: o Painel fazia 8 contagens com join por cliente em paralelo (dezenas de
-- consultas por carga) e passou a estourar o tempo da funcao. Uma consulta so,
-- com os mesmos filtros de src/app/api/dashboard/route.ts (monitoredCount).
CREATE OR REPLACE FUNCTION dashboard_client_counts(p_start TIMESTAMPTZ, p_previous_start TIMESTAMPTZ)
RETURNS TABLE (
  client_id UUID, total BIGINT, direct BIGINT, review BIGINT, previous BIGINT,
  triaged BIGINT, qualified BIGINT, annex BIGINT, pending BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.client_id,
    COUNT(*) FILTER (WHERE a.published_at >= p_start),
    COUNT(*) FILTER (WHERE a.published_at >= p_start AND t.cita_cliente),
    COUNT(*) FILTER (WHERE a.published_at >= p_start AND t.monitoring_status = 'revisao'),
    COUNT(*) FILTER (WHERE a.published_at >= p_previous_start AND a.published_at < p_start),
    COUNT(*) FILTER (WHERE a.published_at >= p_start AND (t.triaged_at IS NOT NULL OR t.report_role_source = 'humano')),
    COUNT(*) FILTER (WHERE a.published_at >= p_start AND t.report_role = 'evidencia' AND (
      t.report_role_source = 'humano' OR t.editorial_review_state = 'revisado'
      OR (t.verification_status = 'verificada' AND t.qa_checked_at IS NOT NULL AND t.editorial_confidence >= 0.85))),
    COUNT(*) FILTER (WHERE a.published_at >= p_start AND t.report_role IN ('contexto', 'ruido')),
    COUNT(*) FILTER (WHERE a.published_at >= p_start AND (t.report_role IS NULL OR t.editorial_review_state = 'pendente'))
  FROM article_client_tags t
  JOIN articles a ON a.id = t.article_id
  WHERE t.monitoring_status <> 'excluido' AND a.published_at >= p_previous_start
  GROUP BY t.client_id;
$$;

REVOKE ALL ON FUNCTION dashboard_client_counts(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION dashboard_client_counts(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
