import { useEffect } from 'react'

export function Analytics({ userId }: { userId: string }) {
  const track = () => {
    navigator.sendBeacon('/analytics', JSON.stringify({ userId }))
  }

  useEffect(() => {
    track()
  }, [track])

  return <p>Analytics enabled</p>
}
