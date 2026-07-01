# UI Schema Refactor Audit

Historical snapshot: this audit predates the current V1.4/V1.2/V1.1 source
baseline and contract-ratio runtime alignment. Use
`docs/CODE_DOCUMENT_DRIFT_AUDIT.md` for current status.

Status: phase-one audit and design freeze only. This document does not approve
runtime implementation, dependency changes, script changes, database changes, or
frontend page rewrites.

System boundary: 数据收益分配系统 V1.2 / DVAS. All UI schema, renderer, export,
and report behavior must keep the statement that results are only simulation
references and are not legal settlement, statutory settlement, payment
instructions, contract performance, formal asset appraisal, or authority
approval.

## 1. Scope Classification

Task type: audit, docs, frontend architecture, refactor planning, UI schema
architecture, QA acceptance planning.

Allowed write scope for this phase:

- `docs/**/*.md`

Forbidden in this phase:

- `src/`
- `demo_ui/`
- `tests/`
- runnable scripts under `scripts/`
- `ui_prototype/`
- dependency files and lock files
- executable DDL or migration scripts
- frontend, backend, algorithm, API, test, database, auth, deployment, cloud,
  secret, commit, or push changes

## 2. Sources Checked

Primary source documents:

- `数据收益分配系统_V1.3_需求规格说明书_导航结构更新版.md`
- `数据收益分配系统_系统详细功能设计_V1.1_导航结构更新版.md`
- `数据收益分配系统_数据库设计与ER关系图_V1.0_导航结构更新版.md`

Repository context:

- `AGENTS.md`
- `README.md`
- `docs/current_project_baseline.md`
- `docs/product_navigation.md`
- `docs/reporting_contract.md`
- `docs/acceptance_checklist.md`
- `docs/test_plan.md`
- `docs/ui/*.md`
- `ui_prototype/src/App.tsx`
- `ui_prototype/src/dvasData.json`
- `ui_prototype/src/styles.css`
- `ui_prototype/package.json`
- `scripts/check_ui_deliverables.py`

Read-only reviewer inputs were collected from schema, renderer, interaction,
QA, and documentation consistency reviews. No reviewer modified files.

## 3. Current Worktree Observation

The worktree was already dirty before this audit. Existing modified and
untracked files include tracked docs and agents, untracked `README.md`,
`docs/ui/`, `ui_prototype/`, `scripts/check_ui_deliverables.py`, `output/`, and
the three mandatory source documents.

This audit intentionally avoids modifying existing dirty files. It adds new
documentation artifacts only.

## 4. Current UI Inventory

Current prototype inventory:

- `ui_prototype/src/dvasData.json` contains 14 page records and 66 action/button
  records.
- `ui_prototype/src/App.tsx` is a single React file that imports
  `dvasData.json`, but still renders many pages, actions, overlays, local
  states, tables, and forms by hand.
- `docs/ui/ui_inventory.md`, `docs/ui/page_structure.md`, and
  `docs/ui/button_interaction_matrix.md` are useful inventories, but they are
  not a complete UI Schema contract.

Target schema inventory for the next implementation phase:

| Target `page_id` | Module | Canonical Route | Current Prototype Alias | Notes |
|---|---:|---|---|---|
| `SYS_OVERVIEW` | SYS | `/dashboard` | `system_home` | Aggregates 项目总览, 流程入口, 风险提示, 一键计算 as sections. No system-home section keeps a separate route, menu code, or permission node. |
| `DATA_INGESTION` | DATA | `/data/ingestion` | `data_ingestion` | Data package, upload, validation, snapshots. |
| `RES_MANAGEMENT` | RES | `/data/resources` | `data_resources` | Resource table, field stats, party relation. |
| `PARTY_MANAGEMENT` | PARTY | `/data/parties` | `data_parties` | Data-provider and non-data party management. |
| `QUAL_ASSESSMENT` | QUAL | `/metering/quality` | `measure_quality` | Quality weights and assessment. |
| `DU_METERING` | DU | `/metering/shuyuan` | `measure_shuyuan` | Base price, call count, metering result. |
| `UTIL_CALCULATION` | UTIL | `/metering/utility` | `measure_utility` | Contribution and utility calculation. |
| `MDS_CALCULATION` | MDS | `/allocation/md-dshap` | `allocation_md_dshap` | MD-DShap weight calculation only. |
| `ALLOC_SIMULATION` | ALLOC | `/allocation/simulation` | `allocation_simulation` | Revenue pool and allocation simulation. |
| `CONS_MANAGEMENT` | CONS | `/allocation/constraints` | `allocation_constraints` | Contract constraints. |
| `REP_EXPORT` | REP | `/reports` | `reports_export` | Markdown/CSV/JSON/JSONL export; PDF is P1. |
| `AUD_LOG` | AUD | `/system/audit` | `system_audit` | Audit logs, trace, snapshots, export records. |
| `PARAM_CONFIG` | PARAM | `/system/parameters` | `system_parameters` | Scenario, quality, MD-DShap, risk text parameters. |
| `USER_PERMISSION_P1` | USER | `/system/users` | `system_users_p1` | P1 only; P0 displays planning/read-only boundary. |

