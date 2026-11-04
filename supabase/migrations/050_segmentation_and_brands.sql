-- 050: todas as fontes de volta, segmentadas; marcas conforme o playbook da consultoria.

-- Recria a contagem do Painel (idêntica à 047) caso ela não tenha entrado, e força
-- o PostgREST a enxergar a função: o erro "not found in the schema cache" vinha daí.
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

-- Manchetes gerais voltam: a 049 desligou por engano. O filtro agora é por
-- relevância na tela (matéria sem cliente não aparece por padrão), não por fonte.
UPDATE sources SET active = TRUE WHERE name = 'Google News — Brasil (manchetes)';

-- Esporte e entretenimento nunca são pauta de nenhum cliente. A exclusão vai só nas
-- regras setoriais (a direta segue sem exclusão): "PRIO patrocina clube" ainda entra.
UPDATE client_relevance_rules rule
SET excluded_terms = (
      SELECT ARRAY(SELECT DISTINCT unnest(rule.excluded_terms || ARRAY[
        'Campeonato Brasileiro', 'Brasileirão', 'Libertadores', 'Copa do Brasil', 'rodada do campeonato',
        'novela', 'reality show', 'BBB', 'horóscopo', 'celebridade'
      ]))
    ),
    updated_at = NOW()
WHERE rule.match_type <> 'direta';

-- Marcas do playbook (README dos relatórios enviados): PRIO assina VX, DAQ assina SAUZ.
UPDATE clients SET contratante = 'VX' WHERE name = 'PRIO' AND contratante IS DISTINCT FROM 'VX';
UPDATE clients SET contratante = 'SAUZ' WHERE name LIKE 'DAQ%' AND contratante IS DISTINCT FROM 'SAUZ';
UPDATE clients SET contratante = 'SAUZ' WHERE name IN ('CCEE', 'SIMINERAL', 'SINDINFOR') AND contratante IS DISTINCT FROM 'SAUZ';

NOTIFY pgrst, 'reload schema';
