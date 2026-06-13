export type Id = string

export interface List {
  id: Id
  name: string
}

export interface Task {
  id: Id
  title: string
  done: boolean
  listId: Id
}
