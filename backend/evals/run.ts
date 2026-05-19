import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ReactCodeReview, ReviewScore, IssueSeverity } from '../src/domain/codeReview.js'

type ScoreName = keyof ReviewScore

type ScoreRange = {
  min?: number
  max?: number
}

type EvalCase = {
  id: string
  name: string
  snippet: string
  expectedCategory: EvalCategory
  expectedSeverity?: IssueSeverity | 'none'
  expectedIssueCategory?: ReactCodeReview['issues'][number]['category']
  maxSeverity?: IssueSeverity
  requiredKeywords?: string[]
  forbiddenKeywords?: string[]
  forbiddenRefactorKeywords?: string[]
  scoreRanges?: Partial<Record<ScoreName, ScoreRange>>
  requireCategoryEvidence?: boolean
}

type EvalCategory =
  | 'real infinite loops'
  | 'unstable dependencies'
  | 'harmless rerenders'
  | 'derived state'
  | 'random keys'
  | 'stale closures'
  | 'unnecessary effects'

type EvalFailure = {
  caseId: string
  type:
    | 'false positive detected'
    | 'incorrect loop classification'
    | 'invalid refactor suggestion'
    | 'expectation mismatch'
  message: string
}

type EvalResult = {
  testCase: EvalCase
  passed: boolean
  failures: EvalFailure[]
  review?: ReactCodeReview
}

const severityRank: Record<IssueSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
}

