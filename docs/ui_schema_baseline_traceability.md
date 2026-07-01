# UI Schema Baseline Traceability Check

Date: 2026-06-17

Scope: source-of-truth traceability only. This file does not implement UI,
runtime schema, renderer logic, tests, scripts, routes, APIs, database changes,
or dependency changes.

Conclusion: **PARTIAL**. The documentation-level schema design is largely
aligned to the three baseline files, but current runtime metadata and renderer
are not fully schema-driven. Before this file existed, UI Schema design could
not be claimed as fully traceable to the three baseline files.

## 1. Baseline Files Read

| Baseline file | Read chapters / sections | Use in this check |
|---|---|---|
| `数据收益分配系统_V1.4_需求规格说明书_增加后端逐资源质量评估.md` | Current requirements baseline. | Highest-priority source for business semantics, P0/P1 boundary, module inclusion, button semantics, export and audit rules. |
| `数据收益分配系统_系统详细功能设计_V1.2_增加后端逐资源质量评估.md` | Current detailed functional baseline. | Highest-priority source for page layout, route paths, action types, overlay expectations, success/failure UI, audit and snapshot requirements. |
| `数据收益分配系统_数据库设计与ER关系图_V1.1_增加后端逐资源质量评估.md` | Current DB/ER baseline with runtime-object caveats. | Highest-priority source for `menu_code`, `module_code`, `route_path`, SQL/runtime object mapping, permission actions, status enum, audit fields, `report_id`, and `checksum`. |

Current implementation evidence read:

| Current artifact | Evidence read | Use |
|---|---|---|
| `docs/ui_schema_design.md` | Top-level schema contract, page list, overlay/action/state/data-binding sections. | Current documentation schema coverage. |
| `docs/ui_renderer_design.md` | Future renderer architecture and acceptance criteria. | Current renderer target coverage; confirms not implemented. |
| `ui_prototype/src/dvasData.json` | 14 page records, 66 runtime button records, statusMachine, menu/route objects. | Current runtime registry coverage. |
| `ui_prototype/src/App.tsx` | Manual route selection, hardcoded page branches, `ActionOverlay`, generic `ModuleActionDialog`. | Current renderer coverage and drift. |

## 2. Module Provenance

All 14 target modules are sourced from the baseline files.

| module_code | Target page_id | Baseline source | Status |
|---|---|---|---|
| SYS | `SYS_HOME` | PRD 4.1 and 7.1; detailed design 3.2, 5.1, and 7.1; DB design navigation rows. | Source confirmed; system home is one first-level page with internal sections. |
| DATA | `DATA_INGESTION` | PRD 4.1 and 7.2; detailed design 3.2, 5.1, 7.2; DB design 2 row `NAV_DATA_PACKAGE`. | Source confirmed. |
| RES | `RES_MANAGEMENT` | PRD 4.1 and 7.3; detailed design 3.2, 5.1, 7.3; DB design 2 row `NAV_DATA_RESOURCE`. | Source confirmed. |
| PARTY | `PARTY_MANAGEMENT` | PRD 4.1 and 7.4; detailed design 3.2, 5.1, 7.x appendix; DB design 2 row `NAV_DATA_PARTY`. | Source confirmed. |
| QUAL | `QUAL_ASSESSMENT` | PRD 4.1 and 7.5; detailed design 3.2, 5.1, 7.x appendix; DB design 2 row `NAV_MEASURE_QUALITY`. | Source confirmed. |
| DU | `DU_METERING` | PRD 4.1 and 7.6; detailed design 3.2, 5.1, 7.x appendix; DB design 2 row `NAV_MEASURE_SHUYUAN`. | Source confirmed. |
| UTIL | `UTIL_CALCULATION` | PRD 4.1 and 7.7; detailed design 3.2, 5.1, 7.x appendix; DB design 2 row `NAV_MEASURE_UTILITY`. | Source confirmed. |
| MDS | `MDS_CALCULATION` | PRD 4.1, 8.1-8.4; detailed design 3.2, 5.1, 8.4; DB design 2 and 14. | Source confirmed. |
| ALLOC | `ALLOC_SIMULATION` | PRD 4.1 and 7.8; detailed design 3.2, 5.1; DB design 2 row `NAV_ALLOC_SIMULATION`. | Source confirmed. |
| CONS | `CONS_MANAGEMENT` | PRD 4.1 and 7.9; detailed design 3.2, 5.1; DB design 2 row `NAV_ALLOC_CONSTRAINT`. | Source confirmed. |
| REP | `REP_EXPORT` | PRD 4.1, 7.10, 9; detailed design 3.2, 5.1, 9; DB design 2, 12, 16. | Source confirmed. |
| PARAM | `PARAM_CONFIG` | PRD 4.1, 7.12; detailed design 3.2, 5.1, 7.12; DB design 2 row `NAV_SYSTEM_PARAMETER`. | Source confirmed. |
| USER | `USER_PERMISSION_P1` | PRD 4.1, 7.13; detailed design 3.2, 5.1, 7.13; DB design 2 row `NAV_SYSTEM_USER`. | Source confirmed; `USER-008` missing in current runtime. |
| AUD | `AUD_LOG` | PRD 4.1, 7.11; detailed design 3.2, 5.1, 7.14; DB design 2 row `NAV_SYSTEM_AUDIT`. | Source confirmed. |

