type User = { id: string; name: string }

export function UserBadge({ user }: { user: User }) {
  return (
    <div>
      <strong>{user.name}</strong>
      <span>{user.id}</span>
    </div>
  )
}
