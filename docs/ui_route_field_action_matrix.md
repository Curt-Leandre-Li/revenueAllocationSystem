# UI Route Field Action Matrix

This matrix binds UI routes to navigation codes, database objects, user-facing
fields, technical detail fields, button numbers, permissions, and intended side
effects. It is a documentation contract only. It does not implement handlers or
modify runtime files.

Technical detail fields must be hidden from normal page bodies and shown only
in audit drawers, export dialogs, log details, or explicit technical detail
panels.

## 1. Route, Field, And Action Matrix

| route_path | menu_code | module_code | Page | Main tables | Main table fields | Technical detail fields | Buttons | Permissions | Button side effects |
|---|---|---|---|---|---|---|---|---|---|
| `/dashboard` | `NAV_SYS_HOME` | `SYS` | 系统首页 | `allocation_project`, `audit_log`, `snapshot_store`, `report_record`, `system_parameter` | project_name, scenario_name, status, current_package, workflow_step, risk_notice, precondition_name, pipeline_stage, recent_report_type, recent_report_time | project_id, current_package_id, current_algorithm_task_id, current_allocation_id, input_snapshot_id, parameter_snapshot_id, output_snapshot_id, report_id, log_id, checksum, menu_code, module_code | `SYS-002`, `SYS-004`, `SYS-005`, `DATA-003`, `REP-001` | VIEW, CREATE, CALCULATE, EXPORT | System home is one first-level page. Project overview, process entry, risk notice, and one-click calculation are internal sections only; they do not enter `nav_menu`, route mapping, or permission menu nodes. |
| `/data/ingestion` | `NAV_DATA_PACKAGE` | `DATA` | 数据接入管理 | `data_package`, `input_snapshot`, `upload_validation_result` | package_name, source_type, file_name, validation_status, access_status, resource_count, party_count, created_at, error_field, repair_suggestion | package_id, input_snapshot_id, validation_result_id, checksum, detail_json, operator, menu_code, module_code | `DATA-002`, `DATA-003`, `DATA-007`, `DATA-008`, `DATA-009` | CREATE, VIEW, DELETE_DISABLE | Select demo/upload JSON creates package, input snapshot, validation result; preview reads safe summary; failure detail reads validation result; delete/disable writes audit. |
| `/data/resources` | `NAV_DATA_RESOURCE` | `RES` | 数据资源管理 | `data_resource`, `data_resource_field`, `data_resource_party_relation` | resource_name, modality, field_count, sample_count, missing_rate, sensitive_field_count, provider_party, split_ratio, include_in_calculation, status | resource_id, field_id, relation_id, package_id, project_id, checksum, is_primary_provider, menu_code, module_code | `RES-002`, `RES-005`, `RES-007` | VIEW, UPDATE, EXPORT | Detail reads resource/field stats; provider binding writes resource-party relation; export creates report/export records for resource summary. |
| `/data/parties` | `NAV_DATA_PARTY` | `PARTY` | 参与方管理 | `party`, `data_resource_party_relation` | party_name, party_type, is_data_provider, include_in_md_dshap, linked_resource_count, status, contribution_summary | party_id, project_id, relation_id, role_snapshot, before_value, after_value, menu_code, module_code | `PARTY-002`, `PARTY-003`, `PARTY-005`, `PARTY-006`, `PARTY-008` | CREATE, UPDATE, DELETE_DISABLE, VIEW | Create/edit writes party; disable changes party status; bind resource writes relation; contribution view reads contribution/utility/weight summaries. |
| `/metering/quality` | `NAV_MEASURE_QUALITY` | `QUAL` | 质量评估管理 | `quality_assessment`, `quality_score_detail`, `parameter_version` | metric_name, metric_weight, score, total_score, quality_level, quality_factor, evidence_summary, low_quality_warning | assessment_id, detail_id, metric_version, parameter_snapshot_id, input_snapshot_id, output_snapshot_id, algorithm_version | `QUAL-002`, `QUAL-003`, `QUAL-006`, `QUAL-009` | UPDATE, CALCULATE, VIEW | Save weights creates parameter version; assessment writes quality result/detail and snapshots; rerun creates new assessment version; detail is read-only. |
| `/metering/shuyuan` | `NAV_MEASURE_SHUYUAN` | `DU` | 数元计量管理 | `shuyuan_metering`, `shuyuan_metering_detail` | base_shuyuan_price, scenario_coefficient, quality_coefficient, technology_coefficient, expert_coefficient, development_coefficient, call_count, metering_amount | metering_id, detail_id, assessment_id, parameter_snapshot_id, output_snapshot_id, checksum | `DU-002`, `DU-003`, `DU-009`, `DU-010` | UPDATE, CALCULATE, VIEW | Save base price/call count writes parameter inputs; metering writes metering/detail and snapshots; detail reads formula/version. |
| `/metering/utility` | `NAV_MEASURE_UTILITY` | `UTIL` | 贡献度与效用计算 | `contribution_record`, `utility_function_snapshot`, `utility_record`, `utility_trace` | party_name, valid_units, usage_weight, coverage_weight, scarcity_weight, contribution_score, normalized_contribution, quality_factor, usage_factor, scenario_factor, utility_value | contribution_id, utility_id, utility_function_snapshot_id, trace_id, formula_text, input_json, output_json, task_key | `UTIL-001`, `UTIL-006`, `UTIL-007`, `UTIL-008`, `UTIL-009` | UPDATE, CALCULATE, VIEW | Save factors writes parameter snapshot; contribution/utility calculation writes records and trace; trace view is read-only. |
| `/allocation/md-dshap` | `NAV_ALLOC_MDS` | `MDS` | MD-DShap 计算管理 | `md_dshap_task`, `md_dshap_result`, `md_dshap_marginal_trace`, `algorithm_audit_snapshot` | algorithm_mode, participant_set, task_set, sample_rounds, epsilon, task_status, party_name, participant_weight, normalized_weight, marginal_contribution | task_id, result_id, trace_id, algorithm_version, seed, baseline_weight, weight_diff, input_snapshot_json, parameter_snapshot_json, output_snapshot_json | `PARAM-004`, `MDS-011`, `MDS-012`, `MDS-013`, `MDS-014`, `MDS-015`, `MDS-016`, `MDS-017`, `MDS-018` | CALCULATE, VIEW, EXPORT, UPDATE | Configure algorithm defaults; start task writes task/result/trace/audit snapshot; rerun creates new task/result; exports create report/export records. |
| `/allocation/simulation` | `NAV_ALLOC_SIMULATION` | `ALLOC` | 收益分配模拟 | `allocation_scenario`, `allocation_result`; runtime `contract_ratio_plan`, `contract_ratio_item` | total_revenue, data_provider_pool_ratio, non_data_contract_amount, data_provider_revenue_pool, amount_source, party_name, raw_weight, normalized_weight, contract_ratio, base_pool_amount, final_amount, scenario_status | allocation_id, result_id, contract_ratio_plan_id, weight_task_id, source_snapshot_id, checksum, rounding_note | `ALLOC-011`, `ALLOC-013`, `ALLOC-014`, `ALLOC-015`, `ALLOC-016` | CALCULATE, CONFIRM, EXPORT, VIEW | Execute simulation requires a saved valid contract-ratio plan and latest MD-DShap weights; it writes allocation scenario/results, output snapshot, and audit log. It does not create a default plan or normal constraint apply trace. |
| `/allocation/constraints` | `NAV_ALLOC_CONSTRAINT` | `CONS` | 合同分配规则 | runtime `contract_ratio_plan`, `contract_ratio_item`; SQL `contract_constraint`, `constraint_apply_trace` only as legacy compatibility | total_revenue, data_provider_pool_ratio, data_provider_revenue_pool, non_data_party, ratio, calculated_amount, amount_source, ratio_sum, can_simulate | plan_id, item_id, project_id, party_id, snapshot_id, before_value, after_value, menu_code, module_code | `CONS-002`, `CONS-003`, `CONS-004`, `CONS-011` | CREATE, UPDATE, DELETE_DISABLE, VIEW | Save/delete contract-ratio plan writes runtime ratio objects, snapshots, and audit records; validation blocks duplicate parties, data-provider-as-non-data rows, invalid revenue, or ratio sum not equal to 1.000000. |
| `/reports` | `NAV_REPORT_EXPORT` | `REP` | 报告生成与导出 | `report_record`, `export_file`, `snapshot_store`, runtime `report_manifest` | report_type, report_status, file_name, file_type, field_scope, generated_at, created_by, download_status, p1_pdf_status | report_id, file_id, source_snapshot_id, file_path, checksum, field_scope_json, content_hash, manifest_id | `REP-001`, `REP-002`, `REP-003`, `REP-004`, `REP-005`, `REP-006`, `REP-009` | VIEW, EXPORT | Preview reads current report/allocation snapshots; Markdown/CSV/JSON/JSONL write report/export/checksum; PDF is a P1 local endpoint; algorithm audit export uses backend `REP-006` permission with `REP-012` as a compatibility alias. |
| `/system/parameters` | `NAV_SYSTEM_PARAMETER` | `PARAM` | 参数配置 | `system_parameter`, `parameter_version` | parameter_group, parameter_name, parameter_value, effective_status, version_no, updated_by, updated_at, risk_disclaimer_text | parameter_id, parameter_version_id, before_value, after_value, checksum, menu_code, module_code | `PARAM-001`, `PARAM-002`, `PARAM-004`, `PARAM-008` | VIEW, UPDATE | Saves parameter versions for scenario factors, quality weights, MD-DShap defaults, and risk copy; writes audit before/after. |
| `/system/users` | `NAV_SYSTEM_USER` | `USER` | 用户与权限管理（P1） | `user_account`, `role`, `permission`, `user_role`, `role_permission` | username, display_name, role_name, menu_permission, button_permission, account_status, p1_boundary | user_id, role_id, permission_id, permission_code, button_code, password_reset_token | `USER-001`, `USER-002`, `USER-003`, `USER-004`, `USER-005`, `USER-007`, `USER-008`, `USER-009`, `USER-010`, `USER-011` | CREATE, UPDATE, VIEW | Local P1 backend supports user/session/role/permission operations with audit and guardrails. This remains outside P0 and does not claim production-grade auth/RBAC. |
| `/system/audit` | `NAV_SYSTEM_AUDIT` | `AUD` | 审计日志管理 | `audit_log`, `snapshot_store`, `report_record` | operation_type, object_type, operator_id, module_code_display, menu_code_display, status, failure_reason, created_at, report_type | log_id, object_id, before_value, after_value, input_snapshot_id, parameter_snapshot_id, output_snapshot_id, report_id, checksum | `AUD-002`, `AUD-006`, `AUD-007` | VIEW, EXPORT | Query/filter reads audit logs; detail reads snapshots; export writes audit export report/export records and logs export action. |

