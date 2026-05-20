import { Sparkles } from 'lucide-react'

export function EmptyState() {
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
