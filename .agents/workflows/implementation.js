export const meta = {
  name: 'implementation',
  description: 'Implement GitHub issues (passed as args) — each through a sequential per-step pipeline (plan → implement[tdd+verify loop] → commit → push → open PR), then pr-reviewer checks the PR diff. Each issue runs in its own persistent worktree shared across its steps.',
  whenToUse: 'Run with args = array of issue numbers, e.g. {name:"implementation", args:[2,6,9]}. Steps run sequentially per issue; issues pipeline against each other.',
  phases: [
    { title: 'Fetch', detail: 'pull each issue body via gh and build the work list' },
    { title: 'Plan', detail: 'task-planner: orient + create the persistent worktree/branch' },
    { title: 'Implement', detail: 'tdd-implementer → change-verifier, looped up to MAX_ITERATIONS (break as soon as verify passes). Gates the rest.' },
    { title: 'Commit', detail: 'committer: one [Claude] Conventional Commit' },
    { title: 'Push', detail: 'pusher: git push -u origin <branch>' },
    { title: 'Open PR', detail: 'pr-opener: gh pr create, Closes #N + criteria checklist' },
    { title: 'Review', detail: 'pr-reviewer: adversarial read-only check of the PR diff' },
  ],
}

const REPO = 'all-you-need-is-laugh/seven-alpha'

// One "iteration" = a tdd pass followed by a verify pass. The implement phase
// loops up to this many iterations, breaking early as soon as verify passes; if
// every iteration still fails verification, commit/push/PR are gated off.
const MAX_ITERATIONS = 3

// --- args: array of issue numbers ---------------------------------------
const issues = Array.isArray(args) ? args : (args == null ? [] : [args])
if (issues.length === 0) {
  throw new Error('implementation: pass issue numbers as args, e.g. Workflow({ name: "implementation", args: [2, 6, 9] })')
}

// --- schemas ------------------------------------------------------------
const STATUS = { type: 'string', enum: ['ok', 'failed'] }

const CONFIG_ITEM_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['issue', 'title', 'spec', 'acceptanceCriteria', 'branch', 'label'],
  properties: {
    issue: { type: 'number' },
    title: { type: 'string' },
    spec: { type: 'string', description: 'Full issue body verbatim (What to build + Acceptance criteria + Out of scope)' },
    acceptanceCriteria: { type: 'string', description: 'ONLY the acceptance-criteria checklist, verbatim — the slice the verify/PR/review steps need' },
    branch: { type: 'string', description: 'claude/issue-<n>-<kebab-slug>' },
    label: { type: 'string', description: 'issue-<n>-<kebab-slug>' },
  },
}

const PLAN_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['worktreePath', 'branch', 'plan', 'files', 'tests', 'status', 'notes'],
  properties: {
    worktreePath: { type: 'string', description: 'ABSOLUTE path to the created worktree' },
    branch: { type: 'string' },
    plan: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    tests: { type: 'array', items: { type: 'string' } },
    status: STATUS, notes: { type: 'string' },
  },
}

const TDD_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['filesChanged', 'testReport', 'tddUsed', 'status', 'notes'],
  properties: {
    filesChanged: { type: 'array', items: { type: 'string' } },
    testReport: { type: 'string' },
    tddUsed: { type: 'boolean' },
    status: STATUS, notes: { type: 'string' },
  },
}

const VERIFY_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['checks', 'allPassed', 'criteria', 'status', 'notes'],
  properties: {
    checks: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['name', 'passed', 'output'],
        properties: { name: { type: 'string' }, passed: { type: 'boolean' }, output: { type: 'string' } },
      },
    },
    allPassed: { type: 'boolean' },
    criteria: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['criterion', 'met'],
        properties: { criterion: { type: 'string' }, met: { type: 'boolean' } },
      },
    },
    status: STATUS, notes: { type: 'string' },
  },
}

const COMMIT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['committed', 'subject', 'sha', 'status', 'notes'],
  properties: {
    committed: { type: 'boolean' }, subject: { type: 'string' }, sha: { type: 'string' },
    status: STATUS, notes: { type: 'string' },
  },
}

const PUSH_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['pushed', 'branch', 'status', 'notes'],
  properties: { pushed: { type: 'boolean' }, branch: { type: 'string' }, status: STATUS, notes: { type: 'string' } },
}

const PR_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['prUrl', 'status', 'notes'],
  properties: { prUrl: { type: 'string' }, status: STATUS, notes: { type: 'string' } },
}

