import type { AiReviewerPort, ReactCodeReview } from '../domain/codeReview.js'

export type AnalyzeReactCodeInput = {
  code: string
}

export class AnalyzeReactCodeUseCase {
  constructor(private readonly reviewer: AiReviewerPort) {}

  async execute(input: AnalyzeReactCodeInput): Promise<ReactCodeReview> {
    return this.reviewer.analyzeReactCode(input.code)
  }
}
