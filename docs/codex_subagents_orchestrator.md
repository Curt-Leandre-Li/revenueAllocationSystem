# Codex Subagents Orchestrator Guide

This repository uses Codex project-scoped custom agents under `.codex/agents/*.toml`. Each TOML file defines one specialized agent with `name`, `description`, `developer_instructions`, and the appropriate `sandbox_mode`.

Global subagent limits are configured in `.codex/config.toml`:

```toml
[agents]
max_threads = 6
max_depth = 1
```

`max_depth = 1` is intentional. Direct child agents may be spawned, but recursive fan-out is disabled.

## Custom Agents

| Agent | File | Primary responsibility | Sandbox |
| --- | --- | --- | --- |
| `pm_strategy` | `.codex/agents/pm-strategy.toml` | MVP boundary, priority, product logic, roadmap, scope, acceptance criteria, and coordination. | read-only |
| `prd_agent` | `.codex/agents/prd-agent.toml` | Requirements, acceptance criteria, user flows, and user-visible behavior. | read-only |
| `ui_designer` | `.codex/agents/ui-designer.toml` | Layout, information hierarchy, presentation style, interaction states, and UI specifications. | read-only |
| `frontend_agent` | `.codex/agents/frontend-agent.toml` | UI pages, components, state, forms, report display, and export entry points. | workspace-write |
| `backend_agent` | `.codex/agents/backend-agent.toml` | Schemas, APIs, pipeline contracts, allocation logic, deterministic computation, and report-generation boundaries. | workspace-write |
| `qa_agent` | `.codex/agents/qa-agent.toml` | Tests, regression coverage, acceptance checks, validation commands, and defect risk. | read-only |
| `devops_agent` | `.codex/agents/devops-agent.toml` | Build scripts, dependencies, local run commands, repository hygiene, and release validation. | workspace-write |
| `docs_agent` | `.codex/agents/docs-agent.toml` | Software copyright materials, system docs, manuals, architecture docs, and audit-readable explanations. | read-only |
| `compliance_audit_agent` | `.codex/agents/compliance-audit-agent.toml` | Data-use risk, medical scenario boundaries, software copyright consistency, and anti-misrepresentation checks. | read-only |

## Standard Startup Prompt

```text
按 Orchestrator 模式执行。请显式 spawn project-scoped subagents，而不是只模拟角色。

根据任务自动选择相关 custom agents，不要每次都调用全部 agents。

当前任务开始前：
1. 先读取 .codex/config.toml。
2. 读取 .codex/agents/*.toml。
3. 根据任务类型选择 subagents。
4. Spawn one agent per selected responsibility.
5. Wait for all selected agents.
6. Consolidate their findings.
7. Resolve conflicts as Orchestrator.
8. Execute the smallest necessary change.
9. Run validation.
10. Report changed files, validation results, git status, commit status, and push status.

默认不得 push。
```

## Orchestrator Call Rules

- Product boundary / MVP / roadmap: spawn `pm_strategy` + `prd_agent`.
- PRD / acceptance criteria: spawn `prd_agent` + `qa_agent`.
- UI / pages / report style: spawn `ui_designer` + `frontend_agent` + `qa_agent`.
- Frontend implementation: spawn `frontend_agent` + `ui_designer` + `qa_agent`.
- Backend / schema / pipeline / API: spawn `backend_agent` + `qa_agent` + `docs_agent`.
- DAUS / Shapley / contribution / revenue allocation algorithm: spawn `backend_agent` + `pm_strategy` + `qa_agent` + `compliance_audit_agent` + `docs_agent`.
- Software copyright / user manual / architecture docs: spawn `docs_agent` + `compliance_audit_agent` + `qa_agent`.
- Tests / build / scripts: spawn `qa_agent` + `devops_agent`.
- Compliance / audit / risk language: spawn `compliance_audit_agent` + `docs_agent` + `pm_strategy`.

Select only the agents needed for the task. Do not spawn all agents by default.

## Project Boundaries

- The project is a data revenue allocation system / data-element revenue allocation software-copyright product.
- Medical data is only a sample scenario and must not become part of the generic system architecture.
- Shapley is a calculation-layer weight determination method, not the final revenue allocation layer.
- Final revenue allocation may be affected by contracts, minimum guarantees, caps, expert confirmation, and human confirmation.
- Do not restore MAR.
- Do not restore Effective DU.
- Do not restore `token_weighting` as a main-process term.
- Top-level terminology keeps only Token and Data Unit.
- Documentation should avoid obviously AI-like wording, including repeated use of the Chinese phrase for end-to-end.

## Validation Requirements

At task completion, run:

```bash
git status --short
git diff --check
find .codex -maxdepth 3 -type f | sort
```

If Python code changed, also run:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m pytest -q -p no:cacheprovider
```

If frontend code changed, also run:

```bash
npm --prefix demo_ui test
npm --prefix demo_ui run build
```

If only Codex configuration and documentation changed, `git diff --check` is the minimum validation command.

## Prohibited Actions

- Do not push by default.
- Do not commit, merge, delete branches, remove worktrees, or rewrite history without explicit user approval.
- Do not install dependencies without explicit approval.
- Do not change security, authentication, authorization, deployment, environment variables, secrets, credentials, or cloud resources without explicit approval.
- Do not use `agents/*.md` as the active custom-agent mechanism. Those files are responsibility sources; Codex-recognized custom agents live in `.codex/agents/*.toml`.
- Do not set `agents.max_depth` above `1`.
- Do not use medical scenario details to redefine the generic product architecture.
- Do not represent Shapley output as the final revenue allocation layer.