## 5. Findings

### P0. Target audit artifact was missing

Before this work, `docs/ui_schema_refactor_audit.md` did not exist. QA review
confirmed there was no checklist anchor for the UI Schema refactor phase.

Resolution in this phase: create this docs-only audit and freeze set.

### P0. Current UI is not schema-driven

Evidence:

- `ui_prototype/src/App.tsx` uses manual route lookup via
  `window.location.pathname`.
- `ui_prototype/src/App.tsx` branches on page/module state and renders custom
  pages by hand for system home, data ingestion, and data resources.
- `ui_prototype/src/App.tsx` has a hardcoded `ActionOverlay` switch for selected
  action IDs; most actions fall through to a generic modal.
- Modal/drawer chrome, tables, forms, filters, export dialogs, and local state
  handlers are repeated in the page file.

Impact: a new page, modal, drawer, table, form, or action still requires React
edits. This does not meet the target rule that UI changes should be made through
schema only.

### P0. Formal UI Schema does not exist yet

`dvasData.json` is useful metadata, but it is not the required
`system.ui.schema.json` contract. It lacks normalized page component trees,
component types, grid layout fields, table columns, form fields, modal/drawer
schemas, data bindings, validation rules, action types, state transitions,
visibility rules, disabled rules, audit payloads, and regeneration metadata.

### P0. Action registry has coverage and semantic drift

Observed action inventory:

- Current prototype has 66 action/button records.
- The requested action set requires `USER-008 角色管理 P1`; this is missing from
  `dvasData.json`, `docs/ui/ui_inventory.md`, and
  `docs/ui/button_interaction_matrix.md`.
- Current prototype uses UI kinds such as `highRisk` and `p1`; target action
  schema must normalize to `VIEW`, `CREATE`, `UPDATE`, `DELETE_DISABLE`,
  `CALCULATE`, `EXPORT`, and `CONFIRM`, with risk and phase stored separately.
- `SYS-004` drifts from the source meaning. Source documents define it as
  `启动完整计算`; current UI matrix narrows it to continuing MD-DShap only.

Freeze decision:

- `SYS-004` keeps the source meaning: full complete-chain calculation from
  quality assessment through allocation simulation when preconditions are met.
- A future "continue current step" shortcut may be added as a UI-only derived
  action, but it must not reuse `SYS-004`.
- `USER-008` must be added to the target action registry as P1 role management.

### P0. State machine is incomplete

Current prototype stores Chinese labels only and lacks the requested derived
`ASSESSABLE / 可评估` state.

Target state machine:

```text
DRAFT 草稿
INGESTED 已接入
ASSESSABLE 可评估
ASSESSED 已评估
METERED 已计量
UTILITY_CALCULATED 已计算效用
WEIGHT_CALCULATED 已计算权重
ALLOCATED 已分配
CONFIRMED 已确认
EXPORTED 已导出
```

`ASSESSABLE` may be a UI-derived state if backend persistence does not yet
store it. The derived rule must be explicit: data package is valid, resources
are identified, and at least one effective data-source party relation exists.

### P0. System-home route and menu-code conflict is resolved

Current database/design/requirements docs define one system-home menu node:

- `NAV_SYS_HOME` -> `/dashboard`

Project overview, process entry, risk notices, and one-click calculation are
in-page sections, not source routes, menu-code aliases, secondary windows, or
permission menu nodes.

Freeze decision:

- Target schema uses one page `SYS_OVERVIEW` with canonical route `/dashboard`.
- The former system-home split routes and menu codes are废止 in the current
  baseline.
- Project overview, process entry, risk notices, and one-click calculation are
  internal sections only.
- Audit metadata for home-page actions uses `module_code=SYS` and
  `menu_code=NAV_SYS_HOME`.

### P0. Modal and drawer behavior is not schema-frozen

The current button matrix describes interaction text, but not a normalized
overlay contract. Target schema must define every modal/drawer with:

- `component_id`
- `type`
- `title`
- `open_by_action`
- `size`
- `content_components`
- `form_schema` or `detail_schema`
- `confirm_action`
- `cancel_action`
- `success_ui`
- `failure_ui`
- `audit_log_required`
- `disclaimer_required`

High-risk and export actions must never fall through to a generic modal without
confirmation, field scope, audit, and disclaimer metadata.

### P0. Disabled states are not globally enforced

Current generic action rendering maps page buttons to clickable controls and
filters missing action IDs without failing. It does not centrally enforce
preconditions, locked/exported states, or P1 unavailable states.

Freeze decision:

- Target renderer must use `can_execute(action, project_state, object_state,
  permissions)` before rendering or dispatching an action.
- Locked or exported core configuration actions must be disabled and point to
  `复制新版本`.
- P1 actions are visible as planning/read-only controls in P0 and cannot write.

### P0. Export and report evidence is currently red

`docs/ui/final_ui_delivery_report.md` claims page screenshots, design images,
button screenshots, flow screenshots, and `python3 scripts/check_ui_deliverables.py`
success. Current QA review found those PNG folders empty and the checker fails.

