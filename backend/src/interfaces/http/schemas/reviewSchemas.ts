import { z } from 'zod'

export const analyzeCodeRequestSchema = z.object({
  code: z
    .string()
    .trim()
    .min(20, 'Paste at least 20 characters of React code.')
    .max(40_000, 'Code is too large for this MVP. Keep snippets under 40,000 characters.'),
})

export const reviewIssueSchema = z.object({
  title: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  category: z.enum(['hooks', 'performance', 'architecture', 'maintainability', 'readability']),
  explanation: z.string(),
  suggestion: z.string(),
  lineHint: z.string().optional(),
})

export const refactorSuggestionSchema = z.object({
  title: z.string(),
  rationale: z.string(),
  changes: z.string().optional(),
  example: z.string().optional(),
})

export const reviewScoreSchema = z.object({
  overall: z.number().min(0).max(100),
  hooks: z.number().min(0).max(100),
  architecture: z.number().min(0).max(100),
  maintainability: z.number().min(0).max(100),
  performance: z.number().min(0).max(100),
})

export const analyzeCodeResponseSchema = z.object({
  summary: z.string().catch('Review completed, but the AI response needed recovery.'),
  issues: z.array(reviewIssueSchema).catch([]),
  refactor: z.array(refactorSuggestionSchema).catch([]),
  score: reviewScoreSchema,
  metadata: z
    .object({
      isFallback: z.boolean(),
      rawAiResponse: z.string().optional(),
      parsingError: z.string().optional(),
    })
    .optional(),
})

export type AnalyzeCodeRequest = z.infer<typeof analyzeCodeRequestSchema>
