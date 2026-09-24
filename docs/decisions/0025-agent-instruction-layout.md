# 0025: Layout of agent instructions and documentation

Status: accepted, 2026-09

## Context

`CLAUDE.md` is loaded into every Claude Code session. It had grown to about 310 lines and 3,900 words, because
every ticket appended its feature narrative to the "What this is" section and because the architecture and
test sections repeated conventions that only matter when a specific part of the tree is touched. The four
agent definitions in `.claude/agents/` repeated the same checklists a third time. Claude Code's own guidance
is to keep `CLAUDE.md` under 200 lines, to hold only commands and always-true rules there, to move
file-pattern-specific conventions to path-scoped rules, and to link (not `@`-import) reference material so it
is read only when needed. Long instruction files reduce adherence to the rules they contain.

Mechanics that shaped the layout (Claude Code docs, September 2026): rules in `.claude/rules/*.md` without a
`paths:` frontmatter load at launch like `CLAUDE.md`; rules with `paths:` load when a matching file is read;
`paths` is the only frontmatter field that is read. `@path` imports in `CLAUDE.md` load eagerly and save no
context. A path mentioned in prose is not loaded until Claude reads it. Custom subagents receive the
`CLAUDE.md` hierarchy. Whether path-scoped rules also fire inside a subagent is not documented, so it was
probed on 2026-09-24: an implementer subagent that read `games/persistence/GamesTable.kt` received
`backend.md` and `schema-migrations.md` right after the read and nothing before it. They do fire, but only on a
read, not when a subagent creates a new file.

## Decision

- **`CLAUDE.md` stays under 200 lines** and holds only: what the project is in a few lines, where to read more,
  the commands table, the rules that hold for every task (build gates, paired changes, Docker for tests, the
  two "never"s, the layer boundary, the version policy in one sentence), git etiquette and delegation.
- **`docs/index.md` is the lazy entry point**: a features table (feature, tickets, summary, page, ADRs) and a
  decisions table (every ADR with a one-line decision, including numbers claimed on unmerged branches), plus the
  other documents. `CLAUDE.md` names it in prose, so it is read only when a task needs it.
- **Features are documented in `docs/features/<slug>.md`**, one page per feature area, and a ticket adds or
  extends a page and its index row. Feature prose never goes into `CLAUDE.md` again.
- **Layer and area conventions are path-scoped rules in `.claude/rules/`**: `backend.md`,
  `schema-migrations.md`, `backend-tests.md`, `frontend.md`, `frontend-tests.md`, `build-ci-deploy.md`. Each
  declares the globs it applies to and stays short. A rule that would apply to every file belongs in
  `CLAUDE.md` instead.
- **Agent definitions describe the role only**: workflow, hook-enforced limits, output format. They point at
  the paired-change list in `CLAUDE.md` and tell the agent to read the rule files whose `paths` match its target
  files, instead of repeating either. That explicit read covers files an agent creates rather than reads, for which
  no rule fires on its own.
- **`@import` is not used**, because it loads at launch and would defeat the purpose.

## Consequences

- A new ticket touches `docs/index.md` and a feature page, plus an ADR when a decision was taken, plus the rule
  file of a layer when it introduces a convention. `CLAUDE.md` changes only when a command or an
  everywhere-rule changes.
- The `paths` globs must be kept accurate when directories move; a stale glob silently stops a rule from
  loading.
- The implementer hook (`.claude/hooks/agent-guard.py`) denies edits to `CLAUDE.md`, `docs/`, `README.md` and
  `.claude/`, so instruction and documentation changes are made in the main session.
- Whether a rule loaded is visible with `/context`; reviewing that after a rule change is part of the change.
