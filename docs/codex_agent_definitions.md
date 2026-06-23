# Codex Agent Definitions

The active project-scoped agent definitions are `.codex/agents/*.toml`. Older
`agents/*.md` role notes have been superseded and are not a current workflow
entry point.

## Canonical 9 Agents

- `pm_strategy`
- `prd_agent`
- `ui_designer`
- `frontend_agent`
- `backend_agent`
- `qa_agent`
- `docs_agent`
- `compliance_audit_agent`
- `devops_agent`

There is no standalone Algorithm Agent in the canonical structure. Algorithm
documentation and future deterministic computation implementation belong to
`backend_agent` with PM, QA, and compliance review unless the user explicitly
approves a separate agent.

## Current-Round Boundary

Documentation synchronization and implementation rounds must follow the active
`.codex/agents/*.toml` role definitions plus `AGENTS.md` project rules.

## Required Agent Knowledge

Each role must know:

- 数据收益分配系统 V1.2 is the current product baseline.
- Outputs are simulation references, not legal settlement or payment.
- The latest six-group navigation is authoritative.
- MD-DShap is default; Basic Shapley is baseline only.
- P0 local operator and Markdown/CSV/JSON/JSONL exports are in scope.
- Login/RBAC/PDF/async/history report management are P1.
