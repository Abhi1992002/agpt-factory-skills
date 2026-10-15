---
name: factory-evidence
description: Evidence step of the AutoGPT factory. Starts AutoGPT with Docker inside the workspace, proves each done criterion on the running app, and writes evidence/verdict.md PASS or FAIL. Use when the prompt says "Factory step: evidence".
---

# factory-evidence

Owns: proof. No code changes, no PR, nothing posted.

Calls: AutoGPT `pr-test` for starting the stack (skip its posting steps); pstack `principle-prove-it-works`, `blast-radius`, `benchmark-checklist` for numbers, Visual parity rules for "must look the same"; `agpt-ui-states`, `agpt-ui-stress`, `agpt-ui-audit-page` when ui = yes.

## Do

1. Prove what `plan.md` **Proof** lists, on the real running app. A page that loads is not proof.
2. UI: every state at 1440 and 390 wide; focus/keyboard flows step by step; reduced motion for animation.
3. Backend: the real API call or flow, with request, response and log lines saved.
4. Visual parity: screenshot before and after with identical settings and run `node ~/.claude/factory-tools/visual-diff.mjs before/ after/ --json diff.json`. PASS needs 0 changed pixels; report `changed_pixels`.
5. New or changed components: `agpt-ui-states` (every state) and `agpt-ui-stress` (worst-case content) on throwaway pages you never commit.
6. Look at every image before keeping it; delete any that show secrets or other people's data.
7. Stop everything you started before you finish.

## Done when

`evidence/verdict.md` starts with `PASS` or `FAIL`, has one row per criterion with the file that proves it, and every FAIL says what you did, saw and expected. The result line carries the verdict and the diff `patch_id`.
