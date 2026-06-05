---
name: for-me
description: Show every touch point on the project tracker that awaits the maintainer's action — issues to triage, issues ready for human implementation, and pull requests to review, fix, or merge — then offer to act on one. Use when the user asks "what needs me", "my queue", "what's waiting on me", "what should I do next", or invokes /for-me.
---

# For Me

Your action inbox over the GitHub tracker configured in `docs/agents/issue-tracker.md`. It reads, never mutates — until you pick something to act on.

## Quick start

1. Run the bundled query (it prints JSON of every bucket):

   ```bash
   bash .claude/skills/for-me/scripts/touch-points.sh
   ```

   If `docs/agents/triage-labels.md` remaps the canonical labels, pass the real strings first, e.g. `LABEL_READY_FOR_HUMAN=needs-human bash .claude/skills/for-me/scripts/touch-points.sh`.

2. Render the result (see format below), oldest item first within each group.
3. Offer to act — ask which item to handle, then run its command from the dispatch table.

If every bucket is empty: say "Inbox zero — nothing awaits you." and stop.

## What it shows

| Group | Bucket(s) | Why it's on you |
| --- | --- | --- |
| 🔍 Triage | `unlabeled`, `needs_triage`, `needs_info` | You must evaluate / supply missing detail |
| 🛠️ Build | `ready_for_human` | Triaged as needing human implementation |
| 🔀 Pull requests | `ready`, `blocked` | Review & merge a green PR / fix one with red CI or a merge conflict |

`needs_info` = an issue parked for missing detail. Solo project, so there's no reporter to wait on — the detail is always on you, so every open `needs-info` shows.

## Render format

```
## Awaiting you — <N> touch points

### 🔍 Triage (3)
- #12 Login retries loop forever      · 4d · unlabeled              → /triage 12
- #9  CSV export mangles UTF-8         · needs-info                  → /triage 9
- #5  Flaky pagination test            · needs-triage                → /triage 5

### 🛠️ Build — ready for human (1)
- #7  Move auth to OAuth               · ready-for-human             → /tdd (issue 7)

### 🔀 Pull requests (2)
- ready   #14 Add rate limiter         · CI green                    → gh pr diff 14, then merge
- blocked #11 Fix off-by-one in cursor · CI red                      → gh pr checks 11
```

One line per item: `#num title · age/status · → next command`. Omit empty groups. Show the total in the heading.

## Offer to act (dispatch table)

After rendering, ask: "Which one do you want to handle?" Then:

| Item | Action |
| --- | --- |
| Triage bucket | Invoke `/triage <N>` |
| `ready_for_human` (enhancement) | Start implementation with `/tdd`, working from issue `<N>` |
| `ready_for_human` (bug) | Start with `/diagnose`, working from issue `<N>` |
| PR `ready` | `gh pr diff <N>` to review, then `gh pr merge <N> --squash` once green |
| PR `blocked` | `gh pr checks <N>` for the red check (or resolve the merge conflict), then fix |

Stay read-only until the user picks. Never triage, review, or merge without their explicit pick.

## Config assumptions

- **PRs are grouped by CI, not author.** Solo repo: agents push under your account and GitHub blocks self-approval, so author and review-decision carry no signal. Every open non-draft PR is yours — `ready` (review, then merge once green) or `blocked` (red CI / merge conflict). Add an author filter in `scripts/touch-points.sh` if you later introduce a separate bot account.
- Label strings come from `docs/agents/triage-labels.md`; the script defaults to the canonical names when no env override is given.
- `ready-for-agent` issues are intentionally **not** shown — dispatching agents is out of this skill's scope.