const categoryEvidence: Record<EvalCategory, string[]> = {
  'real infinite loops': ['infinite loop', 'render loop', 'maximum update depth', 'keeps updating'],
  'unstable dependencies': ['unstable', 'dependency', 'dependencies', 'recreated'],
  'harmless rerenders': ['harmless', 'rerender', 're-render', 'acceptable'],
  'derived state': ['derived state', 'derive', 'derived', 'duplicate state'],
  'random keys': ['random key', 'unstable key', 'key', 'remount'],
  'stale closures': ['stale closure', 'stale', 'closure', 'captures'],
  'unnecessary effects': ['unnecessary effect', 'effect', 'derive during render', 'usememo'],
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const evalDir = path.join(rootDir, 'evals')
const casesDir = path.join(evalDir, 'cases')
const snippetsDir = path.join(evalDir, 'snippets')
const backendUrl = getArg('--url') ?? process.env.EVALS_BACKEND_URL ?? 'http://localhost:3333'
const caseFilter = getArg('--case') ?? getPositionalArg() ?? process.env.EVALS_CASE
const timeoutMs = Number(process.env.EVALS_TIMEOUT_MS ?? 600_000)

async function main() {
  const testCases = await loadCases()
  const startedAt = Date.now()
  const results: EvalResult[] = []

  console.log(`HookGuard AI evals: ${testCases.length} cases against ${backendUrl}`)
  await assertBackendReady()

  for (const testCase of testCases) {
    const result = await runCase(testCase)
    results.push(result)
    console.log(`${result.passed ? 'PASS' : 'FAIL'} ${testCase.id} - ${testCase.name}`)
  }

  const failures = results.flatMap((result) => result.failures)
  const passed = results.length - results.filter((result) => !result.passed).length

  console.log('')
  console.log(
    `Summary: ${passed}/${results.length} passed in ${Math.round((Date.now() - startedAt) / 1000)}s`,
  )

  if (failures.length > 0) {
    console.log('')
    console.log('Mismatches:')
    for (const failure of failures) {
      console.log(`- ${failure.caseId}: ${failure.type} - ${failure.message}`)
    }
    process.exitCode = 1
  }
}

async function loadCases(): Promise<EvalCase[]> {
  const files = (await readdir(casesDir)).filter((file) => file.endsWith('.json')).sort()
  const testCases = await Promise.all(
    files.map(
      async (file) => JSON.parse(await readFile(path.join(casesDir, file), 'utf8')) as EvalCase,
    ),
  )

  if (!caseFilter) return testCases

  const filteredCases = testCases.filter(
    (testCase) => testCase.id === caseFilter || testCase.id.startsWith(caseFilter),
  )

  if (filteredCases.length === 0) {
    throw new Error(`No eval case matched "${caseFilter}".`)
  }

  return filteredCases
}

async function assertBackendReady() {
  try {
    const response = await fetch(new URL('/health', backendUrl))
    if (!response.ok) throw new Error(`health returned ${response.status}`)
  } catch (error) {
    throw new Error(
      `backend is not reachable at ${backendUrl}. Start it with "npm run dev --prefix backend". ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

async function runCase(testCase: EvalCase): Promise<EvalResult> {
  try {
    const code = await readFile(path.join(snippetsDir, testCase.snippet), 'utf8')
    const review = await analyze(code)
    const failures = validateReview(testCase, review)

    return { testCase, review, failures, passed: failures.length === 0 }
  } catch (error) {
    return {
      testCase,
      passed: false,
      failures: [
        {
          caseId: testCase.id,
          type: 'expectation mismatch',
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    }
  }
}

async function analyze(code: string): Promise<ReactCodeReview> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(new URL('/api/reviews/react', backendUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`backend returned ${response.status}: ${await response.text()}`)
    }

    return (await response.json()) as ReactCodeReview
  } finally {
    clearTimeout(timeout)
  }
}

function validateReview(testCase: EvalCase, review: ReactCodeReview): EvalFailure[] {
  const failures: EvalFailure[] = []
  const combinedText = normalizeText([
    review.summary,
    ...review.issues.flatMap((issue) => [
      issue.title,
      issue.severity,
      issue.category,
      issue.explanation,
      issue.suggestion,
    ]),
    ...review.refactor.flatMap((item) => [item.title, item.rationale, item.changes, item.example]),
  ])
  const refactorText = normalizeText(
    review.refactor.flatMap((item) => [item.title, item.rationale, item.changes, item.example]),
  )

  if (review.metadata?.isFallback) {
    failures.push({
      caseId: testCase.id,
      type: 'expectation mismatch',
      message: `AI response used fallback parser: ${review.metadata.parsingError ?? 'unknown error'}`,
    })
  }

  if (testCase.expectedSeverity === 'none' && review.issues.length > 0) {
    failures.push({
      caseId: testCase.id,
      type: 'false positive detected',
      message: `expected no issue, got ${review.issues.map((issue) => issue.severity).join(', ')}`,
    })
  }

  if (testCase.expectedSeverity && testCase.expectedSeverity !== 'none') {
    const hasExpectedSeverity = review.issues.some(
      (issue) => issue.severity === testCase.expectedSeverity,
    )
    if (!hasExpectedSeverity) {
      failures.push({
        caseId: testCase.id,
        type: 'expectation mismatch',
        message: `expected severity ${testCase.expectedSeverity}`,
      })
    }
  }

  if (testCase.maxSeverity) {
    const tooSevere = review.issues.find(
      (issue) => severityRank[issue.severity] > severityRank[testCase.maxSeverity as IssueSeverity],
    )
    if (tooSevere) {
      failures.push({
        caseId: testCase.id,
        type: 'false positive detected',
        message: `severity ${tooSevere.severity} exceeds max ${testCase.maxSeverity}`,
      })
    }
  }

  if (testCase.expectedIssueCategory) {
    const hasCategory = review.issues.some(
      (issue) => issue.category === testCase.expectedIssueCategory,
    )
    if (!hasCategory) {
      failures.push({
        caseId: testCase.id,
        type: 'expectation mismatch',
        message: `expected issue category ${testCase.expectedIssueCategory}`,
      })
    }
  }

  if (testCase.requireCategoryEvidence !== false) {
    const evidence = categoryEvidence[testCase.expectedCategory]
    if (!evidence.some((keyword) => combinedText.includes(keyword))) {
      failures.push({
        caseId: testCase.id,
        type:
          testCase.expectedCategory === 'real infinite loops'
            ? 'incorrect loop classification'
            : 'expectation mismatch',
        message: `missing category evidence for ${testCase.expectedCategory}`,
      })
    }
  }

  for (const keyword of testCase.requiredKeywords ?? []) {
    if (!combinedText.includes(keyword.toLowerCase())) {
      failures.push({
        caseId: testCase.id,
        type: 'expectation mismatch',
        message: `missing required keyword "${keyword}"`,
      })
    }
  }

  for (const keyword of testCase.forbiddenKeywords ?? []) {
    const normalizedKeyword = keyword.toLowerCase()
    if (combinedText.includes(normalizedKeyword)) {
      failures.push({
        caseId: testCase.id,
        type: classifyForbiddenKeyword(testCase, normalizedKeyword, refactorText),
        message: `forbidden keyword "${keyword}" was present`,
      })
    }
  }

  for (const keyword of testCase.forbiddenRefactorKeywords ?? []) {
    const normalizedKeyword = keyword.toLowerCase()
    if (refactorText.includes(normalizedKeyword)) {
      failures.push({
        caseId: testCase.id,
        type: 'invalid refactor suggestion',
        message: `forbidden refactor keyword "${keyword}" was present`,
      })
    }
  }

  for (const [scoreName, range] of Object.entries(testCase.scoreRanges ?? {}) as [
    ScoreName,
    ScoreRange,
  ][]) {
    const score = review.score[scoreName]
    if (range.min !== undefined && score < range.min) {
      failures.push({
        caseId: testCase.id,
        type: 'expectation mismatch',
        message: `${scoreName} score ${score} is below ${range.min}`,
      })
    }
    if (range.max !== undefined && score > range.max) {
      failures.push({
        caseId: testCase.id,
        type: 'expectation mismatch',
        message: `${scoreName} score ${score} is above ${range.max}`,
      })
    }
  }

  return failures
}

function classifyForbiddenKeyword(
  testCase: EvalCase,
  keyword: string,
  refactorText: string,
): EvalFailure['type'] {
  if (testCase.expectedCategory === 'harmless rerenders') return 'false positive detected'
  if (keyword.includes('infinite loop') || keyword.includes('render loop'))
    return 'incorrect loop classification'
  if (refactorText.includes(keyword)) return 'invalid refactor suggestion'

  return 'expectation mismatch'
}

function normalizeText(values: Array<string | undefined>): string {
  return values.filter(Boolean).join('\n').toLowerCase()
}

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

function getPositionalArg(): string | undefined {
  return process.argv.slice(2).find((arg) => !arg.startsWith('-'))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
