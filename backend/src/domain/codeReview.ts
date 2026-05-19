export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low'

export type ReviewIssue = {
  title: string
  severity: IssueSeverity
  category: 'hooks' | 'architecture' | 'render-loop' | 'maintainability' | 'performance'
  explanation: string
  suggestion: string
  lineHint?: string | undefined
}

export type RefactorSuggestion = {
  title: string
  rationale: string
  example?: string | undefined
}

export type ReviewScore = {
  overall: number
  hooks: number
  architecture: number
  maintainability: number
  performance: number
}

export type ReactCodeReview = {
  summary: string
  issues: ReviewIssue[]
  refactor: RefactorSuggestion[]
  score: ReviewScore
  metadata?: {
    isFallback: boolean
    rawAiResponse?: string | undefined
    parsingError?: string | undefined
  } | undefined
}

export type AiReviewerPort = {
  analyzeReactCode(code: string): Promise<ReactCodeReview>
}
