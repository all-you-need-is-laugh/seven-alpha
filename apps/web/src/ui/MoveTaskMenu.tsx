import { useStore } from '../state/store'
import type { Id } from '../domain/types'

export function MoveTaskMenu({ taskId }: { taskId: Id }) {
  const { lists, tasks, moveTask } = useStore()
  const task = tasks.find((t) => t.id === taskId)
  if (!task) return null

  const others = lists.filter((l) => l.id !== task.listId)
  if (others.length === 0) return null

  return (
    <select
      className="move-menu"
      value=""
      onChange={(e) => {
        if (e.target.value) moveTask(taskId, e.target.value as Id)
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
