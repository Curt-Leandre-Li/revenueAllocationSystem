# V1.2 Documentation Freeze Checklist

## Current Freeze Type

This is a documentation-alignment freeze for 数据收益分配系统 V1.2. It is not a
coding-start approval by itself.

## Required Before Future Coding

- `AGENTS.md` reflects V1.2 positioning, navigation, P0/P1 boundary, MD-DShap
  default strategy, reporting/export boundary, audit snapshots, and forbidden
  actions.
- `.codex/agents/*.toml` reflects canonical agent responsibilities.
- `docs/current_project_baseline.md` records authority order and product
  baseline.
- `docs/product_navigation.md` records the six-group left navigation.
- `docs/algorithm_scope.md` records MD-DShap default and Basic Shapley baseline.
- `docs/ui_design_spec.md` records 1440x900 Chinese Web management backend
  requirements.
- `docs/database_design_input.md` records nav_menu, permission, module_code,
  route_path, audit_log, and snapshot_store input.
- `docs/reporting_contract.md` records Markdown/CSV/JSON/JSONL exports,
  `report_id`, `checksum`, and disclaimer.
- `docs/acceptance_checklist.md` records module and button acceptance.
- `docs/codex_workflow.md` records "document freeze first, implementation
  later after approval".

## Frozen Product Rules

- System output is simulation reference only, not legal settlement or payment.
- 肺癌早筛 is an example project only.
- MD-DShap is the default weight strategy.
- Basic Shapley is only `baseline_check`.
- DAUS / utility provides algorithm input signals, not final allocation.
- Non-data contribution parties default to contract priority or constraints.
- P0 uses local operator mode.
- P0 exports Markdown/CSV/JSON/JSONL.
- PDF, login/RBAC, async task progress, CSV/XLSX import, and history report
  management are P1.
- Recalculation and export do not overwrite history.

## Not Frozen For Implementation

- Exact implemented route path where baseline docs list compatibility aliases.
- Exact storage engine.
- Exact frontend framework.
- Exact runtime commands.
- Exact CI/CD and deployment model.

These require future user approval before implementation.

## Completion Criteria For This Round

- Only Markdown documentation files are changed.
- No product code, tests, scripts, dependency files, or migrations are changed.
- `git diff --check` passes.
- `git status --short` is reported.
- Key `rg` scans are reported with intentional remaining matches explained.
