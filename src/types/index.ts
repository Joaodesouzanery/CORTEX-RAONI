// Reputational reading of an article, always relative to a client (see
// migration 018). Deterministic curation input — no AI.
export type Tom = 'positivo' | 'neutro' | 'negativo' | 'critico'
export type Relevancia = 'alta' | 'media' | 'baixa'
export type SourceCategoria = 'imprensa' | 'institucional' | 'agente'
export type ContentStatus = 'integral' | 'parcial' | 'metadados'
export type AccessMode = 'publico' | 'licenciado' | 'referencia'
export type ClassificationSource = 'regra' | 'ia' | 'humano'
export type MonitoringStatus = 'candidato' | 'confirmado' | 'revisao' | 'excluido'
export type FetchRunStatus = 'pendente' | 'executando' | 'concluido' | 'parcial' | 'erro'
export type FetchRunSourceStatus = 'pendente' | 'executando' | 'concluido' | 'erro'
export type ImportDocumentType = 'caderno' | 'artigo' | 'relatorio' | 'desconhecido'
export type ImportStatus = 'enviado' | 'processando' | 'concluido' | 'revisao' | 'erro'
export type ImportIntent = 'noticias' | 'relatorio_referencia'
export type ImportBatchStatus = 'pending' | 'processing' | 'complete' | 'partial' | 'error'
export type OcrStatus = 'not_requested' | 'pending' | 'processing' | 'complete' | 'error'
export type EvidenceBucket = 'qualified' | 'annex' | 'excluded'
export type ReportRole = 'evidencia' | 'contexto' | 'ruido'
export type ReportRoleSource = 'regra' | 'ia' | 'humano'
export type IntakeKind = 'file' | 'url' | 'text'
export type StrategicEffect = 'oportunidade' | 'risco' | 'misto' | 'informativo'
export type VerificationStatus = 'verificada' | 'parcial' | 'pendente'
export type SourceVerificationStatus =
  | 'nao_verificada'
  | 'parcial'
  | 'documento_integral'
  | 'fonte_original'
export type EditorialReviewState = 'automatico' | 'pendente' | 'revisado'
export type EditorialConfidence = number
export type GeographicScope = 'para' | 'amazonia' | 'brasil' | 'internacional' | 'indeterminado'
export type ReportPosture = 'consultivo_cauteloso' | 'executivo_assertivo' | 'somente_descritivo'
export type QualityFlag =
  | 'texto_insuficiente'
  | 'duplicata_exata'
  | 'possivel_mercado_financeiro'
  | 'ambiguidade_criptomoeda'
  | 'energia_nuclear_desconectada'
  | 'equipamento_comercial'
  | 'exterior_sem_impacto_local'
  | 'fora_do_periodo'
  | 'divergencia_de_classificacao'
  | 'agenda_obrigatoria'
export type TopicCoverage = 'unchecked' | 'searching' | 'covered' | 'gap' | 'review'
export type ReportQualityStatus = 'pending' | 'running' | 'passed' | 'blocked'
export type ReportDraftStatus =
  | 'preparing'
  | 'triaging'
  | 'ready'
  | 'generating'
  | 'review'
  | 'approved'
  | 'stale'
  | 'error'
export type ReportSectionStatus = 'pending' | 'generating' | 'generated' | 'edited' | 'stale' | 'error'
export type EditionStatus = 'rascunho' | 'classificando' | 'renderizando' | 'concluido' | 'erro'
export type EditionSection = 'mencao_direta' | 'cobertura_setorial' | 'baixa_confianca'
export type EditionVersion = number

