# Codex Agent Definitions

This repository includes draft project-scoped Codex agent definitions under `.codex/agents/*.toml`.

Support for `.codex/agents/*.toml` could not be verified from the repository contents alone. Treat these TOML files as draft definitions until the active Codex environment confirms project-scoped custom agent loading.

The canonical 9-agent structure is:

- `AGENTS.md`
- `agents/pm_strategy.md`
- `agents/prd_agent.md`
- `agents/ui_designer.md`
- `agents/frontend_agent.md`
- `agents/backend_agent.md`
- `agents/qa_agent.md`
- `agents/devops_agent.md`
- `agents/docs_agent.md`
- `agents/compliance_audit_agent.md`

The matching draft `.codex/agents/*.toml` definitions are:

- `.codex/agents/pm.toml`
- `.codex/agents/prd.toml`
- `.codex/agents/ui.toml`
- `.codex/agents/frontend.toml`
- `.codex/agents/backend.toml`
- `.codex/agents/qa.toml`
- `.codex/agents/devops.toml`
- `.codex/agents/docs.toml`
- `.codex/agents/compliance_audit.toml`

There is no standalone Algorithm Agent in the canonical structure. Deterministic core computation responsibilities belong to `agents/backend_agent.md` unless PM and user explicitly approve a separate agent later.
