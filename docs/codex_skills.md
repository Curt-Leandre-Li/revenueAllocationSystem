# Codex Skills

## Relevant Skills For This Repository

- `documentation_audit`: use for README, AGENTS, docs, archive materials, and
  documentation drift.
- `context_engineering`: use when preparing scoped task context for future
  implementation.
- `refactor_safety`: use only after implementation scope is opened and a
  behavior-preserving refactor is requested.
- `bugfix_workflow`: use only after implementation exists and a bugfix is
  requested.
- `frontend_review`: use after UI implementation exists or UI docs need review.
- `release_hygiene`: use for commits/releases only after explicit user approval.

## Current Round Skill Use

Use `documentation_audit` first. The output should include:

- authority order;
- drift list;
- minimal doc updates;
- validation notes;
- unresolved conflicts.

## Project-Specific Rule

Skills do not override `AGENTS.md` or the three root latest baseline docs. If a
skill suggests implementation work during this round, record it as a future
task rather than changing code.
