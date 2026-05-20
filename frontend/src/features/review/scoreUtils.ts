import type { ReviewResponse } from '@/types/review'

export function scoreEntries(score: ReviewResponse['score']) {
  return [
    ['overall', score.overall],
    ['hooks', score.hooks],
    ['performance', score.performance],
    ['architecture', score.architecture],
    ['maintainability', score.maintainability],
  ] as const
}

export function scoreLabel(value: number): string {
  if (value >= 85) return 'strong'
  if (value >= 70) return 'watch'
  if (value >= 50) return 'risk'
  return 'urgent'
}

export function scoreTone(value: number): string {
  if (value >= 85) return 'bg-emerald-300/10 text-emerald-100'
  if (value >= 70) return 'bg-cyan-300/10 text-cyan-100'
  if (value >= 50) return 'bg-amber-300/10 text-amber-100'
  return 'bg-red-400/10 text-red-100'
}
