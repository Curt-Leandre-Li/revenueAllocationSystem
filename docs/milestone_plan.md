# Milestone Plan

All milestones require user approval before implementation, commit, push, or
phase freeze. This repository currently prioritizes documentation alignment.

## Phase 0A: V1.2 Documentation Alignment

Input:

- Root V1.3 requirements update.
- Root V1.1 detailed function design update.
- Root V1.0 database/ER navigation update.
- Existing `AGENTS.md`, `.codex/agents/*.toml`, and `docs/**/*.md`.

Output:

- V1.2 project baseline.
- Updated AGENTS and canonical project-scoped agent definitions.
- Updated navigation, algorithm, UI, database input, reporting contract,
  acceptance, workflow, and compliance docs.
- Drift checklist and remaining implementation TODOs.

Acceptance:

- Docs state the simulation-reference and non-legal-settlement boundary.
- Navigation matches the six primary groups and required secondary pages.
- MD-DShap is default; Basic Shapley is only baseline.
- P0/P1 boundaries are explicit.
- P0 exports are Markdown/CSV/JSON/JSONL; PDF is P1.
- No product code, tests, dependencies, migrations, or runnable scripts are
  changed.

## Phase 0B: Human Review And Freeze

Input:

- Phase 0A documentation diff.
- User review.

Output:

- Approved documentation baseline or follow-up doc corrections.
- Explicit user decision on whether coding may begin.

Acceptance:

- User confirms the baseline or requests further doc updates.
- Any implementation scope is separately authorized.

## Future Phase 1: P0 Data And Contract Implementation

Potential scope after explicit approval:

- Data package, resource, party, snapshot, validation, and local operator
  behavior.
- No production login/RBAC, PDF, async queue, multi-tenant, tax, bank, or
  payment behavior.

## Future Phase 2: P0 Calculation Chain

Potential scope after explicit approval:

- Quality assessment.
- Shuyuan metering.
- Contribution and utility calculation.
- MD-DShap weights and trace.
- Allocation simulation and contract constraints.

## Future Phase 3: P0 Reports And Audit

Potential scope after explicit approval:

- Markdown/CSV/JSON/JSONL export.
- Report manifest, `report_id`, `checksum`.
- Audit log and snapshot traceability.

## Future Phase 4: P0 UI

Potential scope after explicit approval:

- 1440x900 Chinese Web management backend following `docs/ui_design_spec.md`.

## Future Phase 5: P1 Extensions

Potential scope after explicit approval:

- Login/RBAC.
- PDF export.
- CSV/XLSX template import.
- Async task progress.
- Historical report management.
