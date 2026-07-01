# Backend DB Model Check

Scope: `db/dvas_p0_01_schema.sql`, `backend/dvas/repository.py`, `backend/dvas/postgres_read_model.py`, and runtime service objects.

Historical snapshot: this check predates current runtime objects such as
`contract_ratio_plans`, `contract_ratio_items`, resource-level quality runtime
objects, local P1 user/RBAC, and report manifests. For current alignment, use
`docs/CODE_DOCUMENT_DRIFT_AUDIT.md` and the V1.1 DB/ER root document.

## Required Object Coverage

| Required object | SQL schema | Runtime JSON model | Result |
|---|---|---|---|
| `allocation_project` | Yes, `db/dvas_p0_01_schema.sql:91` | `project` object in `repository.py:51` | Covered, naming differs. |
| `nav_menu` | Yes, `schema.sql:15` | Hardcoded menu in `NavigationService` | Covered, runtime not DB-backed. |
| `permission` | Yes, `schema.sql:32` | `SYSTEM_HOME_BUTTON_PERMISSIONS` only | Partial. |
| `user_account` / `role` / `user_role` / `role_permission` | Yes, `schema.sql:47-86` | No runtime auth implementation | P1 design only, acceptable for P0. |
| `data_package` | Yes, `schema.sql:135` | `data_packages` | Covered, status mismatch. |
| `input_snapshot` | Yes, `schema.sql:123` | `input_snapshots` and `snapshots` | Covered. |
| `upload_validation_result` | Yes, `schema.sql:151` | `validation_results` | Covered. |
| `data_resource` | Yes, `schema.sql:164` | `data_resources` | Covered. |
| `data_resource_field` | Yes, `schema.sql:181` | Not modeled in runtime JSON | Gap. |
| `party` | Yes, `schema.sql:196` | `parties` | Covered. |
| `data_resource_party_relation` | Yes, `schema.sql:212` | Embedded `party_relations` on resource | Partial. |
| `quality_metric_template` | Yes, `schema.sql:230` | Hardcoded quality weights in router/service | Gap. |
| `quality_assessment` | Yes, `schema.sql:244` | `quality_assessments` | Covered, field mismatch. |
| `quality_score_detail` | Yes, `schema.sql:260` | `quality_details` | Covered. |
| `shuyuan_metering` | Yes, `schema.sql:274` | `shuyuan_meterings` | Covered, field mismatch. |
| `shuyuan_metering_detail` | Yes, `schema.sql:293` | `shuyuan_metering_details` | Covered. |
| `contribution_record` | Yes, `schema.sql:307` | `contribution_records` | Covered. |
| `utility_function_snapshot` | Yes, `schema.sql:323` | Not separately modeled; utility params in snapshots | Gap. |
| `utility_record` | Yes, `schema.sql:336` | aggregate `utility_records` | Partial, semantic mismatch. |
| `utility_trace` | Yes, `schema.sql:353` | `utility_traces` | Covered. |
| `md_dshap_task` | Yes, `schema.sql:367` | `md_dshap_tasks` | Covered, status mismatch. |
| `md_dshap_result` | Yes, `schema.sql:389` | `md_dshap_results` | Covered. |
| `md_dshap_marginal_trace` | Yes, `schema.sql:406` | `md_dshap_marginal_traces` | Covered, field mismatch. |
| `algorithm_audit_snapshot` | Yes, `schema.sql:423` | `algorithm_audit_snapshots` | Covered, field/type mismatch. |
| `allocation_scenario` | Yes, `schema.sql:436` | `allocation_scenarios` | Covered, enum mismatch. |
| `allocation_priority_item` | Yes, `schema.sql:457` | Not persisted in runtime | Gap. |
| `contract_constraint` | Yes, `schema.sql:471` | `contract_constraints` | Covered, enum mismatch. |
| `allocation_result` | Yes, `schema.sql:486` | `allocation_results` | Covered, history constraint mismatch. |
| `constraint_apply_trace` | Yes, `schema.sql:503` | `constraint_apply_traces` | Covered, field mismatch. |
| `report_record` | Yes, `schema.sql:521` | `report_records` | Covered, format mismatch. |
| `export_file` | Yes, `schema.sql:537` | `export_files` | Covered, key/format mismatch. |
| `audit_log` | Yes, `schema.sql:552` | `audit_logs` | Covered, checksum/status detail mismatch. |
| `snapshot_store` | Yes, `schema.sql:107` | `snapshots` | Covered, type mismatch. |
| `system_parameter` | Yes, `schema.sql:574` | `system_parameters` | Covered, field naming mismatch. |
| `parameter_version` | Yes, `schema.sql:591` | `parameter_versions` | Covered, field naming mismatch. |

## Critical Model Mismatches

| Area | SQL | Runtime | Impact |
|---|---|---|---|
| Data package status | `VALID` / `INVALID` | `VALIDATED` / `INVALID` | Runtime cannot insert directly into SQL without mapping. |
| Snapshot type | `INPUT`, `PARAMETER`, `RESULT`, `REPORT`, `ALGORITHM`, `ALLOCATION`, `ASSUMPTION`, `OTHER` | includes `ALGORITHM_AUDIT` | Runtime snapshot type violates SQL check. |
| MD-DShap status | `PENDING`, `RUNNING`, `SUCCESS`, `FAILED`, `CANCELLED` | `COMPLETED` | Runtime cannot insert directly. |
| Allocation mode | `MD_DSHAP_WEIGHT`, `CONTRIBUTION`, `UTILITY`, `MANUAL` | `MD_DSHAP_WEIGHT_WITH_CONSTRAINTS` | Runtime cannot insert directly. |
| Contract priority type | `PRIORITY_AMOUNT` | `PRIORITY_ALLOCATION` | Constraint semantics drift. |
| Report format | `MD`, `CSV`, `JSON`, `JSONL`, `ZIP`, `PDF` | `MARKDOWN`, `CSV`, `JSON`, `JSONL` | Runtime cannot insert Markdown without mapping. |
| Export file key | `file_id` | `export_file_id` | Runtime/read model names differ. |
| Utility granularity | one `utility_record` per party with required `party_id` and utility function snapshot | aggregate utility record plus per-party traces | Runtime cannot persist to SQL as-is. |
| Allocation history | SQL `UNIQUE (allocation_id, party_id)` | runtime supports multiple `version_no` result versions per allocation/party | SQL blocks recalculation history unless changed. |

## Project Root And Snapshot Verdict

- `project_id` exists in SQL across core tables.
- Runtime JSON also carries `project_id`, but only one local project is supported by default.
- Input, parameter, result, report, algorithm audit, export, and audit objects exist.
- The SQL model is broad enough to satisfy the documents, but runtime persistence does not yet use it as the authoritative write model.

## DB Verdict

The database design is salvageable and largely aligned with the source documents. The runtime model is not yet aligned tightly enough for a clean production or PostgreSQL-backed backend. Required surgery: define a single canonical persistence contract, then either adapt runtime writes to SQL or formally constrain JSON runtime as a P0-local adapter with explicit mapping tests.
