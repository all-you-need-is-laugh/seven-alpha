#!/usr/bin/env bash
# List open `ready-for-agent` issues, split into pick-up-now (no open blockers) and
# blocked (waiting on another open issue named in their "Blocked by" section).
#
# Label string defaults to canonical. If docs/agents/triage-labels.md remaps it,
# pass an override: LABEL_READY_FOR_AGENT=... bash ready-for-agent.sh
set -euo pipefail

L_READY_AGENT="${LABEL_READY_FOR_AGENT:-ready-for-agent}"

command -v gh >/dev/null || { echo "gh CLI not found" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq not found" >&2; exit 1; }

issues="$(gh issue list --state open --label "$L_READY_AGENT" \
  --json number,title,createdAt,url,body --jq 'sort_by(.createdAt)')"

ready="[]"; blocked="[]"
for n in $(jq -r '.[].number' <<<"$issues"); do
  body="$(jq -r --argjson n "$n" '.[] | select(.number==$n) | (.body // "")' <<<"$issues")"

  # Issue numbers referenced under a "Blocked by" heading in the issue body.
  refs="$(printf '%s\n' "$body" \
    | awk 'tolower($0) ~ /^#+[[:space:]]*blocked by/ {f=1; next} /^#+[[:space:]]/ {f=0} f' \
    | grep -oE '#[0-9]+' | tr -d '#' | sort -u)"

  open_blockers=""
  for b in $refs; do
    [ "$b" = "$n" ] && continue
    st="$(gh issue view "$b" --json state --jq '.state' 2>/dev/null || echo "")"
    [ "$st" = "OPEN" ] && open_blockers="$open_blockers $b"
  done

  item="$(jq -c --argjson n "$n" '.[] | select(.number==$n) | {number,title,url}' <<<"$issues")"
  if [ -n "${open_blockers// /}" ]; then
    item="$(jq -c --arg ob "${open_blockers# }" '. + {blocked_by: ($ob|split(" ")|map(tonumber))}' <<<"$item")"
    blocked="$(jq -c --argjson x "$item" '. + [$x]' <<<"$blocked")"
  else
    ready="$(jq -c --argjson x "$item" '. + [$x]' <<<"$ready")"
  fi
done

jq -n --argjson ready "$ready" --argjson blocked "$blocked" \
  '{ ready: $ready, blocked: $blocked }'