Baseline now has one system-home navigation row. Project overview, process
entry, risk notices, and one-click calculation are internal sections of
`SYS_HOME`, not standalone navigation rows.

## 3. Page Traceability

Legend:

- Schema coverage: current documentation-level schema in
  `docs/ui_schema_design.md`, not a runtime JSON file.
- Renderer coverage: current visual prototype route/page coverage in
  `ui_prototype`, not schema-driven rendering.

| page_id | Source file / section | module_code | route_path | menu_code | Main data objects | Permission actions | Current schema coverage | Current renderer coverage | Drift |
|---|---|---|---|---|---|---|---|---|---|
| `SYS_HOME` | PRD 4.1 and 7.1; detailed 3.2, 5.1, 7.1; DB design navigation mapping. | SYS | `/dashboard` | `NAV_SYS_HOME` | `allocation_project`, `audit_log`, `snapshot_store`, `report_record`, `system_parameter` | VIEW, CREATE, CALCULATE | Yes: one first-level page, internal sections only. | Partial: visual page exists; renderer remains partially hand-coded. | No route/menu drift for system home after this update. |
| `DATA_INGESTION` | PRD 4.1 row 113; PRD 7.2; detailed 3.2, 5.1, 7.2; DB 2 row 51. | DATA | `/data/ingestion` | `NAV_DATA_PACKAGE` | `data_package`, `input_snapshot`, `upload_validation_result` | CREATE, VIEW, DELETE_DISABLE | Yes. | Partial: visual route exists; custom workbench is handwritten. | No source drift; renderer is not schema-driven. |
| `RES_MANAGEMENT` | PRD 4.1 row 114; PRD 7.3; detailed 3.2, 5.1, 7.3; DB 2 row 52. | RES | `/data/resources` | `NAV_DATA_RESOURCE` | `data_resource`, `data_resource_field`, `data_resource_party_relation` | VIEW, UPDATE, EXPORT | Yes. | Partial: visual route exists; custom workbench is handwritten. | Minor: `ASSESSABLE` appears here in detailed/DB side effects but not in runtime statusMachine. |
| `PARTY_MANAGEMENT` | PRD 4.1 row 115; PRD 7.4; detailed 3.2, 5.1 and appendix; DB 2 row 53. | PARTY | `/data/parties` | `NAV_DATA_PARTY` | `party`, `data_resource_party_relation` | CREATE, UPDATE, DELETE_DISABLE, VIEW | Yes. | Partial: generic page shell/action matrix. | No source drift; renderer not schema-driven. |
| `QUAL_ASSESSMENT` | PRD 4.1 row 116; PRD 7.5; detailed 3.2, 5.1 and appendix; DB 2 row 54. | QUAL | `/metering/quality` | `NAV_MEASURE_QUALITY` | `quality_assessment`, `quality_score_detail`, `parameter_version` | UPDATE, CALCULATE, VIEW | Yes. | Partial: generic page shell/action matrix. | Route is aligned to `/metering`, not `/measure`. |
| `DU_METERING` | PRD 4.1 row 117; PRD 7.6; detailed 3.2, 5.1 and appendix; DB 2 row 55. | DU | `/metering/shuyuan` | `NAV_MEASURE_SHUYUAN` | `shuyuan_metering`, `shuyuan_metering_detail` | UPDATE, CALCULATE, VIEW | Yes. | Partial: generic page shell/action matrix. | Route is aligned to `/metering`, not `/measure`. |
| `UTIL_CALCULATION` | PRD 4.1 row 118; PRD 7.7; detailed 3.2, 5.1 and appendix; DB 2 row 56. | UTIL | `/metering/utility` | `NAV_MEASURE_UTILITY` | `contribution_record`, `utility_function_snapshot`, `utility_record`, `utility_trace` | UPDATE, CALCULATE, VIEW | Yes. | Partial: generic page shell/action matrix. | Route is aligned to `/metering`, not `/measure`. |
| `MDS_CALCULATION` | PRD 4.1 row 119; PRD 8.1-8.4; detailed 5.1, 8.4, appendix; DB 2 row 57 and 14. | MDS | `/allocation/md-dshap` | `NAV_ALLOC_MDS` | `md_dshap_task`, `md_dshap_result`, `md_dshap_marginal_trace`, `algorithm_audit_snapshot` | CALCULATE, VIEW, EXPORT | Yes. | Partial: generic page shell/action matrix; `SYS-004` special overlay is hardcoded. | Runtime `SYS-004` currently narrows to MDS calculation. |
| `CONS_MANAGEMENT` | Historical PRD/DB rows used old contract constraint naming; current V1.4/V1.2/V1.1 baseline supersedes it. | CONS | `/allocation/constraints` | `NAV_ALLOC_CONSTRAINT` | runtime `contract_ratio_plan`, `contract_ratio_item`; SQL `contract_constraint`, `constraint_apply_trace` legacy only | CREATE, UPDATE, DELETE_DISABLE, VIEW | Yes. | Partial: custom page backed by runtime contract-ratio state. | Updated: page is 合同分配规则, not old constraint management. |
| `ALLOC_SIMULATION` | Historical PRD/DB rows used priority/constraint wording; current V1.4/V1.2/V1.1 baseline supersedes it. | ALLOC | `/allocation/simulation` | `NAV_ALLOC_SIMULATION` | `allocation_scenario`, `allocation_result`, runtime contract-ratio plan/items | CALCULATE, CONFIRM, EXPORT, VIEW | Yes. | Partial: custom page reads backend contract-ratio simulation. | Updated: current path requires saved contract-ratio plan and no default/fake plan. |
| `REP_EXPORT` | PRD 4.1 row 122; PRD 7.10 and 9; detailed 5.1, 7.11, 9; DB 2 row 60 and 12. | REP | `/reports` | `NAV_REPORT_EXPORT` | `report_record`, `export_file`, `snapshot_store` | VIEW, EXPORT | Yes. | Partial: visual route exists; export confirmations are not all schema-driven. | Export `report_id`/`checksum` is documented but not enforced by runtime schema. |
| `PARAM_CONFIG` | PRD 4.1 row 123; PRD 7.12; detailed 5.1, 7.12, appendix; DB 2 row 61. | PARAM | `/system/parameters` | `NAV_SYSTEM_PARAMETER` | `system_parameter`, `parameter_version` | VIEW, UPDATE | Yes. | Partial: generic page shell/action matrix. | No source drift; renderer not schema-driven. |
| `USER_PERMISSION_P1` | PRD 4.1 row 124; PRD 7.13; detailed 5.1, 7.13, appendix; DB 2 row 62. | USER | `/system/users` | `NAV_SYSTEM_USER` | `user_account`, `role`, `permission`, `user_role`, `role_permission` | CREATE, UPDATE, VIEW | Partial: target schema adds `USER-008`, but detailed appendix and runtime registry do not. | Partial: visual P1 page exists; `USER-008` button absent. | Yes. `USER-008` missing in runtime registry. |
| `AUD_LOG` | PRD 4.1 row 125; PRD 7.11; detailed 5.1, 7.14, appendix; DB 2 row 63. | AUD | `/system/audit` | `NAV_SYSTEM_AUDIT` | `audit_log`, `snapshot_store`, `report_record` | VIEW, EXPORT | Yes. | Partial: visual route exists; details drawer is handcoded/generic. | No source drift; renderer not schema-driven. |

