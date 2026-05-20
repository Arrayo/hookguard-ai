export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low'

export type ReviewIssue = {
  title: string
  severity: IssueSeverity
  category: 'hooks' | 'performance' | 'architecture' | 'maintainability' | 'readability'
  explanation: string
  suggestion: string
  lineHint?: string | undefined
}

export type RefactorSuggestion = {
  title: string
  rationale: string
  changes?: string | undefined
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

export type StreamEvent =
  | { type: 'token'; text: string }
  | { type: 'error'; message: string }

export type AiReviewerPort = {
  analyzeReactCode(code: string): Promise<ReactCodeReview>
  analyzeReactCodeStream(
    code: string,
    onEvent: (event: StreamEvent) => void,
  ): Promise<ReactCodeReview>
}
