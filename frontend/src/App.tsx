import { useState } from 'react'
import { Clipboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CodeEditorPanel } from '@/features/review/components/CodeEditorPanel'
import { EmptyState } from '@/features/review/components/EmptyState'
import { ErrorState } from '@/features/review/components/ErrorState'
import { LoadingState } from '@/features/review/components/LoadingState'
import { ReviewPanels } from '@/features/review/components/ReviewPanels'
import { demoExamples, sampleCode } from '@/features/review/demoExamples'
import { useReviewAnalysis } from '@/features/review/useReviewAnalysis'

const reviewPillars = ['Hooks', 'Loops', 'Design']

function App() {
  const [code, setCode] = useState(sampleCode)
  const { state, actions } = useReviewAnalysis(code, setCode)

  const activeDemo = demoExamples.find((demo) => demo.code === code)

  return (
    <main className="min-h-screen px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <AppHeader pillars={reviewPillars} />

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(380px,0.9fr)] xl:items-stretch">
          <CodeEditorPanel
            code={code}
            isLoading={state.isLoading}
            activeDemo={activeDemo}
            demos={demoExamples}
            onCodeChange={setCode}
            onAnalyze={() => void actions.analyze()}
            onClear={() => setCode('')}
            onPaste={() => void actions.paste()}
          />

          <Card className="flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-white/10">
              <div>
                <CardTitle>Review Results</CardTitle>
                <p className="text-sm text-slate-400">Prioritized findings, fixes, and normalized scores</p>
              </div>
              <Button variant="ghost" size="sm" onClick={actions.copyReview} disabled={!state.review}>
                <Clipboard className="h-4 w-4" />
                Copy JSON
              </Button>
            </CardHeader>
            <CardContent className="flex-1 pt-5">
              {state.isLoading ? <LoadingState streamText={state.streamText} /> : null}
              {state.error ? <ErrorState message={state.error} /> : null}
              {!state.isLoading && !state.error && state.review ? <ReviewPanels review={state.review} /> : null}
              {!state.isLoading && !state.error && !state.review ? <EmptyState /> : null}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}

function AppHeader({ pillars }: { pillars: string[] }) {
  return (
    <header className="flex flex-col gap-4 rounded-2xl border border-white/15 bg-gradient-to-r from-white/8 to-white/5 px-5 py-4 shadow-xl shadow-black/40 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <img src="/logo.png" alt="HookGuard AI" className="h-9 w-9 rounded-xl" />
        <div>
          <h1 className="text-xl font-semibold text-white">HookGuard AI</h1>
          <p className="text-xs text-slate-400">Expert React review · Gemma · Ollama</p>
        </div>
      </div>
      <div className="flex gap-2">
        {pillars.map((label) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-center">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Review</p>
            <p className="text-xs font-semibold text-slate-300">{label}</p>
          </div>
        ))}
      </div>
    </header>
  )
}

export default App
