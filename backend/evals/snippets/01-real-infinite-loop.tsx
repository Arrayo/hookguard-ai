import { useEffect, useState } from 'react'

export function CounterLoop() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    setCount(count + 1)
  }, [count])

  return <p>{count}</p>
}
