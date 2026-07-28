// Reputational reading of an article, always relative to a client (see
// migration 018). Deterministic curation input — no AI.
export type Tom = 'positivo' | 'neutro' | 'negativo' | 'critico'
export type Relevancia = 'alta' | 'media' | 'baixa'
export type SourceCategoria = 'imprensa' | 'institucional' | 'agente'
export type ContentStatus = 'integral' | 'parcial' | 'metadados'
export type AccessMode = 'publico' | 'licenciado' | 'referencia'
export type ClassificationSource = 'regra' | 'ia' | 'humano'
export type ImportDocumentType = 'caderno' | 'artigo' | 'desconhecido'
export type ImportStatus = 'enviado' | 'processando' | 'concluido' | 'revisao' | 'erro'
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
  updated_at?: string
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
  active?: boolean
  created_at: string
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
  created_at: string
  processed_at: string | null
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
