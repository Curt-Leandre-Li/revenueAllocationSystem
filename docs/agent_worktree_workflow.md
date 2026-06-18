# Agent Worktree Workflow

## Purpose

Agent worktrees are for future isolated implementation or review tasks. They are
not required for the current V1.2 documentation-alignment round.

## Current Round

Use the main repository for shared documentation updates. Do not create, remove,
or modify worktrees unless the user explicitly asks.

## Future Worktree Use

Use an agent worktree when:

- the user has approved implementation or review scope;
- multiple agents may modify overlapping areas;
- branch isolation is useful for review.

Each future task brief must include:

- agent name;
- worktree path;
- allowed files;
- forbidden files;
- acceptance criteria;
- validation commands;
- stop conditions;
- whether API/schema/algorithm semantics may change.

## Canonical Agent Mapping

- PM Strategy Agent: `pm-strategy`
- PRD Agent: `prd`
- UI Designer Agent: `ui-designer`
- Frontend Agent: `frontend`
- Backend Agent: `backend`
- QA Agent: `qa`
- Docs Agent: `docs`
- Compliance/Audit Agent: `compliance-audit`
- DevOps Agent: `devops`

## Git Rules

- No commit without explicit user approval.
- No push without explicit user approval.
- No merge without explicit user approval.
- No branch deletion, worktree removal, or history rewrite without explicit user
  approval.

## Standard Checks

```bash
git status --short
git diff --stat
git diff --check
```
