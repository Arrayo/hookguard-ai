export type DemoExample = {
  label: string
  short: string
  description: string
  code: string
}

export const demoExamples: DemoExample[] = [
  {
    label: 'Infinite loop',
    short: 'Loop',
    description: 'Effect updates its own dependency',
    code: `import { useEffect, useState } from 'react'

export function UserPanel({ userId }: { userId: string }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch('/api/users/' + userId)
      .then((res) => res.json())
      .then(setUser)
      .finally(() => setLoading(false))
  }, [user])

  if (loading) return <p>Loading...</p>
  return <pre>{JSON.stringify(user, null, 2)}</pre>
}`,
  },
  {
    label: 'Unstable deps',
    short: 'Unstable',
    description: 'Object dependency recreated per render',
    code: `import { useEffect, useState } from 'react'

export function SearchResults({ query }: { query: string }) {
  const [results, setResults] = useState([])
  const filters = { query, limit: 20 }

  useEffect(() => {
    fetch('/api/search?q=' + filters.query + '&limit=' + filters.limit)
      .then((res) => res.json())
      .then(setResults)
  }, [filters])

  return <pre>{JSON.stringify(results, null, 2)}</pre>
}`,
  },
  {
    label: 'Random keys',
    short: 'Keys',
    description: 'Keys remount stateful children',
    code: `type Todo = { id: string; title: string; done: boolean }

export function TodoList({ todos }: { todos: Todo[] }) {
  return (
    <ul>
      {todos.map((todo) => (
        <li key={Math.random()}>
          <input defaultChecked={todo.done} type="checkbox" />
          {todo.title}
        </li>
      ))}
    </ul>
  )
}`,
  },
  {
    label: 'Derived state',
    short: 'Derived',
    description: 'Stores values that can be computed',
    code: `import { useEffect, useState } from 'react'

type Item = { id: string; name: string; active: boolean }

export function ActiveItems({ items }: { items: Item[] }) {
  const [activeItems, setActiveItems] = useState<Item[]>([])

  useEffect(() => {
    setActiveItems(items.filter((item) => item.active))
  }, [items])

  return <p>Active items: {activeItems.map((item) => item.name).join(', ')}</p>
}`,
  },
]

export const sampleCode = demoExamples[0].code