export interface ArticleTag {
  article_id: string
  client_id: string
  tom: Tom | null
  relevancia: Relevancia | null
  cita_cliente: boolean | null
  tema: string | null
  classification_source?: ClassificationSource | null
  confidence?: number | null
  impact_summary?: string | null
  monitoring_status?: MonitoringStatus
  match_score?: number
  match_reasons?: MatchReason[]
  rule_version?: number
  classified_at?: string | null
  report_role?: ReportRole | null
  editorial_score?: number | null
  editorial_reason?: string | null
  cluster_label?: string | null
  report_role_source?: ReportRoleSource | null
  triaged_at?: string | null
  triage_version?: number | null
  central_message?: string | null
  strategic_effect?: StrategicEffect | null
  recommended_action?: string | null
  verification_status?: VerificationStatus
  editorial_review_state?: EditorialReviewState
  qualified_at?: string | null
  qualification_version?: number | null
  editorial_confidence?: EditorialConfidence | null
  geographic_scope?: GeographicScope | null
  quality_flags?: QualityFlag[]
  adjudication_version?: number | null
  qa_source?: ReportRoleSource | null
  qa_checked_at?: string | null
  source_verification_status?: SourceVerificationStatus
  updated_at?: string
}

export interface MatchReason {
  rule_id?: string
  label: string
  match_type: 'direta' | 'setorial' | 'fonte'
  terms: string[]
  weight: number
}

export interface ClientRelevanceRule {
  id: string
  client_id: string
  label: string
  match_type: 'direta' | 'setorial'
  required_groups: string[][]
  excluded_terms: string[]
  weight: number
  version: number
  active: boolean
}

export interface FetchRunSource {
  run_id: string
  source_id: string
  status: FetchRunSourceStatus
  parsed_count: number
  inserted_count: number
  updated_count: number
  duplicate_count: number
  attempt_count: number
  duration_ms: number | null
  oldest_published_at: string | null
  latest_published_at: string | null
  error: string | null
  sources?: Pick<Source, 'name' | 'type'>
}

export interface FetchRun {
  id: string
  trigger_type: 'manual' | 'schedule'
  status: FetchRunStatus
  total_sources: number
  completed_sources: number
  parsed_count: number
  inserted_count: number
  updated_count: number
  duplicate_count: number
  error_count: number
  created_at: string
  started_at: string | null
  finished_at: string | null
  source_results?: FetchRunSource[]
}

export interface Source {
  id: string
  name: string
  url: string
  type: 'rss' | 'scrape'
  active: boolean
  categoria?: SourceCategoria
  is_general?: boolean
  priority?: number
  access_mode?: AccessMode
  last_fetch_count?: number | null
  last_fetched_at?: string | null
  last_success_at?: string | null
  last_fetch_error?: string | null
  last_fetch_duration_ms?: number | null
  created_at: string
}

export interface Article {
  id: string
  source_id: string
  title: string
  url: string | null
  image_url: string | null
  excerpt: string | null
  content?: string | null
  content_status?: ContentStatus
  author?: string | null
  canonical_fingerprint?: string | null
  published_at: string | null
  fetched_at: string
  publisher?: string | null
  sources?: { name: string; categoria?: SourceCategoria; is_general?: boolean }
  provenance_sources?: Array<{
    id: string
    name: string
    categoria?: SourceCategoria
    is_general?: boolean
  }>
  // Populated client-side by merging the active client's tags (not a DB column).
  tag?: ArticleTag | null
  // Stable monthly evidence label used by generated report citations.
  evidence_code?: string
}

export interface Report {
  id: string
  prompt: string
  article_ids: string[]
  content: string
  created_at: string
  client_id?: string | null
  clients?: { name: string; logo_url: string | null } | null
  metadata?: Record<string, unknown> | null
  draft_id?: string | null
  period_month?: string | null
  version?: number | null
  lead_article_id?: string | null
  brand_snapshot?: ReportBrand | null
  agenda_snapshot?: MonthlyReportTopic[] | null
  quality_snapshot?: Record<string, unknown> | null
  methodology_snapshot?: MethodologySnapshot | null
  citation_snapshot?: EvidenceCitation[] | null
  narrative_posture?: ReportPosture | null
}

export interface Client {
  id: string
  name: string
  context: string | null
  report_prompt: string | null
  sector: string | null
  contratante: string | null
  keywords: string[] | null
  synonyms: string | null
  feed_names: string[] | null
  alert_recipient: string | null
  logo_url: string | null
  report_brand_name?: string | null
  report_brand_footer?: string | null
  report_brand_guidelines?: string | null
  active?: boolean
  created_at: string
}

