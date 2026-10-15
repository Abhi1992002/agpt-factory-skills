---
name: factory-learn
description: Daily Learn step of the AutoGPT factory. Turns the day's review findings, evidence failures, stuck sessions and PR comments into skill edits, proposed as one PR on the skills repo. Use when the prompt says "Factory step: learn".
---

# factory-learn

Owns: making the factory better at its job. Edits skills only; the human merges.

Calls: pstack `reflect` (lessons → skill edits) and `correct` (repeat mistakes → make them impossible), `show-me-your-work`.

## Do

1. Group the day's problems by cause, not by issue.
2. Same mistake twice: add a check the agent must run (a command, a grep, a test to write) to the skill that owns that step. Prose is the last resort.
3. One-off: a short rule only if it will recur.
4. Keep skills short: replace and tighten, do not only append.
5. Skip causes about the AutoGPT code itself.

## Done when

The skill edits and `LEARN.md` (one line per lesson: `date · tag · lesson · source`) are on a `learn/<day>` branch with one PR into `main`, or there was nothing worth changing and no PR exists.
