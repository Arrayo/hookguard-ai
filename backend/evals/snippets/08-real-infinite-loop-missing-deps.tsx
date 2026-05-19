import { useEffect, useState } from 'react'

export function ResizeLoop() {
  const [width, setWidth] = useState(window.innerWidth)

  useEffect(() => {
    setWidth(width + 1)
  })

  return <p>{width}</p>
}
