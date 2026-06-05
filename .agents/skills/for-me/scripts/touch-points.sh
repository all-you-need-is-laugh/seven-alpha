#!/usr/bin/env bash
# Emit JSON of touch points on the GitHub tracker that await the maintainer's action.
#
# Buckets: issues needing triage (unlabeled / needs-triage / needs-info w/ reporter
# reply), issues ready-for-human, and PRs (to review / blocked / mergeable).
#
# Label strings default to the canonical names. If docs/agents/triage-labels.md
# remaps them, pass overrides via env: LABEL_NEEDS_TRIAGE, LABEL_NEEDS_INFO,
# LABEL_READY_FOR_HUMAN.
set -euo pipefail

L_NEEDS_TRIAGE="${LABEL_NEEDS_TRIAGE:-needs-triage}"
L_NEEDS_INFO="${LABEL_NEEDS_INFO:-needs-info}"
L_READY_HUMAN="${LABEL_READY_FOR_HUMAN:-ready-for-human}"

command -v gh >/dev/null  || { echo "gh CLI not found" >&2; exit 1; }
command -v jq >/dev/null  || { echo "jq not found" >&2; exit 1; }

# ---------------------------------------------------------------- issues
# Never triaged (zero labels).
unlabeled="$(gh issue list --search "is:open no:label" \
  --json number,title,createdAt,url --jq 'sort_by(.createdAt)')"

needs_triage="$(gh issue list --state open --label "$L_NEEDS_TRIAGE" \
  --json number,title,createdAt,url --jq 'sort_by(.createdAt)')"

ready_human="$(gh issue list --state open --label "$L_READY_HUMAN" \
  --json number,title,createdAt,url --jq 'sort_by(.createdAt)')"

# needs-info: solo project, so the missing detail is always on you. Whoever filed it
# (you or an agent) it's you who supplies the info — agents don't answer triage
# threads, they run once and open a PR. Show every open needs-info issue.
needs_info="$(gh issue list --state open --label "$L_NEEDS_INFO" \
  --json number,title,createdAt,url --jq 'sort_by(.createdAt)')"

# ---------------------------------------------------------------- pull requests
prs="$(gh pr list --state open \
  --json number,title,isDraft,mergeable,statusCheckRollup,updatedAt,url)"

# Collapse each PR's check rollup to one word: SUCCESS / FAILURE / PENDING / NONE.
prs="$(jq -c '
  map(. + { rollup: (
      (.statusCheckRollup // []) as $c
      | if   ($c | length) == 0 then "NONE"
        elif any($c[]; ((.conclusion // .state) // "") as $s
                       | ($s=="FAILURE" or $s=="ERROR" or $s=="TIMED_OUT" or $s=="CANCELLED")) then "FAILURE"
        elif any($c[]; ((.conclusion // .state) // "") as $s
                       | ($s=="" or $s=="PENDING" or $s=="IN_PROGRESS" or $s=="QUEUED" or $s=="EXPECTED")) then "PENDING"
        else "SUCCESS" end ) })' <<<"$prs")"

# Solo repo: agents push under your account and GitHub blocks self-approval, so
# authorship and review-decision carry no signal. Every open non-draft PR is your queue.

# Blocked: red CI or a merge conflict — fix before it can land.
blocked="$(jq -c '
  map(select((.isDraft|not) and (.rollup == "FAILURE" or .mergeable == "CONFLICTING")))
  | sort_by(.updatedAt)' <<<"$prs")"

# Ready: everything else — review it, merge once checks are green.
ready="$(jq -c '
  map(select((.isDraft|not) and .rollup != "FAILURE" and .mergeable != "CONFLICTING"))
  | sort_by(.updatedAt)' <<<"$prs")"

jq -n \
  --argjson unlabeled "$unlabeled" \
  --argjson needs_triage "$needs_triage" \
  --argjson needs_info "$needs_info" \
  --argjson ready_human "$ready_human" \
  --argjson ready "$ready" \
  --argjson blocked "$blocked" \
  '{
    issues: {
      unlabeled:                   $unlabeled,
      needs_triage:                $needs_triage,
      needs_info:                  $needs_info,
      ready_for_human:             $ready_human
    },
    prs: { ready: $ready, blocked: $blocked }
  }'
