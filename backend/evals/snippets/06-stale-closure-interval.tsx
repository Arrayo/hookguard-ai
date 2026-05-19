import { useEffect, useState } from 'react'

export function Timer() {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setSeconds(seconds + 1)
    }, 1000)

    return () => window.clearInterval(id)
  }, [])

  return <p>{seconds}</p>
}
