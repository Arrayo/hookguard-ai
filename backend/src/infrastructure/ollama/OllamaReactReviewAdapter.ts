import { createHash } from 'node:crypto'
import { Ollama } from 'ollama'
import type { AiReviewerPort, ReactCodeReview, StreamEvent } from '../../domain/codeReview.js'
import { buildAstFacts } from '../ast/reactHooksAnalyzer.js'
import { parseAiReviewResponse } from './aiResponseParser.js'
import { buildCodeFacts } from './codeFactsBuilder.js'
import { systemPrompt } from './systemPrompt.js'

const REVIEW_TIMEOUT_MS = 300_000
const NUM_PREDICT = 1200

export class OllamaReactReviewAdapter implements AiReviewerPort {
  private readonly client: Ollama
  private readonly cache = new Map<string, ReactCodeReview>()

  constructor(
    private readonly model: string,
    host?: string,
  ) {
    this.client = host ? new Ollama({ host }) : new Ollama()
  }

  async analyzeReactCode(code: string): Promise<ReactCodeReview> {
    const hash = codeHash(code)
    const cached = this.cache.get(hash)
    if (cached) {
      console.debug('[HookGuard AI] Cache hit for code hash:', hash.slice(0, 8))
      return cached
    }

    const review = await this.runWithTimeout(() => this.callOllama(code))
    this.cache.set(hash, review)
    return review
  }

  async analyzeReactCodeStream(
    code: string,
    onEvent: (event: StreamEvent) => void,
  ): Promise<ReactCodeReview> {
    const hash = codeHash(code)
    const cached = this.cache.get(hash)
    if (cached) {
      console.debug('[HookGuard AI] Cache hit (stream) for hash:', hash.slice(0, 8))
      return cached
    }

    const stream = await this.client.chat({
      model: this.model,
      messages: buildMessages(code),
      stream: true,
      options: { temperature: 0, num_predict: NUM_PREDICT },
    })

    let fullText = ''
    for await (const chunk of stream) {
      const token = chunk.message.content
      fullText += token
      onEvent({ type: 'token', text: token })
    }

    console.debug('[HookGuard AI] Stream complete, parsing response')
    const review = parseAiReviewResponse(fullText)
    this.cache.set(hash, review)
    return review
  }

  private async callOllama(code: string): Promise<ReactCodeReview> {
    const response = await this.client.chat({
      model: this.model,
      messages: buildMessages(code),
      options: { temperature: 0, num_predict: NUM_PREDICT },
    })

    console.debug('[HookGuard AI] Raw Ollama response:', response.message.content)
    return parseAiReviewResponse(response.message.content)
  }

  private runWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Ollama review timed out after 5 minutes')),
        REVIEW_TIMEOUT_MS,
      )
      fn().then(
        (result) => { clearTimeout(timer); resolve(result) },
        (error: unknown) => { clearTimeout(timer); reject(error) },
      )
    })
  }
}

function codeHash(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

function buildMessages(code: string): Array<{ role: 'system' | 'user'; content: string }> {
  const astFacts = buildAstFacts(code)
  const regexFacts = buildCodeFacts(code)
  const allFacts = astFacts ? `${astFacts}\n${regexFacts}` : regexFacts

  return [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Review only the React code between <react_code> tags. Do not review examples or rules from the system prompt as if they were submitted code.

Facts about the submitted code, computed before review:
${allFacts}

If a fact says a hook or pattern is absent, do not report issues that require that absent code.
If recommendedPrimaryIssue is present, use it as the primary issue, including its severity and category, and do not replace it with a different classification.
If recommendedRefactorExample is present, use that code as the basis for the refactor example and do not wrap it in markdown fences.
If primitiveStringProps lists a prop, do not call that prop an unstable dependency.
Do not add style, className, title, or other JSX attributes in refactor examples unless those attributes are already in the submitted code.

<react_code>
${code}
</react_code>`,
    },
  ]
}