## 4. Action Traceability

Audit rule used in this table:

- Required: CREATE, UPDATE, DELETE_DISABLE, CALCULATE, EXPORT, CONFIRM, high-risk
  actions, and P1 permission mutations. This follows PRD permission rule that
  delete/confirm/export/parameter changes must log, detailed design audit
  categories, and DB audit/snapshot policy.
- Optional/No: read-only P0 views may be optional unless they are audit/export
  views.

| action_id | Source button number | Source business semantics | Current action registry name | state_transition | audit_log_required | success_ui / failure_ui | Missing or drift |
|---|---|---|---|---|---|---|---|
| SYS-002 | PRD `SYS-002`; detailed appendix `SYS-002`; DB side effect row for `SYS-002`. | Select demo data and initialize project, data package, default parties, and parameters. | 选择演示数据 | 草稿/无数据 -> 已接入 | Required | Project status/input snapshot shown; demo load failure shown. | OK, but current audit menu uses `NAV_SYS_HOME`. |
| SYS-004 | PRD `SYS-004`; detailed appendix `SYS-004`; DB side effect row for `SYS-004`. | Start complete calculation: quality, metering, utility, MD-DShap, allocation, snapshots, stop on failed node. | 继续计算：启动 MD-DShap 权重计算 | Source: 已接入 -> 已分配 through pipeline; runtime: 已计算效用 -> 已计算权重. | Required | Source requires full pipeline progress and failed node; runtime shows MDS-only progress/failure. | **Drift: not restored to 启动完整计算 in runtime registry/renderer.** |
| SYS-005 | PRD `SYS-005`; detailed appendix `SYS-005`. | Show risk/disclaimer and sensitive-data boundary. | 查看系统风险提示 | No state change. | Optional | Risk drawer/default text; parameter load failure uses default. | OK. |
| DATA-002 | PRD `DATA-002`; detailed appendix `DATA-002`. | Select built-in sample and create standard input snapshot. | 选择演示数据 | 无数据/草稿 -> 已接入 | Required | Data package appears; initialization failure displayed. | OK. |
| DATA-003 | PRD `DATA-003`; detailed appendix `DATA-003`; DB side effect row for `DATA-003`. | Upload and validate UTF-8 JSON input. | 上传 JSON 输入文件 | 无数据/草稿 -> 已接入 on success. | Required | Package/input snapshot generated; parse/field errors shown. | OK. |
| DATA-007 | PRD `DATA-007`; detailed appendix `DATA-007`. | Preview safe summary without sensitive raw data. | 数据预览 | No state change. | Optional | Preview table shown; missing package shown. | OK. |
| DATA-008 | PRD `DATA-008`; detailed appendix `DATA-008`. | View failed upload details by field/rule. | 上传失败详情查看 | No state change. | Required for failed upload record. | Failure detail shown; no failed record shown. | OK. |
| DATA-009 | PRD `DATA-009`; detailed appendix `DATA-009`. | Delete/disable package only when not referenced; otherwise copy new version. | 删除/停用数据包 | 已接入 -> withdrawn/disabled. | Required | Disable result/impact range; exported reference blocks. | OK, but overlay not schema-driven. |
| RES-002 | PRD `RES-002`; detailed appendix `RES-002`. | View resource metadata, fields, modality, provider relation. | 数据资源详情 | No state change. | Optional | Detail drawer; resource missing message. | OK. |
| RES-005 | PRD `RES-005`; detailed appendix `RES-005`; DB side effect row for `RES-005`. | Link resource to data-source party and split ratio. | 数据源主体关联 | 已接入 -> 可评估. | Required | Relation saved; invalid ratio/no provider error. | Partial: `可评估` absent from runtime statusMachine. |
| RES-007 | PRD `RES-007`; detailed appendix `RES-007`. | Export resource summary without sensitive raw data. | 数据资源导出 | No project state change. | Required | `report_id`/`checksum`; export failure log. | OK in docs; runtime not schema-enforced. |
| PARTY-002 | PRD `PARTY-002`; detailed appendix `PARTY-002`; DB group row `PARTY-002/003/005`. | Create party; data provider defaults into MD-DShap. | 新增参与方 | Party valid. | Required | Party created; duplicate/type errors. | OK. |
| PARTY-003 | PRD `PARTY-003`; detailed appendix `PARTY-003`; DB group row `PARTY-002/003/005`. | Edit party with history-reference protection. | 编辑参与方 | No project state change. | Required | Before/after saved; locked history blocks. | OK. |
| PARTY-005 | PRD `PARTY-005`; detailed appendix `PARTY-005`; DB group row `PARTY-002/003/005`. | Enable/disable party without rewriting history. | 启用/停用参与方 | valid <-> disabled. | Required | Status changed; sole data provider blocked. | OK, but overlay not schema-driven. |
| PARTY-006 | PRD `PARTY-006`; detailed appendix `PARTY-006`. | Link resource from party perspective. | 关联数据资源 | Can support 已接入 -> 可评估. | Required | Relation saved; invalid ratio. | Partial: `可评估` absent from runtime statusMachine. |
| PARTY-008 | PRD `PARTY-008`; detailed appendix `PARTY-008`. | View party contribution, utility, weight, allocation result. | 查看参与方贡献结果 | No state change. | Optional | Result detail; uncalculated empty state. | OK. |
| QUAL-002 | PRD `QUAL-002`; detailed appendix `QUAL-002`. | Configure quality metric weights. | 质量指标权重配置 | No project state change. | Required | Parameter version saved; invalid weights shown. | OK. |
| QUAL-003 | PRD `QUAL-003`; detailed appendix `QUAL-003`; DB side effect row for `QUAL-003`. | Run quality assessment. | 启动质量评估 | 可评估/已接入 -> 已评估. | Required | Assessment result/evidence; empty/invalid weight failure. | Partial: source has `可评估` gate; runtime statusMachine does not. |
| QUAL-006 | PRD `QUAL-006`; detailed appendix `QUAL-006`. | View secondary quality scores. | 查看二级指标得分 | No state change. | Optional | Score detail; no result shown. | OK. |
| QUAL-009 | PRD `QUAL-009`; detailed appendix `QUAL-009`. | Re-evaluate and create new assessment version. | 重新评估 | 已评估 -> 已评估 new version. | Required | New assessment ID; exported version requires copy. | OK, but overlay not schema-driven. |
| DU-002 | PRD `DU-002`; detailed appendix `DU-002`. | Configure base shuyuan price. | 基准数元配置 | No project state change. | Required | Parameter snapshot; zero/negative error. | OK. |
| DU-003 | PRD `DU-003`; detailed appendix `DU-003`. | Enter resource/modal call count. | 调用量录入 | No project state change. | Required | Call count saved; negative error. | OK. |
| DU-009 | PRD `DU-009`; detailed appendix `DU-009`; DB side effect row for `DU-009`. | Run shuyuan metering. | 执行数元计量 | 已评估 -> 已计量. | Required | Metering detail/version; missing assessment error. | OK. |
| DU-010 | PRD `DU-010`; detailed appendix `DU-010`. | View metering formula and details. | 查看数元计量明细 | No state change. | Optional | Detail view; no metering result. | OK. |
| UTIL-001 | PRD `UTIL-001`; detailed appendix `UTIL-001`. | Configure contribution factors. | 贡献因子配置 | No project state change. | Required | Parameter snapshot; invalid factor error. | OK. |
| UTIL-006 | PRD `UTIL-006`; detailed appendix `UTIL-006`; DB group row `UTIL-006/008`. | Calculate contribution and normalized contribution. | 贡献度计算 | No final status until utility calculation. | Required | Contribution record; zero total failure. | OK. |
| UTIL-007 | PRD `UTIL-007`; detailed appendix `UTIL-007`. | Configure utility function source/factors. | 效用函数配置 | No project state change. | Required | Utility function snapshot; invalid/source missing error. | OK. |
| UTIL-008 | PRD `UTIL-008`; detailed appendix `UTIL-008`; DB group row `UTIL-006/008`. | Calculate utility value and trace. | 效用值计算 | 已计量 -> 已计算效用. | Required | Utility record/trace; missing contribution/invalid factor. | OK. |
| UTIL-009 | PRD `UTIL-009`; detailed appendix `UTIL-009`. | View utility trace. | 查看效用计算过程 | No state change. | Optional | Trace drawer; no trace message. | OK. |
| MDS-011 | PRD 8.4.1 `MDS-011`; detailed appendix `MDS-011`; DB side effect row `MDS-011`. | Start MD-DShap calculation with default MD_DSHAP. | 启动 MD-DShap 计算 | 已计算效用 -> 已计算权重. | Required | Weights/trace/audit snapshot; precondition/normalization failures. | OK. |
| MDS-012 | PRD 8.4.2 `MDS-012`; detailed appendix `MDS-012`. | View algorithm task progress/failure reason. | 查看计算进度 | task running -> success/failed/cancelled. | Required for status changes; view optional. | Progress state; missing/failed task. | OK. |
| MDS-013 | PRD 8.4.3 `MDS-013`; detailed appendix `MDS-013`. | View marginal contribution detail. | 查看边际贡献明细 | No state change. | Optional; export required. | Trace table; no saved detail. | OK. |
| MDS-014 | PRD 8.4.4 `MDS-014`; detailed appendix `MDS-014`. | View participant weights. | 查看参与方权重 | No state change. | Optional | Weight table; missing/invalid weights. | OK. |
| MDS-015 | PRD 8.4.5 `MDS-015`; detailed appendix `MDS-015`. | View complexity and baseline explanation. | 查看复杂度优化说明 | No state change. | Optional | Complexity note; missing params use default. | OK. |
| MDS-016 | PRD 8.4.6 `MDS-016`; detailed appendix `MDS-016`. | Recalculate with new task; never overwrite old task/result. | 重新计算 | 已计算权重 -> 已计算权重 new version. | Required | New `task_id`/`result_id`; locked/exported requires copy. | OK, but overlay not schema-driven. |
| MDS-017 | PRD 8.4.7 `MDS-017`; detailed appendix `MDS-017`. | Export algorithm result JSON/CSV/Markdown. | 导出算法结果 | 已计算权重 -> 已导出. | Required | `report_id`/`checksum`; missing result/field failure. | OK in docs; runtime not schema-enforced. |
| MDS-018 | PRD 8.4.8 `MDS-018`; detailed appendix `MDS-018`. | Generate algorithm audit report. | 生成算法审计说明 | Can enter 已导出. | Required | Audit report; missing snapshot/failure. | OK in docs; runtime not schema-enforced. |
| ALLOC-003 | PRD `ALLOC-003`; detailed appendix `ALLOC-003`. | Configure total revenue. | 配置总收益 | No project state change. | Required | Revenue saved; negative/format error. | OK. |
| ALLOC-005 | Historical PRD `ALLOC-005`; superseded by contract-ratio split. | View/use saved contract-ratio plan for simulation context. | 查看合同比例方案 | No project state change. | Required | Missing plan returns `DVAS_CONTRACT_RATIO_REQUIRED`. | Updated. |
| ALLOC-007 | Historical PRD `ALLOC-007`; current runtime uses fixed contract-ratio + MD-DShap path. | Allocation mode is not a user-selected alternate final mode in the main path. | 分配模式说明 | No project state change. | Optional | Unsupported mode remains blocked. | Updated. |
| ALLOC-011 | Current backend project-level simulation path. | Run allocation simulation after saved contract-ratio plan and MD-DShap weights. | 执行收益分配模拟 | 已计算权重 -> 已分配. | Required | Allocation results; missing plan/invalid weights fail. | Updated. |
| ALLOC-013 | PRD `ALLOC-013`; detailed appendix `ALLOC-013`. | View scenario comparison. | 查看分配方案对比 | No state change. | Optional | Comparison shown; insufficient scenarios. | OK. |
| ALLOC-015 | PRD `ALLOC-015`; detailed appendix `ALLOC-015`; DB side effect row `ALLOC-015`. | Lock selected reference方案; not legal confirmation. | 锁定分配方案 | 已分配 -> 已确认. | Required | Confirmed/locked view; incomplete result blocked. | OK, but overlay not schema-driven. |
| ALLOC-016 | PRD `ALLOC-016`; detailed appendix `ALLOC-016`. | Export allocation result and source-level CSV. | 导出分配结果 | 已分配/已确认 -> 已导出. | Required | `report_id`/`checksum`; missing fields/snapshots. | OK in docs; runtime not schema-enforced. |
| CONS-002 | Current contract-ratio page action group. | Initialize or view contract-ratio configuration. | 查看合同比例方案 | No project state change. | Required | Missing plan displays blocked state. | Updated. |
| CONS-003 | Current contract-ratio save action. | Save total revenue, data-provider pool ratio, and non-data-party ratio items. | 保存合同比例方案 | Contract-ratio plan saved. | Required | Invalid revenue, duplicate party, data-provider submitted as non-data, or ratio sum != 1.000000 fails. | Updated. |
| CONS-004 | Current contract-ratio clear/delete action. | Clear saved contract-ratio plan with confirmation. | 清空合同比例方案 | Plan removed. | Required | Locked/exported state blocks destructive change. | Updated. |
| CONS-011 | Current contract-ratio validation/read action. | View ratio validation and can-simulate state. | 查看比例校验结果 | No project state change. | Optional | Shows backend blocker reason such as `DVAS_CONTRACT_RATIO_REQUIRED`. | Updated. |
| REP-001 | PRD `REP-001` and acceptance `RP-001`; detailed appendix `REP-001`. | Preview report with risk/disclaimer. | 报告预览 | No state change. | Optional | Preview shown; missing prerequisite shown. | OK. |
| REP-002 | PRD `REP-002` and acceptance `RP-002`; detailed appendix `REP-002`; DB export row. | Generate Markdown report. | 生成 Markdown 报告 | -> 已导出. | Required | `report_id`/`checksum`; generation failure. | OK in docs; runtime not schema-enforced. |
| REP-003 | PRD `REP-003` and acceptance `RP-003`; detailed appendix `REP-003`. | PDF report is P1, unavailable in P0. | 生成 PDF 报告（P1） | P1 only; no P0 state mutation. | P1 required if enabled. | P1 planned panel; P0 blocked. | OK. |
| REP-004 | PRD `REP-004` and acceptance `RP-004`; detailed appendix `REP-004`; DB export row. | Export CSV detail. | 导出 CSV 明细 | No state change or -> 已导出. | Required | `report_id`/`checksum`; field failure. | OK in docs; runtime not schema-enforced. |
| REP-005 | PRD `REP-005` and acceptance `RP-005`; detailed appendix `REP-005`; DB export row. | Export JSON result with snapshot refs. | 导出 JSON 结果 | No state change or -> 已导出. | Required | JSON snapshot refs; serialization/snapshot failure. | OK in docs; runtime not schema-enforced. |
| REP-006 | PRD `REP-006` and acceptance `RP-006`; detailed appendix `REP-006`. | Export algorithm audit explanation. | 导出算法审计说明 | No state change or -> 已导出. | Required | Audit report; missing algorithm snapshot. | OK in docs; runtime not schema-enforced. |
| REP-009 | PRD `REP-009` and acceptance `RP-007`; detailed appendix `REP-009`. | Export allocation confirmation statement with disclaimer. | 导出收益分配确认书 | -> 已导出. | Required | Confirmation statement; unlocked方案 blocked. | OK in docs; runtime not schema-enforced. |
| PARAM-001 | Detailed design `PARAM-001`; detailed appendix `PARAM-001`. | Maintain scenario coefficient defaults/ranges. | 场景系数配置 | Parameter versioned. | Required | Version saved; invalid coefficient. | OK, but not listed in PRD 7.12 row subset. |
| PARAM-002 | Detailed design `PARAM-002`; detailed appendix `PARAM-002`. | Maintain quality weight template. | 质量权重配置 | Parameter versioned. | Required | Template version saved; invalid weights. | OK, but not listed in PRD 7.12 row subset. |
| PARAM-004 | PRD `PARAM-004`; detailed appendix `PARAM-004`; DB side effect row `PARAM-004/008`. | Maintain MD-DShap defaults. | MD-DShap 参数配置 | Parameter versioned. | Required | Version saved; invalid epsilon/rounds. | OK. |
| PARAM-008 | PRD `PARAM-008`; detailed appendix `PARAM-008`; DB side effect row `PARAM-004/008`. | Maintain page/report risk disclaimer. | 风险提示文案配置 | Parameter versioned. | Required | Disclaimer saved; missing legal boundary blocks. | OK. |
| USER-001 | Detailed design `USER-001`; detailed appendix `USER-001`. | Query users by account/name/role/status in P1. | 用户查询 | P1 view only. | P1 optional/required by policy if enabled. | P1 planned panel; P0 blocked. | OK. |
| USER-002 | PRD `USER-002`; detailed appendix `USER-002`; DB side effect row `USER-002/009`. | Create account and assign role in P1. | 新增用户 | P1 user enabled. | P1 required. | P1 planned panel; P0 blocked. | OK. |
| USER-007 | Detailed design `USER-007`; detailed appendix `USER-007`. | Reset password in P1. | 重置密码 | P1 security flow. | P1 required. | P1 planned panel; P0 blocked. | OK. |
| USER-008 | PRD `USER-008` only in current baseline set; target docs schema row exists. | Role management: role name, menu permission, button permission, save role permission snapshot. | **Missing in `dvasData.json`; target docs call it role management.** | No project state change; P1 role/permission snapshot. | P1 required. | Should show P1 role drawer and conflict/failure UI. | **Missing in runtime registry and detailed appendix.** |
| USER-009 | PRD `USER-009`; detailed appendix `USER-009`; DB side effect row `USER-002/009`. | Configure role/menu/button permissions. | 权限配置 | No project state change; P1 permission config. | P1 required. | P1 planned panel; P0 blocked. | OK. |
| AUD-002 | PRD `AUD-002`; detailed appendix `AUD-002`; DB side effect row `AUD-002/006/007`. | Query calculation logs. | 计算日志查询 | No state change. | Optional for query; required for export/failure logs. | Log list; empty/failure query UI. | OK. |
| AUD-006 | PRD `AUD-006`; detailed appendix `AUD-006`; DB side effect row `AUD-002/006/007`. | View log details and snapshots. | 查看日志详情 | No state change. | Optional view; source snapshots required. | Snapshot detail; missing snapshot failure. | OK. |
| AUD-007 | PRD `AUD-007`; detailed appendix `AUD-007`; DB side effect row `AUD-002/006/007`. | Export audit log JSONL/Markdown by filter scope. | 导出审计日志 | No state change or -> 已导出. | Required | `report_id`/`checksum`; export failure. | OK in docs; runtime not schema-enforced. |

