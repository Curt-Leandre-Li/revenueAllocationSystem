# Codex Workflow

## Current Workflow

1. Read `AGENTS.md`.
2. Read the relevant agent or skill instructions.
3. Read `docs/current_project_baseline.md`.
4. Read the relevant detailed docs for the task.
5. For this round, update documentation only.
6. Run documentation-safe validation.
7. Report checked files, drift found, modified docs, validation, git status, and
   remaining TODOs.

## Authority Order

1. User instruction.
2. `AGENTS.md`.
3. Root latest baseline docs.
4. `docs/current_project_baseline.md`.
5. Specific `docs/*.md`.
6. Historical deliverables.

## Prohibited In This Round

- Product code.
- Frontend code.
- Backend/API code.
- Algorithm code.
- Tests.
- Dependencies.
- Migration scripts or executable DDL.
- Commits and pushes.

## Future Coding Gate

Coding starts only after the user explicitly confirms a task scope. A future
coding task must name:

- objective;
- file scope;
- approved product baseline;
- risk points;
- validation commands;
- whether schema/API/algorithm semantics are allowed to change.
