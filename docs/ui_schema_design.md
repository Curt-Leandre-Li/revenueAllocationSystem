# UI Schema Design Freeze

This document freezes the target UI Schema contract for a future implementation
round. It is not a runtime schema file and does not create `src/` artifacts.

## 1. Top-Level Contract

Future target file:

```text
src/ui-schema/system.ui.schema.json
```

Required top-level structure:

```json
{
  "schema_version": "1.0.0",
  "system": {
    "system_name": "数据收益分配系统 V1.2",
    "english_name": "DVAS",
    "positioning": "数据收益分配模拟与审计说明系统",
    "disclaimer": "系统结果仅为模拟参考，非法律结算；不构成法律结算、财务付款、合同履约或主管单位审批结果。",
    "sample_data_boundary": "肺癌早筛仅作为演示样例，不代表唯一业务场景或真实医疗生产数据。"
  },
  "design_system": {},
  "navigation": [],
  "pages": [],
  "components": {},
  "actions": [],
  "state_machine": {},
  "data_bindings": {},
  "permissions": {},
  "regeneration": {}
}
```

## 2. Design System Tokens

Target token groups:

```text
colors, typography, spacing, radius, shadow, table_density,
form_density, layout_grid, status_colors, risk_colors, audit_colors
```

Style freeze:

- Professional B-side SaaS management backend.
- White surface, restrained deep blue primary, light-blue info panels, gray
  dividers, clear status/risk/audit colors.
- No marketing hero, decorative illustration, or visual treatment that hides
  tables, preconditions, trace, audit, or export scope.
- The renderer should own spacing, density, borders, empty states, loading
  states, and footer layout for all schema components.

## 3. Navigation Contract

Navigation labels must have no Arabic numeric prefixes.

| Top Level | Children |
|---|---|
| 系统首页 | 项目总览, 流程入口, 风险提示, 一键计算 |
| 数据管理 | 数据接入管理, 数据资源管理, 参与方管理 |
| 数元贡献度计量 | 质量评估管理, 数元计量管理, 贡献度与效用计算 |
| 收益分配计算 | MD-DShap 计算管理, 收益分配模拟, 合同约束管理 |
| 报告生成与导出 | 报告生成与导出 |
| 系统管理 | 参数配置, 用户与权限管理（P1）, 审计日志管理 |

System-home freeze:

- Render as one page, `SYS_OVERVIEW`, route `/dashboard`.
- Project overview, process entry, risk notices, and one-click calculation are
  internal sections only.
- The former system-home split routes are废止 and must not be current aliases,
  permission menu nodes, or backend modules.
- Audit metadata for home-page actions uses `module_code=SYS` and
  `menu_code=NAV_SYS_HOME`.

## 4. Page Schema

Every page must include:

```text
page_id, module, page_name, route, route_aliases, page_type,
layout, components, data_binding, state_flow, actions, empty_state,
error_state, risk_notice, audit_requirements
```

Frozen page list:

| `page_id` | Module | Page Name | Route | Page Type | Required Sections |
|---|---:|---|---|---|---|
| `SYS_OVERVIEW` | SYS | 系统首页 | `/dashboard` | dashboard | 项目总览, 流程入口, 风险提示, 一键计算 |
| `DATA_INGESTION` | DATA | 数据接入管理 | `/data/ingestion` | workflow | 数据包列表, JSON 上传, 校验结果, 失败详情, 输入快照 |
| `RES_MANAGEMENT` | RES | 数据资源管理 | `/data/resources` | table | 资源列表, 字段统计, 模态标签, 数据源主体关联, 资源摘要导出 |
| `PARTY_MANAGEMENT` | PARTY | 参与方管理 | `/data/parties` | table | 参与方列表, 主体类型, 算法集合标记, 合同主体标记, 贡献结果摘要 |
| `QUAL_ASSESSMENT` | QUAL | 质量评估管理 | `/metering/quality` | workflow | 指标权重, 前置条件检查, 质量评分, 证据说明, 低质量提示 |
| `DU_METERING` | DU | 数元计量管理 | `/metering/shuyuan` | workflow | 基准价, 调用量, 系数配置, 计量明细, 参数版本 |
| `UTIL_CALCULATION` | UTIL | 贡献度与效用计算 | `/metering/utility` | workflow | 贡献因子, 归一化贡献, 效用函数, 效用值, Trace |
| `MDS_CALCULATION` | MDS | MD-DShap 计算管理 | `/allocation/md-dshap` | workflow | 算法模式, 参与方集合, 前置条件检查, 边际贡献, 权重表, 算法审计快照 |
| `ALLOC_SIMULATION` | ALLOC | 收益分配模拟 | `/allocation/simulation` | workflow | 总收益, 合同优先分配, 分配模式, 约束前后金额, 方案对比 |
| `CONS_MANAGEMENT` | CONS | 合同约束管理 | `/allocation/constraints` | table | 约束列表, 约束类型, 优先级, 生效状态, 约束检查结果 |
| `REP_EXPORT` | REP | 报告生成与导出 | `/reports` | workflow | 报告预览, 导出记录, 文件清单, 字段范围, P1 PDF 提示 |
| `AUD_LOG` | AUD | 审计日志管理 | `/system/audit` | table | 日志查询, 计算 Trace, 输入快照, 参数快照, 输出快照, 导出记录 |
| `PARAM_CONFIG` | PARAM | 参数配置 | `/system/parameters` | form | 场景系数, 质量权重模板, MD-DShap 参数, 风险提示文案, 参数版本 |
| `USER_PERMISSION_P1` | USER | 用户与权限管理（P1） | `/system/users` | table | P1 能力边界, 用户列表, 角色权限矩阵, 按钮权限, local_operator 说明 |

## 5. Component Contract

Allowed top-level component types only:

```text
table, form, modal, drawer, stepper, card, chart, upload_zone,
timeline, risk_panel, audit_panel, action_bar
```

No new top-level component type may be introduced. UI concepts such as tabs,
badge, stat, progress, tag, filter, and toolbar must be variants or display
configuration inside the allowed component types.

Every component must include:

```text
component_id, type, title, grid, data_binding, visible_when,
disabled_when, loading_state, empty_state, error_state,
fields/columns/metrics/steps/panels, actions, audit_display
```

Common component IDs should follow:

```text
<page_id>__<role>
```

Examples:

```text
DATA_INGESTION__package_table
DATA_INGESTION__upload_zone
RES_MANAGEMENT__resource_table
MDS_CALCULATION__weight_table
ALLOC_SIMULATION__scenario_compare_drawer
REP_EXPORT__export_confirm_modal
AUD_LOG__audit_detail_drawer
```

## 6. Modal And Drawer Contract

All overlays are schema components. Overlay types are expressed through
`type=modal/drawer` and `variant`, not new top-level component types.

Allowed overlay variants:

```text
form_modal, detail_drawer, trace_drawer, confirm_modal,
export_confirm_modal, progress_drawer, progress_modal, p1_planned_panel
```

Required overlay coverage:

```text
DATA upload failure detail modal/drawer
DATA delete/disable data package confirm modal
RES link provider drawer
PARTY create/edit party modal
PARTY enable/disable confirm modal
QUAL weight config drawer
QUAL rerun confirm modal
DU base price config drawer
DU call count drawer
UTIL contribution factor drawer
UTIL utility function drawer
UTIL trace drawer
MDS parameter config drawer
MDS calculation progress drawer
MDS marginal contribution drawer
MDS weight detail drawer
MDS complexity note drawer
ALLOC total revenue drawer
ALLOC priority allocation drawer
ALLOC scenario comparison drawer
ALLOC lock scenario confirm modal
CONS create/edit contract constraint modal
CONS constraint check drawer
REP export confirm modal
REP report preview drawer
AUD log detail drawer
PARAM parameter edit drawer
USER create user modal
USER role management drawer
USER permission matrix drawer
```

## 7. Action System

Action types:

```text
VIEW, CREATE, UPDATE, DELETE_DISABLE, CALCULATE, EXPORT, CONFIRM
```

Risk and phase are separate fields:

```text
risk_level: low | medium | high
phase: P0 | P1
enabled_in_p0: boolean
```

Required action fields:

```text
action_id, action_name, module, trigger_component, action_type,
permission_code, api_or_handler, input_schema, preconditions,
validation_rules, state_transition, audit_log_required, success_ui,
failure_ui, confirmation_required, affected_data_objects, result_binding,
risk_level, phase, enabled_in_p0, disclaimer_required
```

