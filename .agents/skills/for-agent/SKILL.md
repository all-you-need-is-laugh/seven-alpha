---
name: for-agent
description: List every issue on the project tracker that's ready for an agent to pick up (the ready-for-agent label), unblocked ones first, then for the task you choose emit a launch prompt wired to its Agent Brief and offer to launch a background agent on it. Use when the user asks "what's ready for agents", "what can I dispatch", "the agent queue", "what can an agent pick up", or invokes /for-agent.
---

# For Agent

The dispatch queue: issues triaged to `ready-for-agent`, waiting to be handed to an AFK agent. Sibling to `/for-me` (your human queue). Reads the tracker; only acts when you pick a task to launch.

## Quick start

1. Run the query:
   ```bash
   bash .claude/skills/for-agent/scripts/ready-for-agent.sh
   ```
   Override the label if remapped: `LABEL_READY_FOR_AGENT=... bash .claude/skills/for-agent/scripts/ready-for-agent.sh`.
2. Render the queue (format below) — `ready` first, then `blocked`.
3. Ask which task to dispatch. For the chosen one, emit the launch prompt, then offer to launch it.

If both groups are empty: say "No tasks ready for agents — run /to-issues or /triage to fill the queue." and stop.

## What it shows

| Group | Meaning | Action |
| --- | --- | --- |
| 🟢 Ready | `ready-for-agent`, no open blockers | Dispatch now |
| ⛔ Blocked | `ready-for-agent`, but an issue in its "Blocked by" is still open | Dispatch the blocker first |

## Render format

```
## Ready for agents — <N> dispatchable

### 🟢 Ready to dispatch (2)
- #14 Add rate limiter middleware       → launch
- #15 Persist rate-limit counters       → launch

### ⛔ Blocked (1)
- #16 Rate-limit admin dashboard         · blocked by #15
```

Every `ready` item has no open blocker, so an agent can start it immediately.

## The launch prompt

For the task the user picks, emit this (fill `<N>` / `<title>`). It hands off the contract — pointing the agent at the Agent Brief, not the issue body:

```
Implement GitHub issue #<N> ("<title>") in all-you-need-is-laugh/seven-alpha.

1. Read it: `gh issue view <N> --comments`. Work from the **Agent Brief** comment — that is the contract, not the title or the issue body.
2. Explore the codebase fresh. Use the domain glossary in CONTEXT.md and respect the ADRs in docs/adr/ for the area you touch.
3. Implement the desired behavior. The brief is behavioral, not procedural — make your own implementation choices.
4. Satisfy every acceptance criterion in the brief, and verify each (run the check or command it implies).
5. Stay strictly inside the brief's scope. Do not touch its "Out of scope" items.
6. Follow AGENTS.md — prefix the commit subject with `[Claude] `.
7. Open a PR that links the issue ("Closes #<N>") and lists which acceptance criteria you verified and how.

If the brief is ambiguous or a criterion can't be met, stop and comment on #<N> instead of guessing.
```

## Launch options

After showing the prompt, offer these and let the user choose:

| Option | How |
| --- | --- |
| Launch here (background) | Spawn a local background agent with the prompt above (Agent tool, `run_in_background: true`). Its PR returns to `/for-me`. |
| Cloud agent | Assign the issue to your Claude cloud agent, or `@claude` on the issue. Needs the repo on github.com + the Claude GitHub App. |
| `claude -p` | `claude -p "<the prompt above>"` in a clone — good for CI or a one-off terminal run. |
| Schedule routine | Hand the prompt to `/schedule` to poll-and-dispatch on a cron. |

Dispatch unblocked tasks first. After launch, the agent's PR appears in `/for-me` under 🔀 Pull requests to review and merge — closing the loop.

## Config

- Reads the `ready-for-agent` label string from `docs/agents/triage-labels.md` (defaults to canonical).
- Blocker detection parses each issue's "## Blocked by" section for `#N` references and checks whether those issues are still open. Keep using the `to-issues` template's "Blocked by" section so this stays accurate.
