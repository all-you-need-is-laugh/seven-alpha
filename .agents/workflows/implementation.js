export const meta = {
  name: 'implementation',
  description: 'Implement GitHub issues (passed as args) — each in its own worktree via task-implementer → PR, then pr-verifier checks each PR diff against the acceptance criteria',
  whenToUse: 'Run with args = array of issue numbers, e.g. {name:"implementation", args:[2,6,9]}. Fans out one worktree-isolated implementer per issue, then verifies each resulting PR.',
  phases: [
    { title: 'Fetch', detail: 'pull each issue body via gh and build the work list' },
    { title: 'Implement', detail: 'task-implementer per issue: plan/TDD/verify/commit/push/PR in an isolated worktree' },
    { title: 'Verify', detail: 'pr-verifier checks each PR diff against the acceptance criteria (read-only)' },
  ],
}

const REPO = 'all-you-need-is-laugh/seven-alpha'

// --- args: array of issue numbers ---------------------------------------
const issues = Array.isArray(args) ? args : (args == null ? [] : [args])
if (issues.length === 0) {
  throw new Error('implementation: pass issue numbers as args, e.g. Workflow({ name: "implementation", args: [2, 6, 9] })')
}

// --- schemas ------------------------------------------------------------
const CONFIG_ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['issue', 'title', 'spec', 'branch', 'label'],
  properties: {
    issue: { type: 'number' },
    title: { type: 'string' },
    spec: { type: 'string', description: 'The full issue body verbatim (What to build + Acceptance criteria)' },
    branch: { type: 'string', description: 'claude/issue-<n>-<kebab-slug>' },
    label: { type: 'string', description: 'issue-<n>-<kebab-slug> — used as the progress label' },
  },
}

const IMPL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['issue', 'branch', 'plan', 'filesChanged', 'criteria', 'verification', 'prUrl', 'status', 'notes'],
  properties: {
    issue: { type: 'number' },
    branch: { type: 'string' },
    plan: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    criteria: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['criterion', 'met', 'how'],
        properties: {
          criterion: { type: 'string' },
          met: { type: 'boolean' },
          how: { type: 'string' },
        },
      },
    },
    verification: { type: 'string' },
    prUrl: { type: 'string', description: 'PR URL, or empty string if none opened' },
    status: { type: 'string', enum: ['success', 'partial', 'failed'] },
    notes: { type: 'string' },
  },
}

const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['issue', 'prUrl', 'verdict', 'criteria', 'concerns'],
  properties: {
    issue: { type: 'number' },
    prUrl: { type: 'string' },
    verdict: { type: 'string', enum: ['pass', 'concerns', 'fail', 'skipped'] },
    criteria: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['criterion', 'satisfiedByDiff'],
        properties: {
          criterion: { type: 'string' },
          satisfiedByDiff: { type: 'boolean' },
          evidence: { type: 'string' },
        },
      },
    },
    concerns: { type: 'string' },
  },
}

// --- Phase: Fetch -------------------------------------------------------
phase('Fetch')
log(`Fetching ${issues.length} issue(s): ${issues.join(', ')}`)

const config = (await parallel(issues.map((n) => () =>
  agent(
    `Fetch GitHub issue #${n} from ${REPO}.\n` +
    `Run: gh issue view ${n} --repo ${REPO} --json title,body\n` +
    `Return an object: issue=${n}; title=<the title>; spec=<the body VERBATIM>; ` +
    `branch="claude/issue-${n}-<slug>"; label="issue-${n}-<slug>" — where <slug> is a 3-5 word ` +
    `kebab-case summary of the title (lowercase, hyphens, no punctuation).`,
    { label: `fetch:#${n}`, phase: 'Fetch', schema: CONFIG_ITEM_SCHEMA }
  )
))).filter(Boolean)

if (config.length === 0) throw new Error('implementation: no issues could be fetched')

// --- Phases: Implement -> Verify (pipelined per issue) ------------------
const results = await pipeline(
  config,
  // Stage 1: implement in an isolated worktree -> PR
  (c) => agent(
    `Implement GitHub issue #${c.issue} ("${c.title}") in ${REPO}.\n` +
    `Create and work on branch: ${c.branch}\n\n` +
    `=== ISSUE (the contract) ===\n${c.spec}\n\n` +
    `Satisfy every acceptance criterion and verify each. Open a PR with "Closes #${c.issue}". ` +
    `Set prUrl to the created PR URL; status=success only if every criterion is met and verified.`,
    { agentType: 'task-implementer', isolation: 'worktree', schema: IMPL_SCHEMA, label: c.label, phase: 'Implement' }
  ),
  // Stage 2: adversarial review of the resulting PR (skip if no PR).
  // Return {impl, review} so the final result keeps BOTH stages' data
  // (pipeline only yields the last stage's value otherwise).
  (impl, c) => {
    if (!impl || !impl.prUrl || impl.status === 'failed') {
      return {
        impl: impl || null,
        review: {
          issue: c.issue,
          prUrl: impl?.prUrl || '',
          verdict: 'skipped',
          criteria: [],
          concerns: 'No PR produced or implementation failed. Implementer notes: ' + (impl?.notes || 'agent died'),
        },
      }
    }
    return agent(
      `Verify the PR for issue #${c.issue} ("${c.title}") in ${REPO}.\n` +
      `PR: ${impl.prUrl}\n\nAcceptance criteria are in the issue body:\n${c.spec}\n\n` +
      `Read the actual diff (gh pr diff ${impl.prUrl}) and judge each criterion from the DIFF.`,
      { agentType: 'pr-verifier', schema: REVIEW_SCHEMA, label: 'review:' + c.label, phase: 'Verify' }
    ).then((review) => ({ impl, review }))
  }
)

// Clean per-issue summary pairing implementation with its review
return config.map((c, i) => {
  const r = results[i] || {}
  return {
    issue: c.issue,
    title: c.title,
    branch: c.branch,
    prUrl: r.impl?.prUrl || r.review?.prUrl || '',
    implStatus: r.impl?.status || 'failed',
    verdict: r.review?.verdict || 'skipped',
    impl: r.impl || null,
    review: r.review || null,
  }
})
