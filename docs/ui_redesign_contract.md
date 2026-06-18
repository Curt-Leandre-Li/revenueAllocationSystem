# UI Redesign Contract

This document is the execution contract for the next UI redesign round. It is
documentation only. It does not authorize page implementation, file deletion,
dependency changes, runtime schema changes, or build output regeneration.

## 1. Source Of Truth

The redesign must follow this authority order:

1. `数据收益分配系统_V1.3_需求规格说明书_导航结构更新版.md`
2. `数据收益分配系统_系统详细功能设计_V1.1_导航结构更新版.md`
3. `数据收益分配系统_数据库设计与ER关系图_V1.0_导航结构更新版.md`
4. `AGENTS.md`

If older UI docs or current prototype files conflict with these sources, treat
the older UI material as superseded. Do not change runtime implementation to
force alignment during this documentation round.

## 2. Design Goals

- Rebuild the frontend as a Chinese management-backend workbench for DVAS,
  not as a schema/debug demonstration page.
- Make the left navigation, `route_path`, `menu_code`, `module_code`, page
  responsibilities, button numbers, permissions, field mappings, state changes,
  and audit side effects traceable from one contract.
- Keep every page focused on a user task: current project state, unmet
  preconditions, available actions, calculation/output results, and audit
  trace access.
- Preserve the product boundary: all UI pages, exports, dialogs, and report
  previews must state that outputs are simulation references only and are not
  legal settlement, statutory settlement, payment instructions, contract
  performance, or authority approval.
- Use the sample project only as an example. `肺癌早筛` must not become the
  only scenario, default business positioning, or real medical production data.
- Keep P0 honest: local operator mode, JSON/demo input, synchronous demo-scale
  calculations, Markdown/CSV/JSON/JSONL exports, audit snapshots. Do not
  present login, production RBAC, PDF export, async queues, bank/tax/payment, or
  electronic signature as implemented P0 features.

## 3. Delete Old UI Boundary

Deletion is a future implementation action and requires explicit user approval.
When implementation is opened, the following old UI runtime surfaces should be
deleted or removed from the active app path instead of patched:

| Path | Delete boundary | Reason |
|---|---|---|
| `ui_prototype/src/ui-renderer/` | Delete or fully retire from runtime | Generic schema renderer exposes engineering metadata and cannot express page-specific workflows. |
| `ui_prototype/src/ui-schema/` | Delete or archive as historical contract input | Current schema validates old assumptions and should not be the running UI authority. |
| `ui_prototype/src/routes/schemaRoutes.ts` | Replace with source-of-truth route registry | Current canonical routes use `/dashboard` and `/data/packages`, which are compatibility paths only. |
| `ui_prototype/src/dvasData.json` | Replace with typed fixtures | Mixed UI inventory, screenshots, buttons, and sample data in one JSON file is not a domain boundary. |
| `ui_prototype/dist/` | Delete generated output | Build artifacts must not be source-owned in the redesign contract. |
| `ui_prototype/node_modules/` | Delete from repo/worktree handoff scope | Installed dependencies are local artifacts, not source files. |
| `ui_prototype/scripts/generate-ui-docs.mjs` | Retire unless rewritten for the new contract | The old generator is tied to schema-renderer assumptions. |
| `docs/ui*` and `docs/ui/**` old route claims | Mark superseded or update before implementation | Existing UI docs may state `系统首页` is a single `/dashboard` entry; this conflicts with current source-of-truth navigation. |

Do not delete package/config files, source-of-truth documents, or reusable
domain rules as part of old UI cleanup.

## 4. Preserve File Boundary

The following files or concepts may be kept, but only after being moved into
clearer runtime boundaries:

| Current location | Preserve as | Conditions |
|---|---|---|
| `ui_prototype/package.json` | Frontend package manifest | No new dependency without approval. |
| `ui_prototype/tsconfig.json` | TypeScript configuration | Keep no-emit type validation available. |
| `ui_prototype/index.html` and `src/main.tsx` | App entry | Replace app wiring only during implementation. |
| `ui_prototype/src/design-system/tokens.ts` | Design tokens | Review colors and typography against the new visual rules. |
| `ui_prototype/src/design-system/layout.ts` | Layout constants | Keep only if compatible with 1440x900 workbench layout. |
| `ui_prototype/src/features/data-management/types/index.ts` | Domain type seed | Rename fields to database-aligned names where needed. |
| `ui_prototype/src/features/data-management/utils/validation.ts` | Domain validation seed | Keep JSON upload, resource binding, and party boundary rules. |
| `ui_prototype/src/features/data-management/utils/permissions.ts` | P0 local operator permission seed | Expand into route/button permission registry. |
| `ui_prototype/src/features/data-management/api/dataManagementApi.ts` | Fixture and mock service seed | Split into `mocks/` and `services/`; do not keep as page-local API authority. |
| Data-management page ideas | Workflow references | Re-implement as page-specific workspaces, not as direct carry-over. |

