# factory-skills

The skills every AutoGPT factory session loads. The server's prompts carry the step-by-step instructions; these skills carry the "how" that improves over time.

```
skills/
  factory-mode/      router: picks the playbook, sets gates, names the owning skill
  factory-plan/ factory-fix/ factory-review/ factory-evidence/ factory-pr/ factory-learn/
  agpt-ui-*/         UI skills (color, type, layout, polish, a11y, copy, audit, review, states, stress, variants, from-design, explain)
pstack/              Lauren Tan's pstack (MIT), vendored from cursor/plugins — playbooks, tools, principles
tools/
  visual-diff.mjs    zero-dependency PNG pixel diff for visual-parity proof (copied to ~/.claude/factory-tools)
scripts/
  sync-pstack.sh     refresh pstack/ from upstream
  sync-agpt-ui.sh    copy agpt-ui-* from ~/.claude/skills
LEARN.md             lessons the daily Learn session added
```

## How sessions get them

Set **Skills repo** in the desktop app's Settings to the repo that holds this folder. Every session then runs:

```bash
git clone --depth 1 <skills repo> /tmp/factory-skills
# uses /tmp/factory-skills/factory-skills/ when the folder sits inside a bigger repo
cp -R <root>/skills/. ~/.claude/skills/
cp -R <root>/pstack ~/.claude/pstack
cp -R <root>/tools ~/.claude/factory-tools
```

Conductor cloud must be able to clone that repo (its GitHub app needs access to it).

## Learn

With **Learn** switched on, the server starts one session a day in this repo. It proposes skill edits as a PR into `main`. Nothing changes until you merge it.

## Later

Once the skills are stable, copy `skills/` into the AutoGPT repo's `.claude/skills/` and open a PR there.
