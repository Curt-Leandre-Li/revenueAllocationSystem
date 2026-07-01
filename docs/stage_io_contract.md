# Stage Input/Output Contract

This document freezes the stage-level data contract for the DVAS P0 local
simulation chain. It is the reference checklist for backend service logic,
frontend API calls, page field display, and integration validation.

System outputs are simulation references only. They are not legal settlement,
statutory settlement, payment instructions, contract performance, asset
valuation reports, formal audit reports, or authority approvals.

## Authority

Use this contract after the product baseline documents and before reading
runtime implementation details:

1. `AGENTS.md`
2. `数据收益分配系统_V1.4_需求规格说明书_增加后端逐资源质量评估.md`
3. `数据收益分配系统_系统详细功能设计_V1.2_增加后端逐资源质量评估.md`
4. `数据收益分配系统_数据库设计与ER关系图_V1.1_增加后端逐资源质量评估.md`
5. `docs/api_and_data_contract.md`
6. `docs/reporting_contract.md`

If this contract and code disagree, first identify the logic breakpoint. Do not
paper over missing backend behavior with frontend mock success.

## Shared Calculation Envelope

Every stage that calculates or exports a result should preserve the following
metadata:

| Field | Required | Meaning |
| --- | --- | --- |
| `project_id` | Yes | Project scope. |
| `input_snapshot_id` | Calculation stages | Input snapshot used by the stage. |
| `parameter_snapshot_id` | Calculation stages | Parameter snapshot used by the stage. |
| `requested_by` | Yes | P0 uses `local_operator`. |
| `run_mode` | Calculation stages | `manual`, `full_pipeline`, or `rerun`. |
| `status` | Yes | `SUCCESS`, `FAILED`, or explicit partial status. |
| `failure_reason` | On failure | Structured reason, not a partial success illusion. |
| `result_id` / `task_id` | On success | New identifier per calculation or rerun. |
| `output_snapshot_id` | Calculation/export stages | Output snapshot used by reports and audit. |
| `trace_ref` | Traceable stages | Link to trace rows or audit details. |
| `simulation_disclaimer` | User-facing outputs | Non-legal, simulation-reference disclaimer. |

## Stage Contracts