## 5. New Route List

Historical routes may be compatibility aliases, but the left navigation and
primary route registry must use this list.

| Level 1 | Page | route_path | menu_code | module_code | Phase |
|---|---|---|---|---|---|
| 系统首页 | 项目总览 | `/dashboard` | `NAV_SYS_HOME` | `SYS` | P0 |
| 系统首页 | 流程入口 | `/dashboard` | `NAV_SYS_HOME` | `SYS` | P0 |
| 系统首页 | 风险提示 | `/dashboard` | `NAV_SYS_HOME` | `SYS` | P0 |
| 系统首页 | 一键计算 | `/dashboard` | `NAV_SYS_HOME` | `SYS` | P0 |
| 数据管理 | 数据接入管理 | `/data/ingestion` | `NAV_DATA_PACKAGE` | `DATA` | P0 |
| 数据管理 | 数据资源管理 | `/data/resources` | `NAV_DATA_RESOURCE` | `RES` | P0 |
| 数据管理 | 参与方管理 | `/data/parties` | `NAV_DATA_PARTY` | `PARTY` | P0 |
| 数元贡献度计量 | 质量评估管理 | `/metering/quality` | `NAV_MEASURE_QUALITY` | `QUAL` | P0 |
| 数元贡献度计量 | 数元计量管理 | `/metering/shuyuan` | `NAV_MEASURE_SHUYUAN` | `DU` | P0 |
| 数元贡献度计量 | 贡献度与效用计算 | `/metering/utility` | `NAV_MEASURE_UTILITY` | `UTIL` | P0 |
| 收益分配计算 | MD-DShap 计算管理 | `/allocation/md-dshap` | `NAV_ALLOC_MDS` | `MDS` | P0 |
| 收益分配计算 | 收益分配模拟 | `/allocation/simulation` | `NAV_ALLOC_SIMULATION` | `ALLOC` | P0 |
| 收益分配计算 | 合同约束管理 | `/allocation/constraints` | `NAV_ALLOC_CONSTRAINT` | `CONS` | P0 |
| 报告生成与导出 | 报告生成与导出 | `/reports` | `NAV_REPORT_EXPORT` | `REP` | P0/P1 |
| 系统管理 | 参数配置 | `/system/parameters` | `NAV_SYSTEM_PARAMETER` | `PARAM` | P0 |
| 系统管理 | 用户与权限管理（P1） | `/system/users` | `NAV_SYSTEM_USER` | `USER` | P1 |
| 系统管理 | 审计日志管理 | `/system/audit` | `NAV_SYSTEM_AUDIT` | `AUD` | P0 |

## 6. Page Responsibility List

| Page | Responsibility |
|---|---|
| 项目总览 | Show current project, current status, key metrics, recent reports, risk summary, and next recommended step. |
| 流程入口 | Present the complete chain as actionable cards from data ingestion through audit trace. |
| 风险提示 | Present simulation-reference, non-legal-settlement, sensitive-data, algorithm, contract, and report boundaries. |
| 一键计算 | Show precondition checks, run-mode selection, MD-DShap default, pipeline progress, failed node, and audit entry. |
| 数据接入管理 | Select demo data, upload UTF-8 JSON, validate required fields, show failure details, preview safe summaries, and generate input snapshot. |
| 数据资源管理 | Show resources, fields, modality, sample statistics, sensitive-field flags, data-source subject binding, calculation inclusion, and resource summary export. |
| 参与方管理 | Maintain data-provider and non-data parties, enforce MD-DShap pool boundaries, manage status, link resources, and show contribution/utility/weight summary. |
| 质量评估管理 | Configure metric weights, show preconditions, run quality assessment, show total/dimension scores, evidence, warning, and versioning. |
| 数元计量管理 | Configure base price, call count, scenario/quality/technology/expert/development coefficients, execute metering, and show resource/party/project details. |
| 贡献度与效用计算 | Configure contribution factors, calculate normalized contribution, configure utility function, calculate utility values, and expose trace. |
| MD-DShap 计算管理 | Make `MD_DSHAP` the default, show participant/task sets, parameters, baseline-check boundary, marginal trace, weights, rerun behavior, and audit export. |
| 收益分配模拟 | Configure total revenue, priority allocation, data-provider revenue pool, allocation mode, pre/post constraint amounts, comparison, lock, and export. |
| 合同约束管理 | Maintain minimum, maximum, cap, floor, fixed-ratio, and priority-allocation constraints with status, priority, version, and check results. |
| 报告生成与导出 | Preview reports, show export field scopes, generate Markdown/CSV/JSON/JSONL, show P1 PDF boundary, version, `report_id`, and `checksum`. |
| 参数配置 | Maintain scenario coefficients, quality weights, MD-DShap defaults, risk copy, precision rules, and parameter versions. |
| 用户与权限管理（P1） | Show disabled P1 planning for users, roles, permissions, password reset, and button permissions without pretending P0 login exists. |
| 审计日志管理 | Query operation/calculation/export logs, inspect input/parameter/output/report snapshots, show failure reasons, and export audit logs. |

