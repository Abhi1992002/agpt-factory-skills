---
name: factory-mode
description: Router every AutoGPT factory session follows. Picks the playbook from the brief, sets size, ui yes/no and the review gate, and names which factory-* skill owns the current step. Use at the start of every factory step, after the skills setup.
---

# factory-mode

The factory's version of pstack's `poteto-mode`. You are one unattended step in a pipeline the server drives:

`plan (→ prototype) → [your OK] → fix → review → evidence → pr` (+ `pr_fix`, `restack` in the PR column, `learn` daily).

Each step is a fresh session in the same Conductor workspace. Steps share nothing but files in `.context/factory/` (and `.context/factory/p<n>/` for PR n of a stack) and the git branch.

## 1. Find your step

Your prompt's title says `Factory step: <step>`. Load the owning skill and follow it inside the prompt's own steps:

| Step | Skill | Reads | Writes |
|---|---|---|---|
| plan | `factory-plan` | the issue in the prompt | `brief.md`, `plan.md`, `audit.md` for audits |
| prototype | `factory-plan` (options) | `plan.md` | `options.md`, `options/`, local branch `<branch>-options` |
| fix | `factory-fix` | `plan.md` (+ `review.md`, `evidence/verdict.md`, `ci.md` on later rounds) | code, commits, `build.md` |
| review | `factory-review` | the branch diff, `plan.md`, `build.md` | `review.md` |
| evidence | `factory-evidence` | `plan.md` Proof, `build.md` | `evidence/`, `evidence/verdict.md` |
| pr, pr_fix | `factory-pr` | everything above | the PR, `pr.md` |
| learn | `factory-learn` | the day report in the prompt | skill edits, `LEARN.md`, one PR |

The prompt wins over any skill when they disagree. The `FACTORY_RESULT` line is always the last line.

## 2. Pick the playbook (plan step; later steps read it from `plan.md`)

| Issue | Playbook (`~/.claude/pstack/skills/poteto-mode/playbooks/`) | ui |
|---|---|---|
| Typo, docs, config | none — size `tiny` | only if users read the text |
| Something broken | `bug-fix.md` | if it renders |
| New behaviour | `feature.md` | if it renders |
| Slow page or API | `perf-issue.md` | no |
| Same behaviour, better structure | `refactoring.md` | if screens must stay identical: `visual-parity.md` rules |
| Design-system change that must look the same | `visual-parity.md` (screenshot first, image diff 0) | yes |
| Design not decided | `needs_options: true` → the prototype step builds 2–3 options (`prototype.md` + `agpt-ui-variants`) → the human picks one → plan again | yes |
| A design exists (Figma, screenshot) | `feature.md` with `agpt-ui-from-design` mapping the design to tokens and components | yes |
| Audit (design system, a11y across pages, legacy API) | `audit.md` with findings → parts → the human approves | per part |
| Several dependent PRs | `multi-phase-plan.md` → `stack` (≤6, in order, one workspace) | per PR |
| Many independent fixes | `separate` cards (≤20, each its own workspace and plan) | per card |

## 3. Gates

- **ui = yes** when anything renders differently in the browser. Then the agpt-ui skills apply in every later step, and evidence must show every state at 1440 and 390 wide.
- **Plan gate:** audits and plans that split wait in **Plan ready** for the human's OK (the server's `approve_plans` setting can widen this to UI changes or every plan). Design options always wait for a pick. Parts of a split never split again.
- **Review gate:** findings marked **ask** stop the card for the human. Use **ask** only for product or design calls, never for things you can decide from the code.
- **Visible UI changes** need screenshots and, for motion or keyboard flows, a short video before the PR.

## 4. Non-negotiables

- Never write to Linear. Never merge, approve, close or force-push. Never post `/review` on an approved PR or twice.
- Prove it on the running app; green CI is not a verdict.
- Fix root causes. Two failed fixes on the same premise: attack the premise.
- Smallest change that works; delete before you add.
- Everything the next step needs goes in a file in `.context/factory/`, never only in chat.
- If a step cannot be done, say why in `summary` and return the right status (`blocked`, `too_vague`, `needs_local`, `failed`). Never invent success.

## 5. Principles by moment

Before code: `principle-foundational-thinking`, `principle-model-the-domain`, `principle-type-system-discipline`.
Changing a design: `principle-subtract-before-you-add`, `principle-laziness-protocol`, `principle-migrate-callers-then-delete-legacy-apis`.
Debugging: `principle-fix-root-causes`, `principle-attack-the-premise`.
Proving: `principle-prove-it-works`, `principle-test-behavior-not-implementation`.
All live in `~/.claude/pstack/skills/`.
