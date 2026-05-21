# skills

Personal collection of [Agent Skills](https://agentskills.io) for use across AI coding agents (Claude Code, Cursor, Copilot, Codex, etc.).

## Install

```bash
npx skills@latest add moorthyptm/skills
```

The [`skills` CLI](https://github.com/vercel-labs/skills) clones this repo and symlinks each published skill into your agent's skills directory (`~/.claude/skills/`, `~/.cursor/skills/`, etc.).

## Layout

```
skills/
  <category>/
    <skill-name>/
      SKILL.md          # required: YAML frontmatter + instructions
      scripts/          # optional: executable helpers
      references/       # optional: docs loaded on demand
      assets/           # optional: templates, data
```

Only skills explicitly listed in [`.claude-plugin/plugin.json`](./.claude-plugin/plugin.json) are published — others can live in the repo as drafts without being installed.

## Authoring a skill

See the [Agent Skills specification](https://agentskills.io/specification) and [best practices](https://agentskills.io/skill-creation/best-practices).

Minimum `SKILL.md`:

```markdown
---
name: my-skill
description: One-line summary of what the skill does and when to use it.
---

# My skill

Step-by-step instructions for the agent...
```

## Commits

This repository follows [Conventional Commits](https://www.conventionalcommits.org/).

```
feat(skill-name): add new skill
fix(skill-name): correct trigger phrasing
docs: update README
chore: tidy plugin manifest
```

## License

[MIT](./LICENSE)
