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
})

export const sourceUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').optional(),
  url: urlString.optional(),
  type: z.enum(['rss', 'scrape']).optional(),
  active: z.boolean().optional(),
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
  logo_url: z.string().nullish(),
})

export const clientUpdateSchema = clientCreateSchema

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
