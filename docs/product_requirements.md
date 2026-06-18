# Product Requirements

## Source Of Truth

Use `数据收益分配系统_V1.3_需求规格说明书_导航结构更新版.md` as the highest-priority
product requirements source. This file is a concise repository working summary
for agents.

## Product Goals

- Provide a standard complete chain for data revenue allocation simulation.
- Support demo data and uploaded JSON input.
- Manage data packages, data resources, parties, quality, shuyuan metering,
  contribution, utility, MD-DShap weights, contract constraints, allocation
  simulation, reports, and audit trace.
- Use MD-DShap as the default contribution weight strategy.
- Export audit-readable Markdown/CSV/JSON/JSONL artifacts in P0.
- Keep all results as simulation reference, not legal settlement or payment.

## GAP Closure Requirements

| GAP | Requirement | Current V1.2 rule |
| --- | --- | --- |
| GAP-001 | 用户与权限管理 | P0 keeps local operator; P1 adds login/RBAC and button permissions. |
| GAP-002 | PDF export | P0 exports Markdown/CSV/JSON/JSONL; PDF is P1. |
| GAP-003 | Algorithm baseline drift | MD-DShap is default; Basic Shapley is only `baseline_check`. |
| GAP-004 | Button-level requirements | Core buttons must define entry, precondition, fields, flow, exception, log, and acceptance. |
| GAP-005 | Export field list | Every export file must list fields/sections and be traceable. |

## Functional Requirements

- FR-01: Create a project or select demo data.
- FR-02: Upload or initialize a JSON data package and create input snapshots.
- FR-03: Identify data resources, fields, modality, and basic statistics.
- FR-04: Maintain parties and distinguish data providers from non-data
  contribution parties.
- FR-05: Link data resources to data providers.
- FR-06: Configure and execute quality assessment.
- FR-07: Configure and execute shuyuan metering.
- FR-08: Calculate contribution and utility values.
- FR-09: Execute MD-DShap weight calculation with trace and audit snapshots.
- FR-10: Configure total revenue, contract priority allocation, and data
  provider revenue pool.
- FR-11: Apply contract constraints and run allocation simulation.
- FR-12: Lock a reference scenario or copy a new version for recalculation.
- FR-13: Generate Markdown/CSV/JSON/JSONL exports with `report_id`,
  `checksum`, disclaimer, and field scope.
- FR-14: Query audit logs and snapshots.

## Acceptance Anchors

Requirements are accepted only when they map to:

- the latest navigation in `docs/product_navigation.md`;
- algorithm rules in `docs/algorithm_scope.md`;
- report/export rules in `docs/reporting_contract.md`;
- module and button checks in `docs/acceptance_checklist.md`;
- database/menu mapping in `docs/database_design_input.md`.
