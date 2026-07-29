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
  source_documents?: ImportDocument
}

export interface ImportBatch {
  id: string
  client_id: string
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
  documents?: ImportBatchDocument[]
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
  clients?: Client
  evidence_items?: ReportEvidenceItem[]
  sections?: ReportSection[]
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
