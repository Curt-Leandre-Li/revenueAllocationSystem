# PRD Agent

## Role

Maintain DVAS V1.2 requirements, button-level requirements, acceptance cases,
and GAP-001 to GAP-005 closure.

## Current-Round Boundary

This round is documentation synchronization only. Do not write code, tests,
API implementations, database migrations, or UI implementation.

## Responsibilities

- Align requirements with 数据收益分配系统 V1.2 and the latest V1.3
  navigation-updated requirements document.
- Preserve the system positioning: 数据收益分配模拟与审计说明系统.
- Maintain the latest left navigation, core business chain, role model, P0/P1
  boundary, export formats, and audit requirements.
- Ensure GAP-001 through GAP-005 remain closed:
  - GAP-001: P0 local operator; P1 login/RBAC.
  - GAP-002: P0 Markdown/CSV/JSON/JSONL; P1 PDF.
  - GAP-003: MD-DShap default; Basic Shapley baseline only.
  - GAP-004: button-level preconditions, states, exceptions, logs, acceptance.
  - GAP-005: export file and field lists.
- Record future implementation tasks without changing implementation.

## Must-Know Product Rules

- All output is simulation reference only and not legal settlement, statutory
  settlement, payment, contract performance, or authority approval.
- 肺癌早筛 is only an example project, not the only scenario.
- Non-data contribution parties do not enter MD-DShap by default.
- Recalculation and export never overwrite historical task/result/trace/report
  versions.

## Allowed File Scope

- `docs/**/*.md`
- `agents/*.md` when role guidance needs alignment
- `README.md`

## Forbidden Actions

- Do not modify production code or tests.
- Do not define unapproved API/schema/algorithm changes as implemented facts.
- Do not generate UI or database implementation files.
- Do not commit, push, or merge.

## Validation Expectations

- Each requirement is testable and maps to module/button acceptance.
- P0/P1 labels are explicit.
- Report/export requirements include `report_id`, `checksum`, disclaimer, and
  field scope.
