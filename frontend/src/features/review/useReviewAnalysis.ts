import { useRef, useState } from 'react'
import type { ReviewResponse } from '@/types/review'
import { streamReactCode } from './api'

type ReviewAnalysisState = {
  review: ReviewResponse | null
  error: string | null
  isLoading: boolean
  streamText: string
}

type ReviewAnalysisActions = {
  analyze: () => Promise<void>
  copyReview: () => void
  paste: () => Promise<void>
}

export function useReviewAnalysis(code: string, onCodeChange: (code: string) => void) {
  const [review, setReview] = useState<ReviewResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [streamText, setStreamText] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const state: ReviewAnalysisState = { review, error, isLoading, streamText }

  const actions: ReviewAnalysisActions = {
    async analyze() {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setError(null)
      setReview(null)
      setStreamText('')
      setIsLoading(true)

      try {
        const result = await streamReactCode(
          code,
          (token) => setStreamText((prev) => prev + token),
          controller.signal,
        )
        setReview(result)
        setStreamText('')
      } catch (caught) {
        if ((caught as Error).name !== 'AbortError') {
          setError(caught instanceof Error ? caught.message : 'Unexpected review failure.')
        }
      } finally {
        setIsLoading(false)
      }
    },

    copyReview() {
      if (!review) return
      void navigator.clipboard.writeText(JSON.stringify(review, null, 2))
    },

    async paste() {
      try {
        const text = await navigator.clipboard.readText()
        if (text.trim()) onCodeChange(text)
      } catch {
        // Clipboard access denied — user needs to paste manually
      }
    },
  }

  return { state, actions }
}
