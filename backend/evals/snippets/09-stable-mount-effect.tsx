import { useEffect, useState } from 'react'

export function Welcome() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(true)
  }, [])

  return <p>{ready ? 'Ready' : 'Loading'}</p>
}