## 5. State Machine Alignment

| Chinese state | Canonical enum | Baseline support | Current schema coverage | Current renderer/runtime coverage | Drift |
|---|---|---|---|---|---|
| 草稿 | DRAFT | PRD 6.3; detailed 3.4; DB enum. | Yes. | Present in `statusMachine`; no real transition engine. | Partial runtime. |
| 已接入 | INGESTED | PRD 6.3; detailed 3.4; DB enum. | Yes. | Present in `statusMachine`; no real transition engine. | Partial runtime. |
| 可评估 | ASSESSABLE | Detailed module `RES` key state says 已接入 -> 可评估; DB button side effect says `RES-005` 已接入 -> 可评估. PRD 6.3 and DB enum do not list it. | Yes: `docs/ui_schema_design.md` requires `ASSESSABLE`. | Missing from `dvasData.json` `statusMachine`. | **Yes: must enter state machine as persisted or derived state.** |
| 已评估 | ASSESSED | PRD 6.3; detailed 3.4; DB enum. | Yes. | Present in `statusMachine`; no real transition engine. | Partial runtime. |
| 已计量 | METERED | PRD 6.3; detailed 3.4; DB enum. | Yes. | Present in `statusMachine`; no real transition engine. | Partial runtime. |
| 已计算效用 | UTILITY_CALCULATED | PRD 6.3; detailed 3.4; DB enum. | Yes. | Present and often hardcoded as current state. | Partial runtime; hardcoded. |
| 已计算权重 | WEIGHT_CALCULATED | PRD 6.3; detailed 3.4; DB enum. | Yes. | Present in `statusMachine`; `SYS-004` runtime advances here only. | Drift for `SYS-004`. |
| 已分配 | ALLOCATED | PRD 6.3; detailed 3.4; DB enum. | Yes. | Present in `statusMachine`; no real transition engine. | Partial runtime. |
| 已确认 | CONFIRMED | PRD 6.3; detailed 3.4; DB enum. | Yes. | Present in `statusMachine`; no real transition engine. | Partial runtime. |
| 已导出 | EXPORTED | PRD 6.3; detailed 3.4; DB enum. | Yes. | Present in `statusMachine`; no real transition engine. | Partial runtime. |

