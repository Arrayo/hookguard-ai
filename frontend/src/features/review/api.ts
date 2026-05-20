import type { ReviewResponse } from '@/types/review'
import { demoResponses } from './demoResponses'
import { demoExamples } from './demoExamples'

export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3333'

type SseEvent =
  | { type: 'token'; text: string }
  | { type: 'done'; review: ReviewResponse }
  | { type: 'error'; message: string }

export function getDemoKey(code: string): string | null {
  const match = demoExamples.find((d) => d.code.trim() === code.trim())
  return match?.short ?? null
}

export async function streamReactCode(
  code: string,
  onToken: (text: string) => void,
  signal?: AbortSignal,
): Promise<ReviewResponse> {
  if (DEMO_MODE) {
    return streamDemoResponse(code, onToken, signal)
  }

  const response = await fetch(`${apiUrl}/api/reviews/react/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
    signal,
  })

  if (!response.ok || !response.body) {
    throw new Error('Stream request failed')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      if (!part.startsWith('data: ')) continue
      const event = JSON.parse(part.slice(6)) as SseEvent
      if (event.type === 'token') onToken(event.text)
      if (event.type === 'error') throw new Error(event.message)
      if (event.type === 'done') return event.review
    }
  }

  throw new Error('Stream ended without a review result')
}

async function streamDemoResponse(
  code: string,
  onToken: (text: string) => void,
  signal?: AbortSignal,
): Promise<ReviewResponse> {
  const key = getDemoKey(code)
  const review = key ? demoResponses.get(key) : undefined

  if (!review) {
    throw new Error('Demo mode: only built-in examples can be analysed without a running backend.')
  }

  const text = JSON.stringify(review, null, 2)
  const words = text.split(/(?<=\s)/)

  for (const word of words) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    onToken(word)
    await delay(12)
  }

  return review
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
