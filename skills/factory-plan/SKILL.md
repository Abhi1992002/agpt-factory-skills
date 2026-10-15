---
name: factory-plan
description: Plan step of the AutoGPT factory. Turns one Linear issue into brief.md and plan.md with a playbook, the files to change and how to prove it works. Use when the prompt says "Factory step: plan".
---

# factory-plan

Owns: understanding the issue and deciding the shape of the work. No repo code changes.

Calls: pstack `how` (trace the code path), `why` (history), `architect` (types and signatures when a boundary moves), `multi-phase-plan` rules for stacks; AutoGPT `slice-work` thinking for splitting by what users see; `agpt-ui-variants` / `agpt-ui-from-design` only to describe options, never to build them.

## Do

1. Read the code before planning. Every claim in `plan.md` points at `path:line`.
2. Name the data shape first, then the change.
3. Write **Proof** as checks a stranger could run on the live app: the path, the clicks or the API call, and what must be seen. One line per done criterion.
4. Size honestly: `tiny` skips review and evidence, so only for typos, docs, config and one-line style fixes.
5. Split big work: parts that must land in order go in `stack` (≤6); independent fixes go in `separate` cards (≤20), each with a brief that stands alone. Mark every part `ui` true or false. Two separate cards must never edit the same file.
6. Design input: a Figma link or mock → `agpt-ui-from-design`; no design and no clear target → `needs_options: true` (the prototype step builds options).
7. Audits: write `audit.md` (F1… with severity, domain, `path:line`, fix, part) and set `audit: true`.

## Done when

`brief.md` and `plan.md` exist in `.context/factory/`, `plan.md` starts with `Playbook: <name>`, every Changes entry has a file, and the result line's `data` matches the plan (`ui_change`, `size`, `playbook`, `touched_paths`, `stack`).
