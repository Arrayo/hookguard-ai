import Editor from '@monaco-editor/react'
import { Clipboard, ClipboardPaste, Loader2, Radar, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
  const filename = deriveFilename(code)
  const lineCount = code.trim().split('\n').length

  return (
    <Card className="overflow-hidden">
      <EditorTabBar
        filename={filename}
        demos={demos}
        activeDemo={activeDemo}
        onSelectDemo={(demo) => onCodeChange(demo.code)}
        onClear={onClear}
        onPaste={onPaste}
        onCopyCode={() => void navigator.clipboard.writeText(code)}
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
  filename: string
  demos: DemoExample[]
  activeDemo: DemoExample | undefined
  onSelectDemo: (demo: DemoExample) => void
  onClear: () => void
  onPaste: () => void
  onCopyCode: () => void
}

function EditorTabBar({ filename, demos, activeDemo, onSelectDemo, onClear, onPaste, onCopyCode }: TabBarProps) {
  return (
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
          {demos.map((demo) => (
            <button
              key={demo.label}
              className={`h-8 border-b-2 px-3 text-xs transition-colors ${activeDemo?.label === demo.label ? 'border-cyan-400 text-cyan-200' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
              onClick={() => onSelectDemo(demo)}
              title={demo.description}
            >
              {demo.short}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-200" onClick={onClear} title="Clear editor">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-200" onClick={onPaste} title="Paste from clipboard">
          <ClipboardPaste className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-200" onClick={onCopyCode} title="Copy code">
          <Clipboard className="h-3.5 w-3.5" />
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
  return (
    <div className="flex items-center justify-between border-t border-white/10 bg-slate-900/70 px-4 py-2">
      <p className="text-xs text-slate-500">{lineCount} lines</p>
      <Button onClick={onAnalyze} disabled={isLoading || code.trim().length < 20}>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Radar className="h-4 w-4" />
        )}
        Analyze code
      </Button>
    </div>
  )
}

function deriveFilename(code: string): string {
  const match = code.match(/export\s+(?:default\s+)?function\s+([A-Z]\w+)/)
  if (!match?.[1]) return 'component.tsx'
  return match[1].replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase() + '.tsx'
}
