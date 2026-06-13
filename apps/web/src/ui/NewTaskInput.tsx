import { useState, type FormEvent } from 'react'
import { useStore } from '../state/store'
import { Button, TextInput } from './lib'

export function NewTaskInput() {
  const { activeListId, createTask } = useStore()
  const [title, setTitle] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || !activeListId) return
    await createTask(trimmed)
    setTitle('')
  }

  return (
    <form className="new-task" onSubmit={submit}>
      <TextInput
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={activeListId ? 'Add a task…' : 'Create a list first'}
        disabled={!activeListId}
        aria-label="New task title"
      />
      <Button type="submit" disabled={!activeListId}>
        Add
      </Button>
    </form>
  )
}
