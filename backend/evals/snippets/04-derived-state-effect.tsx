import { useEffect, useState } from 'react'

export function FullName({ firstName, lastName }: { firstName: string; lastName: string }) {
  const [fullName, setFullName] = useState('')

  useEffect(() => {
    setFullName(`${firstName} ${lastName}`)
  }, [firstName, lastName])

  return <h1>{fullName}</h1>
}
