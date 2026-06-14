import { useStore } from '../state/store'
import type { Task } from '../domain/types'

export function MoveTaskMenu({ task }: { task: Task }) {
  const { lists, moveTask } = useStore()

  const others = lists.filter((l) => l.id !== task.listId)
  if (others.length === 0) return null

  return (
    <select
      className="move-menu"
      value=""
      onChange={(e) => {
        if (e.target.value) moveTask(task.id, e.target.value)
      }}
      aria-label="Move task to another list"
    >
      <option value="" disabled>
        Move to…
      </option>
      {others.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
        </option>
      ))}
    </select>
  )
}
