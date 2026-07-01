# DVAS Backend Audit Report

Audit date: 2026-06-23

Historical snapshot: this report used the older generated DOCX authority set.
For current product alignment, use `docs/CODE_DOCUMENT_DRIFT_AUDIT.md` and the
V1.4/V1.2/V1.1 root Markdown source documents.

Scope: backend only. Frontend repair, frontend compatibility shims, and runtime implementation changes were intentionally not performed.

## Source Of Truth

The audit used the requested generated DOCX authority files:

- `docs/generated_docx/数据收益分配系统_V1.3_需求规格说明书_导航结构更新版.docx`
- `docs/generated_docx/数据收益分配系统_系统详细功能设计_V1.1_导航结构更新版.docx`
- `docs/generated_docx/数据收益分配系统_数据库设计与ER关系图_V1.0_导航结构更新版.docx`

Key requirements extracted from those documents:

- System output is simulation reference only, not legal settlement, statutory settlement, payment instruction, contract performance, or authority approval.
- Full chain: data ingestion -> resource and party management -> quality -> shuyuan metering -> contribution and utility -> MD-DShap weights -> revenue allocation -> lock/confirm -> report/export -> audit.
- Required project states: `DRAFT / INGESTED / ASSESSED / METERED / UTILITY_CALCULATED / WEIGHT_CALCULATED / ALLOCATED / CONFIRMED / EXPORTED`.
- MD-DShap is the default weight calculation strategy. Basic Shapley is only baseline checking.
- Non-data parties do not enter the MD-DShap pool by default.
- Calculation operations must retain input, parameter, output/result snapshots, algorithm version, audit records, and checksums where applicable.
- P0 exports are Markdown, CSV, JSON, and JSONL. PDF is P1.

## Baseline Commands

Executed and recorded:

```bash
git status --short
git branch --all --verbose
git log --oneline --decorate -20
find . ... -prune -o -print
find . -maxdepth 4 \( -name 'README*' -o -name 'pyproject.toml' -o -name 'requirements*.txt' -o -name 'package.json' -o -name 'Makefile' -o -name '*.yaml' -o -name '*.yml' -o -name '*.toml' -o -name '*.sql' -o -name '*.db' -o -name '*.sqlite' -o -name '*.sqlite3' \)
```

Initial dirty state:

```text
 M README.md
?? docs/P0_ACCEPTANCE_TODAY.md
?? docs/P0_API_CONTRACT_TODAY.md
?? docs/TODAY_CHANGELOG.md
?? output/
?? ui_rebuild/
```

Because the working tree is dirty, no deletions, branch deletions, backend rewrites, or frontend cleanup were performed in this pass.

## Backend Entry Points

- Startup: `python3.12 -m backend.dvas.server`
- HTTP adapter: `backend/dvas/server.py`
- Application/router: `backend/dvas/app.py`
- Services and domain logic: `backend/dvas/services.py`
- Runtime repository: `backend/dvas/repository.py`
- PostgreSQL read model: `backend/dvas/postgres_read_model.py`
- OpenAPI contract: `backend/openapi.yaml`
- Tests: `backend/tests/test_api_contract.py`
- Database/migration-like SQL: `db/dvas_p0_00_create_database.sql`, `db/dvas_p0_01_schema.sql`, `db/dvas_p0_02_seed.sql`, `db/dvas_p0_03_demo_data.sql`, `db/dvas_p0_04_validation.sql`
- Config files: `Makefile`, `docker-compose.yml`, `.env.example`, `.github/workflows/p0-database-acceptance.yml`
- Dependencies: no `pyproject.toml` or `requirements*.txt` was found for backend; current backend uses Python stdlib plus external `psql`/Docker for PostgreSQL read service.

## Architecture Check

| Layer | Current evidence | Result |
|---|---|---|
| API/Controller/Router | `DvasApplication._dispatch` is one large route dispatcher in `backend/dvas/app.py:78`. | Present but too centralized. |
| DTO/Schema/Validation | OpenAPI schemas exist; runtime validation is ad hoc inside service methods and `ApiError` envelopes. | Weak. Needs schema layer. |
| Application Service | Service classes are initialized in `backend/dvas/app.py:31-46`; main services live in `backend/dvas/services.py`. | Present. |
| Domain/Algorithm Service | `MdDshapService`, `AllocationService`, `QualityAssessmentService`, `ShuyuanMeteringService`, `UtilityService` exist. | Present, but concentrated in one 3652-line file. |
| Repository/Persistence | `JsonFileRepository` and `InMemoryRepository` exist; PostgreSQL read service exists separately. | Present, but split-brain persistence. |
| Report/Export | `ReportService` creates Markdown/CSV/JSON/JSONL and report/export records. | Present. |
| Audit/Snapshot | `write_audit` is centralized; snapshots/checksums are created in services. | Present but failure audit is incomplete. |
| Config/Parameter | `default_system_parameters` and `SystemParameterService` exist. | Present. |

