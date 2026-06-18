# UI Agents Task Split

This document defines future agent responsibilities for the UI redesign. It is
documentation only. It does not start page implementation and does not authorize
file deletion.

## 1. Coordination Rules

- The main controller agent owns scope, source-of-truth interpretation, merge
  order, and final acceptance.
- Every implementation agent must read `AGENTS.md`,
  `docs/ui_redesign_contract.md`, and
  `docs/ui_route_field_action_matrix.md` before touching files.
- Agents must not edit production code, dependency files, DDL, scripts, or
  generated output unless a later user request explicitly opens that scope.
- Agents must not edit the same file concurrently. If ownership is unclear, the
  main controller assigns ownership before work begins.
- Route, field, action, and state registries are shared contracts. They require
  main-controller approval before any module agent edits them.
- Every agent must preserve the simulation-reference and non-legal-settlement
  boundary.
- P1 capabilities must remain disabled/planning-only in P0 UI unless the user
  explicitly opens P1 implementation.

## 2. Main Controller Agent

Responsibilities:

- Freeze the implementation scope for each phase.
- Confirm that source-of-truth documents are read and applied in authority
  order.
- Own route/action/field/state manifest approval.
- Decide whether old UI runtime files are deleted, archived, or bypassed after
  explicit user approval.
- Assign file boundaries to implementation agents.
- Resolve conflicts between page UX, route mapping, database fields, and audit
  requirements.
- Run final validation and prepare completion report.

Allowed future files:

- `docs/ui_redesign_contract.md`
- `docs/ui_route_field_action_matrix.md`
- `docs/ui_agents_task_split.md`
- Future top-level UI manifest docs.

Must not do:

- Implement page components directly while delegating module work.
- Merge conflicting route assumptions from older UI docs.
- Infer approval for deletion, dependency changes, commits, or pushes.

## 3. UI Shell Agent

Responsibilities:

- Build the frontend application shell after implementation is opened.
- Own left navigation, top project/status bar, route outlet, layout density,
  global risk entry, and locked-project behavior.
- Implement source-of-truth route registry using canonical paths.
- Provide shared status, empty, loading, error, confirmation, drawer, and modal
  primitives.
- Ensure normal pages do not expose schema/debug metadata.

Future owned files:

- `ui_prototype/src/app/**`
- `ui_prototype/src/routes/**`
- `ui_prototype/src/shared/ui/**`
- `ui_prototype/src/design-system/**`
- `ui_prototype/src/styles.css` or replacement style entry

Must not edit:

- Feature page business logic owned by module agents.
- Mock service logic owned by module agents.
- Report export field scopes without report/system agent approval.

## 4. Data Module Agent

Responsibilities:

- Own data ingestion, data resource, and party workspaces.
- Implement distinct page workflows for:
  - 数据接入管理
  - 数据资源管理
  - 参与方管理
- Implement JSON/demo input validation UX, safe preview, failed-field details,
  resource-field mapping, resource-party relation, and MD-DShap pool boundary.
- Enforce that non-data parties do not enter MD-DShap by default.
- Keep technical fields in drawers and audit details only.

Future owned files:

- `ui_prototype/src/features/data-ingestion/**`
- `ui_prototype/src/features/data-resources/**`
- `ui_prototype/src/features/parties/**`
- `ui_prototype/src/domain/data-management/**`
- `ui_prototype/src/mocks/data-management*`
- `ui_prototype/src/services/data-management*`

Must not edit:

- Measurement, allocation, report, or system pages.
- Global route registry except through controller-approved changes.
- Shared component internals unless UI Shell Agent approves.

## 5. Measure Module Agent

Responsibilities:

- Own 数元贡献度计量 pages:
  - 质量评估管理
  - 数元计量管理
  - 贡献度与效用计算
- Implement precondition cards and state progression from `INGESTED` through
  `UTILITY_CALCULATED`.
- Show quality score, evidence, metric weights, metering coefficients, call
  counts, contribution factors, normalized contribution, utility function, and
  utility trace.
- Ensure values used by MD-DShap are visible and auditable.

Future owned files:

- `ui_prototype/src/features/quality/**`
- `ui_prototype/src/features/shuyuan-metering/**`
- `ui_prototype/src/features/utility/**`
- `ui_prototype/src/domain/metering/**`
- `ui_prototype/src/mocks/metering*`
- `ui_prototype/src/services/metering*`

Must not edit:

- Data management pages except for reading typed outputs.
- MD-DShap or allocation calculation pages.
- Report export fields except through report/system agent handoff.

## 6. Allocation Module Agent

Responsibilities:

- Own 收益分配计算 pages:
  - MD-DShap 计算管理
  - 收益分配模拟
  - 合同约束管理
- Implement MD-DShap default display, baseline-check boundary, participant/task
  sets, marginal trace, weights, complexity notes, rerun versioning, allocation
  mode, priority allocation, pre/post constraint amounts, plan comparison, lock,
  and constraint check results.
- Enforce weight normalization to 1 and 6-decimal display.
- Keep MD-DShap outputs as weights only, not settlement instructions.

Future owned files:

