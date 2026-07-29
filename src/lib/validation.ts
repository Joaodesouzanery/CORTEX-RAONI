import { z } from 'zod'

/**
 * Centralized request validation schemas for the API routes.
 * Uses only core Zod APIs (object/string/number/array/enum/refine) so it stays
 * compatible across Zod versions and avoids relying on format helpers.
 */

const urlString = z
  .string()
  .trim()
  .min(1, 'URL é obrigatória')
  .refine((v) => {
    try {
      const u = new URL(v)
      return u.protocol === 'http:' || u.protocol === 'https:'
    } catch {
      return false
    }
  }, 'URL inválida')

// ---- Sources ----
export const sourceCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório'),
  url: urlString,
  type: z.enum(['rss', 'scrape']),
  active: z.boolean().optional(),
  is_general: z.boolean().optional(),
})

export const sourceUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').optional(),
  url: urlString.optional(),
  type: z.enum(['rss', 'scrape']).optional(),
  active: z.boolean().optional(),
  is_general: z.boolean().optional(),
})

// ---- Clients ----
export const clientCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório'),
  context: z.string().nullish(),
  report_prompt: z.string().nullish(),
  sector: z.string().nullish(),
  contratante: z.string().nullish(),
  keywords: z.array(z.string()).nullish(),
  synonyms: z.string().nullish(),
  feed_names: z.array(z.string()).nullish(),
  alert_recipient: z.string().nullish(),
  logo_url: z.string().nullish(),
  report_brand_name: z.string().nullish(),
  report_brand_footer: z.string().nullish(),
  report_brand_guidelines: z.string().nullish(),
})

export const clientUpdateSchema = clientCreateSchema

// ---- Curation tags (article ↔ client reputational reading) ----
// All fields nullable: a single click sets/clears one dimension at a time.
export const articleTagSchema = z.object({
  article_id: z.string().min(1, 'article_id é obrigatório'),
  client_id: z.string().min(1, 'client_id é obrigatório'),
  tom: z.enum(['positivo', 'neutro', 'negativo', 'critico']).nullish(),
  relevancia: z.enum(['alta', 'media', 'baixa']).nullish(),
  cita_cliente: z.boolean().nullish(),
  tema: z.string().nullish(),
  classification_source: z.enum(['regra', 'ia', 'humano']).nullish(),
  confidence: z.number().min(0).max(1).nullish(),
  impact_summary: z.string().max(2000).nullish(),
  monitoring_status: z.enum(['candidato', 'confirmado', 'revisao', 'excluido']).optional(),
  report_role: z.enum(['evidencia', 'contexto', 'ruido']).nullish(),
  editorial_score: z.number().int().min(0).max(100).nullish(),
  editorial_reason: z.string().max(2000).nullish(),
  cluster_label: z.string().max(300).nullish(),
  report_role_source: z.enum(['regra', 'ia', 'humano']).nullish(),
})

// Request a batch of tag suggestions for a client's articles (no save).
export const articleTagSuggestSchema = z.object({
  client_id: z.string().min(1, 'client_id é obrigatório'),
  article_ids: z.array(z.string()).min(1, 'Selecione ao menos um artigo'),
})

// Apply many suggestions at once. The route fills only the empty dimensions of
// each (article, client), never overwriting a tag the human already set.
export const articleTagBulkSchema = z.object({
  client_id: z.string().min(1, 'client_id é obrigatório'),
  items: z
    .array(
      z.object({
        article_id: z.string().min(1),
        tom: z.enum(['positivo', 'neutro', 'negativo', 'critico']).nullish(),
        relevancia: z.enum(['alta', 'media', 'baixa']).nullish(),
        cita_cliente: z.boolean().nullish(),
        tema: z.string().nullish(),
        classification_source: z.enum(['regra', 'ia', 'humano']).nullish(),
        confidence: z.number().min(0).max(1).nullish(),
        impact_summary: z.string().max(2000).nullish(),
      })
    )
    .min(1, 'Nenhum item para aplicar'),
})

