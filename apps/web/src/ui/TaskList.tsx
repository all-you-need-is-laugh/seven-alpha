import { useStore } from '../state/store'
import { Checkbox } from './lib'
import { MoveTaskMenu } from './MoveTaskMenu'

export function TaskList() {
  const { tasks, activeListId, toggleDone } = useStore()

  if (!activeListId) {
    return <p className="empty">Create a list to start adding tasks.</p>
  }

  const visible = tasks.filter((t) => t.listId === activeListId)
  if (visible.length === 0) {
    return <p className="empty">No tasks yet.</p>
  }

  return (
    <ul className="task-list">
      {visible.map((task) => (
        <li key={task.id} className={`task ${task.done ? 'is-done' : ''}`.trim()}>
          <label className="task__main">
            <Checkbox checked={task.done} onChange={() => toggleDone(task.id)} />
            <span className="task__title">{task.title}</span>
          </label>
          <MoveTaskMenu taskId={task.id} />
        </li>
      ))}
    </ul>
  )
}
