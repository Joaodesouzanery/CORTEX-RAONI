-- 033: Painel como cockpit de automação.
-- Torna explícita a procedência das decisões que hoje travam a preparação
-- mensal (indicadores de serviço e matéria principal), permite parquear um
-- job aguardando revisão humana e escopar o claim por cliente/run para que o
-- botão de um card não drene a fila de outro.
-- Idempotente. Depende da 030 e anteriores.

-- Procedência dos indicadores de serviço: 'ausente' (sem histórico),
-- 'herdado' (copiado do período anterior, ainda não confirmado) ou 'humano'
-- (confirmado por uma pessoa). Só 'humano' libera o checklist sem ressalva.
ALTER TABLE monthly_report_drafts
  ADD COLUMN IF NOT EXISTS service_metrics_source TEXT NOT NULL DEFAULT 'ausente';
ALTER TABLE monthly_report_drafts
  ADD COLUMN IF NOT EXISTS service_metrics_source_period DATE;

-- Procedência da matéria principal. A máquina pode preencher
-- lead_article_id com 'sugestao'; só uma pessoa promove para 'humano'.
-- Essa separação é o que mantém a decisão editorial humana sem custar mais
-- que um clique.
ALTER TABLE monthly_report_drafts
  ADD COLUMN IF NOT EXISTS lead_source TEXT NOT NULL DEFAULT 'ausente';
ALTER TABLE monthly_report_drafts
  ADD COLUMN IF NOT EXISTS lead_suggested_at TIMESTAMPTZ;

-- Motivo estruturado do parque, para o card do Painel renderizar o botão
-- certo sem recalcular o checklist no cliente.
ALTER TABLE monthly_report_drafts
  ADD COLUMN IF NOT EXISTS automation_blocking_reason TEXT;

-- Opt-in para o estágio que gera as seções 1-9 sem operador. Default FALSE
-- mantém o cron diário com o comportamento atual.
ALTER TABLE monthly_report_drafts
  ADD COLUMN IF NOT EXISTS auto_sections BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monthly_report_drafts_service_metrics_source_check') THEN
    ALTER TABLE monthly_report_drafts ADD CONSTRAINT monthly_report_drafts_service_metrics_source_check
      CHECK (service_metrics_source IN ('ausente', 'herdado', 'humano'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monthly_report_drafts_lead_source_check') THEN
    ALTER TABLE monthly_report_drafts ADD CONSTRAINT monthly_report_drafts_lead_source_check
      CHECK (lead_source IN ('ausente', 'sugestao', 'humano'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monthly_report_drafts_automation_blocking_reason_check') THEN
    ALTER TABLE monthly_report_drafts ADD CONSTRAINT monthly_report_drafts_automation_blocking_reason_check
      CHECK (automation_blocking_reason IS NULL OR automation_blocking_reason IN ('exceptions', 'service_metrics', 'lead', 'agenda', 'quality'));
  END IF;
END $$;

-- Drafts que já têm matéria principal foram escolhidos por uma pessoa —
-- a máquina nunca preencheu esse campo antes desta migration.
UPDATE monthly_report_drafts SET lead_source = 'humano'
  WHERE lead_article_id IS NOT NULL AND lead_source = 'ausente';

-- Mesmo raciocínio: indicadores completos hoje só existem se alguém digitou.
UPDATE monthly_report_drafts SET service_metrics_source = 'humano'
  WHERE service_metrics_source = 'ausente'
    AND jsonb_typeof(service_metrics) = 'object'
    AND (service_metrics ? 'reunioes_presenciais')
    AND (service_metrics ? 'reunioes_virtuais')
    AND (service_metrics ? 'orientacoes')
    AND (service_metrics ? 'acoes_imprensa');

-- 'waiting_review': tudo que a máquina podia fazer está feito e o que resta
-- é decisão humana. Distinto de 'waiting_configuration' (falta chave de IA).
ALTER TABLE monthly_report_drafts DROP CONSTRAINT IF EXISTS monthly_report_drafts_automation_status_check;
ALTER TABLE monthly_report_drafts ADD CONSTRAINT monthly_report_drafts_automation_status_check
  CHECK (automation_status IN ('pending', 'running', 'waiting_configuration', 'waiting_review', 'complete', 'partial', 'error'));

CREATE INDEX IF NOT EXISTS idx_report_automation_jobs_run_status
  ON report_automation_jobs (run_id, status);
CREATE INDEX IF NOT EXISTS idx_report_automation_jobs_client_status
  ON report_automation_jobs (client_id, status);

-- Claim escopado. A versão sem argumentos precisa sair: mantê-la ao lado de
-- uma sobrecarga com todos os parâmetros default deixaria a chamada
-- claim_report_automation_job() ambígua ("function is not unique").
-- Chamadas existentes sem argumento continuam resolvendo para esta.
DROP FUNCTION IF EXISTS claim_report_automation_job();
DROP FUNCTION IF EXISTS claim_report_automation_job(UUID, UUID);

CREATE OR REPLACE FUNCTION claim_report_automation_job(
  p_client_id UUID DEFAULT NULL,
  p_run_id UUID DEFAULT NULL
)
RETURNS SETOF report_automation_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE selected_id UUID;
BEGIN
  SELECT id INTO selected_id
  FROM report_automation_jobs
  WHERE (
    status = 'pending'
    OR (status = 'running' AND locked_at < NOW() - INTERVAL '10 minutes')
  )
    AND available_at <= NOW()
    AND (p_client_id IS NULL OR client_id = p_client_id)
    AND (p_run_id IS NULL OR run_id = p_run_id)
  ORDER BY created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF selected_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  UPDATE report_automation_jobs
  SET status = 'running', locked_at = NOW(), started_at = COALESCE(started_at, NOW()),
      attempts = attempts + 1, updated_at = NOW()
  WHERE id = selected_id
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION claim_report_automation_job(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_report_automation_job(UUID, UUID) TO service_role;
