import type { Id, List, Task } from './types'

/**
 * The swap seam. IndexedDbTaskRepository backs this today; an
 * HttpTaskRepository (Python backend) can replace it without the UI
 * or domain knowing.
 */
export interface TaskRepository {
  getLists(): Promise<List[]>
  createList(name: string): Promise<List>
  getTasks(): Promise<Task[]>
  createTask(title: string, listId: Id): Promise<Task>
  /** Rejects when no Task with `taskId` exists. */
  setDone(taskId: Id, done: boolean): Promise<void>
  /** Rejects when no Task with `taskId` exists. */
  moveTask(taskId: Id, toListId: Id): Promise<void>
}
