-- 038: destrava a triagem — templates de agenda da PRIO e o status que a
-- CHECK de report_automation_jobs rejeitava em silencio.
--
-- Dois problemas independentes, ambos diagnosticados em 26/09/2026 a partir do
-- Painel (PRIO e ANTAQ com candidatas e zero triadas).
--
-- BLOCO A. A migration 032 criou as regras de relevancia da PRIO mas nao os
-- templates de agenda. Sem template nao ha topico; sem topico, a rota
-- /api/report-drafts/[id]/triage devolvia 409, o worker contava como falha de
-- estagio e, em tres tentativas, o job ia para 'error' -- estado que o botao
-- "Continuar" nao ressuscitava. O 409 ja foi removido do codigo (a agenda
-- melhora a curadoria mas nao entra na decisao de triagem); os templates
-- entram aqui porque a cobertura por tema continua valendo para o relatorio.
--
-- BLOCO B. report-automation-worker.ts grava status 'waiting_review' no job ao
-- parquear, mas a CHECK criada na 030 so aceitava
-- ('pending','running','waiting_configuration','complete','error'). O UPDATE
-- estava dentro de um Promise.all sem checagem de erro, entao a rejeicao era
-- silenciosa: o job ficava 'running' com o locked_at do claim e era
-- reivindicado de novo a cada 10 minutos para parquear outra vez, em laco.
-- A checagem de erro foi adicionada no codigo; sem esta migration, ela passaria
-- a FALHAR ALTO em vez de falhar em silencio -- melhor, mas ainda quebrado.

-- ---------------------------------------------------------------------------
-- BLOCO A - templates de agenda da PRIO
-- ---------------------------------------------------------------------------
-- Temas derivados das regras ja semeadas na 032 (aliases institucionais e
-- campos/ativos offshore). exclusion_terms ficam vazios de proposito: termo
-- excludente veta o documento inteiro, e uma exclusao larga apaga a cobertura
-- principal em vez de refina-la.
--
-- Cobertura de mercado (PRIO3, resultado trimestral) ficou DE FORA: e o mesmo
-- ruido de cotacao que exigiu guarda dedicada no SIMINERAL
-- (isSimineralHardFalsePositive em src/lib/client-relevance.ts). Entra depois,
-- com guarda propria, se a curadoria pedir.

INSERT INTO client_report_topic_templates (
  client_id, position, title, rationale, inclusion_terms, exclusion_terms
)
SELECT client.id, seed.position, seed.title, seed.rationale,
       seed.inclusion_terms::JSONB, seed.exclusion_terms::JSONB
FROM clients client
JOIN (
  VALUES
    ('PRIO', 1, 'Produção e ativos offshore',
     'Desempenho operacional dos campos próprios e da revitalização de campos maduros.',
     '["campo de Frade","campo de Polvo","campo de Wahoo","campo de Peroá","Albacora Leste","revitalização de campos maduros","produção offshore"]',
     '[]'),
    ('PRIO', 2, 'Regulação da ANP e cessão de direitos',
     'Outorga, cessão de direitos, conteúdo local e decisões regulatórias com efeito sobre os ativos.',
     '["ANP","Agência Nacional do Petróleo","cessão de direitos","conteúdo local","rodada de licitações","partilha de produção"]',
     '[]'),
    ('PRIO', 3, 'Licenciamento ambiental e descomissionamento',
     'Condições socioambientais para operar e encerrar campos, incluindo IBAMA e plano de descomissionamento.',
     '["licenciamento ambiental","IBAMA","descomissionamento","derramamento de óleo","unidade de conservação"]',
     '[]')
) AS seed(client_name, position, title, rationale, inclusion_terms, exclusion_terms)
  ON seed.client_name = client.name
WHERE client.active = TRUE
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- BLOCO B - a CHECK aceita o status que o worker realmente grava
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_automation_job_status_check') THEN
    ALTER TABLE report_automation_jobs DROP CONSTRAINT report_automation_job_status_check;
  END IF;
  ALTER TABLE report_automation_jobs ADD CONSTRAINT report_automation_job_status_check
    CHECK (status IN ('pending', 'running', 'waiting_configuration', 'waiting_review', 'complete', 'error'));
END $$;

-- Jobs presos em 'running' porque o park() foi rejeitado voltam para a fila.
-- locked_at antigo e a assinatura desse estado: o claim so reivindica 'running'
-- cujo lock passou de 10 minutos, entao esses jobs circulavam sem sair do lugar.
UPDATE report_automation_jobs
SET status = 'pending',
    locked_at = NULL,
    failure_count = 0,
    error = NULL,
    available_at = NOW(),
    updated_at = NOW()
WHERE status = 'running'
  AND locked_at IS NOT NULL
  AND locked_at < NOW() - INTERVAL '30 minutes';

-- ---------------------------------------------------------------------------
-- Pos-condicao: nunca ser um no-op silencioso
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_topics INTEGER;
  v_check_ok BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO v_topics
  FROM client_report_topic_templates t
  JOIN clients c ON c.id = t.client_id
  WHERE c.name = 'PRIO';

  SELECT pg_get_constraintdef(oid) LIKE '%waiting_review%' INTO v_check_ok
  FROM pg_constraint WHERE conname = 'report_automation_job_status_check';

  IF v_topics < 3 THEN
    RAISE EXCEPTION '038: PRIO ficou com % template(s) de agenda; esperado ao menos 3. O cliente "PRIO" existe e esta ativo?', v_topics;
  END IF;

  IF NOT COALESCE(v_check_ok, FALSE) THEN
    RAISE EXCEPTION '038: a CHECK de report_automation_jobs nao aceita waiting_review; o park() vai continuar falhando.';
  END IF;
END $$;