Normalized high-risk actions:

```text
DATA-009, PARTY-005, QUAL-009, MDS-016, ALLOC-015, CONS-004,
PARAM-001, PARAM-002, PARAM-004, PARAM-008
```

All export actions require an export confirmation modal:

```text
RES-007, MDS-017, MDS-018, ALLOC-016,
REP-002, REP-003, REP-004, REP-005, REP-006, REP-009, AUD-007
```

`REP-003` is P1 and disabled in P0.

P1 user actions:

| Action | Type | P0 Behavior |
|---|---|---|
| `USER-001` | VIEW | Show planning/read-only panel. |
| `USER-002` | CREATE | Disabled; no account creation in P0. |
| `USER-007` | UPDATE | Disabled; no password flow in P0. |
| `USER-008` | UPDATE | Disabled; role management is P1. |
| `USER-009` | UPDATE | Disabled; permission config is P1. |

## 8. State Machine

Canonical transitions:

| From | To | Trigger |
|---|---|---|
| `DRAFT` | `INGESTED` | `SYS-002`, `DATA-002`, `DATA-003` |
| `INGESTED` | `ASSESSABLE` | Resource recognition complete and `RES-005` or `PARTY-006` creates valid data-source relation |
| `ASSESSABLE` | `ASSESSED` | `QUAL-003` |
| `ASSESSED` | `METERED` | `DU-009` |
| `METERED` | `UTILITY_CALCULATED` | `UTIL-008` |
| `UTILITY_CALCULATED` | `WEIGHT_CALCULATED` | `MDS-011` |
| `WEIGHT_CALCULATED` | `ALLOCATED` | `ALLOC-011` |
| `ALLOCATED` | `CONFIRMED` | `ALLOC-015` |
| `ALLOCATED`, `CONFIRMED` | `EXPORTED` | `ALLOC-016`, `REP-002`, `REP-004`, `REP-005`, `REP-006`, `REP-009`, `AUD-007` |

Every transition must include:

```text
from, to, triggered_by_action, module, guards, side_effects,
audit_log_required, rollback_policy, success_ui, failure_ui
```

`ASSESSABLE` may be UI-derived until backend persistence is approved, but it
must not be omitted from the schema.

## 9. Data Binding Registry

Every page/component uses bindings, not direct API calls.

Binding fields:

```text
binding_id, source_type, query_key, api_endpoint_or_handler,
params, transform, refresh_policy, error_policy, empty_policy
```

Core binding groups:

| Binding | Source Type | Used By |
|---|---|---|
| `binding_project_summary` | selector/api | `SYS_OVERVIEW` cards, status, recent report |
| `binding_data_packages` | api/mock | `DATA_INGESTION` table and upload details |
| `binding_resources` | api/mock | `RES_MANAGEMENT` resource table and detail drawer |
| `binding_parties` | api/mock | `PARTY_MANAGEMENT`, `RES_MANAGEMENT`, `ALLOC_SIMULATION` |
| `binding_quality_results` | api/mock | `QUAL_ASSESSMENT` |
| `binding_metering_results` | api/mock | `DU_METERING` |
| `binding_utility_results` | api/mock | `UTIL_CALCULATION`, `MDS_CALCULATION` |
| `binding_mds_results` | api/mock | `MDS_CALCULATION`, `ALLOC_SIMULATION`, reports |
| `binding_allocation_results` | api/mock | `ALLOC_SIMULATION`, `REP_EXPORT` |
| `binding_constraints` | api/mock | `CONS_MANAGEMENT`, `ALLOC_SIMULATION` |
| `binding_report_records` | api/mock | `REP_EXPORT`, `AUD_LOG` |
| `binding_audit_logs` | api/mock | `AUD_LOG`, audit panels |
| `binding_system_parameters` | api/mock | `PARAM_CONFIG`, risk panels |
| `binding_user_permission_p1` | api/mock | `USER_PERMISSION_P1` planning state |

## 10. Regeneration Contract

The schema must support regeneration:

- route shell generation
- page/component rendering
- modal/drawer mounting
- action registry generation
- state-machine verification
- data-binding verification
- screenshot/test target generation

Regeneration metadata must include:

```text
source_documents, source_lineage, schema_hash, generated_at,
generator_version, compatibility_aliases, deprecated_files, validation_commands
```