export interface DashboardClientSummary {
  client: Client
  total: number
  triaged_count: number
  qualified_count: number
  annex_count: number
  pending_count: number
  direct_mentions: number
  review_count: number
  previous_total: number
  variation_percent: number | null
}

export interface DashboardSummary {
  period_days: number
  generated_at: string
  clients: DashboardClientSummary[]
  health: {
    active_sources: number
    healthy_sources: number
    stale_sources: number
    failed_sources: number
    empty_sources?: number
    never_fetched_sources: number
    last_success_at: string | null
    coverage_start: string | null
    coverage_complete: boolean
    latest_run: FetchRun | null
  }
}

export interface PaginatedArticles {
  items: Article[]
  total: number
  next_cursor: string | null
  coverage: {
    start: string | null
    end: string | null
    complete: boolean
  }
}

export interface NewsQualificationSummary {
  total: number
  panorama: import('@/lib/panorama').Panorama
  funnel: QualificationFunnel
}

export interface ImportDocument {
  id: string
  filename: string
  storage_path: string
  sha256: string
  document_type: ImportDocumentType
  status: ImportStatus
  page_count: number | null
  imported_article_count: number
  error: string | null
  metadata: Record<string, unknown>
  ocr_status?: OcrStatus
  ocr_text?: string | null
  created_at: string
  processed_at: string | null
}

export interface ImportBatchDocument {
  batch_id: string
  document_id: string
  filename: string
  status: 'pending' | 'uploading' | 'processing' | 'complete' | 'review' | 'error'
  article_count: number
  error: string | null
  created_at: string
  processed_at: string | null
  input_kind?: IntakeKind
  source_documents?: ImportDocument
}

export interface ImportBatch {
  id: string
  client_id: string
  client_ids?: string[]
  period_month: string
  intent: ImportIntent
  status: ImportBatchStatus
  total_files: number
  completed_files: number
  review_files: number
  failed_files: number
  article_count: number
  created_at: string
  started_at: string | null
  completed_at: string | null
  clients?: Pick<Client, 'id' | 'name'>
  selected_clients?: Array<Pick<Client, 'id' | 'name'>>
  documents?: ImportBatchDocument[]
}

export interface IntakeItem {
  kind: Exclude<IntakeKind, 'file'>
  value: string
  label?: string
}

export interface ReferenceReport {
  id: string
  client_id: string
  period_month: string
  source_document_id: string
  title: string
  extracted_text: string | null
  status: 'ready' | 'ocr_pending' | 'review' | 'error'
  metadata: Record<string, unknown>
  created_at: string
}

export interface ReferenceReportItem {
  id: string
  reference_report_id: string
  row_number: number
  article_id: string | null
  match_status: 'pending' | 'linked' | 'created' | 'ambiguous'
  original_snapshot: Record<string, unknown>
  classification_snapshot: Record<string, unknown>
  match_confidence: number | null
  created_at: string
  reconciled_at: string | null
}

export interface ReportBrand {
  name: string
  footer: string | null
  guidelines: string | null
  contratante: string | null
  client_name: string
}

export interface ReportEvidenceItem {
  id: string
  draft_id: string
  article_id: string
  bucket: EvidenceBucket
  position: number
  article_snapshot: ArticleSnapshot
  classification_snapshot: Record<string, unknown>
  cluster_key: string | null
  created_at: string
}

export interface ReportSection {
  id: string
  draft_id: string
  section_key: number
  content: string
  status: ReportSectionStatus
  version: number
  generated_at: string | null
  updated_at: string
}

export interface MonthlyReportDraft {
  id: string
  client_id: string
  period_month: string
  version: number
  status: ReportDraftStatus
  lead_article_id: string | null
  monthly_instructions: string
  service_metrics: Record<string, number>
  brand_snapshot: ReportBrand
  base_version: number
  base_refreshed_at: string | null
  error: string | null
  created_at: string
  updated_at: string
  approved_at: string | null
  quality_status?: ReportQualityStatus
  quality_summary?: QualificationFunnel & {
    blocking_checks?: number
    warning_checks?: number
  }
  quality_checked_at?: string | null
  narrative_posture: ReportPosture
  methodology_snapshot?: MethodologySnapshot
  clients?: Client
  evidence_items?: ReportEvidenceItem[]
  sections?: ReportSection[]
  topics?: MonthlyReportTopic[]
  quality_checks?: ReportQualityCheck[]
}

