# Agent instructions

## Agent skills

### Issue tracker

Issues are tracked as GitHub issues (`all-you-need-is-laugh/seven-alpha`) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical triage roles map 1:1 to their label strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Commits

When you (an agent) create a git commit, prefix the subject line with `[Claude] ` — e.g. `[Claude] feat: add rate limiter`. Agents push under the maintainer's GitHub account, so authorship alone can't tell agent work from the human's; this tag is the signal. The prefix goes before any Conventional Commits type. Commits the human makes by hand (outside Claude Code) stay untagged.
