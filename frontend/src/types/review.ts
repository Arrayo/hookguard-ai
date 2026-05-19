export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low'

export type ReviewIssue = {
  title: string
  severity: IssueSeverity
  category: 'hooks' | 'architecture' | 'render-loop' | 'maintainability' | 'performance'
  explanation: string
  suggestion: string
  lineHint?: string
}

export type RefactorSuggestion = {
  title: string
  rationale: string
  example?: string
}

export type ReviewResponse = {
  summary: string
  issues: ReviewIssue[]
  refactor: RefactorSuggestion[]
  score: {
    overall: number
    hooks: number
    architecture: number
    maintainability: number
    performance: number
  }
  metadata?: {
    isFallback: boolean
    rawAiResponse?: string
    parsingError?: string
  }
}