## 6. Explicit Inconsistency List

| Check item | Result | Evidence / required decision |
|---|---|---|
| `USER-008` 是否缺失 | **Yes, missing in current runtime registry.** | PRD defines `USER-008 角色管理`; `docs/ui_schema_design.md` adds it as P1 update; `ui_prototype/src/dvasData.json` has only `USER-001`, `USER-002`, `USER-007`, `USER-009`. |
| `SYS-004` 是否恢复为“启动完整计算” | **No, not in current runtime registry/renderer.** | PRD/detailed/DB define full pipeline to 已分配; `dvasData.json` label says “继续计算：启动 MD-DShap 权重计算”; `App.tsx` special modal targets 已计算权重. |
| 系统首页路由与菜单策略 | **Closed for current baseline.** | Current design uses one route `/dashboard`, one `menu_code=NAV_SYS_HOME`, and `children=[]`. The four home sections are not routes, menu rows, backend modules, or permission menu nodes. |
| `/metering` 与 `/measure` canonical route 策略 | **Canonical is `/metering/*`.** | Detailed design and DB baseline use `/metering/quality`, `/metering/shuyuan`, `/metering/utility`. `/measure/*` appears only in project navigation docs as compatibility aliases. Current schema/prototype use `/metering/*`, which is correct; implementation should keep `/measure/*` aliases only if route compatibility is opened. |
| `ASSESSABLE` 是否进入 state machine | **Docs yes; runtime no.** | Target schema includes `ASSESSABLE`; baseline detailed/DB side effects support 可评估; current `dvasData.json` statusMachine omits it. |
| modal/drawer 是否全部 schema 化 | **Docs target yes; runtime no.** | `docs/ui_schema_design.md` defines overlay variants and required coverage. `App.tsx` still uses repeated modal/drawer markup, hardcoded `ActionOverlay`, and generic `ModuleActionDialog`. |
| `report_id` / `checksum` / export confirmation 是否 schema 化 | **Docs target yes; runtime no.** | Baseline requires every export to generate `report_id` and `checksum`. Target docs include export confirmation modal requirements. Current runtime displays some values but does not enforce them through a schema/action dispatcher. |
| 14-page schema vs DB nav rows | **Closed for current baseline.** | System home is one nav row and one `SYS_HOME` page; its four internal sections do not create extra DB nav rows. |
| Action types | **Partial.** | Baseline DB action enum is `VIEW`, `CREATE`, `UPDATE`, `DELETE_DISABLE`, `CALCULATE`, `EXPORT`, `CONFIRM`. Current runtime uses `highRisk` and `p1` as `kind`; target docs correctly require those to become risk/phase fields, not action types. |
| Renderer coverage | **Not complete.** | Visual routes exist, but `App.tsx` manually routes by `window.location.pathname`, branches per page, and does not render all pages/actions/overlays from schema. |