Freeze decision:

- The UI Schema refactor cannot use missing screenshot evidence as acceptance
  proof.
- Screenshot generation remains a future writable validation pass.
- The schema validator and renderer tests must become the primary gate before
  screenshot evidence is regenerated.

### P1. Export/report file contract drift needs follow-up

Source docs list P0 files such as `allocation_result.json`,
`allocation_result.csv`, `md_dshap_result.json`, and
`md_dshap_marginal_trace.csv`. `docs/reporting_contract.md` introduces split
CSV names such as `participant_weight.csv`, `task_level_weight.csv`, and
`marginal_contribution_trace.csv`.

Freeze decision for schema: preserve source file names as canonical. Additional
split files may be documented as derived/optional only after source docs are
updated together.

### P1. Source button references have legacy-ID drift

The PRD priority table references `RP-001 至 RP-008` and `MDS-001 至 MDS-012`,
while the detailed button set uses `REP-*` and `MDS-011` through `MDS-018`.

Freeze decision: target action registry uses the detailed button IDs listed in
the task request, plus `USER-008`. Legacy ID ranges require a future mapping
table before implementation.

### P2. Sample project wording must remain bounded

The UI materials mention 肺癌早筛 as a default/sample project. This is permitted
only as an example. Schema docs must call it an example dataset, not the product
domain or real medical production data.

## 6. Target Freeze Summary

Target architecture:

```text
system.ui.schema.json
-> component.registry
-> action.registry
-> state.machine
-> data.binding.registry
-> SchemaApp / SchemaPage / SchemaComponentRenderer
```

Rules:

- Pages are schema records, not hand-authored business layouts.
- Tables, forms, modals, drawers, steppers, cards, charts, upload zones,
  timelines, risk panels, audit panels, and action bars are schema components.
- Actions are schema records with explicit handlers, preconditions, validation,
  state transitions, audit rules, confirmation rules, and result bindings.
- State changes go through the state machine.
- Data reads and writes go through binding/action registries.
- The renderer injects the simulation-reference disclaimer in page headers,
  risk surfaces, export dialogs, report previews, lock confirmations, and
  generated report bodies.

## 7. Action Coverage Freeze

Target action registry must include these IDs:

```text
SYS-002, SYS-004, SYS-005
DATA-002, DATA-003, DATA-007, DATA-008, DATA-009
RES-002, RES-005, RES-007
PARTY-002, PARTY-003, PARTY-005, PARTY-006, PARTY-008
QUAL-002, QUAL-003, QUAL-006, QUAL-009
DU-002, DU-003, DU-009, DU-010
UTIL-001, UTIL-006, UTIL-007, UTIL-008, UTIL-009
MDS-011, MDS-012, MDS-013, MDS-014, MDS-015, MDS-016, MDS-017, MDS-018
ALLOC-003, ALLOC-005, ALLOC-007, ALLOC-011, ALLOC-013, ALLOC-015, ALLOC-016
CONS-002, CONS-003, CONS-004, CONS-011
REP-001, REP-002, REP-003, REP-004, REP-005, REP-006, REP-009
AUD-002, AUD-006, AUD-007
PARAM-001, PARAM-002, PARAM-004, PARAM-008
USER-001, USER-002, USER-007, USER-008, USER-009
```

Minimum action fields:

```text
action_id, action_name, module, trigger_component, action_type,
permission_code, api_or_handler, input_schema, preconditions,
validation_rules, state_transition, audit_log_required, success_ui,
failure_ui, confirmation_required, affected_data_objects, result_binding,
phase, risk_level, disclaimer_required
```

## 8. Validation Freeze

Future implementation validation must include:

- parse `system.ui.schema.json`
- validate all 14 `page_id`s exist
- validate all action IDs above exist
- validate `USER-008` exists
- validate component types are only the 12 allowed types
- validate all modal/drawer records are schema-defined
- validate all calculate/export/high-risk actions have preconditions,
  failure UI, audit rules, and confirmation/export metadata as applicable
- validate state machine has no illegal transition
- validate locked/exported disabled rules
- validate MD-DShap is default and Basic Shapley is only `baseline_check`
- validate non-data parties do not enter MD-DShap by default
- validate weights display at 6 decimals and normalize to 1
- validate exports include field scope, `report_id`, `checksum`, and disclaimer
- validate generated pages can be regenerated from schema

Current checks run during audit are listed in the final handoff. Some checks are
expected to fail until implementation or screenshot regeneration is approved.

## 9. Remaining Tasks

Documentation follow-up:

- Align the system-home route/menu decision across source docs and UI docs.
- Add a legacy ID mapping for `RP-*` and old `MDS-*` references.
- Align `docs/reporting_contract.md` with the source export file names.
- Rename “默认项目：肺癌早筛...” wording to “默认演示样例” where needed.

Future implementation:

- Create runtime `src/ui-schema/` files.
- Create runtime `src/ui-renderer/` files.
- Add schema validation script and tests.
- Replace handwritten UI page layout with schema route shell.
- Regenerate screenshots after renderer/schema validation passes.