export interface MonthlyReportTopic {
  id: string
  draft_id: string
  position: number
  title: string
  rationale: string
  inclusion_terms: string[]
  exclusion_terms: string[]
  required: boolean
  coverage_status: TopicCoverage
  gap_reason: string | null
  gap_acknowledged_at: string | null
  created_at: string
  updated_at: string
  evidence_count?: number
  evidence?: ReportTopicEvidence[]
  search_runs?: TopicSearchRun[]
}

export interface ReportTopicEvidence {
  topic_id: string
  article_id: string
  source: ReportRoleSource
  confidence: number | null
  reason: string | null
  human_confirmed: boolean
  created_at: string
  updated_at: string
}

export interface TopicSearchRun {
  id: string
  topic_id: string
  status: 'pending' | 'searching' | 'complete' | 'gap' | 'error'
  query_snapshot: Record<string, unknown>
  matched_count: number
  linked_count: number
  fetch_run_id: string | null
  error: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
}

export interface ReportQualityCheckItem {
  key: string
  label: string
  status: 'passed' | 'warning' | 'blocked'
  count: number
  details?: string[]
}

export interface ReportQualityCheck {
  id: string
  draft_id: string
  base_version: number
  status: 'passed' | 'blocked'
  checks: ReportQualityCheckItem[]
  summary: Record<string, unknown>
  created_at: string
}

export interface QualificationFunnel {
  detected: number
  triaged: number
  verified: number
  qualified: number
  review: number
  annex: number
  excluded: number
}

export interface EvidenceCitation {
  code: string
  article_id: string
  title: string
  publisher: string
  published_at: string | null
  source_verification_status: SourceVerificationStatus
}

export interface MethodologySnapshot {
  monitored_total: number
  direct_mentions: number
  qualified_evidence: number
  annex_total: number
  excluded_total: number
  content_integral: number
  content_partial: number
  content_metadata_only: number
  source_original_verified: number
  source_document_integral: number
  source_partial: number
  source_unverified: number
  generated_at: string
}

export interface ArticleProvenance {
  id: string
  article_id: string
  source_document_id: string | null
  source_id: string | null
  acquisition_type: 'rss' | 'scrape' | 'pdf'
  page_start: number | null
  page_end: number | null
  original_reference: string | null
  created_at: string
}

export interface ArticleSnapshot {
  id: string
  title: string
  url: string | null
  image_url: string | null
  excerpt: string | null
  content: string | null
  content_status: ContentStatus
  author: string | null
  published_at: string | null
  publisher: string | null
  source_name: string | null
  source_categoria: SourceCategoria
  origin_pdf?: {
    document_id: string
    page_start: number
    page_end: number
  } | null
}

export interface MonthlyEditionItem {
  id: string
  edition_id: string
  article_id: string
  position: number
  section: EditionSection
  cluster_key: string | null
  article_snapshot: ArticleSnapshot
  classification_snapshot: {
    tom: Tom | null
    relevancia: Relevancia | null
    cita_cliente: boolean | null
    tema: string | null
    confidence: number | null
    impact_summary: string | null
  }
  created_at: string
}

export interface MonthlyEdition {
  id: string
  client_id: string
  period_month: string
  version: EditionVersion
  status: EditionStatus
  summary_markdown: string | null
  summary_data: Record<string, unknown>
  counts: {
    total?: number
    integral?: number
    parcial?: number
    metadados?: number
    mencoes_diretas?: number
    cobertura_setorial?: number
    baixa_confianca?: number
  }
  pdf_storage_path: string | null
  error: string | null
  source_cutoff_at: string
  created_at: string
  generated_at: string | null
  clients?: { name: string; logo_url: string | null } | null
  items?: MonthlyEditionItem[]
}
