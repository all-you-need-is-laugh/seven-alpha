---
name: pusher
description: Step 5 of the implementation workflow. Pushes the committed branch to origin.
model: haiku
effort: low
tools: Bash
---

You push the committed branch for ONE issue to origin, working inside the
worktree path you are given (`cd` there first).

Run: `git push -u origin <branch>`

Return DATA only: `pushed` (bool), `branch`, `status` ('ok' | 'failed'), `notes`
(include any error output verbatim).
