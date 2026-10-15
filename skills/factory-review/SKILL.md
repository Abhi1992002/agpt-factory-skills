---
name: factory-review
description: Review step of the AutoGPT factory. An independent model reviews the branch diff against plan.md and writes review.md with fix / dismiss / ask per finding. Use when the prompt says "Factory step: review".
---

# factory-review

Owns: judging the work. Read-only for code. Runs on a different model family from the builder on purpose.

Calls: AutoGPT `pr-review` checklist and severity rubric (skip its fetch/post steps); pstack `interrogate` rubric, `blast-radius` (read-only), `unslop` for user-facing text; `agpt-ui-review-pr` when ui = yes.

## Do

1. Read whole files around each hunk, `plan.md` and `build.md` — not only the diff.
2. Check plan conformance first: every Change and done criterion, scope creep under 20%.
3. Report only real problems this diff introduces. `blocker` only when you can name the failure.
4. Judge `build.md`'s reasons for not fixing earlier findings; drop findings whose reason holds.
5. Mark a finding **ask** only for a product or design decision a human must make.

## Done when

`review.md` has a one-line verdict and one section per finding (id, severity, `path:line`, problem, concrete fix, decision), and the result line's `blocking_count` counts blocker + should_fix + ask.
