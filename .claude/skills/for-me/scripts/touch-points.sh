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

me="$(gh api user --jq .login)"

# ---------------------------------------------------------------- issues
# Never triaged (zero labels).
unlabeled="$(gh issue list --search "is:open no:label" \
  --json number,title,createdAt,url --jq 'sort_by(.createdAt)')"

needs_triage="$(gh issue list --state open --label "$L_NEEDS_TRIAGE" \
  --json number,title,createdAt,url --jq 'sort_by(.createdAt)')"

ready_human="$(gh issue list --state open --label "$L_READY_HUMAN" \
  --json number,title,createdAt,url --jq 'sort_by(.createdAt)')"

# needs-info where the reporter replied last (heuristic: last comment not by you).
needs_info_replied="[]"
for n in $(gh issue list --state open --label "$L_NEEDS_INFO" --json number --jq '.[].number'); do
  last="$(gh issue view "$n" --json comments --jq '(.comments | last | .author.login) // ""')"
  if [ -n "$last" ] && [ "$last" != "$me" ]; then
    item="$(gh issue view "$n" --json number,title,createdAt,url \
      --jq '{number,title,createdAt,url}')"
    needs_info_replied="$(jq -c --argjson x "$item" '. + [$x]' <<<"$needs_info_replied")"
  fi
done

# ---------------------------------------------------------------- pull requests
prs="$(gh pr list --state open \
  --json number,title,author,isDraft,reviewDecision,mergeable,statusCheckRollup,updatedAt,url)"

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

# To review: someone else's open PR not yet approved.
to_review="$(jq -c --arg me "$me" '
  map(select((.isDraft|not) and .author.login != $me
             and (.reviewDecision == "REVIEW_REQUIRED" or .reviewDecision == null)))
  | sort_by(.updatedAt)' <<<"$prs")"

# Blocked: your own PR with changes requested or red CI.
blocked="$(jq -c --arg me "$me" '
  map(select((.isDraft|not) and .author.login == $me
             and (.reviewDecision == "CHANGES_REQUESTED" or .rollup == "FAILURE")))
  | sort_by(.updatedAt)' <<<"$prs")"

# Mergeable: approved, clean merge, green (or no) checks.
mergeable="$(jq -c '
  map(select((.isDraft|not) and .reviewDecision == "APPROVED"
             and .mergeable == "MERGEABLE" and (.rollup == "SUCCESS" or .rollup == "NONE")))
  | sort_by(.updatedAt)' <<<"$prs")"

jq -n \
  --argjson unlabeled "$unlabeled" \
  --argjson needs_triage "$needs_triage" \
  --argjson needs_info "$needs_info_replied" \
  --argjson ready_human "$ready_human" \
  --argjson to_review "$to_review" \
  --argjson blocked "$blocked" \
  --argjson mergeable "$mergeable" \
  '{
    issues: {
      unlabeled:                   $unlabeled,
      needs_triage:                $needs_triage,
      needs_info_reporter_replied: $needs_info,
      ready_for_human:             $ready_human
    },
    prs: { to_review: $to_review, blocked: $blocked, mergeable: $mergeable }
  }'