## 2. Cross-Page Field Rules

- Main table fields use business labels and should be understandable without
  reading database names.
- Technical detail fields must be available for auditability but hidden from the
  default workspace.
- Weight fields display 6 decimal places.
- Amount fields display 2 decimal places.
- Export dialogs must show the exact field scope before export.
- Any page that displays `report_id` or `checksum` must explain that exports are
  versioned and must not silently overwrite history.
- Any page that references `algorithm_mode` must show `MD_DSHAP` as default and
  Basic Shapley only as `baseline_check`.

## 3. Button Permission Rules

| Permission | Applies to | P0 handling |
|---|---|---|
| VIEW | Read pages, previews, trace, logs | Enabled for local operator unless page is P1-only. |
| CREATE | Demo data, upload, party, contract-ratio plan | Enabled when project is not locked/exported and preconditions pass. |
| UPDATE | Parameters, resource binding, parties, allocation inputs | Disabled after confirmed/exported state unless copy-new-version flow is used. |
| DELETE_DISABLE | Disable package, party, constraint | Requires confirmation and impact explanation. Prefer logical disable over physical deletion. |
| CALCULATE | Quality, metering, utility, MD-DShap, allocation, full run | Requires precondition card and snapshot/audit side effects. |
| CONFIRM | Lock allocation scenario | Requires explicit simulation-reference confirmation. |
| EXPORT | Reports, CSV, JSON, JSONL, audit logs | Requires export dialog, field scope, disclaimer, `report_id`, and `checksum`. |

