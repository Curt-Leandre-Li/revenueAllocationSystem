# Backend Salvage Decision

## Conclusion

`KEEP_WITH_SURGERY`

The backend can be preserved, but it is not clean enough for `KEEP`. It has a real backend domain chain, tests, snapshots, audit records, MD-DShap default behavior, and report/export generation. The core is not merely old frontend scaffolding. However, it needs focused surgery around routing, DTO/schema validation, persistence authority, DB/runtime enum alignment, failure audit, and cleanup.

## Why Not REBUILD

Rebuild is not justified by current evidence:

- Core backend service classes exist and run.
- Full P0 chain is covered by tests through export.
- MD-DShap defaults to `MD_DSHAP` and excludes non-data parties.
- The SQL schema contains the required DVAS core tables.
- Backend routes do not import frontend code or expose obvious `/mock`, `/legacy`, `/frontend`, `/pages`, or `/fake` endpoints.
- 69 backend contract tests pass.

## Why Not KEEP

Clean keep is not justified:

- Router is a single large dispatcher.
- DTO/schema validation is not a first-class runtime layer.
- Runtime JSON persistence and PostgreSQL schema/read model are not one authoritative model.
- Several runtime values cannot be inserted into the SQL schema without mapping.
- Failed calculation operations do not consistently write failure audit logs.
- Some alias/draft endpoints echo request bodies without persistence, snapshots, or audit.
- The export gate allows `ALLOCATED`; the brief requires locked/confirmed for confirmation-style exports.
- Generated frontend/output debris and AGENTS cleanup were not performed because the worktree is dirty and deletion has instruction conflicts.

## Evidence Table

| Problem | Severity | File position | Fixed |
|---|---|---|---|
| Monolithic router | P2 | `backend/dvas/app.py:78-384` | No |
| Service layer exists | Positive | `backend/dvas/app.py:31-46`, `backend/dvas/services.py` | N/A |
| DTO/schema weak at runtime | P2 | validation spread across service methods | No |
| Split JSON write model vs PostgreSQL read model | P1 | `repository.py`, `postgres_read_model.py` | No |
| DB/runtime enum mismatch | P1 | `db/dvas_p0_01_schema.sql`, runtime services | No |
| MD-DShap default present | Positive | `services.py:2144-2172`, `repository.py:23-26` | N/A |
| Algorithm mode not validated | P2 | `services.py:2144-2147` | No |
| Non-data MD-DShap exclusion present | Positive | `services.py:2097-2136` | N/A |
| State gates present but not centralized | P2 | `services.py:533-660`, service-specific guards | No |
| Export allows allocated state | P1 | `services.py:2987-2993` | No |
| Success snapshots/audits present | Positive | service methods and `write_audit` | N/A |
| Failure audits incomplete | P1 | many `raise ApiError` paths | No |
| Report/checksum history present | Positive | `services.py:3047-3126` | N/A |
| Old frontend API residue not found in backend | Positive | route scans | N/A |
| Draft echo routes need refactor | P2 | `app.py:191-262`, `app.py:316-321` | No |
| Generated debris exists | P3 | `.DS_Store`, `__pycache__`, `output/`, `ui_rebuild/` | No |

## Deletion List

Deleted: none.

Candidate deletions are listed in `BACKEND_DELETION_LOG.md`.

## Keep List

- `backend/dvas/server.py`: simple local HTTP adapter.
- `backend/dvas/app.py`: keep behavior, split router later.
- `backend/dvas/services.py`: keep domain logic, split into modules.
- `backend/dvas/contracts.py`: keep standard envelope, constants, checksum helper.
- `backend/dvas/repository.py`: keep as P0 local adapter or migrate to SQL writer.
- `backend/dvas/postgres_read_model.py`: keep as SQL read model, but fold into persistence architecture.
- `backend/openapi.yaml`: keep API contract, update after route/DTO cleanup.
- `backend/tests/test_api_contract.py`: keep as regression baseline.
- `db/*.sql`: keep schema/seed/validation, align enums/fields to runtime or vice versa.

## Test And Startup Results

Validation run:

```text
PYTHONDONTWRITEBYTECODE=1 python3.12 -m py_compile backend/dvas/*.py
PASS

PYTHONDONTWRITEBYTECODE=1 python3.12 -m unittest backend.tests.test_api_contract -v
Ran 69 tests in 0.250s
OK

git diff --check
PASS

python3.12 minimal DvasApplication status call
GET /api/v1/projects/current True OK ALLOCATED
GET /api/v1/dashboard/preconditions True OK ALLOCATED
```

Runtime caveat: the minimal default `DvasApplication()` call returned `ALLOCATED` because existing ignored local state under `backend/runtime/dvas_state.json` is loaded by default. Tests use isolated in-memory repositories and prove a fresh chain starts from `DRAFT`.

## Minimal Surgery Plan

1. Freeze and clean working tree, or explicitly whitelist existing dirty files.
2. Delete generated debris only after logging in `BACKEND_DELETION_LOG.md`.
3. Split `app.py` dispatch into domain routers without changing route behavior.
4. Add DTO/schema validation module and move echo/draft endpoints into real services or remove them.
5. Add canonical enums for statuses, snapshot types, report formats, allocation modes, and constraint types.
6. Align SQL schema and runtime model, especially `VALIDATED`, `COMPLETED`, `ALGORITHM_AUDIT`, `MARKDOWN`, `MD_DSHAP_WEIGHT_WITH_CONSTRAINTS`, and allocation result versioning.
7. Add `ProjectStateMachine` and route every status transition through it.
8. Add `SnapshotService` and `AuditService.record_failure` to ensure failed calculations are auditable.
9. Decide whether P0 runtime writes JSON only or writes PostgreSQL. Do not keep both as competing authorities.
10. Re-run py_compile, 69 backend tests, `git diff --check`, PostgreSQL acceptance, and backend API smoke.

