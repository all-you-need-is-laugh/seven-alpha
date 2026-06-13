# Local-first persistence via IndexedDB

The app ships without a backend first, so the React client owns all data and persists it in the browser using IndexedDB (via the `idb` wrapper). All reads and writes go through a `TaskRepository` interface; the IndexedDB implementation can later be swapped for an HTTP implementation backed by the planned Python service without touching the UI or domain.

## Considered options

- **localStorage** — simplest for today's tiny data (Task = title + done), but synchronous and unstructured; the access pattern would differ from a future network backend.
- **IndexedDB (chosen)** — async and structured with indexes, leaving room to grow and keeping the repository-shaped, promise-based access identical to the eventual Python backend.
- **In-memory only** — rejected: a reload would wipe everything.

## Consequences

- Data lives per-browser until the backend exists; no sync across devices yet.
- The `TaskRepository` boundary is load-bearing — the future backend swaps one implementation, nothing else.
