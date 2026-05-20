import type { AiReviewerPort, ReactCodeReview, StreamEvent } from '../domain/codeReview.js'

export type AnalyzeReactCodeInput = {
  code: string
}

export class AnalyzeReactCodeUseCase {
  constructor(private readonly reviewer: AiReviewerPort) {}

  async execute(input: AnalyzeReactCodeInput): Promise<ReactCodeReview> {
    return this.reviewer.analyzeReactCode(input.code)
  }

  async executeStream(
    input: AnalyzeReactCodeInput,
    onEvent: (event: StreamEvent) => void,
  ): Promise<ReactCodeReview> {
    return this.reviewer.analyzeReactCodeStream(input.code, onEvent)
  }
}
