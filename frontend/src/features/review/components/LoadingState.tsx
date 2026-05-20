import { Loader2 } from 'lucide-react'

type Props = { streamText: string }

export function LoadingState({ streamText }: Props) {
  if (streamText.length > 0) {
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
