import Editor from '@monaco-editor/react'
import { AlertTriangle, Clipboard, Loader2, Radar, ShieldCheck, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { analyzeReactCode } from '@/features/review/api'
import type { ReviewResponse } from '@/types/review'

const sampleCode = `import { useEffect, useState } from 'react'

export function UserPanel({ userId }: { userId: string }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch('/api/users/' + userId)
      .then((res) => res.json())
      .then(setUser)
      .finally(() => setLoading(false))
  }, [user])

  if (loading) return <p>Loading...</p>
  return <pre>{JSON.stringify(user, null, 2)}</pre>
}`

function App() {
  const [code, setCode] = useState(sampleCode)
  const [review, setReview] = useState<ReviewResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleAnalyze() {
    setError(null)
    setIsLoading(true)

    try {
      const result = await analyzeReactCode(code)
      setReview(result)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unexpected review failure.')
    } finally {
      setIsLoading(false)
    }
  }

  function copyReview() {
    if (!review) return
    void navigator.clipboard.writeText(JSON.stringify(review, null, 2))
  }

  return (
    <main className="min-h-screen px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-5 rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-2xl shadow-black/30 backdrop-blur lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-sm text-cyan-100">
              <ShieldCheck className="h-4 w-4" />
              Local Gemma reviews through Ollama
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">
                React code review for hooks, architecture, and render loops.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Paste a component, run a focused AI review, and get pragmatic issues, scores, and
                refactoring suggestions without adding auth, databases, or enterprise weight.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center lg:min-w-80">
            {['Hooks', 'Loops', 'Design'].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Review</p>
                <p className="mt-1 font-semibold text-cyan-100">{item}</p>
              </div>
            ))}
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(380px,0.9fr)]">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-white/10">
              <div>
                <CardTitle>React Snippet</CardTitle>
                <p className="text-sm text-slate-400">Monaco editor with TypeScript JSX support.</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void navigator.clipboard.writeText(code)}
              >
                <Clipboard className="h-4 w-4" />
                Copy code
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[520px] overflow-hidden border-b border-white/10">
                <Editor
                  height="100%"
                  defaultLanguage="typescript"
                  theme="vs-dark"
                  value={code}
                  onChange={(value) => setCode(value ?? '')}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    padding: { top: 18, bottom: 18 },
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                  }}
                />
              </div>
              <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-400">Backend endpoint: POST /api/reviews/react</p>
                <Button onClick={handleAnalyze} disabled={isLoading || code.trim().length < 20}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Radar className="h-4 w-4" />
                  )}
                  Analyze code
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-white/10">
              <div>
                <CardTitle>Review Results</CardTitle>
                <p className="text-sm text-slate-400">Issues, refactor ideas, and score cards.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={copyReview} disabled={!review}>
                <Clipboard className="h-4 w-4" />
                Copy JSON
              </Button>
            </CardHeader>
            <CardContent className="pt-5">
              {isLoading ? <LoadingState /> : null}
              {error ? <ErrorState message={error} /> : null}
              {!isLoading && !error && review ? <ReviewPanels review={review} /> : null}
              {!isLoading && !error && !review ? <EmptyState /> : null}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}

function ReviewPanels({ review }: { review: ReviewResponse }) {
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {review.metadata?.isFallback ? <FallbackNotice review={review} /> : null}
      <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/8 p-4 text-sm leading-6 text-cyan-50">
        {review.summary}
      </div>
      <Tabs defaultValue="issues">
        <TabsList className="w-full justify-between sm:w-auto">
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="refactor">Refactor</TabsTrigger>
          <TabsTrigger value="score">Score</TabsTrigger>
        </TabsList>
        <TabsContent value="issues">
          <div className="space-y-3">
            {review.issues.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                No issues returned.
              </p>
            ) : (
              review.issues.map((issue) => (
                <article
                  key={`${issue.title}-${issue.category}`}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
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
                  <p className="mt-3 text-sm leading-6 text-cyan-100">{issue.suggestion}</p>
                  {issue.lineHint ? (
                    <p className="mt-2 text-xs text-slate-500">Hint: {issue.lineHint}</p>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </TabsContent>
        <TabsContent value="refactor">
          <div className="space-y-3">
            {review.refactor.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                No refactor suggestions returned.
              </p>
            ) : (
              review.refactor.map((item) => (
                <article
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <h3 className="font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.rationale}</p>
                  {item.example ? (
                    <pre className="mt-3 overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-cyan-100">
                      {item.example}
                    </pre>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </TabsContent>
        <TabsContent value="score">
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(review.score).map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm capitalize text-slate-400">{label}</p>
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
        </TabsContent>
      </Tabs>
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

function EmptyState() {
  return (
    <div className="grid min-h-[420px] place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-8 text-center">
      <div className="max-w-sm space-y-3">
        <Sparkles className="mx-auto h-10 w-10 text-cyan-200" />
        <h2 className="text-xl font-semibold text-white">Ready for a local AI review</h2>
        <p className="text-sm leading-6 text-slate-400">
          Start Ollama, pull a Gemma model, then analyze a React snippet.
        </p>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="grid min-h-[420px] place-items-center rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
      <div className="space-y-3">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-cyan-200" />
        <h2 className="text-xl font-semibold text-white">Gemma is reviewing your component</h2>
        <p className="text-sm text-slate-400">
          Checking hooks, render loops, architecture, and maintainability.
        </p>
      </div>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-5 text-red-100">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <h2 className="font-semibold">Review failed</h2>
          <p className="mt-1 text-sm leading-6 text-red-100/80">{message}</p>
        </div>
      </div>
    </div>
  )
}

export default App
