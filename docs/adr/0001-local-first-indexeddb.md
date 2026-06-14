# Local-first persistence via IndexedDB

The app ships without a backend first, so the React client owns all data and persists it in the browser using IndexedDB (via the `idb` wrapper). All reads and writes go through a `TaskRepository` interface; the IndexedDB implementation can later be swapped for an HTTP implementation backed by the planned Python service without touching the UI or domain.

## Considered options

- **localStorage** — simplest for today's tiny data (Task = title + done), but synchronous and unstructured; the access pattern would differ from a future network backend.
- **IndexedDB (chosen)** — async and structured with indexes, leaving room to grow and keeping the repository-shaped, promise-based access identical to the eventual Python backend.
- **In-memory only** — rejected: a reload would wipe everything.

## The `byListId` index

The `tasks` object store carries a `byListId` index that nothing queries today — `getTasks` reads every Task with `getAll` and the store filters in memory. We keep the index deliberately, as a seed for the future backend's per-List queries (e.g. a `getTasks(listId)` that the Python service will serve with an indexed `WHERE list_id = ?`). Defining it now means the IndexedDB schema already mirrors the access pattern the backend will need, so adopting it is a query change, not a schema change.

Removing the index instead would require bumping `DB_VERSION` and shipping an `upgrade` migration to drop it from already-provisioned browsers — cost we take on for dead weight worth a few bytes. Keeping it avoids that churn and documents intent.

## Consequences

- Data lives per-browser until the backend exists; no sync across devices yet.
- The `TaskRepository` boundary is load-bearing — the future backend swaps one implementation, nothing else.
- The `byListId` index is intentionally unqueried for now; introducing a per-List read is a query change, while dropping the index would force a `DB_VERSION` bump + migration.