## 4. State And Side-Effect Rules

- `DRAFT -> INGESTED`: demo data or valid JSON upload creates `data_package` and
  `input_snapshot`.
- `INGESTED -> ASSESSED`: quality assessment writes assessment, details, and
  snapshots.
- `ASSESSED -> METERED`: metering writes metering and detail records.
- `METERED -> UTILITY_CALCULATED`: contribution and utility writes records and
  trace.
- `UTILITY_CALCULATED -> WEIGHT_CALCULATED`: MD-DShap writes task, result,
  marginal trace, and algorithm audit snapshot.
- `WEIGHT_CALCULATED -> ALLOCATED`: allocation simulation reads a saved
  contract-ratio plan, writes allocation scenario/results, snapshots, and audit
  log. Missing contract-ratio plan fails with `DVAS_CONTRACT_RATIO_REQUIRED`.
- `ALLOCATED -> CONFIRMED`: lock action updates scenario status and audit log.
- `ALLOCATED/CONFIRMED -> EXPORTED`: export writes report record, export file,
  checksum, and audit log.

## 5. Deprecated Route Notes

Deprecated routes may be mentioned only in migration records. Current design
uses `/dashboard` for system home and does not expose system-home secondary
routes or menu nodes.

| Old route | New canonical route |
|---|---|
| system-home historical split routes | `/dashboard` |
| `/data/packages` | `/data/ingestion` |
| `/quality` | `/metering/quality` |
| `/shuyuan` | `/metering/shuyuan` |
| `/utility` | `/metering/utility` |
| `/md-dshap` | `/allocation/md-dshap` |
| `/allocation` | `/allocation/simulation` |
| `/constraints` | `/allocation/constraints` |
| `/parameters` | `/system/parameters` |
| `/users` | `/system/users` |
| `/audit` | `/system/audit` |
