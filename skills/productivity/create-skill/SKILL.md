---
name: create-skill
description: >
  Author new Agent Skills in this repo — capture intent, draft SKILL.md, validate with
  `npm run validate`, then publish via `.claude-plugin/plugin.json`. Use this skill
  when the user wants to create, write, or add a new skill, even when the word "skill"
  is not used. Phrases such as "codify this workflow", "turn this into something
  reusable", "add a procedure for X", or "I keep doing this manually" should trigger
  this skill.
license: MIT
---

# Create a skill

Author loop for new Agent Skills. This skill is installed globally, so it can
trigger from any project's session — the first decision is where the new skill
should land.

## Destinations

A skill can live in three places. Decide which fits before drafting, because the
later steps differ.

| Destination | Pick when | Pipeline |
|---|---|---|
| **`moorthyptm/skills`** (this source repo) | The skill is reusable across every project on the machine. | Full loop. Validator, `.claude-plugin/plugin.json`, husky pre-commit, Conventional Commit, push. Re-installs everywhere via `npx skills@latest add moorthyptm/skills`. |
| **`<project>/.claude/skills/<name>/`** | The skill is specific to one codebase and should travel with it in git. | Save the SKILL.md (and any helpers) directly. Claude Code auto-discovers it next session in that project. Steps 4 (validate) and 6 (publish) do not apply — there is no validator or manifest in the other project unless you copy them in. |
| **`~/.claude/skills/<name>/`** | The skill is personal — not shared, not version-controlled. | Save the SKILL.md directly under the user-level skills dir. Available across every Claude Code session on this machine. Steps 4 and 6 do not apply. |

When in doubt, default to the project-level destination first. Promoting a
project skill to `moorthyptm/skills` later is a copy of the folder into
`skills/<category>/<name>/` plus the publish pipeline.

## The loop

```
1. capture intent   — where / what / when / output / verifiable?
2. source           — real session OR project artifacts (not LLM imagination)
3. draft            — frontmatter + body + patterns
4. validate         — (moorthyptm/skills only) npm run validate
5. iterate          — read traces; add corrections to Gotchas
6. publish          — (moorthyptm/skills only) list in .claude-plugin/plugin.json
```

Stop at step 5 until the user approves.

## 1. Capture intent

Always ask the user — never infer intent from `cwd` or repo state. Skip
questions only when you have explicit answers from the conversation.