| # | Stage | Preconditions | Inputs | Backend output contract | Frontend display contract | Downstream consumers |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Project/demo selection | None for demo; project exists for manual flow. | `project_id` or demo case id, `requested_by`, optional project metadata. | Active project context, demo package candidate or empty project state, `input_snapshot_id` when demo initializes. | 首页 must show project overview, flow entry, risk notice, and one-click calculation entry on `/dashboard`. | Data package initialization, audit. |
| 2 | Data package upload/initialization | JSON input or demo data selected. | `package_name`, `file_name`, `resources[]`, `parties[]`, provider binding fields. | `DataPackage`, `InputSnapshot`, validation result, parsed `DataResource[]`, parsed `Party[]`, structured error envelope with `code`, `message`, `trace_id`, `field_errors`. | 数据接入管理 shows validation status, failure detail, parsed resources/parties, and no success state on invalid upload. | Resource management, party management, quality assessment. |
| 3 | Resource recognition and provider binding | Valid data package exists. | `package_id`, resources with `resource_id`, `resource_name`, `modality`, `field_count`, `sample_count`, `include_in_calculation`, provider party relation. | Active resource list, resource fields/basic stats, `data_resource_party_relation`, provider binding status. | 数据资源管理 shows resource list, modality, stats, provider binding, active/inactive state, and missing binding risks. | Quality assessment, shuyuan metering, contribution/utility. |
| 4 | Party confirmation | Parsed or manually maintained parties exist. | `party_id`, `party_name`, `party_type`, `is_data_provider`, `include_in_md_dshap`, status. | Confirmed `Party[]`; data providers separated from non-data parties. | 参与方管理 shows data-source parties separately from operators, pilot bases, service providers, experts, and contract parties. | MD-DShap participant set, contract ratio plan, allocation result. |
| 5 | Quality assessment | Package is ingested; valid resources exist; quality weights are valid. | `package_id`, optional `resource_ids`, metric version, 7 first-level and 17 second-level weights, `resource_weight_strategy`, `requested_by`. | `QualityAssessment` package result with `assessment_id`, `quality_score`/`package_score`, `quality_level`/`package_level`, `quality_factor`, `dimension_scores`, `quality_score_detail`, `evidence_summary`; resource results with `resource_quality_assessments[]`, `resource_score`, `resource_level`, `resource_quality_factor`, `details`, `heatmap`; status may be `PARTIAL_SUCCESS` only with explicit failed resources. | 质量评估页面 only displays backend scores. It must not recalculate package or resource scores. It shows package score, average resource score, low-score resource count, 7 dimensions, 17 indicator details, evidence, failure details, and clear display range when summarizing resources. | Shuyuan metering reads resource quality factor first and package quality factor as fallback; utility and MD-DShap audit read quality provenance; reports export quality details. |
| 6 | Shuyuan metering | Quality assessment completed or selected version available. | `quality_assessment_id`, `resource_id`, `base_shuyuan_price`, `scenario_factor`, `quality_factor`, `tech_factor`, `expert_factor`, `development_factor`, `call_count`. | Resource-level, party-level, and project-level metering results; each detail exposes formula factors, amount, version, `parameter_snapshot_id`, `result_id`, and `output_snapshot_id`. | 数元计量管理 shows resource details, party aggregation, formula expansion, factor source, amount precision, and parameter snapshot. | Contribution/utility, reports, audit. |
| 7 | Contribution calculation | Parties/resources exist; metering or contribution factors are available. | `party_id`, `valid_units`, `usage_weight`, `coverage_weight`, `scarcity_weight`. | `ContributionRecord[]` with `contribution_score`, `normalized_contribution`, total contribution, zero-total failure when applicable. | 贡献度与效用计算 shows raw contribution and normalized contribution, and blocks normalization when total contribution is zero. | Utility calculation, MD-DShap audit. |
| 8 | Utility calculation | Contribution is normalized; quality/scenario factors are valid. | `party_id`, `normalized_contribution`, `quality_factor`, `usage_factor`, `scenario_factor`, `utility_source`, utility parameters. | `UtilityRecord[]` with `utility_value`, formula inputs, `UtilityFunctionSnapshot`, trace rows, and `result_id`. | 贡献度与效用计算 shows utility value, formula expansion, factor provenance, and trace. | MD-DShap `v(S,t)` input, report and audit. |
| 9 | Contract ratio configuration | Project exists; total revenue is known or supplied; non-data parties may exist. This configuration does not depend on MD-DShap and may be saved before or after Stage 10. | `total_revenue`, `currency`, `data_provider_pool_ratio`, `items[]` with `bucket_type=NON_DATA_PARTY`, `party_id`, `ratio`, `basis_text`. | `contract_ratio_plan`, `contract_ratio_items`, `ratio_sum`, `data_provider_revenue_pool`, `non_data_contract_amount`; failure if ratio sum is not `1.000000`, a data provider is submitted as a non-data party, or a party is duplicated. | 合同分配规则 shows data-provider pool ratio, non-data party ratio rows, backend-calculated amount, amount source, can-simulate state, and no fallback/mock amount. | Allocation simulation, reports, audit. |
| 10 | MD-DShap weight calculation | Utility exists; at least one data provider exists. | `participant_set` where `include_in_md_dshap=true`, task set, `v(S,t)` source, quality/contribution/scenario inputs, `random_seed`, `sample_rounds`, `epsilon`, algorithm mode. | `MDDShapTask`, `MDDShapResult`, normalized `participant_weight` sum = 1 with 6 decimal display precision, task-level weights, marginal contribution trace, approximation note, algorithm audit snapshot; single data-provider case returns weight 1 with simplified-allocation disclosure. | MD-DShap 页面 shows algorithm mode, participant set, utility source, task/progress, weights, trace, approximation note, audit snapshot, and reference-only warning. It must not use Basic Shapley as default final mode. | Allocation simulation consumes weights; reports/audit consume traces and snapshots. |
| 11 | Allocation simulation with contract ratio | Saved contract ratio plan is valid; latest successful MD-DShap weights valid. | `contract_ratio_plan`, `contract_ratio_items`, `data_provider_revenue_pool`, latest successful MD-DShap normalized participant weights, rounding strategy. | `AllocationResult` with summary, `contract_ratio_plan`, `contract_ratio_items`, `data_provider_allocations`, `amount_source`, `contract_ratio`, `base_pool_amount`, `final_amount`, tail-difference handling, `result_id`, `output_snapshot_id`; hard formulas: `contract_ratio_sum = 1.000000`, `data_provider_revenue_pool = total_revenue × data_provider_pool_ratio`, `non_data_contract_amount_j = total_revenue × ratio_j`, `data_provider_amount_i = data_provider_revenue_pool × md_dshap_normalized_weight_i`, `final_amount_all_parties_sum = total_revenue`. | 收益分配模拟 and 合同分配规则 show contract-ratio split, data-provider pool, amount source, total reconciliation, and reference-only disclaimer. The P0 contract-ratio path does not display old constraint hit/miss or `constraint_apply_trace`. | Locking, reports, audit. |
| 12 | Lock/copy version | Allocation result exists. | `allocation_result_id`, operator confirmation, optional lock reason or rerun reason. | Locked allocation version or copied project/version with new ids for recalculation. History is not overwritten. | Page disables direct edits on locked scheme and offers copy-new-version flow. | Report export, audit. |
| 13 | Report/export | Stage result exists for selected report; export format allowed in P0. | Report type, selected chapters/fields, source result ids, operator, export format. | `ReportRecord`, `ExportFile[]`, `report_id`, checksum per file, manifest, source snapshot references, Markdown/CSV/JSON/JSONL files; no silent overwrite. PDF is P1. | 报告生成与导出 shows preview without recalculation, export scope, `report_id`, checksum, source result ids, and disclaimer. | Audit log, downloaded deliverables. |
| 14 | Audit/query | Any auditable operation occurred. | Filters such as project, module, menu, operator, object id, status, time range; snapshot id for detail. | `AuditLog[]`, snapshot detail, JSONL export; records include input/parameter/output snapshots, algorithm version, trace, `menu_code`, `module_code`, operator, status, failure reason, checksum where applicable. | 审计日志管理 shows log table, details, snapshot references, status/failure reason, and export checksum. | Compliance review and report appendices. |

