import type { ReviewResponse } from '@/types/review'

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3333'

export async function analyzeReactCode(code: string): Promise<ReviewResponse> {
  const response = await fetch(`${apiUrl}/api/reviews/react`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null
    throw new Error(payload?.message ?? 'The review request failed.')
  }

  return response.json() as Promise<ReviewResponse>
}
