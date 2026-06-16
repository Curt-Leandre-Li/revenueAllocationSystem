# Agent Worktree Workflow

## Purpose

Multi-agent worktrees let specialized Codex agents work in isolated directories and branches without stepping on each other's changes. This setup is only infrastructure. It does not assign feature work.

## Directory Layout

Main repository:

```text
/Users/apple/Desktop/data-revenue-allocation-system-v2
```

Worktree parent:

```text
/Users/apple/Desktop/data-revenue-allocation-system-v2-worktrees
```

Agent worktrees:

```text
pm-strategy      -> agent/pm-strategy
prd              -> agent/prd
ui-designer      -> agent/ui-designer
frontend         -> agent/frontend
backend          -> agent/backend
qa               -> agent/qa
docs             -> agent/docs
compliance-audit -> agent/compliance-audit
```

## Setup

Run from any directory:

```bash
/Users/apple/Desktop/data-revenue-allocation-system-v2/scripts/setup_agent_worktrees.sh
```

The script verifies the repository is a git repository, prints current status, creates missing branches and worktrees, skips existing paths, and prints `git worktree list`.

## Opening Worktrees In Codex

Open a separate Codex session rooted at the matching worktree path:

```text
/Users/apple/Desktop/data-revenue-allocation-system-v2-worktrees/pm-strategy
/Users/apple/Desktop/data-revenue-allocation-system-v2-worktrees/prd
/Users/apple/Desktop/data-revenue-allocation-system-v2-worktrees/ui-designer
/Users/apple/Desktop/data-revenue-allocation-system-v2-worktrees/frontend
/Users/apple/Desktop/data-revenue-allocation-system-v2-worktrees/backend
/Users/apple/Desktop/data-revenue-allocation-system-v2-worktrees/qa
/Users/apple/Desktop/data-revenue-allocation-system-v2-worktrees/docs
/Users/apple/Desktop/data-revenue-allocation-system-v2-worktrees/compliance-audit
```

Each session must read `AGENTS.md` and its role file under `agents/` before editing.

## Agent To Worktree Map

- PM Strategy Agent: `pm-strategy`
- PRD Agent: `prd`
- UI Designer Agent: `ui-designer`
- Frontend Agent: `frontend`
- Backend Agent: `backend`
- QA Agent: `qa`
- Docs Agent: `docs`
- Compliance/Audit Agent: `compliance-audit`

There is no standalone Algorithm Agent in the canonical structure. Deterministic core computation responsibilities belong to the Backend Agent unless PM and user explicitly approve a separate agent later.

## Worktree Vs Local

Use an agent worktree when:

- an implementation agent has a scoped task
- work may overlap with another agent
- changes need isolated branch review

Use the main repository when:

- editing shared governance files
- PM is planning scope only
- no implementation work has been assigned

## PM Task Assignment

PM assigns work only after user approval. A task brief must include:

- agent name
- worktree path
- allowed files
- forbidden files
- acceptance criteria
- validation commands
- stop conditions

## Agent Reporting

Every agent must report:

1. task completed
2. files changed
3. commands run
4. test/build results
5. risks
6. next recommended step

## Inspecting Diffs

Inside a worktree:

```bash
git status --short
git diff --stat
git diff --check
git diff
```

Use scoped diffs when reviewing a single area:

```bash
git diff -- docs/
git diff -- frontend/
git diff -- backend/
git diff -- src/
```

## Safe Merge Process

Merges require explicit user approval.

Recommended review sequence:

1. Agent completes scoped task and reports.
2. PM reviews changed files, validation, risks, and contract impact.
3. QA validates if needed.
4. User approves merge.
5. Merge from the main repository using normal git review commands.
6. Re-run relevant validation after merge.

Do not merge if:

- validation failed
- changed files exceed assigned scope
- API/schema contracts changed without approval
- algorithm semantics changed without approval
- conflicts are unresolved

## Cleanup Process

Cleanup requires explicit user approval when it removes worktrees or branches.

Typical commands after approval:

```bash
git worktree list
git worktree remove /Users/apple/Desktop/data-revenue-allocation-system-v2-worktrees/frontend
git branch -d agent/frontend
```

Use `git branch -D` only when explicitly approved and the branch is known to be disposable.

## Conflict Resolution Rules

- Do not resolve conflicts by deleting another agent's work without approval.
- Ask PM/user when conflicts cross ownership boundaries.
- Preserve API/schema contracts unless a contract change is approved.
- Run validation after resolving conflicts.

## API And Schema Contract Changes

API, schema, data model, and external contract changes require PM and user approval before implementation.

Agents must stop and ask when:

- a new field is needed
- an existing field changes type, meaning, or required status
- endpoint behavior changes
- output semantics change
- frontend and backend expectations do not match

## Validation Expectations

Use the smallest relevant checks for the assigned scope. If no project-level commands exist, report that clearly.

Standard git checks:

```bash
git status --short
git diff --stat
git diff --check
```

Feature-specific tests/builds must be defined by PM in the task brief before implementation begins.