### Stage 9/10 Ordering Note

Revenue-pool and contract-ratio configuration does not depend on MD-DShap.
Operators may configure total revenue and the contract ratio plan before or
after Stage 10. Stage 11 allocation simulation is the first stage that must
read all of the following together:

- `total_revenue`
- `contract_ratio_plan`
- `contract_ratio_items`
- `data_provider_revenue_pool`
- latest successful MD-DShap weights

## One-Click Full Pipeline Contract

The one-click action on the system home page must call the same backend stage
logic in order. It may orchestrate the full chain, but it must not compute stage
outputs in the frontend.

Required order:

```text
demo/project initialization
-> input snapshot
-> resource and party confirmation
-> quality assessment
-> shuyuan metering
-> contribution calculation
-> utility calculation
-> contract ratio configuration
-> MD-DShap weight calculation
-> allocation simulation with contract ratio
-> report/audit readiness
```

On any failed precondition or failed stage, it must stop at that stage and return
a structured failure with `code`, `message`, `trace_id`, and stage context.

## Logic Breakpoint Checklist

Use this checklist when反查代码:

1. Does the backend expose or compute every stage output listed above?
2. Does each downstream backend stage read the prior stage result instead of
   recomputing or using constants?
3. Does every rerun create new ids/snapshots instead of overwriting history?
4. Do frontend services call backend endpoints for calculable results instead
   of calculating scores, weights, or allocation amounts in page code?
5. Do DTO mappers preserve backend field names and provenance fields such as
   snapshot ids, trace refs, checksums, and failure reasons?
6. Do pages display unavailable backend capabilities honestly instead of mock
   success?
7. Does integration validation cover the sequence from upload/demo through
   report/audit outputs?
