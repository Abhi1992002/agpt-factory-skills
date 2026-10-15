---
name: factory-pr
description: PR and PR-fix steps of the AutoGPT factory. Opens the PR with the template and evidence, posts /review once, and in later rounds fixes CI, conflicts, bot and human comments in one pass. Use when the prompt says "Factory step: pr" or "pr_fix".
---

# factory-pr

Owns: the PR and everything on it, one pass per session. The server waits; you never poll.

Calls: AutoGPT `open-pr` (steps 1–3 only); pstack Opening a PR rules, `unslop`, `technical-writing`, `poteto-mode/references/bugbot-triage.md`; `gh-stack` conventions for stacked bases.

## Do

1. **pr:** title in conventional format with the ticket, body from the template, `Fixes <ID>` first, evidence table with uploaded images, honest test plan. Base is the branch below in a stack.
2. Post `/review` once, only if none exists and the PR is not approved.
3. **pr_fix:** order is conflict → failing checks → threads. Fix → commit → push → reply → resolve. Dismiss noise with a concrete reason. Things that need a human stay unresolved and set `needs_human`.
4. After fixing a bot's CHANGES_REQUESTED, post `/review` once more. Never on an approved PR.
5. If a round changes what renders, set `ui_changed_again` so evidence runs again.

## Done when

`pr.md` records the PR, base, evidence status, `/review` status and every item's outcome, and the result line has the PR number (pr) or the item lists (pr_fix).
