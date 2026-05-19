type Todo = { id: string; title: string }

export function TodoList({ todos }: { todos: Todo[] }) {
  return (
    <ul>
      {todos.map((todo) => (
        <li key={Math.random()}>{todo.title}</li>
      ))}
    </ul>
  )
}
