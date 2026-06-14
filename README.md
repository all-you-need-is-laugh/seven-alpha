# Seven Alpha

A personal task-management app: a single collection of Tasks, organized into Lists and (later) viewed through many lenses (Eisenhower matrix, ICE prioritization, planners, roadmap).

## Running it

Requires [pnpm](https://pnpm.io/) and Node 22 (see `.nvmrc`). Install once, then use the root scripts:

```bash
pnpm install      # install workspace dependencies
pnpm run dev      # start the dev server
pnpm run build    # type-check and build for production
pnpm run typecheck
```

The root scripts delegate into the app, so you never need to `cd` into `apps/web`.

## Repo layout

```
.
├── apps/web/      # the web app (React + Vite + TypeScript)
├── docs/adr/      # architecture decision records
├── CONTEXT.md     # domain glossary
└── package.json   # language-agnostic root with passthrough scripts
```

The root stays language-agnostic; TypeScript, Vite, and Node config live under `apps/web`.

## Domain language

See [CONTEXT.md](CONTEXT.md) for the domain glossary (Task, List, and the terms to avoid).
