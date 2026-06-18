# API And Data Contract Input

This document is a V1.2 interface-contract input for future implementation. It
does not claim that API endpoints or schemas are implemented.

## Contract Principles

- Use stable string IDs for project, package, resource, party, task, result,
  allocation, report, and snapshot objects.
- P0 accepts demo data or JSON upload.
- P0 records `local_operator` as operator.
- All outputs must include simulation-reference and non-legal-settlement
  boundary copy when user-facing.
- Calculation APIs or local service functions must return structured failures
  without partial misleading allocation output.
- Recalculation creates new versions instead of overwriting historical records.

## Core Objects

- `AllocationProject`
- `DataPackage`
- `InputSnapshot`
- `DataResource`
- `Party`
- `QualityAssessment`
- `ShuyuanMetering`
- `ContributionRecord`
- `UtilityRecord`
- `MDDShapTask`
- `MDDShapResult`
- `ContractConstraint`
- `AllocationScenario`
- `AllocationResult`
- `ReportRecord`
- `ExportFile`
- `AuditLog`
- `SnapshotStore`
- `SystemParameter`

## Service Method Input

| Service | Future method examples |
| --- | --- |
| DataIngestionService | `select_demo_case`, `upload_json`, `validate_input`, `preview_package` |
| ResourceService | `list_resources`, `bind_party`, `export_resource_summary` |
| PartyService | `create_party`, `update_party`, `set_status`, `bind_resource` |
| QualityService | `save_weights`, `evaluate`, `reevaluate`, `get_score_detail` |
| ShuyuanService | `save_metering_params`, `calculate`, `get_detail` |
| UtilityService | `calculate_contribution`, `configure_utility`, `calculate_utility`, `get_trace` |
| MDDShapService | `start_task`, `get_progress`, `get_marginal_trace`, `get_weights`, `rerun`, `export_audit` |
| AllocationService | `save_revenue_pool`, `save_priority_items`, `simulate`, `lock_scheme`, `compare_schemes` |
| ConstraintService | `create_constraint`, `update_constraint`, `disable_constraint`, `apply_constraints` |
| ReportService | `preview`, `export_markdown`, `export_csv`, `export_json`, `export_audit_log`, `export_pdf_p1` |
| AuditService | `query_logs`, `get_snapshot`, `export_audit_log` |

## Calculation Request Envelope

Future calculation calls should carry:

- `project_id`
- `input_snapshot_id`
- `parameter_snapshot_id`
- `requested_by`
- `run_mode`
- `algorithm_mode`, default `MD_DSHAP` for algorithm tasks
- `source_task_id` when rerunning
- `recompute_reason` when rerunning

## Calculation Response Envelope

Future calculation responses should carry:

- `status`
- `result_id` or `task_id`
- `output_snapshot_id`
- `failure_reason`
- `algorithm_version` where applicable
- `trace_ref` where applicable
- `simulation_disclaimer`

## Error Codes

- `DVAS_INPUT_FORMAT_ERROR`
- `DVAS_REQUIRED_FIELD_MISSING`
- `DVAS_PERMISSION_DENIED`
- `DVAS_PRECONDITION_NOT_MET`
- `DVAS_WEIGHT_INVALID`
- `DVAS_FACTOR_INVALID`
- `DVAS_REVENUE_INVALID`
- `DVAS_PRIORITY_EXCEEDS_REVENUE`
- `DVAS_ALGORITHM_FAILED`
- `DVAS_EXPORT_FAILED`
- `DVAS_LOCKED_VERSION`

## P0/P1 Notes

HTTP APIs are not required for P0 if local service functions provide the same
contract. Login/RBAC and async progress are P1.
