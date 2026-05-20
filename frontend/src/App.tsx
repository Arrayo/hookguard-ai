import Editor from '@monaco-editor/react'
import { AlertTriangle, Clipboard, ClipboardPaste, Loader2, Radar, Sparkles, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { streamReactCode } from '@/features/review/api'
import type { ReviewResponse } from '@/types/review'

const demoExamples = [
  {
    label: 'Infinite loop',
    short: 'Loop',
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
    short: 'Unstable',
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
    short: 'Keys',
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
    short: 'Derived',
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

const reviewPillars = ['Hooks', 'Loops', 'Design']

function App() {
  const [code, setCode] = useState(sampleCode)
  const [review, setReview] = useState<ReviewResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [streamText, setStreamText] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const activeDemo = demoExamples.find((example) => example.code === code)
  const filename = (() => {
    const match = code.match(/export\s+(?:default\s+)?function\s+([A-Z]\w+)/)
    if (!match?.[1]) return 'component.tsx'
    return match[1].replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase() + '.tsx'
  })()

  async function handleAnalyze() {
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
  }

  function copyReview() {
    if (!review) return
    void navigator.clipboard.writeText(JSON.stringify(review, null, 2))
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText()
      if (text.trim()) setCode(text)
    } catch {
      // Clipboard access denied — user needs to paste manually
    }
  }

  return (
    <main className="min-h-screen px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-2xl border border-white/15 bg-gradient-to-r from-white/8 to-white/5 px-5 py-4 shadow-xl shadow-black/40 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="HookGuard AI" className="h-9 w-9 rounded-xl" />
            <div>
              <h1 className="text-xl font-semibold text-white">HookGuard AI</h1>
              <p className="text-xs text-slate-400">Expert React review · Gemma · Ollama</p>
            </div>
          </div>
          <div className="flex gap-2">
            {reviewPillars.map((label) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-center">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">Review</p>
                <p className="text-xs font-semibold text-slate-300">{label}</p>
              </div>
            ))}
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(380px,0.9fr)] xl:items-stretch">
          <Card className="overflow-hidden">
            {/* VS Code-style tab bar */}
            <div className="flex items-center justify-between border-b border-white/10 bg-slate-950/70 px-3 py-2">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-red-400/50" />
                  <span className="h-3 w-3 rounded-full bg-amber-400/50" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400/50" />
                </div>
                <div className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/6 px-2.5 py-1 text-xs text-slate-300">
                  <span>{filename}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600">Demos</span>
                <div className="flex">
                  {demoExamples.map((example) => {
                    const isActive = activeDemo?.label === example.label
                    return (
                      <button
                        key={example.label}
                        className={`h-8 border-b-2 px-3 text-xs transition-colors ${isActive ? 'border-cyan-400 text-cyan-200' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                        onClick={() => setCode(example.code)}
                        title={example.description}
                      >
                        {example.short}
                      </button>
                    )
                  })}
                </div>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-200" onClick={() => setCode('')} title="Clear editor">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-200" onClick={() => void handlePaste()} title="Paste from clipboard">
                  <ClipboardPaste className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-200" onClick={() => void navigator.clipboard.writeText(code)} title="Copy code">
                  <Clipboard className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <CardContent className="p-0">
              <div className="h-[540px] overflow-hidden">
                <Editor
                  height="100%"
                  defaultLanguage="typescript"
                  theme="vs-dark"
                  value={code}
                  onChange={(value) => setCode(value ?? '')}
                  beforeMount={(monaco) => {
                    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                      noSemanticValidation: true,
                      noSyntaxValidation: true,
                    })
                    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                      noSemanticValidation: true,
                      noSyntaxValidation: true,
                    })
                  }}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    padding: { top: 16, bottom: 16 },
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                  }}
                />
              </div>
              <div className="flex items-center justify-between border-t border-white/10 bg-slate-900/70 px-4 py-2">
                <p className="text-xs text-slate-500">
                  {code.trim().split('\n').length} lines
                </p>
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

          <Card className="flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-white/10">
              <div>
                <CardTitle>Review Results</CardTitle>
                <p className="text-sm text-slate-400">Prioritized findings, fixes, and normalized scores</p>
              </div>
              <Button variant="ghost" size="sm" onClick={copyReview} disabled={!review}>
                <Clipboard className="h-4 w-4" />
                Copy JSON
              </Button>
            </CardHeader>
            <CardContent className="flex-1 pt-5">
              {isLoading ? <LoadingState streamText={streamText} /> : null}
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
    <div className="grid min-h-[420px] place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
      <div className="max-w-sm space-y-3">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/8">
          <Sparkles className="h-7 w-7 animate-pulse text-cyan-300" />
        </div>
        <h2 className="text-lg font-semibold text-white">Load a demo or paste your code</h2>
        <p className="text-sm leading-6 text-slate-400">
          HookGuard surfaces concrete React risks and generates normalized scores with copy-ready fixes
        </p>
      </div>
    </div>
  )
}

function LoadingState({ streamText }: { streamText: string }) {
  const hasStream = streamText.length > 0

  if (hasStream) {
    return (
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
          <span>Generating review…</span>
        </div>
        <pre className="flex-1 overflow-auto rounded-xl border border-white/8 bg-slate-950/60 p-4 font-mono text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap break-words">
          {streamText}
          <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-cyan-400" />
        </pre>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
        <span>Connecting to Ollama…</span>
      </div>
      <div className="h-16 rounded-2xl border border-white/8 bg-white/[0.03] animate-shimmer" />
      <div className="flex gap-2">
        {[64, 76, 56].map((w) => (
          <div key={w} className="h-9 rounded-lg bg-white/[0.04] animate-shimmer" style={{ width: w }} />
        ))}
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4 animate-shimmer">
          <div className="flex gap-2">
            <div className="h-5 w-16 rounded-full bg-white/8" />
            <div className="h-5 w-20 rounded-full bg-white/6" />
          </div>
          <div className="h-3.5 w-3/4 rounded bg-white/8" />
          <div className="h-3 w-full rounded bg-white/5" />
          <div className="h-3 w-5/6 rounded bg-white/5" />
        </div>
      ))}
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
