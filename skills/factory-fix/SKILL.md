---
name: factory-fix
description: Fix step of the AutoGPT factory. Writes the code and tests from plan.md, or fixes what review.md, evidence/verdict.md or ci.md list on later rounds. Use when the prompt says "Factory step: fix".
---

# factory-fix

Owns: code, tests, commits and `build.md`. Does not open the PR.

Calls: the playbook named in `plan.md`; pstack `tdd` when a cheap failing test exists; `principle-fix-root-causes`; AutoGPT `worktree`-style setup commands from the plan, `write-frontend-tests`, `vercel-react-best-practices` for React; agpt-ui color/type/layout/polish/a11y/copy when ui = yes.

## Do

1. Round 1: follow the plan in order. Later rounds: fix only the must-fix items in `review.md`, `evidence/verdict.md` and `ci.md`. Leave passing work alone.
2. A finding you think is wrong: do not change code for it; write the technical reason in `build.md`. Review reads it.
3. Small commits in a sensible order, conventional messages with the `AGENTS.md` trailer.
4. Run the checks the prompt lists and make them green for real. Never skip, xfail or delete tests.
5. Strip comments that only narrate the code (`no-comments`).

## Done when

The branch is pushed, the checks you ran are green, and `build.md` has a `## Round <n>` section listing changes, commits, each finding's outcome and what is left to CI.
