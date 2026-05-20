import type { ReviewResponse } from '@/types/review'

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3333'

type SseEvent =
  | { type: 'token'; text: string }
  | { type: 'done'; review: ReviewResponse }
  | { type: 'error'; message: string }

export async function analyzeReactCode(code: string): Promise<ReviewResponse> {
  const response = await fetch(`${apiUrl}/api/reviews/react`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null
    throw new Error(payload?.message ?? 'The review request failed.')
  }

  return response.json() as Promise<ReviewResponse>
}

export async function streamReactCode(
  code: string,
  onToken: (text: string) => void,
  signal?: AbortSignal,
): Promise<ReviewResponse> {
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
