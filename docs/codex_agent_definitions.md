# Codex Agent Definitions

This repository defines project-scoped Codex custom agents under `.codex/agents/*.toml`.

The source role documents remain in `agents/*.md`. They describe responsibilities, file scope, forbidden actions, validation expectations, and report format. The Codex-recognized custom agents are the TOML files under `.codex/agents/`.

Global subagent settings live in `.codex/config.toml`:

```toml
[agents]
max_threads = 6
max_depth = 1
```

The canonical 9-agent structure is:

- `pm_strategy`: `.codex/agents/pm-strategy.toml`, sourced from `agents/pm_strategy.md`
- `prd_agent`: `.codex/agents/prd-agent.toml`, sourced from `agents/prd_agent.md`
- `ui_designer`: `.codex/agents/ui-designer.toml`, sourced from `agents/ui_designer.md`
- `frontend_agent`: `.codex/agents/frontend-agent.toml`, sourced from `agents/frontend_agent.md`
- `backend_agent`: `.codex/agents/backend-agent.toml`, sourced from `agents/backend_agent.md`
- `qa_agent`: `.codex/agents/qa-agent.toml`, sourced from `agents/qa_agent.md`
- `devops_agent`: `.codex/agents/devops-agent.toml`, sourced from `agents/devops_agent.md`
- `docs_agent`: `.codex/agents/docs-agent.toml`, sourced from `agents/docs_agent.md`
- `compliance_audit_agent`: `.codex/agents/compliance-audit-agent.toml`, sourced from `agents/compliance_audit_agent.md`

There is no standalone Algorithm Agent in the canonical structure. Deterministic core computation responsibilities belong to `backend_agent` unless PM and user explicitly approve a separate agent later.

For Orchestrator startup prompts, agent selection rules, and validation requirements, see `docs/codex_subagents_orchestrator.md`.
