# Codex Subagents Orchestrator Guide

This repository uses the canonical 9-agent structure. The role source files are
`agents/*.md`; project-scoped TOML agents under `.codex/agents/` may be used
only when implementation or review work is explicitly assigned.

## Current-Round Rule

For the V1.2 documentation alignment round, do not spawn agents to implement
code. Use agents only as role guidance for documentation scope.

## Canonical Agents

| Agent | Current V1.2 responsibility |
| --- | --- |
| `pm_strategy` | Scope freeze, P0/P1 boundary, milestones, risk closure. |
| `prd_agent` | Requirements, buttons, acceptance, GAP closure. |
| `ui_designer` | 1440x900 Chinese backend UI input, dialogs, states, risk copy. |
| `frontend_agent` | Route/page/component documentation only in this round. |
| `backend_agent` | Service/data/interface documentation only in this round. |
| `qa_agent` | Acceptance matrix and doc consistency checks. |
| `docs_agent` | Index, terminology, version notes, copyright mapping. |
| `compliance_audit_agent` | Simulation-reference, non-legal-settlement, sensitive data, audit boundary. |
| `devops_agent` | P0/P1 runtime boundary documentation only in this round. |

## Selection Rules

- Product baseline or milestone: `pm_strategy`, `prd_agent`, `docs_agent`.
- UI/navigation docs: `ui_designer`, `frontend_agent`, `qa_agent`.
- Backend/data contract docs: `backend_agent`, `qa_agent`, `docs_agent`.
- Algorithm docs: `backend_agent`, `pm_strategy`, `qa_agent`,
  `compliance_audit_agent`.
- Report/copyright/compliance docs: `docs_agent`, `compliance_audit_agent`,
  `qa_agent`.
- Runtime/deployment boundary docs: `devops_agent`, `pm_strategy`.

Select only needed roles. Do not call all agents by default.

## Project Boundaries

- DVAS V1.2 is a data revenue allocation simulation and audit-explanation
  system.
- Medical examples are sample-only.
- MD-DShap is the default weight strategy.
- Basic Shapley is only `baseline_check`.
- Non-data contribution parties are contract/constraint handled by default.
- Results are simulation references, not payment or legal settlement.
- P0 is local/demo mode; P1 covers login/RBAC/PDF/async/history extensions.

## Validation

For documentation-only work:

```bash
git status --short
git diff --check
```

Run broader tests only after implementation scope is opened and commands exist.