const REVIEW_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['issue', 'prUrl', 'verdict', 'criteria', 'concerns'],
  properties: {
    issue: { type: 'number' }, prUrl: { type: 'string' },
    verdict: { type: 'string', enum: ['pass', 'concerns', 'fail', 'skipped'] },
    criteria: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['criterion', 'satisfiedByDiff'],
        properties: { criterion: { type: 'string' }, satisfiedByDiff: { type: 'boolean' }, evidence: { type: 'string' } },
      },
    },
    concerns: { type: 'string' },
  },
}

// --- helpers ------------------------------------------------------------
function baseCtx(c) {
  return {
    issue: c.issue, title: c.title, spec: c.spec, branch: c.branch, label: c.label,
    worktreePath: '', prUrl: '', status: 'ok', stoppedAt: null, steps: {},
  }
}

// Run a step unless an earlier step already failed; merge its result into ctx
// under steps[name] and propagate status / lifted fields. Never clobbers prior
// step data (each step keeps its own slot).
function step(prev, c, name, makeAgent) {
  const ctx = prev && prev.steps ? prev : baseCtx(c)
  if (ctx.status === 'failed') {
    return { ...ctx, steps: { ...ctx.steps, [name]: { skipped: true } } }
  }
  return Promise.resolve(makeAgent()).then((r) => {
    const ok = !!r && r.status === 'ok'
    return {
      ...ctx,
      steps: { ...ctx.steps, [name]: r || { error: 'agent died' } },
      status: ok ? 'ok' : 'failed',
      stoppedAt: ok ? ctx.stoppedAt : (ctx.stoppedAt || name),
      worktreePath: (r && r.worktreePath) || ctx.worktreePath,
      branch: (r && r.branch) || ctx.branch,
      prUrl: (r && r.prUrl) || ctx.prUrl,
    }
  })
}

const WT = (c) => '.claude/worktrees/impl-' + c.label

// --- Phase: Fetch -------------------------------------------------------
phase('Fetch')
log(`Fetching ${issues.length} issue(s): ${issues.join(', ')}`)

const config = (await parallel(issues.map((n) => () =>
  agent(
    `Fetch GitHub issue #${n} from ${REPO}.\n` +
    `Run: gh issue view ${n} --repo ${REPO} --json title,body\n` +
    `Return: issue=${n}; title=<the title>; spec=<the body VERBATIM>; ` +
    `acceptanceCriteria=<ONLY the acceptance-criteria checklist from the body, verbatim>; ` +
    `branch="claude/issue-${n}-<slug>"; label="issue-${n}-<slug>" — <slug> is a 3-5 word ` +
    `kebab-case summary of the title (lowercase, hyphens, no punctuation).`,
    { label: `fetch:#${n}`, phase: 'Fetch', schema: CONFIG_ITEM_SCHEMA }
  )
))).filter(Boolean)

if (config.length === 0) throw new Error('implementation: no issues could be fetched')

