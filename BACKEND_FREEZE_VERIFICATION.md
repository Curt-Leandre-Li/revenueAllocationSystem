# Backend Freeze Verification

## Conclusion

PASS_WITH_NOTES.

The current backend can be used as the trusted P0 API baseline for rebuilding a
new frontend. Runtime behavior, state transitions, failure audit, snapshots,
draft persistence, report non-overwrite behavior, and runtime/SQL enum mapping
were verified from a cold isolated runtime.

Notes that do not block the frontend rebuild:

- `backend/openapi.yaml` exposes the P0 routes and standard envelope, but it
  does not yet define explicit reusable `ProjectStatus` and `ReportFormat`
  enum schemas. Runtime constants and tests do define and validate these enums.
- Local PostgreSQL acceptance was attempted with the existing `make
  db-acceptance` target but was skipped by environment failure because Docker
  CLI and Docker Compose are not installed on this machine.

## Current Checkpoints

- `c7b2c91` Add backend salvage audit reports
- `ee8b8f9` Stabilize backend contract baseline
- `ade7b81` Remove unused project-local agents

Verification started from `ade7b81` before this report commit.

## Workspace Boundary

Commands:

```bash
git status --short
git log --oneline --decorate -8
git diff --name-status -- backend db .codex AGENTS.md BACKEND_AGENTS_INVENTORY.md backend/openapi.yaml
```

Result:

- `backend/dvas`, `backend/openapi.yaml`, and `backend/tests` had no
  uncommitted changes.
- `.codex`, `AGENTS.md`, and `BACKEND_AGENTS_INVENTORY.md` had no uncommitted
  changes.
- Existing dirty files outside this verification scope were left untouched:
  `README.md`, `docs/P0_ACCEPTANCE_TODAY.md`,
  `docs/P0_API_CONTRACT_TODAY.md`, `docs/TODAY_CHANGELOG.md`, `output/`, and
  `ui_rebuild/`.

## Basic Validation

Commands:

```bash
PYTHONDONTWRITEBYTECODE=1 python3.12 -m py_compile backend/dvas/*.py
PYTHONDONTWRITEBYTECODE=1 python3.12 -m unittest discover -s backend/tests -v
git diff --check
```

Result:

- `py_compile`: PASS.
- `unittest`: PASS, 75 tests ran, OK.
- `git diff --check`: PASS.

## Cold Runtime Smoke

The smoke used a temporary `InMemoryRepository` with `runtime_dir` set to a
temporary directory. It did not read or reuse `backend/runtime/dvas_state.json`.

Command shape:

```bash
PYTHONDONTWRITEBYTECODE=1 python3.12 - <<'PY'
from pathlib import Path
from tempfile import TemporaryDirectory
from backend.dvas.app import DvasApplication
from backend.dvas.repository import InMemoryRepository

tmp = TemporaryDirectory()
repo = InMemoryRepository()
repo.runtime_dir = Path(tmp.name)
app = DvasApplication(repo)

def ok(method, path, body=None):
    response = app.handle(method, path, body or {})
    assert response["success"], response
    assert response["code"] == "OK"
    assert "trace_id" in response and "data" in response
    return response["data"]

ok("GET", "/api/v1/projects/current")
ok("POST", "/api/v1/demo-cases/lung_screening_demo/initialize")
ok("POST", "/api/v1/quality-assessments/run")
ok("POST", "/api/v1/shuyuan-meterings/run")
ok("POST", "/api/v1/contributions/run")
ok("POST", "/api/v1/utilities/run")
ok("POST", "/api/v1/md-dshap/tasks")
scenario = ok("POST", "/api/v1/allocation-scenarios", {"total_revenue": 1000})
ok("POST", f"/api/v1/allocation-scenarios/{scenario['allocation_id']}/simulate")
ok("POST", f"/api/v1/allocation-scenarios/{scenario['allocation_id']}/lock")
ok("POST", "/api/v1/reports/json")
ok("POST", "/api/v1/reports/json")
PY
```

Resulting status chain:

| Step | Status |
|---|---|
| Cold start | `DRAFT` |
| Demo initialize | `INGESTED` |
| Quality assessment | `ASSESSED` |
| Shuyuan metering | `METERED` |
| Contribution | `METERED` |
| Utility | `UTILITY_CALCULATED` |
| MD-DShap | `WEIGHT_CALCULATED` |
| Allocation simulation | `ALLOCATED` |
| Lock | `CONFIRMED` |
| Export | `EXPORTED` |

Re-export result:

- First report: `report_000001`.
- Second report: `report_000002`.
- File paths were distinct:
  `exports/report_000001/p0_simulation_reference_export.json` and
  `exports/report_000002/p0_simulation_reference_export.json`.
- Checksums were distinct for the two exported JSON payloads because the second
  export included the first report in its report list.
- Existing report files were not overwritten.

## State Machine Blocking

Each blocked operation returned a standard error envelope and wrote a FAILED
audit record.

| Blocked operation | Error code | Message | FAILED audit |
|---|---|---|---|
| `POST /api/v1/quality-assessments/run` at `DRAFT` | `DVAS_PRECONDITION_NOT_MET` | 请先完成数据接入 | `RUN_QUALITY_ASSESSMENT` |
| `POST /api/v1/shuyuan-meterings/run` at `DRAFT` | `DVAS_PRECONDITION_NOT_MET` | 请先完成质量评估 | `RUN_SHUYUAN_METERING` |
| `POST /api/v1/shuyuan-meterings/run` at `INGESTED` | `DVAS_PRECONDITION_NOT_MET` | 请先完成质量评估 | `RUN_SHUYUAN_METERING` |
| `POST /api/v1/contributions/run` before metering | `DVAS_PRECONDITION_NOT_MET` | 请先完成数元计量 | `RUN_CONTRIBUTION` |
| `POST /api/v1/utilities/run` before metering | `DVAS_PRECONDITION_NOT_MET` | 请先完成数元计量 | `RUN_UTILITY` |
| `POST /api/v1/md-dshap/tasks` before utility | `DVAS_PRECONDITION_NOT_MET` | 请先完成效用计算 | `RUN_MD_DSHAP` |
| `POST /api/v1/allocation-scenarios` before weights | `DVAS_PRECONDITION_NOT_MET` | 请先完成 MD-DShap 权重计算 | `CREATE_ALLOCATION_SCENARIO` |
| `POST /api/v1/reports/markdown` before allocation | `DVAS_PRECONDITION_NOT_MET` | 请先完成收益分配模拟 | `GENERATE_MARKDOWN_REPORT` |

Confirmation-style final reports are not exposed as a separate P0 route. P0
ordinary reports are blocked before allocation and may be generated from
`ALLOCATED`, `CONFIRMED`, or `EXPORTED`.

## Failure Audit

The smoke directly inspected `repo.list_audit_logs()` after every blocked
operation and confirmed:

- `status=FAILED`.
- `error_code` matched the API error code.
- `created_by=local_operator`.
- module and operation codes matched the failed business operation.

## API Smoke

The API smoke executed 69 requests across the P0 surface:

- current project, status, and flow.
- navigation menu tree and button permissions.
- dashboard overview and preconditions.
- demo initialization.
- data packages, resources, parties, details, validation result, and resource
  party binding.
- quality run/latest/details.
- shuyuan run/latest/details.
- contribution run.
- utility run/latest/trace.
- MD-DShap participant pool, tasks, task detail, results, marginal traces, and
  audit export.
- allocation constraints.
- allocation scenario create/simulate/lock/results.
- reports list, preview, markdown, csv, json, audit-log, and MD-DShap audit.
- system parameters list/detail/update/restore.
- audit logs list/detail.
- alias routes under `/data`, `/metering`, `/allocation`, `/sys`, and
  `/system/audit`.

Result:

- All successful routes returned the standard success envelope.
- All inspected errors returned the standard error envelope.
- No response contained UI-only payload keys: `cardList`, `tableColumns`,
  `sidebarTree`, `buttonState`, or `mockChartData`.
- Alias routes mapped to the same backend services and produced standard
  envelopes.
- Draft/config endpoints persisted state instead of echoing request bodies:
  5 business draft records and 9 parameter version records were written during
  the smoke.

## OpenAPI Consistency

Observed:

- `backend/openapi.yaml` defines 90 P0 paths.
- The P0 main chain and compatibility aliases are represented.
- Standard envelope components are present:
  `StandardSuccess`, `StandardError`, `StandardResponse`, and `ErrorResponse`.