// ---- Clipping (curated PDF: cover + sumário + full text) ----
// Selected articles → a branded clipping. Deterministic, no AI.
export const clippingCreateSchema = z.object({
  article_ids: z.array(z.string()).min(1, 'Selecione ao menos um artigo'),
  client_id: z.string().nullish(),
  mes: z.string().nullish(),
})

// ---- Licensed/public PDF imports ----
export const importInitSchema = z.object({
  filename: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .refine((v) => /\.pdf$/i.test(v), 'Envie um arquivo PDF'),
  size: z
    .number()
    .int()
    .positive()
    .max(50 * 1024 * 1024, 'O PDF deve ter no máximo 50 MB'),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i, 'SHA-256 inválido'),
  batch_id: z.string().uuid('Lote inválido').optional(),
})

export const importBatchCreateSchema = z.object({
  client_id: z.string().uuid('Cliente inválido'),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Use o período YYYY-MM'),
  intent: z.enum(['noticias', 'relatorio_referencia']),
  total_files: z.number().int().min(1).max(100),
})

export const reportDraftCreateSchema = z.object({
  client_id: z.string().uuid('Cliente inválido'),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Use o período YYYY-MM'),
  monthly_instructions: z.string().max(10000).optional().default(''),
  service_metrics: z.record(z.string(), z.number().int().min(0)).optional().default({}),
  new_version: z.boolean().optional().default(false),
})

export const reportDraftUpdateSchema = z.object({
  monthly_instructions: z.string().max(10000),
  service_metrics: z.record(z.string(), z.number().int().min(0)),
})

export const reportDraftLeadSchema = z.object({
  article_id: z.string().uuid('Matéria inválida'),
})

export const reportDraftSectionSchema = z.object({
  instructions: z.string().max(10000).optional(),
})

export const reportDraftSectionEditSchema = z.object({
  content: z.string().min(1, 'O texto não pode ficar vazio'),
})

// ---- Monthly editions ----
export const editionCloseSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Use o período YYYY-MM'),
  client_ids: z.array(z.string().min(1)).optional(),
  dispatch: z.boolean().optional().default(false),
})

export const editionCompleteSchema = z.object({
  pdf_storage_path: z.string().trim().min(1),
  summary_markdown: z.string().nullish(),
  summary_data: z.record(z.string(), z.unknown()).optional(),
})

// ---- Reports ----
export const reportMetadataSchema = z.object({
  mes: z.string().trim().min(1, 'Mês de referência é obrigatório'),
  reunioes_presenciais: z.number().int().min(0),
  reunioes_virtuais: z.number().int().min(0),
  orientacoes: z.number().int().min(0),
  acoes_imprensa: z.number().int().min(0),
})

export const reportCreateSchema = z.object({
  // `reports.prompt` is NOT NULL — default to '' so an omitted prompt is valid.
  prompt: z.string().default(''),
  article_ids: z.array(z.string()).min(1, 'Selecione ao menos um artigo'),
  metadata: reportMetadataSchema.optional(),
  client_id: z.string().nullish(),
  // When provided, the report was generated section-by-section on the client and
  // is saved as-is (no server-side AI call).
  content: z.string().optional(),
})

// One group of the sectioned report generation (Vercel Hobby 60s-safe flow).
export const reportSectionSchema = z.object({
  group: z.number().int().min(0),
  prompt: z.string().default(''),
  article_ids: z.array(z.string()).min(1, 'Selecione ao menos um artigo'),
  metadata: reportMetadataSchema.optional(),
  client_id: z.string().nullish(),
  prior: z.string().nullish(),
})

/** Flattens Zod issues into a single human-readable message for API responses. */
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((i) => {
      const path = i.path.join('.')
      return path ? `${path}: ${i.message}` : i.message
    })
    .join('; ')
}
