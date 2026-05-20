import type { ReactCodeReview } from '../../domain/codeReview.js'
import { analyzeCodeResponseSchema } from '../../interfaces/http/schemas/reviewSchemas.js'

export function parseAiReviewResponse(rawAiResponse: string): ReactCodeReview {
  const sanitized = sanitizeRawResponse(rawAiResponse)
  const jsonText = extractJsonFromText(sanitized)
  console.debug('[HookGuard AI] Extracted JSON candidate:', jsonText)

  if (!jsonText) {
    return fallbackReview(rawAiResponse, 'No JSON object found in AI response.')
  }

  const parsed = parseJsonCandidate(jsonText)
  if (!parsed.ok) {
    console.warn('[HookGuard AI] JSON parsing failed:', parsed.error.message)
    return fallbackReview(rawAiResponse, parsed.error.message)
  }

  const normalized = normalizeReview(parsed.value, rawAiResponse)
  const validated = analyzeCodeResponseSchema.safeParse(normalized)

  if (!validated.success) {
    console.warn('[HookGuard AI] Response validation recovered with fallback:', validated.error.issues)
    return fallbackReview(rawAiResponse, 'AI response did not match the expected review shape.')
  }

  console.debug('[HookGuard AI] Response parsing succeeded.')
  return validated.data
}

function sanitizeRawResponse(content: string): string {
  return content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
}

export function extractJsonFromText(content: string): string | null {
  const start = content.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < content.length; index += 1) {
    const char = content[index]

    if (escaped) { escaped = false; continue }
    if (char === '\\') { escaped = true; continue }
    if (char === '"') { inString = !inString; continue }
    if (inString) continue

    if (char === '{') depth += 1
    if (char === '}') depth -= 1

    if (depth === 0) return content.slice(start, index + 1)
  }

  return completeJsonIfNeeded(content.slice(start))
}

function parseJsonCandidate(
  jsonText: string,
): { ok: true; value: unknown } | { ok: false; error: Error } {
  for (const candidate of [jsonText, repairJson(jsonText)]) {
    try {
      return { ok: true, value: JSON.parse(candidate) as unknown }
    } catch (caught) {
      console.debug('[HookGuard AI] JSON candidate parse failed:', String(caught))
    }
  }
  return { ok: false, error: new Error('Unable to parse AI JSON after recovery attempts.') }
}

function repairJson(jsonText: string): string {
  return jsonText
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/\\`/g, '`')
    .replace(/\\\$/g, '$')
    .replace(/\/\/.*$/gm, '')
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/\\\s+([\[\]{}])/g, '$1')
    .trim()
}

function completeJsonIfNeeded(jsonText: string): string {
  let fixed = jsonText.trim()
  let objectDepth = 0
  let arrayDepth = 0
  let inString = false
  let escaped = false

  for (const char of fixed) {
    if (escaped) { escaped = false; continue }
    if (char === '\\') { escaped = true; continue }
    if (char === '"') { inString = !inString; continue }
    if (inString) continue

    if (char === '{') objectDepth += 1
    if (char === '}') objectDepth -= 1
    if (char === '[') arrayDepth += 1
    if (char === ']') arrayDepth -= 1
  }

  if (inString) fixed += '"'
  while (arrayDepth > 0) { fixed += ']'; arrayDepth -= 1 }
  while (objectDepth > 0) { fixed += '}'; objectDepth -= 1 }

  return fixed
}

function normalizeReview(value: unknown, rawAiResponse: string): ReactCodeReview {
  const record = isRecord(value) ? value : {}
  const issues = Array.isArray(record.issues)
    ? record.issues.map(normalizeIssue).filter(isDefined)
    : []
  const refactor = Array.isArray(record.refactor)
    ? record.refactor.map(normalizeRefactor).filter(isDefined)
    : []

  return {
    summary: toText(record.summary) ?? 'Review completed with a partially recovered AI response.',
    issues,
    refactor,
    score: normalizeScore(record.score, issues),
    metadata: { isFallback: false, rawAiResponse },
  }
}

function normalizeIssue(value: unknown): ReactCodeReview['issues'][number] | null {
  if (!isRecord(value)) return null

  return {
    title: toText(value.title) ?? 'Recovered issue',
    severity: normalizeSeverity(value.severity),
    category: normalizeCategory(value.category),
    explanation: toText(value.explanation) ?? 'Gemma returned an incomplete issue explanation.',
    suggestion: toText(value.suggestion) ?? 'Review the highlighted code manually.',
    lineHint: toText(value.lineHint),
  }
}

function normalizeRefactor(value: unknown): ReactCodeReview['refactor'][number] | null {
  if (!isRecord(value)) return null

  return {
    title: toText(value.title) ?? 'Recovered refactor suggestion',
    rationale: toText(value.rationale) ?? 'Gemma returned an incomplete refactor rationale.',
    changes: toText(value.changes),
    example: toText(value.example),
  }
}