## 7. Required Decisions Before Claiming Full Completion

1. Keep the baseline source order: PRD V1.3, detailed design V1.1, database/ER
   V1.0.
2. Treat `SYS_HOME` / `/dashboard` as the only current system-home navigation
   contract: `NAV_SYS_HOME`, `SYS`, and `children=[]`.
3. Keep `/metering/*` canonical; document `/measure/*` only as compatibility
   aliases if implementation later adds alias routing.
4. Add `USER-008` to the runtime action registry when implementation scope is
   opened.
5. Restore `SYS-004` runtime semantics to “启动完整计算” or introduce a new
   separate continue-current-step action without reusing `SYS-004`.
6. Add `ASSESSABLE` as a persisted or derived state in the runtime state
   machine.
7. Implement real schema files and schema validation before claiming the schema
   is executable.
8. Replace handwritten modal/drawer/action handling with schema-defined overlay
   and action dispatch before claiming renderer completion.
9. Enforce export confirmation fields, `report_id`, `checksum`, field scope,
   no-overwrite behavior, and disclaimer through schema validation.

## 8. Final Verdict

**PARTIAL**: documentation-level schema and renderer design now trace back to
the three baseline files, and this traceability file records the exact remaining
gaps. Current schema design is not yet a runtime `system.ui.schema.json`, and
current renderer is not yet schema-driven. Therefore the correct status is not
PASS.

