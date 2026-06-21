# Release Notes P0

## Scope

P0 is the local demo and software-copyright acceptance edition of 数据收益分配系统 DVAS. It demonstrates the complete P0 simulation chain with PostgreSQL-backed data, backend APIs, frontend real API integration, report/export records, audit logs, and screenshot evidence.

## New Capabilities

- PostgreSQL 16-backed P0 database schema, seed, demo data, and validation SQL.
- Backend database health, read APIs, write APIs, and smoke tests.
- Backend write flow from seed state: demo load, JSON upload validation, complete calculation pipeline, allocation confirmation, report generation.
- Frontend real API client with `VITE_API_BASE_URL`.
- Fourteen UI pages wired to real backend data or explicit P1/out-of-scope notices.
- UI screenshot capture script and GitHub Actions screenshot artifact.
- Final release audit docs, traceability matrix, API summary, CI evidence summary, and software-copyright delivery package manifest.

## Database Capabilities

- Database `dvas_p0`, schema `dvas`, 38 core tables.
- Root project table: `allocation_project`.
- Audit and snapshot traceability: `audit_log`, `snapshot_store`.
- MD-DShap task/result/trace/audit tables.
- Allocation scenario/result/constraint/trace tables.
- Report and export checksum tables.

## Backend Capabilities

- `GET /health/db` returns database health without crashing app startup.
- Read APIs cover projects, status, audit, reports, allocation, MD-DShap, resources, parties, quality, shuyuan, utility, constraints, and export files.
- Write APIs cover demo load, JSON upload, pipeline run, allocation confirmation, and report generation.
- Decimal and money values are serialized safely for JSON.
- Database failures return structured errors or HTTP 503.

## Frontend Capabilities

- Dashboard shows current project, status progress, operation buttons, risk notices, recent reports, and audit summary.
- Data, metering, allocation, reports, audit, parameters, and users pages show real API-backed content or explicit P1 notices.
- Write buttons call real backend APIs and refresh data after success.
- Backend unavailable states are displayed instead of blank screens.
- All pages preserve the simulation-reference, non-legal-settlement boundary.

## Acceptance Capabilities

- PostgreSQL CI validation.
- Backend unit tests and API smokes.
- Pipeline write DB smoke.
- Frontend build and real API smoke.
- UI screenshot artifact.
- Final release gate workflow.

## Known Limitations

- PDF export is P1.
- Login/RBAC is P1.
- Async queueing is not P0.
- Multi-tenancy is not P0.
- Real payment, banking, tax, and e-sign integrations are not P0.
- Unmasked sensitive raw data is not supported.
- Local real DB validation requires Docker/psql; current release audit relies on GitHub Actions PostgreSQL 16.

## P1 Suggestions

- Add login and production RBAC.
- Add PDF export after report content is frozen.
- Add async job progress for long-running calculations.
- Add CSV/XLSX import templates and stronger validation UX.
- Add versioned historical report management.
- Add deployment hardening after local demo acceptance is merged.
