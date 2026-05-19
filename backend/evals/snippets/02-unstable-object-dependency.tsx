import { useEffect } from 'react'

export function SearchResults({ query }: { query: string }) {
  const filters = { query, limit: 20 }

  useEffect(() => {
    fetch('/api/search', {
      method: 'POST',
      body: JSON.stringify(filters),
    })
  }, [filters])

  return <section>Results for {query}</section>
}