## 7. Page Acceptance Criteria

Every page must satisfy these criteria:

- The left navigation label, `route_path`, `menu_code`, and `module_code` match
  the route list in this document.
- The page header shows system name, current project, current status, operator
  `local_operator`, and risk entry.
- A project status strip shows: 草稿, 已接入, 已评估, 已计量, 已计算效用,
  已计算权重, 已分配, 已确认, 已导出.
- Page content leads with business state and next action, not schema metadata.
- `page_id`, raw `menu_code`, raw `module_code`, `snapshot_id`, `checksum`,
  `report_id`, debug schema text, and placeholder values appear only in audit
  drawers, export confirmation dialogs, or log details.
- Empty states explain the next user action.
- Error states identify a field, precondition, or business rule.
- Calculation pages show precondition checks before the calculation button.
- Export pages show file type, field scope, version, disclaimer, `report_id`,
  and `checksum` after export generation.
- Locked or exported projects disable core configuration actions and offer a
  copy-new-version path.
- High-risk actions require a confirmation dialog.
- P1-only actions are disabled or clearly marked as P1. They must not look
  implemented in P0.

## 8. Visual Specification

- Target layout: 1440x900 Chinese management-backend workspace.
- Visual tone: restrained, operational, dense enough for repeated work, not a
  landing page or marketing page.
- First viewport must show actual work state: current project, status, risk
  note, navigation, and primary task panel.
- Use a left navigation tree with the exact navigation baseline and no Arabic
  numeric prefixes in menu labels.
- Use a top project/status bar across pages.
- Use tables for operational lists, forms for configuration, drawers for trace
  and audit detail, modals for confirmation and export, and cards only for
  individual repeated workflow/status items.
- Do not put UI cards inside other UI cards.
- Avoid decorative gradients, orbs, bokeh, oversized heroes, marketing-style
  split layouts, and generic stock-like imagery.
- Use compact headings inside panels. Hero-scale type is not appropriate for
  this product.
- Keep text inside buttons and controls readable at desktop and mobile widths;
  do not use viewport-width font scaling.
- Use status colors consistently: success, warning, failure, disabled, pending.
  Do not make the UI a one-hue palette.
- Always show simulation-reference and non-legal-settlement language in upload,
  algorithm, allocation, report, and export contexts.

## 9. Component System Specification

The redesign must define these reusable components before page implementation:

| Component | Required behavior |
|---|---|
| AppShell | Left navigation, top project bar, main workspace, route outlet, risk entry. |
| ProjectStatusStrip | Shows project state sequence and current state; locked states disable edit actions. |
| PageHeader | Business title, breadcrumb, project context, action summary, risk boundary. |
| PreconditionCard | Lists checks with pass/fail/blocked state and links to the module that resolves each blocker. |
| DataTable | Supports empty state, filter/search where relevant, stable columns, fixed action column, and long text handling. |
| ActionBar | Renders registered buttons by permission, project state, P0/P1 phase, and precondition state. |
| BusinessForm | Field labels use business names; validation errors identify field paths and rules. |
| RiskNotice | Displays simulation-reference, non-legal-settlement, sensitive-data, algorithm, and contract boundaries. |
| TraceDrawer | Shows input, formula, parameters, output, snapshot IDs, and version metadata without crowding the main table. |
| AuditDetailDrawer | Shows `menu_code`, `module_code`, operator, before/after, snapshots, status, failure reason, report checksum. |
| ConfirmModal | Required for delete, disable, rerun, lock, parameter save, and export actions. |
| ExportDialog | Shows file type, field scope, version, disclaimer, `report_id`, checksum rule, and failure handling. |
| P1BoundaryPanel | Explains disabled P1 capabilities such as login, RBAC, PDF, async progress, and historical report management. |

Component props must be driven by route, field, action, state, and permission
registries. Components must not hard-code business state transitions that
belong in service/action handlers.

## 10. Forbidden Items

- Do not implement pages in this documentation round.
- Do not modify `ui_prototype/`, `src/`, `demo_ui/`, tests, scripts, dependency
  files, database DDL, or generated output in this documentation round.
- Do not keep schema/debug metadata visible in normal page content.
- Do not treat `/dashboard` or `/data/packages` as canonical navigation paths.
- Do not collapse the four system-home pages into a single left-nav entry when
  implementing the new navigation baseline.
- Do not describe Basic Shapley as the default final allocation mode. It is only
  a small-scale `baseline_check`.
- Do not let non-data contribution parties enter the MD-DShap pool by default.
- Do not describe MD-DShap outputs as legal allocation, payment instructions, or
  final settlement.
- Do not silently overwrite historical reports, snapshots, calculation results,
  or export files.
- Do not show PDF, login, production RBAC, async task queue, bank/tax/payment,
  electronic signature, or multi-tenant features as implemented P0 capability.
- Do not make the sample project the only business scenario.
