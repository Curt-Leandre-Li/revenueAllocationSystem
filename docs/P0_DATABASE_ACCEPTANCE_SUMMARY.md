# P0 Database Acceptance Summary

## Database Shape

- Database: `dvas_p0`
- Schema: `dvas`
- PostgreSQL version in CI: PostgreSQL 16 service container
- Core table count: 38
- Root business table: `allocation_project`
- Application role: `dvas_app`
- Read-only role: `dvas_readonly`

## Core Table Groups

| Group | Tables |
|---|---|
| Navigation and local operator | `nav_menu`, `permission`, `user_account`, `role`, `user_role`, `role_permission` |
| Project and snapshots | `allocation_project`, `snapshot_store`, `input_snapshot` |
| Data ingestion | `data_package`, `upload_validation_result`, `data_resource`, `data_resource_field`, `party`, `data_resource_party_relation` |
| Quality | `quality_metric_template`, `quality_assessment`, `quality_score_detail` |
| Shuyuan metering | `shuyuan_metering`, `shuyuan_metering_detail` |
| Contribution and utility | `contribution_record`, `utility_function_snapshot`, `utility_record`, `utility_trace` |
| MD-DShap | `md_dshap_task`, `md_dshap_result`, `md_dshap_marginal_trace`, `algorithm_audit_snapshot` |
| Allocation | `allocation_scenario`, `allocation_priority_item`, `contract_constraint`, `allocation_result`, `constraint_apply_trace` |
| Report and export | `report_record`, `export_file` |
| Audit and parameters | `audit_log`, `system_parameter`, `parameter_version` |

## Acceptance SQL Order

1. `db/dvas_p0_00_create_database.sql`
2. `db/dvas_p0_01_schema.sql`
3. `db/dvas_p0_02_seed.sql`
4. `db/dvas_p0_03_demo_data.sql`
5. `db/dvas_p0_04_validation.sql`

Phase 2B and later pipeline smoke tests intentionally skip `03_demo_data.sql` and let the backend write the full business flow from seed state.

## CI Validation Results

| Workflow | Run ID | Result | Coverage |
|---|---:|---|---|
| P0 Database Acceptance | `27894194835` | PASS | SQL 00-04, validation SQL, `scripts/db_smoke_test.py` |
| P0 Database Acceptance | `27894627475` | PASS | PostgreSQL acceptance plus backend API smoke |
| Phase 2B Pipeline Write DB | `27895440063` | PASS | Seed DB plus backend write flow |
| Phase 2D UI Acceptance | `27897363388` | PASS | Seed DB, write flow, read APIs, frontend build, screenshot artifact |

## Validation Highlights

- `dvas` schema exists.
- Core table count is at least 38.
- Demo project status reaches `EXPORTED` in validation SQL.
- `md_dshap_task.algorithm_mode = MD_DSHAP`.
- MD-DShap weight sum is `1.000000` within `0.000001`.
- Allocation post-constraint amount sum equals total revenue within `0.01`.
- `report_record` and `export_file.checksum` are present.
- `audit_log`, `snapshot_store`, and `algorithm_audit_snapshot` are present.

## Local Environment Note

The current local machine has no Docker or local `psql`; real DB acceptance for this release audit is the GitHub Actions PostgreSQL 16 evidence above.
