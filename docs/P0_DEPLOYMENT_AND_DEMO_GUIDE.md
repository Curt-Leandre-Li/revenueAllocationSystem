# P0 Deployment And Demo Guide

## Environment Requirements

- Python 3 with standard library support for `unittest` and `py_compile`
- Node.js 22 for the frontend CI path
- npm for `ui_prototype`
- Docker with Docker Compose for local PostgreSQL acceptance
- PostgreSQL 16 if running without Docker

## Environment Variables

```bash
DATABASE_URL=postgresql://dvas_app:password@localhost:5432/dvas_p0
VITE_API_BASE_URL=http://localhost:8000
DVAS_API_BASE_URL=http://127.0.0.1:8000
DVAS_UI_BASE_URL=http://127.0.0.1:5173
DVAS_UI_PORT=5173
```

## Start PostgreSQL With Docker

```bash
cp .env.example .env
make db-acceptance
```

For a step-by-step reset:

```bash
make db-up
make db-create
make db-schema
make db-seed
```

Phase 2B and later smoke tests intentionally start from `00_create_database`, `01_schema`, and `02_seed`, then let the backend write the P0 business data.

## Start Backend

```bash
DATABASE_URL=postgresql://dvas_app:password@localhost:5432/dvas_p0 python3 -m backend.dvas.server
```

Default backend URL:

```text
http://127.0.0.1:8000
```

## Start Frontend

```bash
cd ui_prototype
npm ci
VITE_API_BASE_URL=http://localhost:8000 npm run dev -- --port 5173
```

Default frontend URL:

```text
http://127.0.0.1:5173/dashboard
```

## One-Click Demo Flow

1. Open `/dashboard`.
2. Click `选择演示数据`.
3. Click `启动完整计算` or `执行完整链路计算`.
4. Confirm the allocation plan.
5. Generate the report.
6. Open MD-DShap calculation management.
7. Open allocation simulation.
8. Open reports and confirm checksum-bearing Markdown/CSV/JSON/JSONL export records.
9. Open audit logs and confirm `module_code`, `menu_code`, operation, snapshot, and status records.

## Validation Commands

```bash
python3 -m py_compile backend/dvas/app.py backend/dvas/postgres_read_model.py backend/dvas/postgres_write_model.py backend/dvas/pipeline_write_service.py scripts/db_smoke_test.py scripts/backend_api_smoke_test.py scripts/pipeline_db_write_smoke_test.py scripts/frontend_real_api_smoke_test.py scripts/capture_ui_acceptance_screenshots.py
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s backend/tests -v
cd ui_prototype && npm run build
git diff --check
```

## Common Errors

| Symptom | Likely Cause | Action |
|---|---|---|
| `/health/db` returns 503 | PostgreSQL unavailable or `DATABASE_URL` invalid | Start PostgreSQL and confirm `DATABASE_URL` |
| Frontend shows backend unavailable | `VITE_API_BASE_URL` points to the wrong backend URL | Set `VITE_API_BASE_URL=http://localhost:8000` |
| API returns DB connection failure | Database roles/schema not initialized | Run `make db-create`, `make db-schema`, `make db-seed` |
| Frontend build fails | Dependencies not installed | Run `cd ui_prototype && npm ci` |
| Screenshot capture fails locally | Missing Playwright browser or local DB | Use GitHub Actions artifact as acceptance evidence |

## Boundary Notice

P0 exports and UI reports are simulation references only. They are not legal settlement results, statutory settlement results, payment instructions, contract performance, or authority approval.
