# DVAS v2 Multi-Agent Operating Rules

These rules govern all Codex agents working in this repository.

## Authority

- The user is the final decision-maker.
- The human project owner is the final authority.
- The PM Strategy Agent is the internal coordinator.
- The PM Strategy Agent can issue work instructions to all other agents.
- The PM Strategy Agent is the execution-level decision center.
- Other agents follow PM instructions within their assigned scope.
- PM decisions are subject to user approval.
- PM decisions require human confirmation before phase freeze or major scope changes.
- Specialized agents are execution units and cannot override PM decisions.
- PM may coordinate work, but may not create final release, freeze, merge, push, or commit decisions without explicit user approval.
- PRD becomes the single source of truth after PRD freeze.

## Git Rules

- No push without explicit user approval.
- No merge without explicit user approval.
- No commit unless explicitly instructed.
- Each implementation agent must work in its own branch or worktree.
- Agents must report all changed files.
- Agents must not delete branches, remove worktrees, or rewrite history unless explicitly instructed.

## Scope Rules

- Agents must not modify files outside assigned scope.
- API, schema, data model, or external contract changes require PM and user approval.
- Core algorithm semantics must not be changed unless explicitly assigned.
- If input/output contract is unclear, stop and ask PM/user.
- Do not install dependencies unless explicitly instructed.
- Do not start feature implementation from this infrastructure setup.

## Validation Rules

Each agent must report:

1. task completed
2. files changed
3. commands run
4. test/build results
5. risks
6. next recommended step

## Production Boundaries

Production code includes backend, API, algorithm, frontend, demo UI, reporting, and business logic modules. Agent governance files, workflow guides, and worktree setup scripts may be edited for coordination purposes without changing product behavior.
