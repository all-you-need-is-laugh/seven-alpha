import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Id, List, Task } from '../domain/types'
import type { TaskRepository } from '../domain/TaskRepository'

interface SevenAlphaDB extends DBSchema {
  lists: {
    key: Id
    value: List
  }
  tasks: {
    key: Id
    value: Task
    indexes: { byListId: Id }
  }
}

const DB_NAME = 'seven-alpha'
const DB_VERSION = 1

function openSevenAlphaDb(): Promise<IDBPDatabase<SevenAlphaDB>> {
  return openDB<SevenAlphaDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('lists', { keyPath: 'id' })
      const tasks = db.createObjectStore('tasks', { keyPath: 'id' })
      tasks.createIndex('byListId', 'listId')
    },
  })
}

export class IndexedDbTaskRepository implements TaskRepository {
  private readonly dbPromise = openSevenAlphaDb()

  async getLists(): Promise<List[]> {
    return (await this.dbPromise).getAll('lists')
  }

  async createList(name: string): Promise<List> {
    const list: List = { id: crypto.randomUUID(), name }
    await (await this.dbPromise).put('lists', list)
    return list
  }

  async getTasks(): Promise<Task[]> {
    return (await this.dbPromise).getAll('tasks')
  }

  async createTask(title: string, listId: Id): Promise<Task> {
    const task: Task = { id: crypto.randomUUID(), title, done: false, listId }
    await (await this.dbPromise).put('tasks', task)
    return task
  }

  async setDone(taskId: Id, done: boolean): Promise<void> {
    const db = await this.dbPromise
    const task = await db.get('tasks', taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)
    await db.put('tasks', { ...task, done })
  }

  async moveTask(taskId: Id, toListId: Id): Promise<void> {
    const db = await this.dbPromise
    const task = await db.get('tasks', taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)
    await db.put('tasks', { ...task, listId: toListId })
  }
}
