import { useState, type FormEvent } from 'react'
import { useStore } from '../state/store'
import { Button, TextInput } from './lib'

export function ListSidebar() {
  const { lists, activeListId, selectList, createList } = useStore()
  const [name, setName] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    await createList(trimmed)
    setName('')
  }

  return (
    <aside className="sidebar">
      <h2>Lists</h2>
      <ul className="list-nav">
        {lists.map((list) => (
          <li key={list.id}>
            <button
              className={`list-nav__item ${list.id === activeListId ? 'is-active' : ''}`.trim()}
              onClick={() => selectList(list.id)}
            >
              {list.name}
            </button>
          </li>
        ))}
      </ul>
      <form className="new-list" onSubmit={submit}>
        <TextInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New list…"
          aria-label="New list name"
        />
        <Button type="submit">Add</Button>
      </form>
    </aside>
  )
}
