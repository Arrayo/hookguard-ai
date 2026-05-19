import Editor from '@monaco-editor/react'
import { AlertTriangle, Clipboard, Loader2, Radar, ShieldCheck, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { analyzeReactCode } from '@/features/review/api'
import type { ReviewResponse } from '@/types/review'

const demoExamples = [
  {
    label: 'Infinite loop',
    description: 'Effect updates its own dependency',
    code: `import { useEffect, useState } from 'react'

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
}`,
  },
  {
    label: 'Unstable deps',
    description: 'Object dependency recreated per render',
    code: `import { useEffect, useState } from 'react'

export function SearchResults({ query }: { query: string }) {
  const [results, setResults] = useState([])
  const filters = { query, limit: 20 }

  useEffect(() => {
    fetch('/api/search?q=' + filters.query + '&limit=' + filters.limit)
      .then((res) => res.json())
      .then(setResults)
  }, [filters])

  return <pre>{JSON.stringify(results, null, 2)}</pre>
}`,
  },
  {
    label: 'Random keys',
    description: 'Keys remount stateful children',
    code: `type Todo = { id: string; title: string; done: boolean }

export function TodoList({ todos }: { todos: Todo[] }) {
  return (
    <ul>
      {todos.map((todo) => (
        <li key={Math.random()}>
          <input defaultChecked={todo.done} type="checkbox" />
          {todo.title}
        </li>
      ))}
    </ul>
  )
}`,
  },
  {
    label: 'Derived state',
    description: 'Stores values that can be computed',
    code: `import { useEffect, useState } from 'react'

type Item = { id: string; name: string; active: boolean }

export function ActiveItems({ items }: { items: Item[] }) {
  const [activeItems, setActiveItems] = useState<Item[]>([])

  useEffect(() => {
    setActiveItems(items.filter((item) => item.active))
  }, [items])

  return <p>Active items: {activeItems.map((item) => item.name).join(', ')}</p>
}`,
  },
]

const sampleCode = demoExamples[0].code

function App() {
  const [code, setCode] = useState(sampleCode)
  const [review, setReview] = useState<ReviewResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const activeDemo = demoExamples.find((example) => example.code === code)

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
                Production-grade React review, locally.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Paste a component or load a demo to surface hook bugs, rerender causes, and minimal
                refactors with a senior frontend lens.
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
                <p className="text-sm text-slate-400">
                  {activeDemo ? activeDemo.description : 'Paste your own TypeScript or JSX snippet.'}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Demo cases</p>
                <div className="flex flex-wrap justify-end gap-2 rounded-2xl border border-white/10 bg-slate-950/50 p-1.5">
                {demoExamples.map((example) => (
                  <Button
                    key={example.label}
                    variant={activeDemo?.label === example.label ? 'secondary' : 'ghost'}
                    size="sm"
                    className={activeDemo?.label === example.label ? 'bg-cyan-300/12 text-cyan-100' : ''}
                    onClick={() => setCode(example.code)}
                    title={example.description}
                  >
                    {example.label}
                  </Button>
                ))}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void navigator.clipboard.writeText(code)}
                >
                  <Clipboard className="h-4 w-4" />
                  Copy code
                </Button>
              </div>
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
                <p className="text-sm text-slate-400">Local endpoint: POST /api/reviews/react</p>
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
                <p className="text-sm text-slate-400">Prioritized findings, fixes, and normalized scores.</p>
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
          <div className="space-y-3">
            {review.issues.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                No concrete issues returned. Scores should stay high when the model does not find a specific risk.
              </p>
            ) : (
              review.issues.map((issue) => (
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
              ))
            )}
          </div>
        </TabsContent>
        <TabsContent value="refactor">
          <div className="space-y-3">
            {review.refactor.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                No refactor needed yet. When issues exist, HookGuard asks Gemma for minimal corrected code.
              </p>
            ) : (
              review.refactor.map((item) => <RefactorCard key={item.title} item={item} />)
            )}
          </div>
        </TabsContent>
        <TabsContent value="score">
          <div className="space-y-3">
            <p className="text-sm leading-6 text-slate-400">
              Scores are normalized from concrete findings so unrelated categories do not collapse to zero.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
            {scoreEntries(review.score).map(([label, value]) => (
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
        </TabsContent>
      </Tabs>
    </div>
  )
}

function RefactorCard({ item }: { item: ReviewResponse['refactor'][number] }) {
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
              onClick={() => void navigator.clipboard.writeText(item.example ?? '')}
            >
              <Clipboard className="h-4 w-4" />
              Copy
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

function scoreEntries(score: ReviewResponse['score']) {
  return [
    ['overall', score.overall],
    ['hooks', score.hooks],
    ['performance', score.performance],
    ['architecture', score.architecture],
    ['maintainability', score.maintainability],
  ] as const
}

function scoreLabel(value: number) {
  if (value >= 85) return 'strong'
  if (value >= 70) return 'watch'
  if (value >= 50) return 'risk'
  return 'urgent'
}

function scoreTone(value: number) {
  if (value >= 85) return 'bg-emerald-300/10 text-emerald-100'
  if (value >= 70) return 'bg-cyan-300/10 text-cyan-100'
  if (value >= 50) return 'bg-amber-300/10 text-amber-100'
  return 'bg-red-400/10 text-red-100'
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
        <h2 className="text-xl font-semibold text-white">Load a demo or paste production code</h2>
        <p className="text-sm leading-6 text-slate-400">
          HookGuard will prioritize concrete React risks, then generate normalized scores and copy-ready fixes.
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
        <h2 className="text-xl font-semibold text-white">Gemma is reviewing the snippet</h2>
        <p className="text-sm text-slate-400">
          Checking render loops, unstable references, architecture, and practical fixes.
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