function normalizeScore(
  value: unknown,
  issues: ReactCodeReview['issues'],
): ReactCodeReview['score'] {
  const record = isRecord(value) ? value : {}
  const derived = deriveScoreFromIssues(issues)

  const score = {
    overall: Math.min(normalizeScoreValue(record.overall, derived.overall), severityCap(issues)),
    hooks: normalizeScoreValue(record.hooks, derived.hooks),
    architecture: normalizeScoreValue(record.architecture, derived.architecture),
    maintainability: normalizeScoreValue(record.maintainability, derived.maintainability),
    performance: normalizeScoreValue(record.performance, derived.performance),
  }

  return capAffectedCategoryScores(score, issues)
}

function capAffectedCategoryScores(
  score: ReactCodeReview['score'],
  issues: ReactCodeReview['issues'],
): ReactCodeReview['score'] {
  const capped = { ...score }

  for (const issue of issues) {
    const key = scoreKeyForCategory(issue.category)
    capped[key] = Math.min(capped[key], categorySeverityCap(issue.severity))
  }

  return capped
}

function deriveScoreFromIssues(issues: ReactCodeReview['issues']): ReactCodeReview['score'] {
  const score: ReactCodeReview['score'] = {
    overall: 95,
    hooks: 95,
    architecture: 92,
    maintainability: 92,
    performance: 92,
  }

  for (const issue of issues) {
    const penalty = severityPenalty(issue.severity)
    const key = scoreKeyForCategory(issue.category)
    score[key] = Math.max(20, score[key] - penalty)
    score.maintainability = Math.max(25, score.maintainability - Math.ceil(penalty / 3))

    if (issue.category === 'hooks' && (issue.severity === 'high' || issue.severity === 'critical')) {
      score.performance = Math.max(20, score.performance - Math.ceil(penalty / 2))
    }
  }

  const categoryAverage = Math.round(
    (score.hooks + score.architecture + score.maintainability + score.performance) / 4,
  )
  score.overall = Math.min(categoryAverage, severityCap(issues))

  return score
}

function normalizeScoreValue(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) return fallback

  const rounded = Math.max(0, Math.min(100, Math.round(numeric)))
  if (rounded === 0 && fallback >= 60) return fallback
  if (Math.abs(rounded - fallback) > 30) return Math.round((rounded + fallback * 2) / 3)

  return rounded
}

function severityPenalty(severity: ReactCodeReview['issues'][number]['severity']): number {
  if (severity === 'critical') return 48
  if (severity === 'high') return 26
  if (severity === 'medium') return 12
  return 6
}

function severityCap(issues: ReactCodeReview['issues']): number {
  if (issues.some((i) => i.severity === 'critical')) return 40
  if (issues.some((i) => i.severity === 'high')) return 70
  if (issues.some((i) => i.severity === 'medium')) return 85
  return 100
}

function categorySeverityCap(severity: ReactCodeReview['issues'][number]['severity']): number {
  if (severity === 'critical') return 45
  if (severity === 'high') return 75
  if (severity === 'medium') return 85
  return 95
}

function scoreKeyForCategory(
  category: ReactCodeReview['issues'][number]['category'],
): keyof ReactCodeReview['score'] {
  if (category === 'hooks') return 'hooks'
  if (category === 'performance') return 'performance'
  if (category === 'architecture') return 'architecture'
  return 'maintainability'
}

function normalizeSeverity(value: unknown): ReactCodeReview['issues'][number]['severity'] {
  return value === 'critical' || value === 'high' || value === 'medium' || value === 'low'
    ? value
    : 'medium'
}

function normalizeCategory(value: unknown): ReactCodeReview['issues'][number]['category'] {
  return value === 'hooks' ||
    value === 'architecture' ||
    value === 'maintainability' ||
    value === 'readability' ||
    value === 'performance'
    ? value
    : 'maintainability'
}

function fallbackReview(rawAiResponse: string, parsingError: string): ReactCodeReview {
  return {
    summary: 'Gemma returned a response that could not be fully parsed, so HookGuard preserved the raw output for review.',
    issues: [
      {
        title: 'AI response parsing fallback',
        severity: 'low',
        category: 'maintainability',
        explanation: 'The model completed the request, but its response was not valid JSON for the review schema.',
        suggestion: 'Read the preserved raw AI response below, then retry if you need structured score cards.',
      },
    ],
    refactor: [],
    score: { overall: 50, hooks: 50, architecture: 50, maintainability: 50, performance: 50 },
    metadata: { isFallback: true, rawAiResponse, parsingError },
  }
}

function toText(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDefined<T>(value: T | null): value is T {
  return value !== null
}