PASS requires all of the following:

- runtime schema generated or authored from the three baseline files;
- all 14 target page IDs and all required actions, including `USER-008`,
  validated by a schema checker;
- `SYS-004` restored to full complete-chain semantics;
- `ASSESSABLE` represented in the runtime state machine;
- modals/drawers/export confirmations generated from schema;
- `report_id`, `checksum`, field scope, disclaimer, and audit payload enforced
  for export actions;
- renderer dispatching routes, components, actions, and state transitions from
  schema rather than hardcoded page logic.

## 9. Phase 2 Runtime Landing Result

Date: 2026-06-17

Scope: runtime UI schema / renderer foundation only. This addendum does not
change algorithms, database scripts, report core logic, dependencies, lock
files, screenshots, or Vite audit state.

Phase 2 converted the recorded PARTIAL drift into the following runtime
foundation artifacts under `ui_prototype/src/`:

- `ui-schema/ui.schema.types.ts`
- `ui-schema/system.ui.schema.ts`
- `ui-schema/action.registry.ts`
- `ui-schema/component.registry.ts`
- `ui-schema/state.machine.ts`
- `ui-schema/data.binding.registry.ts`
- `ui-schema/validateUiSchema.ts`
- `routes/schemaRoutes.ts`
- `ui-renderer/SchemaApp.tsx`
- `ui-renderer/SchemaPage.tsx`
- `ui-renderer/SchemaLayout.tsx`
- `ui-renderer/SchemaComponentRenderer.tsx`
- `ui-renderer/SchemaActionBar.tsx`
- `ui-renderer/SchemaModalHost.tsx`
- `ui-renderer/SchemaDrawerHost.tsx`
- `ui-renderer/components/*`
- `design-system/tokens.ts`
- `design-system/layout.ts`

