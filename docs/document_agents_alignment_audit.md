# Documentation And Agents Alignment Self-Check

Historical snapshot: this self-check predates the current V1.4/V1.2/V1.1
source baseline and contract-ratio runtime alignment. Use
`docs/CODE_DOCUMENT_DRIFT_AUDIT.md` for current status.

## Inventory

Checked current entrypoints and document areas:

- `AGENTS.md`
- `.codex/agents/*.toml`
- root baseline documents:
  - `数据收益分配系统_V1.3_需求规格说明书_导航结构更新版.md`
  - `数据收益分配系统_系统详细功能设计_V1.1_导航结构更新版.md`
  - `数据收益分配系统_数据库设计与ER关系图_V1.0_导航结构更新版.md`
- `docs/system_scope.md`
- `docs/milestone_plan.md`
- `docs/product_requirements.md`
- `docs/system_architecture.md`
- `docs/allocation_logic_design.md`
- `docs/api_and_data_contract.md`
- `docs/ui_flow.md`
- `docs/test_plan.md`
- `docs/compliance_and_audit_boundary.md`
- `docs/development_task_breakdown.md`
- workflow and agent docs under `docs/`
- formal archive docs under `docs/deliverables/`

`README.md` did not exist before this alignment round.

## Drift Table

| File | Current old wording/problem | Latest wording to use | Needs change | Change method |
| --- | --- | --- | --- | --- |
| `AGENTS.md` | Generic multi-agent governance and pre-coding setup; missing V1.2 product baseline. | V1.2 positioning, navigation, P0/P1, MD-DShap, exports, audit, documentation-only round. | Yes | Replaced with project-level V1.2 entry rules. |
| `.codex/agents/*.toml` | Active project-scoped agent definitions. Older `agents/*.md` role notes were superseded. | Each active agent role follows current project rules and user-authorized scope. | Yes | Use TOML definitions as the current source. |
| `docs/system_scope.md` | Older freeze scope, DAUS/Shapley generic chain, no latest navigation or export boundary. | 数据收益分配模拟与审计说明系统; P0/P1; full V1.2 chain. | Yes | Replaced with V1.2 scope. |
| `docs/product_requirements.md` | Generic JSON/Data Unit requirements; no button-level GAP closure. | V1.3 PRD baseline, GAP-001 to GAP-005, latest navigation and exports. | Yes | Replaced with V1.2 requirements summary. |
| `docs/system_architecture.md` | Suggested code layout and old DAUS/Shapley contribution module as default. | Documentation-only architecture input; MD-DShap default weight layer; reporting/audit boundaries. | Yes | Replaced with service/domain architecture input. |
| `docs/allocation_logic_design.md` | Basic Shapley described as main contribution weight method. | MD-DShap default; Basic Shapley baseline only; DAUS utility input layer. | Yes | Replaced with algorithm scope. |
| `docs/ui_flow.md` | Linear flow pages rather than updated left navigation. | 1440x900 Chinese admin UI with six navigation groups and module states. | Yes | Replaced with UI design spec summary. |
| `docs/api_and_data_contract.md` | Old input/output envelope with `shapley_weight` as central field. | V1.2 service/data contract input; MD-DShap task/result; report/audit ids. | Yes | Replaced with interface-contract documentation input. |
| `docs/test_plan.md` | Old test plan for generic pipeline; lacks V1.2 module/button acceptance. | GAP closure, module acceptance, export checksum, trace, P0/P1 checks. | Yes | Replaced with acceptance checklist references. |
| `docs/compliance_and_audit_boundary.md` | Correct caution language but missing V1.2 export and MD-DShap specifics. | Simulation reference, non-legal settlement, sensitive data, audit trace, report ids. | Yes | Replaced with V1.2 compliance boundary. |
| `docs/development_task_breakdown.md` | Coding task breakdown from old freeze. | Future implementation tasks after documentation freeze only. | Yes | Replaced with V1.2 future task map. |
| `docs/milestone_plan.md` | Phase 0 pre-coding freeze and old Phase 1-5 plan. | Documentation freeze first; future implementation after user confirmation. | Yes | Replaced with V1.2 milestone plan. |
| `docs/deliverables/*.md` | Formal archive materials may use older MVP, UI, DB, test terminology. | Must map to V1.2 baseline and mark runtime claims as planned unless implemented. | Yes | Updated as V1.2-compatible archive summaries. |
| root V1.3/V1.1/V1.0 baseline docs | New authority inputs; contain latest product details. | Use as source of truth. | No | Read and referenced; not modified. |

## Key Drift Found

High:

- Old docs did not make MD-DShap the default contribution weight strategy.
- Old docs lacked the new six-group left navigation.
- Old docs did not consistently state P0/P1 boundaries for login/RBAC/PDF/async.
- Old docs did not consistently require `report_id`, `checksum`, snapshots, and
  trace for exports.

Medium:

- Agent role definitions must follow the active `.codex/agents/*.toml` files.
- UI docs used a linear page flow instead of the latest management-backend
  navigation and module controls.
- Database/API docs were older implementation drafts rather than V1.2 design
  inputs.

Low:

- Some old docs used historical freeze language. This is now superseded by the
  V1.2 baseline rather than treated as current implementation status.
