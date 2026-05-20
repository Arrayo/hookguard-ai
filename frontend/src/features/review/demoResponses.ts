import type { ReviewResponse } from '@/types/review'

const loopResponse: ReviewResponse = {
  summary:
    'The effect depends on `user` and calls `setUser` when the fetch succeeds. Each successful fetch updates `user`, which immediately re-triggers the effect — a classic infinite fetch loop causing continuous network requests.',
  issues: [
    {
      title: 'Self-triggering fetch loop via `user` dependency',
      severity: 'critical',
      category: 'hooks',
      explanation:
        'The useEffect lists `user` as a dependency and calls `setUser` when the fetch resolves. Each time `setUser` runs, `user` changes, the effect re-runs, and a new fetch fires. This creates an unbounded cycle of network requests that will not stop on its own.',
      suggestion:
        'Replace `[user]` with `[userId]`. The fetch should respond to the identifier changing, not to the fetched result changing.',
      lineHint: 'useEffect dependency array: [user]',
    },
    {
      title: 'Loading state not reset on re-runs',
      severity: 'medium',
      category: 'maintainability',
      explanation:
        'Because the effect loops, `setLoading(true)` fires repeatedly. If the infinite loop is fixed, the `finally` block correctly resets it, but the current arrangement hides this risk.',
      suggestion:
        'Once `[userId]` is the dependency, the loading logic becomes correct. No additional change needed.',
    },
  ],
  refactor: [
    {
      title: 'Depend on `userId`, not `user`',
      rationale:
        'The effect should run when the identifier changes, not when the fetched result changes. Replacing `[user]` with `[userId]` breaks the self-triggering loop and preserves correct data-fetching behaviour.',
      changes: 'Replace `[user]` with `[userId]` in the useEffect dependency array.',
      example:
        "useEffect(() => {\n  setLoading(true)\n  fetch('/api/users/' + userId)\n    .then((res) => res.json())\n    .then(setUser)\n    .finally(() => setLoading(false))\n}, [userId])",
    },
  ],
  score: { overall: 34, hooks: 18, architecture: 72, maintainability: 65, performance: 30 },
}

const unstableResponse: ReviewResponse = {
  summary:
    'The `filters` object is created during render and listed as the sole effect dependency. Because it is a new reference on every render, the effect reruns after every render — causing repeated fetch calls even when `query` has not changed.',
  issues: [
    {
      title: 'Object literal `filters` recreated on every render',
      severity: 'high',
      category: 'hooks',
      explanation:
        '`const filters = { query, limit: 20 }` runs on every render and produces a new object reference each time. Because `[filters]` uses reference equality, the effect treats every render as a dependency change and refetches — even when `query` is the same.',
      suggestion:
        'Move `filters` construction inside the effect and depend on the primitive `query` directly. This ties refetching to what actually matters: the query string.',
      lineHint: 'const filters = { query, limit: 20 }',
    },
  ],
  refactor: [
    {
      title: 'Move object construction inside the effect',
      rationale:
        'Constructing `filters` inside the callback means it is not a dependency — only `query` is. The effect now runs exactly when the query changes, eliminating spurious fetches.',
      changes: 'Move `filters` inside useEffect and replace `[filters]` with `[query]`.',
      example:
        "useEffect(() => {\n  const filters = { query, limit: 20 }\n  fetch('/api/search?q=' + filters.query + '&limit=' + filters.limit)\n    .then((res) => res.json())\n    .then(setResults)\n}, [query])",
    },
  ],
  score: { overall: 58, hooks: 48, architecture: 78, maintainability: 74, performance: 62 },
}

const keysResponse: ReviewResponse = {
  summary:
    '`key={Math.random()}` generates a new key for every list item on every render. React treats each new key as a brand-new element and unmounts the previous one, discarding all child state and causing unnecessary DOM work.',
  issues: [
    {
      title: '`Math.random()` as key remounts every list item on every render',
      severity: 'high',
      category: 'performance',
      explanation:
        'React uses keys to decide whether to reuse or replace a DOM element. A random key always differs from the previous render, so every list item is unmounted and remounted on every render. This destroys child state, breaks browser focus and animations, and causes unnecessary layout work.',
      suggestion:
        'Use the stable `todo.id` field as the key. It already exists on the type and provides a unique, stable identity for each item.',
      lineHint: 'key={Math.random()}',
    },
  ],
  refactor: [
    {
      title: 'Replace `Math.random()` with `todo.id`',
      rationale:
        '`todo.id` is a stable string identifier that survives re-renders. Using it as the key lets React reconcile the list correctly, preserving child state and avoiding unnecessary remounts.',
      changes: 'Replace `key={Math.random()}` with `key={todo.id}`.',
      example:
        '{todos.map((todo) => (\n  <li key={todo.id}>\n    <input defaultChecked={todo.done} type="checkbox" />\n    {todo.title}\n  </li>\n))}',
    },
  ],
  score: { overall: 62, hooks: 90, architecture: 80, maintainability: 80, performance: 48 },
}

const derivedResponse: ReviewResponse = {
  summary:
    '`activeItems` is derived directly from the `items` prop via a filter. Storing it in state and syncing it through a `useEffect` adds unnecessary complexity, a render cycle, and stale-state risk — all avoidable by computing the value during render.',
  issues: [
    {
      title: 'Derived state stored in `useEffect` instead of computed during render',
      severity: 'medium',
      category: 'maintainability',
      explanation:
        '`activeItems` is always `items.filter(item => item.active)`. Keeping it in state requires a `useEffect` to stay in sync, adds an extra render cycle on every `items` change, and risks showing stale filtered data between renders.',
      suggestion:
        'Remove the `useState` and `useEffect` pair. Compute `activeItems` directly during render with `const activeItems = items.filter(item => item.active)`.',
      lineHint: 'const [activeItems, setActiveItems] = useState',
    },
  ],
  refactor: [
    {
      title: 'Compute `activeItems` during render',
      rationale:
        'A value that is purely derived from props never needs to be stored in state. Computing it inline removes the synchronisation effect, eliminates the extra render cycle, and makes the data flow obvious.',
      changes: 'Remove `useState` and `useEffect`. Add a single `const` computed from `items`.',
      example:
        "type Item = { id: string; name: string; active: boolean }\n\nexport function ActiveItems({ items }: { items: Item[] }) {\n  const activeItems = items.filter((item) => item.active)\n  return <p>Active items: {activeItems.map((item) => item.name).join(', ')}</p>\n}",
    },
  ],
  score: { overall: 72, hooks: 75, architecture: 82, maintainability: 58, performance: 85 },
}

export const demoResponses = new Map<string, ReviewResponse>([
  ['Loop', loopResponse],
  ['Unstable', unstableResponse],
  ['Keys', keysResponse],
  ['Derived', derivedResponse],
])
