import { AlertTriangle } from 'lucide-react'

type Props = { message: string }

export function ErrorState({ message }: Props) {
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
