import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Id, List, Task } from '../domain/types'
import type { TaskRepository } from '../domain/TaskRepository'
import { IndexedDbTaskRepository } from '../infra/IndexedDbTaskRepository'

interface StoreValue {
  lists: List[]
  tasks: Task[]
  activeListId: Id | null
  loading: boolean
  selectList: (id: Id) => void
  createList: (name: string) => Promise<void>
  createTask: (title: string) => Promise<void>
  toggleDone: (taskId: Id) => Promise<void>
  moveTask: (taskId: Id, toListId: Id) => Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)

const repository: TaskRepository = new IndexedDbTaskRepository()

export function StoreProvider({ children }: { children: ReactNode }) {
  const [lists, setLists] = useState<List[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [activeListId, setActiveListId] = useState<Id | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([repository.getLists(), repository.getTasks()]).then(
      ([loadedLists, loadedTasks]) => {
        if (cancelled) return
        setLists(loadedLists)
        setTasks(loadedTasks)
        setActiveListId((prev) => prev ?? loadedLists[0]?.id ?? null)
        setLoading(false)
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  const selectList = (id: Id) => setActiveListId(id)

  const createList = async (name: string) => {
    const list = await repository.createList(name)
    setLists((prev) => [...prev, list])
    setActiveListId((prev) => prev ?? list.id)
  }

  // A Task is always born into the active List; with no List, creation is disabled.
  const createTask = async (title: string) => {
    if (!activeListId) return
    const task = await repository.createTask(title, activeListId)
    setTasks((prev) => [...prev, task])
  }

  // Done is a flag — the Task stays in its List.
  const toggleDone = async (taskId: Id) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    const done = !task.done
    await repository.setDone(taskId, done)
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, done } : t)))
  }

  const moveTask = async (taskId: Id, toListId: Id) => {
    await repository.moveTask(taskId, toListId)
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, listId: toListId } : t)),
    )
  }

  const value: StoreValue = {
    lists,
    tasks,
    activeListId,
    loading,
    selectList,
    createList,
    createTask,
    toggleDone,
    moveTask,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within a StoreProvider')
  return ctx
}
