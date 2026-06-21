# Software Copyright Delivery Package

## Package Identity

- System name: 数据收益分配系统 DVAS
- Software version: P0 local demo and software-copyright acceptance edition
- Positioning: data revenue allocation simulation and audit explanation system
- Boundary statement: outputs are simulation references only and are not legal settlement, statutory settlement, payment instructions, contract performance, asset appraisal, or authority approval.

## Core Function Modules

- System home dashboard
- Data ingestion management
- Data resource management
- Party management
- Quality assessment management
- Shuyuan metering management
- Contribution and utility calculation
- MD-DShap calculation management
- Allocation simulation
- Contract constraint management
- Report generation and export
- Parameter configuration summary
- User and permission P1 notice
- Audit log management

## Technical Architecture

| Layer | Implementation |
|---|---|
| Database | PostgreSQL 16, database `dvas_p0`, schema `dvas` |
| Backend | Python HTTP service under `backend/dvas/`, explicit PostgreSQL read/write models |
| Frontend | React + Vite under `ui_prototype/`, `VITE_API_BASE_URL` real API client |
| CI | GitHub Actions PostgreSQL service containers and frontend build/screenshot gates |
| Export evidence | `report_record`, `export_file`, checksum-bearing Markdown/CSV/JSON/JSONL records |

## Database Description

P0 uses 38 core tables under schema `dvas`. The root business table is `allocation_project`. Audit and traceability are stored through `audit_log` and `snapshot_store`. MD-DShap and allocation outputs are stored through dedicated task/result/scenario/result/trace tables. Report and export evidence is stored in `report_record` and `export_file`.

## API Description

Implemented P0 APIs are summarized in `docs/P0_API_INTERFACE_SUMMARY.md`. The API set includes database health, project status, audit logs, reports, allocation and MD-DShap summaries, resource/party/quality/shuyuan/utility/constraint/export detail reads, demo loading, JSON upload, pipeline execution, allocation confirmation, and report generation.

## Screenshot List

The screenshot manifest is `docs/SOFTWARE_COPYRIGHT_SCREENSHOT_MANIFEST.md`. Phase 2D CI uploaded artifact `phase-2d-screenshots` with artifact id `7773025213`; PNG files are not committed to avoid binary artifact churn.

## Source Directory Description

| Path | Purpose |
|---|---|
| `db/` | PostgreSQL database bootstrap, schema, seed/demo data, validation SQL |
| `backend/dvas/` | Python backend app, server, PostgreSQL read model, PostgreSQL write model, pipeline service |
| `backend/tests/` | Backend unit and contract tests |
| `scripts/` | DB smoke, backend API smoke, pipeline write smoke, frontend real API smoke, UI screenshot capture |
| `ui_prototype/` | React/Vite frontend prototype wired to real P0 APIs |
| `.github/workflows/` | CI gates for database acceptance, Phase 2B/2C/2D, and final release gate |
| `docs/` | Acceptance reports, traceability, release docs, screenshot and software-copyright package manifests |

## Test And Acceptance Evidence

- `P0 Database Acceptance` run `27894194835`: PostgreSQL validation SQL and DB smoke PASS.
- `P0 Database Acceptance` run `27894627475`: backend read API smoke PASS.
- `Phase 2B Pipeline Write DB` run `27895440063`: seed-only database, backend writes full P0 flow PASS.
- `Phase 2C Frontend Real API` run `27896151068`: frontend real API build/smoke PASS.
- `Phase 2D UI Acceptance` run `27897363388`: page coverage, screenshot artifact, frontend/backend smoke PASS.

## Outside System Boundary

P0 does not include PDF generation, login/RBAC, multi-tenant operation, async queues, real payment, banking, tax, e-sign integrations, or unmasked sensitive raw data handling.