- `ui_prototype/src/features/md-dshap/**`
- `ui_prototype/src/features/allocation-simulation/**`
- `ui_prototype/src/features/constraints/**`
- `ui_prototype/src/domain/allocation/**`
- `ui_prototype/src/mocks/allocation*`
- `ui_prototype/src/services/allocation*`

Must not edit:

- Data-management resource ownership logic except via typed contracts.
- Report export implementation except by emitting export-ready result data.
- P1 user/RBAC pages.

## 7. Report/System Module Agent

Responsibilities:

- Own report generation/export and system management pages:
  - 报告生成与导出
  - 参数配置
  - 用户与权限管理（P1）
  - 审计日志管理
- Implement export dialogs, field scopes, version display, report records,
  checksum display, audit log query/detail/export, parameter version pages, and
  P1-disabled user/permission planning.
- Ensure PDF remains P1 unless explicitly opened.
- Ensure every export shows simulation-reference and non-legal-settlement
  language.

Future owned files:

- `ui_prototype/src/features/reports/**`
- `ui_prototype/src/features/system-parameters/**`
- `ui_prototype/src/features/system-users-p1/**`
- `ui_prototype/src/features/audit-log/**`
- `ui_prototype/src/domain/reporting/**`
- `ui_prototype/src/domain/system/**`
- `ui_prototype/src/mocks/reporting*`
- `ui_prototype/src/services/reporting*`
- `ui_prototype/src/services/audit*`

Must not edit:

- Calculation page internals.
- Data-management page internals.
- Shared app shell without UI Shell Agent approval.

## 8. QA Visual Agent

Responsibilities:

- Validate visual, route, state, permission, and content acceptance after
  implementation is opened.
- Produce route-by-route screenshots at 1440x900 and at least one narrower
  viewport.
- Check that text does not overflow, tables remain readable, drawers/modals are
  usable, and disabled/P1 states are clear.
- Check no normal page leaks debug/schema fields.
- Check every route maps to the required `menu_code` and `module_code`.
- Check high-risk actions require confirmation.
- Check export dialogs show field scope, disclaimer, `report_id`, and checksum.

Future owned files:

- `docs/ui_visual_acceptance_report.md`
- `docs/ui_route_acceptance_checklist.md`
- Future screenshot evidence under a controller-approved path.

Must not edit:

- Runtime source files while acting as QA.
- Generated build artifacts unless explicitly asked to refresh evidence.

## 9. No-Duplicate-Edit File Boundary

| File or directory | Owner | Other agents may edit? |
|---|---|---|
| `ui_prototype/src/app/**` | UI Shell Agent | No, request shell changes through owner. |
| `ui_prototype/src/routes/**` | UI Shell Agent + Main Controller approval | No direct module-agent edits. |
| `ui_prototype/src/shared/ui/**` | UI Shell Agent | No direct feature edits; request shared API changes. |
| `ui_prototype/src/design-system/**` | UI Shell Agent | No, except QA may report issues. |
| `ui_prototype/src/features/data-ingestion/**` | Data Module Agent | No. |
| `ui_prototype/src/features/data-resources/**` | Data Module Agent | No. |
| `ui_prototype/src/features/parties/**` | Data Module Agent | No. |
| `ui_prototype/src/features/quality/**` | Measure Module Agent | No. |
| `ui_prototype/src/features/shuyuan-metering/**` | Measure Module Agent | No. |
| `ui_prototype/src/features/utility/**` | Measure Module Agent | No. |
| `ui_prototype/src/features/md-dshap/**` | Allocation Module Agent | No. |
| `ui_prototype/src/features/allocation-simulation/**` | Allocation Module Agent | No. |
| `ui_prototype/src/features/constraints/**` | Allocation Module Agent | No. |
| `ui_prototype/src/features/reports/**` | Report/System Module Agent | No. |
| `ui_prototype/src/features/system-parameters/**` | Report/System Module Agent | No. |
| `ui_prototype/src/features/system-users-p1/**` | Report/System Module Agent | No. |
| `ui_prototype/src/features/audit-log/**` | Report/System Module Agent | No. |
| `ui_prototype/src/domain/**` | Owning module by subdirectory | Cross-module changes require controller approval. |
| `ui_prototype/src/services/**` | Owning module by service name | Cross-module changes require typed contract update. |
| `ui_prototype/src/mocks/**` | Owning module by fixture name | Shared demo data changes require controller approval. |
| `docs/ui_redesign_contract.md` | Main Controller Agent | No, except explicit contract update task. |
| `docs/ui_route_field_action_matrix.md` | Main Controller Agent | No, except explicit contract update task. |
| `docs/ui_agents_task_split.md` | Main Controller Agent | No, except explicit contract update task. |

## 10. Handoff Requirements

Each implementation agent must report:

- Files touched.
- Routes or components affected.
- Source-of-truth sections used.
- Validation run and exact result.
- Known skipped checks.
- Whether any P0/P1 or simulation-reference boundary is affected.

The main controller must reject handoffs that introduce unapproved dependency
changes, visible debug/schema output, route drift, hidden P1 implementation, or
business semantics that conflict with the three source-of-truth documents.
