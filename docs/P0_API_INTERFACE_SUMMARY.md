# P0 API Interface Summary

All P0 APIs use real PostgreSQL when `DATABASE_URL` is configured. Mock data is not allowed as the acceptance path. When the database is unavailable, APIs return structured errors or HTTP 503 instead of crashing the app.

| API | Purpose | P0 | Database tables | Failure behavior | Real PostgreSQL | Mock allowed |
|---|---|---|---|---|---|---|
| `GET /health/db` | Check database connectivity | Yes | PostgreSQL connection check | HTTP 503 when DB unavailable | Yes | No |
| `GET /api/projects` | List projects | Yes | `dvas.allocation_project` | Structured error if DB unavailable | Yes | No |
| `GET /api/projects/:projectId/status` | Project status and aggregate counts | Yes | `allocation_project`, `data_package`, `quality_assessment`, `shuyuan_metering`, `utility_record`, `md_dshap_task`, `allocation_scenario`, `report_record`, `export_file`, `audit_log`, `snapshot_store` | 404/structured error for missing project or DB failure | Yes | No |
| `GET /api/audit/logs` | Query audit logs with optional `project_id` and `limit` | Yes | `dvas.audit_log` | Structured error if DB unavailable | Yes | No |
| `GET /api/reports` | Query reports and nested export files | Yes | `dvas.report_record`, `dvas.export_file` | Structured error if DB unavailable | Yes | No |
| `GET /api/projects/:projectId/allocation-summary` | Allocation scenario and party allocation summary | Yes | `allocation_scenario`, `allocation_result`, `party` | Structured error if no allocation or DB unavailable | Yes | No |
| `GET /api/projects/:projectId/md-dshap-summary` | MD-DShap task, participant weights, audit snapshot flag | Yes | `md_dshap_task`, `md_dshap_result`, `party`, `algorithm_audit_snapshot` | Structured error if no task or DB unavailable | Yes | No |
| `GET /api/projects/:projectId/resources` | Data resource list with fields and party relations | Yes | `data_resource`, `data_resource_field`, `data_resource_party_relation`, `party` | Empty array if no resources; error if DB unavailable | Yes | No |
| `GET /api/projects/:projectId/parties` | Full party list and relation/allocation summary | Yes | `party`, `data_resource_party_relation`, `md_dshap_result`, `allocation_result` | Empty array if no parties; error if DB unavailable | Yes | No |
| `GET /api/projects/:projectId/quality-summary` | Latest quality assessment and score details | Yes | `quality_assessment`, `quality_score_detail` | Empty summary when not assessed; error if DB unavailable | Yes | No |
| `GET /api/projects/:projectId/shuyuan-summary` | Latest shuyuan metering and details | Yes | `shuyuan_metering`, `shuyuan_metering_detail` | Empty summary when not metered; error if DB unavailable | Yes | No |
| `GET /api/projects/:projectId/utility-summary` | Contribution, utility records, trace summary | Yes | `contribution_record`, `utility_record`, `utility_trace` | Empty arrays when not calculated; error if DB unavailable | Yes | No |
| `GET /api/projects/:projectId/constraints-summary` | Contract priority, constraints, apply trace | Yes | `allocation_scenario`, `allocation_priority_item`, `contract_constraint`, `constraint_apply_trace` | Empty arrays when not allocated; error if DB unavailable | Yes | No |
| `GET /api/projects/:projectId/export-files` | Export files for project reports | Yes | `report_record`, `export_file` | Empty array if no exports; error if DB unavailable | Yes | No |
| `POST /api/demo-cases/load` | Create a demo project and ingestion records | Yes | Writes `allocation_project`, `input_snapshot`, `data_package`, `upload_validation_result`, `data_resource`, `data_resource_field`, `party`, `data_resource_party_relation`, `snapshot_store`, `audit_log` | Structured error and audit log on failure | Yes | No |
| `POST /api/data/upload-json` | Validate and write JSON input | Yes | Writes ingestion tables, validation result, snapshot, audit log | Returns field-level validation errors for invalid input | Yes | No |
| `POST /api/projects/:projectId/pipeline/run` | Run the P0 calculation write flow | Yes | Writes quality, shuyuan, contribution, utility, MD-DShap, allocation, constraint, snapshot, audit tables | Stops on failed stage, returns failure node/reason, writes failed audit | Yes | No |
| `POST /api/projects/:projectId/allocation/confirm` | Confirm simulated allocation plan | Yes | Updates `allocation_project`, writes `snapshot_store`, `audit_log` | Structured precondition/DB error | Yes | No |
| `POST /api/projects/:projectId/reports/generate` | Generate report and export file records | Yes | Writes `report_record`, `export_file`, `snapshot_store`, `audit_log` | Structured error; no silent overwrite | Yes | No |

## Boundary

The APIs do not implement PDF, login/RBAC, async queueing, multi-tenancy, real payment, banking, tax, or e-sign integrations. All report and allocation outputs remain simulation references only.