1. **Where will the skill live?** See [Destinations](#destinations). Every later
   choice depends on this.
2. **What does the skill enable?** Answer in one sentence.
3. **When should the skill trigger?** Specific phrases, contexts, or file types.
   Generic phrasing such as "when handling data" will not trigger reliably.
4. **What is the output?** A file, a pull request, an updated configuration?
5. **Verifiable or subjective?** Mechanical outputs (file transforms, code
   generation) are suited for eval test cases. Subjective outputs (writing style,
   design) are not.
6. **(`moorthyptm/skills` only) Which category?** `engineering`, `productivity`,
   `misc`, or a new one.

Do not draft until these are answered.

## 2. Source from real expertise

LLMs will produce generic skills if given no source (for example:
"handle errors appropriately"). Use any one of the following:

- **A real session.** Review the task the user just completed in conversation.
  Capture every correction (e.g., "use X, not Y"), the exact tools and flags,
  input/output formats, and project-specific facts the agent was not aware of.
- **The activating prompt.** When the user described the workflow inline while
  asking for the skill, treat that prompt as the session — but probe the user
  for the corrections, gotchas, and exact commands that did not make it into
  the prompt.
- **Project artifacts.** Runbooks, ADRs, schemas, code-review comments, incident
  reports, and patches that fixed real bugs.

If no such source exists, do not draft.

## 3. Draft the SKILL.md

### Layout

```
skills/<category>/<skill-name>/
├── SKILL.md          # required
├── scripts/          # optional helpers
├── references/       # optional docs loaded on demand
└── assets/           # optional templates / data
```

### Frontmatter

```yaml
---
name: <skill-name>                # must equal the parent directory
description: <≤1024 chars; what + when; broad triggers>
license: MIT                       # optional, conventional here
compatibility: <env>               # optional, ≤500 chars; usually skip
metadata:                          # optional; values must be strings
  version: "1.0"
allowed-tools: Bash(git:*) Read    # optional, experimental
---
```

`name`: 1–64 characters, `[a-z0-9-]`, no leading, trailing, or consecutive hyphens.

### Description — the trigger

The agent sees only `name` and `description` from the catalog. An unclear
description will not trigger.

- Imperative phrasing: "Use this skill when…" rather than "This skill does…"
- Describe user intent, not implementation detail.
- Be comprehensive — list contexts including ones where the user does not name
  the domain explicitly ("…even when the user does not mention 'CSV'").
- ≤1024 characters.
- Use a YAML block scalar (`description: >`) for multi-line text.

### Body

Cover what the agent would not know without the skill. Skip what the agent
already knows (for example, do not explain what a PDF is). Outline:

```markdown
# <Skill name>

One-paragraph framing.

## When this triggers / what it produces

Short and concrete.

## Workflow

1. Step one
2. Step two

## Gotchas

- <non-obvious environment fact>
- <naming mismatch the agent may overlook>

## Output template (if applicable)

[concrete template]
```

Soft caps: ≤500 lines and approximately 5000 tokens. The validator emits a warning
past these limits. Move content into `references/<topic>.md` when the body
approaches the cap, when distinct domains live in one file and only one applies
per task, or when rarely-used advanced material clutters the main flow. Tell the
agent when to load each reference (for example: "Read `references/api-errors.md`
when the API returns a non-200 response").

### Patterns — use what fits

| Pattern | When |
|---|---|
| **Gotchas** | Always include. Non-obvious facts that the agent may overlook. |
| **Output template** | When the output must follow a fixed structure. Agents pattern-match templates more reliably than prose. |
| **Checklist** | Multi-step workflows where order or dependencies matter. Use `- [ ]` items. |
| **Validation loop** | Do work → run validator → fix → repeat. Use when a script can verify correctness. |
| **Plan-validate-execute** | Destructive or batch operations. The agent emits a plan → a validator checks it → execution runs. |
| **Bundled scripts** | Use when the agent would otherwise reinvent the same logic each run, or when a deterministic check (lint, schema validation) is cheaper as a script than as a re-prompted instruction. Write once and place under `scripts/`. |

## 4. Validate

For the `moorthyptm/skills` destination:

```bash
npm run validate
```

Fix anything it reports. Husky also runs it on every commit, so errors block
the commit if missed.

For project-scoped and personal destinations, the repo validator is not
available. Check by hand:

- `name` matches the parent directory exactly.
- `name` is 1–64 characters, lowercase letters, digits, and hyphens only —
  no leading, trailing, or consecutive hyphens.
- `description` is present and 1–1024 characters.
- `metadata` values are strings — quote numerics like `version: "1.0"`.
- Body is under 500 lines and approximately 5000 tokens.
- Every `scripts/…`, `references/…`, or `assets/…` path mentioned in the
  body actually exists in the skill directory.

## 5. Iterate

Run the skill on 2–3 realistic prompts and read the **execution traces**, not
only the final outputs. Signals to look for:

- The agent tries multiple approaches before one works → instructions too vague.
- The agent follows steps that do not apply to the task → instructions too
  prescriptive.
- The agent oscillates between options → no clear default has been provided.

Every correction the user makes goes into Gotchas.

Before publishing, check the semantic items the validator cannot catch:
time-sensitive content (specific dates, version numbers that will age),
drifting terminology, missing concrete examples, whether an agent could
complete the task from this file alone, and — most importantly — that no
credentials, secrets, tokens, internal hostnames, customer data, or
personal information are present in the SKILL.md, scripts, references, or
assets. Once published, the skill is public.

Deeper evaluation: <https://agentskills.io/skill-creation/evaluating-skills>

## 6. Publish

This step applies only when the destination is `moorthyptm/skills`. Project-level
and personal skills are picked up automatically by Claude Code from
`.claude/skills/` or `~/.claude/skills/` — nothing to publish.

Once the user approves:

1. Add the skill path to `.claude-plugin/plugin.json`:
   ```json
   { "name": "moorthyptm-skills", "skills": ["./skills/<category>/<skill-name>"] }
   ```
2. Run `npm run validate` once more. Validation should pass, and the "not listed"
   warning should be gone.
3. Commit using Conventional Commits:
   ```
   feat(<skill-name>): add new skill
   ```
   Husky runs the validator again before the commit is recorded.

## Gotchas — authoring in this repo

- **Never include secrets or personal information.** Published skills are
  public. No credentials, API keys, tokens, internal hostnames, customer
  data, real teammate names without consent, or personal email addresses
  in any file under the skill directory. When an example needs a value,
  use a placeholder like `<your-api-key>` or `TODO: set token`.
- **Name must equal the parent directory.** `skills/productivity/foo/SKILL.md`
  requires `name: foo`.
- **Quote numeric metadata values.** Write `version: "1.0"`, not `version: 1.0`
  (YAML parses unquoted numbers as floats).
- **`plugin.json` gates only when non-empty.** With an empty `skills: []` and
  nested skill folders, the CLI's recursive fallback picks them up anyway.
  List at least one published skill to disable the fallback.
- **References stay one level deep.** `references/api-errors.md` is fine;
  `references/v2/api/errors.md` is allowed by the spec but discouraged.

## Reference

- Spec: <https://agentskills.io/specification>
- Best practices: <https://agentskills.io/skill-creation/best-practices>
- Optimizing descriptions: <https://agentskills.io/skill-creation/optimizing-descriptions>
- Evaluating output: <https://agentskills.io/skill-creation/evaluating-skills>
- Validator source: `scripts/validate-skills.mjs`
