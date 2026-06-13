import { StoreProvider, useStore } from './state/store'
import { ListSidebar } from './ui/ListSidebar'
import { NewTaskInput } from './ui/NewTaskInput'
import { TaskList } from './ui/TaskList'
import './App.css'

function Workspace() {
  const { loading, activeListId, lists } = useStore()

  if (loading) {
    return (
      <main className="workspace">
        <p className="empty">Loading…</p>
      </main>
    )
  }

  const activeList = lists.find((l) => l.id === activeListId)

  return (
    <main className="workspace">
      <header className="workspace__header">
        <h1>{activeList ? activeList.name : 'Seven Alpha'}</h1>
      </header>
      <NewTaskInput />
      <TaskList />
    </main>
  )
}

export function App() {
  return (
    <StoreProvider>
      <div className="app">
        <ListSidebar />
        <Workspace />
      </div>
    </StoreProvider>
  )
}