Runtime drift closure:

| Drift item | Phase 2 runtime status |
|---|---|
| `USER-008` missing | Closed at foundation level. `USER-008 = 角色管理` exists in `action.registry.ts`, belongs to `USER_PERMISSION_P1`, has P1 disabled-in-P0 behavior, validation rules, handler placeholder, and `USER` role-management drawer schema. |
| `SYS-004` narrowed to MD-DShap only | Closed at foundation level. `SYS-004 = 启动完整计算` now maps to full-pipeline semantics: quality assessment, shuyuan metering, contribution/utility, MD-DShap, and allocation. |
| `ASSESSABLE` missing | Closed at foundation level. Runtime state machine includes `ASSESSABLE / 可评估` and derived rule: `INGESTED + 已完成有效数据源主体关联 => ASSESSABLE`. |
| 系统首页 route/menu drift | Closed at foundation level. System home uses only `/dashboard` and `NAV_SYS_HOME`; internal sections do not preserve separate menu-code mapping. |
| `/metering` vs `/measure` | Closed at foundation level. `/metering/*` is canonical; `/measure/*` and legacy short paths are compatibility aliases. |
| modal/drawer not schema-driven | Closed at foundation level for required overlays. `component.registry.ts` defines schema overlays with `open_by_action`; renderer hosts open modal/drawer from schema records instead of an action-id switch. |
| export confirmation missing | Closed at foundation level. All required export actions define `export_confirmation` with `export_type`, `field_scope`, `version_no`, disclaimer, `report_id` rule, `checksum` rule, success/failure UI, and `audit_log_required=true`. |
| `App.tsx` hardcoded main path | Closed at foundation level. `App.tsx` now renders `<SchemaApp schema={systemUiSchema} />`. |

Validation evidence:

```bash
cd ui_prototype && ./node_modules/.bin/tsc --noEmit
cd ui_prototype && npm run validate:ui-schema
```

Both commands passed in Phase 2.

Remaining limits:

- Renderer widgets are foundation-level generic schema renderers, not final
  page-polished production components.
- Screenshots, browser visual QA, Vite audit remediation, algorithm behavior,
  database scripts, and report core generation were intentionally out of scope.
- `dvasData.json` remains as historical prototype metadata and is no longer the
  main runtime schema path.
