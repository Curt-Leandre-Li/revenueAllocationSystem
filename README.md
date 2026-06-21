# 数据收益分配系统 DVAS

DVAS, Data Value Allocation System, is a data revenue allocation simulation and audit explanation system.

P0 is a local demo and software-copyright acceptance edition. System outputs are simulation references only. They are not legal settlement, statutory settlement, payment instructions, contract performance, formal asset appraisal, or authority approval.

## Current P0 Capabilities

- PostgreSQL 16 database acceptance with schema `dvas` and database `dvas_p0`.
- Backend reads and writes real PostgreSQL data through `DATABASE_URL`.
- P0 write flow: demo load, JSON upload validation, complete calculation pipeline, allocation confirmation, report generation.
- Frontend defaults to real APIs through `VITE_API_BASE_URL`.
- UI coverage for 14 P0/P1-notice pages.
- P0 exports are Markdown, CSV, JSON, and JSONL. PDF is P1.
- Report/export checksum, audit log, and snapshot records are visible in API and UI.
- MD-DShap is the default contribution weight strategy; Basic Shapley is baseline-only.

## Documentation Entry Points

Start here:

1. `AGENTS.md`
2. `docs/current_project_baseline.md`
3. `docs/product_navigation.md`
4. `docs/P0_FINAL_ACCEPTANCE_REPORT.md`
5. `docs/P0_RELEASE_CHECKLIST.md`
6. `docs/P0_TRACEABILITY_MATRIX.md`
7. `docs/P0_DEPLOYMENT_AND_DEMO_GUIDE.md`
8. `docs/P0_API_INTERFACE_SUMMARY.md`
9. `docs/SOFTWARE_COPYRIGHT_DELIVERY_PACKAGE.md`

## Quick Start

Local PostgreSQL acceptance requires Docker with Docker Compose:

```bash
cp .env.example .env
make db-acceptance
```

For the Phase 2B/2C/2D style demo path, initialize only database, schema, and seed, then let the backend write the business data:

```bash
make db-up
make db-create
make db-schema
make db-seed
```

Start the backend:

```bash
DATABASE_URL=postgresql://dvas_app:password@localhost:5432/dvas_p0 python3 -m backend.dvas.server
```

Start the frontend:

```bash
cd ui_prototype
npm ci
VITE_API_BASE_URL=http://localhost:8000 npm run dev -- --port 5173
```

Open:

```text
http://127.0.0.1:5173/dashboard
```

## Database Acceptance

PostgreSQL assets are under `db/`. The full local command is:

```bash
make db-acceptance
```

The command creates `dvas_p0`, loads schema `dvas`, inserts seed and demo data, runs validation SQL, and executes `scripts/db_smoke_test.py` against:

```text
DATABASE_URL=postgresql://dvas_app:password@localhost:5432/dvas_p0
```

The current release audit machine has no Docker or local `psql`; real database acceptance evidence is GitHub Actions PostgreSQL 16.

## Backend API

Implemented P0 APIs include:

- `GET /health/db`
- `GET /api/projects`
- `GET /api/projects/:projectId/status`
- `GET /api/audit/logs`
- `GET /api/reports`
- `GET /api/projects/:projectId/allocation-summary`
- `GET /api/projects/:projectId/md-dshap-summary`
- `GET /api/projects/:projectId/resources`
- `GET /api/projects/:projectId/parties`
- `GET /api/projects/:projectId/quality-summary`
- `GET /api/projects/:projectId/shuyuan-summary`
- `GET /api/projects/:projectId/utility-summary`
- `GET /api/projects/:projectId/constraints-summary`
- `GET /api/projects/:projectId/export-files`
- `POST /api/demo-cases/load`
- `POST /api/data/upload-json`
- `POST /api/projects/:projectId/pipeline/run`
- `POST /api/projects/:projectId/allocation/confirm`
- `POST /api/projects/:projectId/reports/generate`

See `docs/P0_API_INTERFACE_SUMMARY.md` for purpose, table source/write targets, failure behavior, PostgreSQL requirements, and mock policy.

## Frontend

Frontend source is under `ui_prototype/`.

```bash
cd ui_prototype
npm ci
npm run build
```

The frontend uses:

```text
VITE_API_BASE_URL=http://localhost:8000
```

If the backend or database is unavailable, the UI must show an explicit unavailable/offline message instead of blanking the page or presenting mock data as real database output.

## CI Status

| Workflow | Run ID | Result |
|---|---:|---|
| P0 Database Acceptance | `27894194835` | PASS |
| P0 Database Acceptance with backend API smoke | `27894627475` | PASS |
| Phase 2B Pipeline Write DB | `27895440063` | PASS |
| Phase 2C Frontend Real API | `27896151068` | PASS |
| Phase 2D UI Acceptance | `27897363388` | PASS |
| P0 Final Release Gate | assigned after Phase 2E push | pending |

Phase 2D screenshot artifact: `phase-2d-screenshots`, artifact id `7773025213`.

## Software Copyright Materials

- `docs/SOFTWARE_COPYRIGHT_DELIVERY_PACKAGE.md`
- `docs/SOFTWARE_COPYRIGHT_SCREENSHOT_MANIFEST.md`
- `docs/P0_FINAL_ACCEPTANCE_REPORT.md`
- `docs/P0_TRACEABILITY_MATRIX.md`
- `docs/P0_CI_EVIDENCE_SUMMARY.md`
- `docs/PHASE_2D_UI_ACCEPTANCE_REPORT.md`

Screenshot PNG files are delivered by GitHub Actions artifact. They are not committed to the repository.

## Known Limitations

- P0 is not a production system.
- P0 does not implement PDF export.
- P0 does not implement login/RBAC.
- P0 does not implement async queueing.
- P0 does not implement multi-tenancy.
- P0 does not connect to real payment, bank, tax, or e-sign systems.
- P0 does not process unmasked real sensitive raw data.
- P0 outputs are simulation references only and are not statutory settlement results or payment instructions.