## Major Findings

| Severity | Finding | Evidence | Status |
|---|---|---|---|
| P1 | Backend is salvageable, but not clean enough for `KEEP`; it needs surgery. | Tests pass and core chain exists, but router is monolithic, DTO layer is weak, persistence is split, duplicate helper logic exists. | Not fixed. |
| P1 | PostgreSQL schema and runtime JSON model are not the same authoritative model. | Runtime writes JSON via `JsonFileRepository`; PostgreSQL read service only exposes read paths from SQL tables. | Not fixed. |
| P1 | DB enum/field semantics drift from runtime. | DB uses `data_package.status IN VALID`, runtime uses `VALIDATED`; DB `md_dshap_task.status` uses `SUCCESS`, runtime uses `COMPLETED`; DB `allocation_mode` lacks `MD_DSHAP_WEIGHT_WITH_CONSTRAINTS`; DB `snapshot_store.snapshot_type` lacks runtime `ALGORITHM_AUDIT`. | Not fixed. |
| P1 | Export locking rule is too loose for confirmation-style outputs. | `ReportService._final_export_context` accepts `ALLOCATED`, `CONFIRMED`, `EXPORTED`, not only locked/confirmed. | Not fixed. |
| P1 | Failure audit is not uniformly recorded for failed calculation operations. | Many service precondition failures raise `ApiError`; only invalid upload records failed audit. | Not fixed. |
| P2 | Router contains draft/save endpoints that return body without persistence/audit. | `/metering/*/parameters`, `/metering/*/weights`, `/allocation/*/config`, `/allocation/simulation/*` draft routes in `backend/dvas/app.py:191-262` and `316-321`. | Not fixed. |
| P2 | Algorithm mode input is not constrained at runtime. | `MdDshapService._parameters` accepts payload `algorithm_mode` without validating allowed mode/default-only policy. | Not fixed. |
| P2 | Hardcoded local defaults remain. | `DEFAULT_DATABASE_URL`, OpenAPI `127.0.0.1`, README absolute paths, demo project id, default total revenue `1000`. | Not fixed. |
| P2 | Duplicate numeric validation, snapshot creation, and precision logic is scattered. | `_number` and `_snapshot` methods repeat across multiple service classes. | Not fixed. |
| P3 | Generated and local debris exists. | `.DS_Store`, `__pycache__`, untracked `output/`, untracked `ui_rebuild/`. | Not deleted due dirty tree. |

## Positive Evidence

- Backend has a real service layer and is not just frontend-shaped mock code.
- Core state progression exists and is covered by tests.
- MD-DShap is the default algorithm mode in the service and DB schema.
- Non-data parties are excluded from MD-DShap by default in the runtime service.
- Recalculation generally creates new IDs and preserves history.
- Report exports create `report_id`, `export_file` rows in runtime state, file paths, and checksums.
- OpenAPI excludes P0-forbidden PDF/login/RBAC/tenant/async routes.
- Backend tests do not import frontend workspaces.

## State Machine Check

Implemented evidence:

- Dashboard preconditions cover ingestion, relation, quality, metering, contribution, utility, MD-DShap, allocation, confirmation, report, and export checks.
- Quality requires a validated package.
- Shuyuan metering requires latest quality.
- Utility requires contribution and quality.
- MD-DShap requires utility state/result.
- Allocation requires weight calculation and normalized weights.
- Lock requires an allocated scenario.
- Export requires allocation results.

Gaps:

- No single authoritative `ProjectStateMachine` object owns transition rules.
- Some services check presence of prior records instead of enforcing exact ordered transition semantics.
- Export currently permits `ALLOCATED`, not only `CONFIRMED`, for report generation.

## Audit/Snapshot Check

Working:

- Successful ingestion creates input snapshot and audit.
- Successful quality, metering, contribution, utility, MD-DShap, allocation, parameter, and report operations create snapshots and/or audit.
- Export files carry SHA-256 checksums.

Gaps:

- Failed calculation operations generally raise errors without writing `audit_log.status=FAILED`.
- Runtime `write_audit` has no checksum field even though DB `audit_log` has `checksum`.
- Snapshot service logic is duplicated rather than centralized.

## No Cleanup Performed

No file deletion, branch deletion, or backend rewrites were performed because:

- The working tree had pre-existing uncommitted changes.
- The project `AGENTS.md` still declares a docs-only round and forbids backend implementation edits.
- The requested deletion of `AGENTS.md` conflicts with the current active project instruction source.

Cleanup candidates are recorded in `BACKEND_DELETION_LOG.md`.