- `MD_DSHAP` is the default algorithm mode and `BASELINE_SHAPLEY` is documented
  as `baseline_check` only.
- Allocation mode includes `MD_DSHAP_WEIGHT_WITH_CONSTRAINTS`.
- PDF, login/RBAC, async queue, and multi-tenant fake routes are not exposed as
  P0 API paths.
- Old frontend fields `cardList`, `tableColumns`, `sidebarTree`, `buttonState`,
  and `mockChartData` are absent.

Note:

- OpenAPI does not yet expose reusable explicit enum schemas for
  `ProjectStatus` and `ReportFormat`. Runtime constants, mapping tests, and API
  responses are correct, but the OpenAPI document should add these enum schemas
  in a later contract-documentation cleanup.

## Runtime / SQL Mapping

Verified `backend/dvas/persistence_mapping.py`:

| Runtime | SQL |
|---|---|
| `data_package_status: VALIDATED` | `VALID` |
| `md_dshap_task_status: COMPLETED` | `SUCCESS` |
| `report_format: MARKDOWN` | `MD` |
| `snapshot_type: ALGORITHM_AUDIT` | `ALGORITHM` |
| `allocation_mode: MD_DSHAP_WEIGHT_WITH_CONSTRAINTS` | `MD_DSHAP_WEIGHT` |
| `contract_constraint_type: PRIORITY_ALLOCATION` | `PRIORITY_AMOUNT` |
| `export_file_id` | `file_id` |

Reverse SQL-to-runtime mapping was also verified.

Unmapped runtime and SQL enum values raised `DVAS_UNMAPPED_ENUM_VALUE`; they did
not silently fall back to `OTHER`.

P1 SQL values for report formats such as `PDF` and `ZIP` remain marked as P1
disabled and do not become P0 fake implementations.

## PostgreSQL Acceptance

The repository has `make db-acceptance`; there is no `make p0-db-acceptance`.

Command:

```bash
make db-acceptance
```

Result: SKIPPED by local environment failure.

- `docker` CLI: missing.
- `docker compose`: missing.
- host `psql`: present, `psql (PostgreSQL) 16.14 (Homebrew)`.
- Makefile target requires Docker Compose and exited with code 127.

No PostgreSQL PASS was claimed.

## Hardcode / Old Frontend Residue

Commands:

```bash
rg -n "mock|fake|demo-ui|old-dashboard|legacy|cardList|tableColumns|sidebarTree|buttonState|mockChartData|5173|5174" backend || true
rg -n "localhost|127.0.0.1|/Users/apple/Desktop" backend backend/openapi.yaml Makefile docker-compose.yml .env.example README.md || true
find . -iname 'agents.md' -o -iname 'AGENTS.md' -o -iname '.agents.md'
git ls-files agents
```

Result:

- No backend hit for `mock`, `fake`, `demo-ui`, `old-dashboard`, `legacy`,
  `cardList`, `tableColumns`, `sidebarTree`, `buttonState`, `mockChartData`,
  `5173`, or `5174`.
- `localhost` and `127.0.0.1` only appeared in local development OpenAPI,
  server, Makefile, `.env.example`, README, and PostgreSQL read-model defaults.
  These are allowed local P0 configuration references.
- `/Users/apple/Desktop` only appeared in README commands; this is docs cleanup,
  not a backend freeze blocker.
- `find` returned only `./AGENTS.md`.
- `git ls-files agents` returned empty output.

## Frontend Rebuild Decision

Allowed: yes.

The new frontend can start from the current backend API baseline. It should use
`backend/openapi.yaml`, `backend/dvas/constants.py`, and the 75 backend contract
tests as the interface truth until the OpenAPI enum-schema note is cleaned up.

## Remaining Non-Blocking Items

- Add explicit reusable OpenAPI schemas for `ProjectStatus` and `ReportFormat`.
- Run `make db-acceptance` in an environment with Docker and Docker Compose.
- Clean unrelated README and P0 documentation working-tree changes in a
  separate docs task if needed.

## Scope Statement

- No frontend files were modified.
- No backend code was modified.
- No backend tests or OpenAPI files were modified.
- No push was performed.
