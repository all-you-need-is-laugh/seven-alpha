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
| 🔍 Triage | `unlabeled`, `needs_triage`, `needs_info_reporter_replied` | You must evaluate / re-evaluate |
| 🛠️ Build | `ready_for_human` | Triaged as needing human implementation |
| 🔀 Pull requests | `to_review`, `blocked`, `mergeable` | Review someone's PR / fix your blocked PR / merge a ready one |

`needs_info_reporter_replied` = a `needs-info` issue whose last comment isn't yours (reporter answered — heuristic).

## Render format

```
## Awaiting you — <N> touch points

### 🔍 Triage (3)
- #12 Login retries loop forever      · 4d · unlabeled              → /triage 12
- #9  CSV export mangles UTF-8         · needs-info, reporter replied → /triage 9
- #5  Flaky pagination test            · needs-triage                → /triage 5

### 🛠️ Build — ready for human (1)
- #7  Move auth to OAuth               · ready-for-human             → /tdd (issue 7)

### 🔀 Pull requests (2)
- review #14 Add rate limiter          · CI green                    → gh pr diff 14
- merge  #11 Fix off-by-one in cursor  · approved + green            → gh pr merge 11 --squash
```

One line per item: `#num title · age/status · → next command`. Omit empty groups. Show the total in the heading.

## Offer to act (dispatch table)

After rendering, ask: "Which one do you want to handle?" Then:

| Item | Action |
| --- | --- |
| Triage bucket | Invoke `/triage <N>` |
| `ready_for_human` (enhancement) | Start implementation with `/tdd`, working from issue `<N>` |
| `ready_for_human` (bug) | Start with `/diagnose`, working from issue `<N>` |
| PR to review | `gh pr diff <N>` then walk the review; `gh pr review <N> --approve` / `--request-changes` |
| PR blocked | `gh pr checks <N>` for red CI, or read the change requests, then fix |
| PR mergeable | Confirm, then `gh pr merge <N> --squash` |

Stay read-only until the user picks. Never triage, review, or merge without their explicit pick.

## Config assumptions

- **"PR to review" = a PR you didn't author.** Assumes AFK agents open PRs under a different account than yours. If agents push under your own login, edit the `to_review` filter in `scripts/touch-points.sh`.
- Label strings come from `docs/agents/triage-labels.md`; the script defaults to the canonical names when no env override is given.
- `ready-for-agent` issues are intentionally **not** shown — dispatching agents is out of this skill's scope.
