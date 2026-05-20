import Editor from '@monaco-editor/react'
import { Check, Clipboard, ClipboardPaste, Loader2, Radar, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useCopyFeedback } from '@/hooks/useCopyFeedback'
import { DEMO_MODE, getDemoKey } from '../api'
import type { DemoExample } from '../demoExamples'

type Props = {
  code: string
  isLoading: boolean
  activeDemo: DemoExample | undefined
  demos: DemoExample[]
  onCodeChange: (code: string) => void
  onAnalyze: () => void
  onClear: () => void
  onPaste: () => void
}

export function CodeEditorPanel({
  code,
  isLoading,
  activeDemo,
  demos,
  onCodeChange,
  onAnalyze,
  onClear,
  onPaste,
}: Props) {
  const lineCount = code.trim().split('\n').length

  return (
    <Card className="overflow-hidden">
      <EditorTabBar
        demos={demos}
        activeDemo={activeDemo}
        code={code}
        onSelectDemo={(demo) => onCodeChange(demo.code)}
        onClear={onClear}
        onPaste={onPaste}
      />
      <CardContent className="p-0">
        <div className="h-[540px] overflow-hidden">
          <Editor
            height="100%"
            defaultLanguage="typescript"
            theme="vs-dark"
            value={code}
            onChange={(value) => onCodeChange(value ?? '')}
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
        <EditorStatusBar lineCount={lineCount} isLoading={isLoading} onAnalyze={onAnalyze} code={code} />
      </CardContent>
    </Card>
  )
}

type TabBarProps = {
  demos: DemoExample[]
  activeDemo: DemoExample | undefined
  code: string
  onSelectDemo: (demo: DemoExample) => void
  onClear: () => void
  onPaste: () => void
}

function EditorTabBar({ demos, activeDemo, code, onSelectDemo, onClear, onPaste }: TabBarProps) {
  const { copied, copy } = useCopyFeedback()

  return (
    <div className="flex items-center justify-between border-b border-white/10 bg-slate-950/70 px-3 py-2">
      <div className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full bg-red-400/50" />
        <span className="h-3 w-3 rounded-full bg-amber-400/50" />
        <span className="h-3 w-3 rounded-full bg-emerald-400/50" />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-1">
          <span className="rounded border border-cyan-300/25 bg-cyan-300/8 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-cyan-300/70">
            Examples
          </span>
          <div className="flex">
            {demos.map((demo) => (
              <button
                key={demo.label}
                className={`h-7 border-b-2 px-3 text-xs transition-colors ${activeDemo?.label === demo.label ? 'border-cyan-400 text-cyan-200' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                onClick={() => onSelectDemo(demo)}
                title={demo.description}
              >
                {demo.short}
              </button>
            ))}
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-200" onClick={onClear} title="Clear editor">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-200" onClick={onPaste} title="Paste from clipboard">
          <ClipboardPaste className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 w-7 p-0 transition-colors ${copied ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
          onClick={() => void copy(code)}
          title={copied ? 'Copied!' : 'Copy code'}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  )
}

type StatusBarProps = {
  lineCount: number
  isLoading: boolean
  code: string
  onAnalyze: () => void
}

function EditorStatusBar({ lineCount, isLoading, code, onAnalyze }: StatusBarProps) {
  const isDemoSnippet = !DEMO_MODE || getDemoKey(code) !== null
  const isDisabled = isLoading || code.trim().length < 20 || !isDemoSnippet

  return (
    <div className="flex items-center justify-between border-t border-white/10 bg-slate-900/70 px-4 py-2">
      <div className="flex items-center gap-3">
        <p className="text-xs text-slate-500">{lineCount} lines</p>
        {DEMO_MODE && (
          <span className="rounded border border-amber-300/25 bg-amber-300/8 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-300/80">
            Demo
          </span>
        )}
      </div>
      <div className="flex flex-col items-end gap-1">
        {DEMO_MODE && !isDemoSnippet && (
          <p className="text-[10px] text-slate-500">Load an example to analyze</p>
        )}
        <Button onClick={onAnalyze} disabled={isDisabled} title={!isDemoSnippet ? 'Demo mode — select a built-in example' : undefined}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Radar className="h-4 w-4" />
          )}
          Analyze code
        </Button>
      </div>
    </div>
  )
}
