# P0 Release Checklist

## Release Gate Checklist

| Item | Evidence | Status |
|---|---|---|
| Database DDL is executable | `db/dvas_p0_00_create_database.sql`, `db/dvas_p0_01_schema.sql` | PASS |
| Seed data is executable | `db/dvas_p0_02_seed.sql` | PASS |
| PostgreSQL CI validation passes | `P0 Database Acceptance` run `27894194835`, `27894627475` | PASS |
| Backend read interfaces pass | `scripts/backend_api_smoke_test.py` | PASS |
| Backend write smoke passes | `scripts/pipeline_db_write_smoke_test.py`, run `27895440063` | PASS |
| Frontend real API build passes | `cd ui_prototype && npm run build`, run `27896151068` | PASS |
| UI covers 14 pages | `docs/PHASE_2D_UI_ACCEPTANCE_REPORT.md` | PASS |
| Screenshot artifact uploaded | `phase-2d-screenshots`, artifact id `7773025213` | PASS |
| report/export checksum visible | `report_record`, `export_file`, reports API, reports page | PASS |
| `audit_log` / `snapshot_store` visible | status API, audit API, dashboard/system audit pages | PASS |
| MD-DShap default algorithm visible | `md_dshap_task.algorithm_mode=MD_DSHAP`, MD-DShap page | PASS |
| PDF is marked non-P0 | reports page and release docs | PASS |
| RBAC/login is marked non-P0 | users page and release docs | PASS |
| Multi-tenant mode is marked non-P0 | release docs | PASS |
| Real payment/bank/tax/e-sign are marked non-P0 | release docs | PASS |

## Merge Readiness

- Do not merge until `P0 Final Release Gate` passes on `phase-2e-final-release-audit`.
- Do not tag until the final gate run is green and the PR/merge target is confirmed.
- Do not include local zip/docx/output screenshots unless a separate delivery step explicitly requests packaging.