// --- The per-step sequential pipeline (issues pipeline against each other) ---
const results = await pipeline(
  config,

  // 1. PLAN — also creates the persistent worktree/branch (procedure lives in task-planner.md)
  (c) => step(null, c, 'plan', () => agent(
    `Repo: ${REPO}\nIssue #${c.issue}: ${c.title}\n` +
    `Target branch: ${c.branch}\nTarget worktree (relative to repo root): ${WT(c)}\n\n` +
    `=== ISSUE ===\n${c.spec}`,
    { agentType: 'task-planner', schema: PLAN_SCHEMA, label: `plan:${c.label}`, phase: 'Plan' }
  )),

  // 2. IMPLEMENT — loop (tdd → verify) up to MAX_ITERATIONS; verify gates the rest
  (p, c) => step(p, c, 'implement', async () => {
    const iterations = []
    let v = null
    let n = 0
    while (n < MAX_ITERATIONS) {
      n++
      const first = n === 1
      const tddPrompt = first
        ? `Issue #${c.issue}: ${c.title}\n` +
          `Worktree (cd here): ${p.worktreePath}\nBranch: ${p.branch}\n\n` +
          `=== PLAN ===\n${p.steps.plan?.plan || '(none — work from the issue)'}\n\n` +
          `=== ISSUE ===\n${c.spec}`
        : `Issue #${c.issue}: ${c.title} — REMEDIATION (your iteration ${n - 1} failed verification).\n` +
          `Worktree (cd here): ${p.worktreePath}\nBranch: ${p.branch}\n\n` +
          `=== Failing checks ===\n${JSON.stringify((v?.checks || []).filter((x) => !x.passed))}\n\n` +
          `=== Unmet criteria ===\n${JSON.stringify((v?.criteria || []).filter((x) => !x.met).map((x) => x.criterion))}\n\n` +
          `=== Verifier notes ===\n${v?.notes || ''}`

      const tdd = await agent(tddPrompt, {
        agentType: 'tdd-implementer', schema: TDD_SCHEMA,
        label: first ? `tdd:${c.label}` : `tdd${n}:${c.label}`, phase: 'Implement',
      })

      v = await agent(
        `Issue #${c.issue}: ${c.title}\nWorktree (cd here): ${p.worktreePath}\n\n` +
        `=== Acceptance criteria ===\n${c.acceptanceCriteria}`,
        { agentType: 'change-verifier', schema: VERIFY_SCHEMA, label: first ? `verify:${c.label}` : `verify${n}:${c.label}`, phase: 'Implement' }
      )

      iterations.push({ iteration: n, tdd, verify: v })
      if (v && v.status === 'ok') break
      if (n < MAX_ITERATIONS) log(`#${c.issue}: verify failed — re-running tdd+verify (iteration ${n + 1}/${MAX_ITERATIONS})`)
    }

    // Return the FINAL verify object (so .checks/.status/.criteria stay valid for
    // downstream), annotated with the iteration trail.
    return { ...(v || { status: 'failed', checks: [], criteria: [], allPassed: false, notes: 'no verify result' }), iterations, iterationCount: n }
  }),

  // 4. COMMIT
  (p, c) => step(p, c, 'commit', () => agent(
    `Issue #${c.issue}: ${c.title}\nWorktree (cd here): ${p.worktreePath}\nBranch: ${p.branch}`,
    { agentType: 'committer', schema: COMMIT_SCHEMA, label: `commit:${c.label}`, phase: 'Commit' }
  )),

  // 5. PUSH
  (p, c) => step(p, c, 'push', () => agent(
    `Issue #${c.issue}\nWorktree (cd here): ${p.worktreePath}\nBranch: ${p.branch}`,
    { agentType: 'pusher', schema: PUSH_SCHEMA, label: `push:${c.label}`, phase: 'Push' }
  )),

  // 6. OPEN PR
  (p, c) => step(p, c, 'pr', () => agent(
    `Issue #${c.issue}: ${c.title} (${REPO})\nWorktree (cd here): ${p.worktreePath}\nBranch: ${p.branch}\n\n` +
    `Body MUST include "Closes #${c.issue}".\n` +
    `=== Acceptance criteria (one checklist line each, with how verified) ===\n${c.acceptanceCriteria}\n\n` +
    `=== Verify results to cite ===\n${JSON.stringify(p.steps.implement?.checks || [])}`,
    { agentType: 'pr-opener', schema: PR_SCHEMA, label: `pr:${c.label}`, phase: 'Open PR' }
  )),

  // 7. REVIEW — independent adversarial read-only check of the PR diff
  (p, c) => {
    if (!p || p.status === 'failed' || !p.prUrl) {
      return { ...(p || baseCtx(c)), review: { issue: c.issue, prUrl: p?.prUrl || '', verdict: 'skipped', criteria: [], concerns: 'No PR / earlier step failed at: ' + (p?.stoppedAt || 'unknown') } }
    }
    return agent(
      `Issue #${c.issue}: ${c.title} (${REPO})\nPR: ${p.prUrl}\n\n` +
      `=== Acceptance criteria ===\n${c.acceptanceCriteria}`,
      { agentType: 'pr-reviewer', schema: REVIEW_SCHEMA, label: `review:${c.label}`, phase: 'Review' }
    ).then((review) => ({ ...p, review }))
  }
)

// --- Clean per-issue summary -------------------------------------------
return config.map((c, i) => {
  const r = results[i] || {}
  return {
    issue: c.issue,
    title: c.title,
    branch: r.branch || c.branch,
    worktreePath: r.worktreePath || '',
    prUrl: r.prUrl || '',
    status: r.status || 'failed',
    stoppedAt: r.stoppedAt || null,
    iterations: r.steps?.implement?.iterationCount || 0,
    verdict: r.review?.verdict || 'skipped',
    steps: r.steps || {},
    review: r.review || null,
  }
})
