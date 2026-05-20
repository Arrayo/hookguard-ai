import { Check, Clipboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ReviewResponse } from '@/types/review'
import { useCopyFeedback } from '@/hooks/useCopyFeedback'
import { scoreEntries, scoreLabel, scoreTone } from '../scoreUtils'

type Props = { review: ReviewResponse }

export function ReviewPanels({ review }: Props) {
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {review.metadata?.isFallback ? <FallbackNotice review={review} /> : null}
      <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/8 p-4 text-sm leading-6 text-cyan-50 shadow-inner shadow-cyan-950/20">
        {review.summary}
      </div>
      <Tabs defaultValue="issues">
        <TabsList className="w-full justify-between sm:w-auto">
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="refactor">Refactor</TabsTrigger>
          <TabsTrigger value="score">Score</TabsTrigger>
        </TabsList>
        <TabsContent value="issues">
          <IssuesList issues={review.issues} />
        </TabsContent>
        <TabsContent value="refactor">
          <RefactorList refactors={review.refactor} />
        </TabsContent>
        <TabsContent value="score">
          <ScoreGrid score={review.score} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function IssuesList({ issues }: { issues: ReviewResponse['issues'] }) {
  if (issues.length === 0) {
    return (
      <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
        No concrete issues returned. Scores should stay high when the model does not find a specific risk.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {issues.map((issue) => (
        <article
          key={`${issue.title}-${issue.category}`}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-sm shadow-black/10"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs uppercase tracking-wide text-slate-300">
              {issue.severity}
            </span>
            <span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-xs text-cyan-100">
              {issue.category}
            </span>
          </div>
          <h3 className="mt-3 font-semibold text-white">{issue.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">{issue.explanation}</p>
          <p className="mt-3 rounded-xl border border-cyan-300/10 bg-cyan-300/[0.06] p-3 text-sm leading-6 text-cyan-100">
            {issue.suggestion}
          </p>
          {issue.lineHint ? (
            <p className="mt-2 text-xs text-slate-500">Hint: {issue.lineHint}</p>
          ) : null}
        </article>
      ))}
    </div>
  )
}

function RefactorList({ refactors }: { refactors: ReviewResponse['refactor'] }) {
  if (refactors.length === 0) {
    return (
      <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
        No refactor needed yet. When issues exist, HookGuard asks Gemma for minimal corrected code.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {refactors.map((item) => <RefactorCard key={item.title} item={item} />)}
    </div>
  )
}

function RefactorCard({ item }: { item: ReviewResponse['refactor'][number] }) {
  const { copied, copy } = useCopyFeedback()

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] shadow-sm shadow-black/10">
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">Minimal fix</p>
            <h3 className="mt-1 font-semibold text-white">{item.title}</h3>
          </div>
          {item.example ? (
            <Button
              variant="ghost"
              size="sm"
              className={copied ? 'text-emerald-400' : ''}
              onClick={() => void copy(item.example ?? '')}
            >
              {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          ) : null}
        </div>
        <p className="text-sm leading-6 text-slate-300">{item.rationale}</p>
        {item.changes ? (
          <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-sm leading-6 text-slate-300">
            <span className="font-medium text-cyan-100">Changed: </span>
            {item.changes}
          </div>
        ) : null}
      </div>
      {item.example ? (
        <div className="border-t border-white/10 bg-slate-950/80">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-slate-500">
            <span>after.tsx</span>
            <span>copy-ready</span>
          </div>
          <pre className="overflow-auto p-4 text-xs leading-5 text-cyan-50">
            <code className="language-tsx">{item.example}</code>
          </pre>
        </div>
      ) : null}
    </article>
  )
}

function ScoreGrid({ score }: { score: ReviewResponse['score'] }) {
  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-slate-400">
        Scores are normalized from concrete findings so unrelated categories do not collapse to zero.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {scoreEntries(score).map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm capitalize text-slate-400">{label}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs ${scoreTone(value)}`}>
                {scoreLabel(value)}
              </span>
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <strong className="text-3xl text-white">{value}</strong>
              <span className="text-sm text-slate-500">/100</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-cyan-300 transition-all"
                style={{ width: `${value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FallbackNotice({ review }: { review: ReviewResponse }) {
  return (
    <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-amber-50">
      <h2 className="font-semibold">Recovered imperfect AI response</h2>
      <p className="mt-1 text-sm leading-6 text-amber-50/80">
        Gemma answered, but its JSON was malformed. HookGuard generated a safe fallback instead of
        failing the review.
      </p>
      {review.metadata?.parsingError ? (
        <p className="mt-2 text-xs text-amber-100/70">Parser detail: {review.metadata.parsingError}</p>
      ) : null}
      {review.metadata?.rawAiResponse ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-amber-100">Show raw AI text</summary>
          <pre className="mt-3 max-h-64 overflow-auto rounded-xl bg-slate-950 p-3 text-xs leading-5 text-amber-50/90">
            {review.metadata.rawAiResponse}
          </pre>
        </details>
      ) : null}
    </div>
  )
}
