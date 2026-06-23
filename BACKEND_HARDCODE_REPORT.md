# Backend Hardcode Report

No hardcode cleanup was performed in this pass.

## Findings

| Severity | Pattern | Evidence | Assessment | Action |
|---|---|---|---|---|
| P1 | PostgreSQL default URL and password | `backend/dvas/postgres_read_model.py:11`, `.env.example`, `Makefile` | Local default is useful, but password and host should not be hidden in production code. | Move to config, keep `.env.example` for local only. |
| P2 | `127.0.0.1` / local API base | `backend/openapi.yaml:10`, `backend/dvas/server.py`, Makefile Docker psql host | Acceptable for P0 local, but not clean for deployable backend. | Make OpenAPI server generated/configured. |
| P2 | Absolute local paths in README | `README.md` startup commands use `/Users/apple/Desktop/...` | Not backend runtime code, but not portable. | Replace with relative commands when README scope opens. |
| P2 | Fixed project id | `backend/dvas/repository.py:52`, tests use `project_p0_local_demo` | Acceptable P0 local demo default, but not multi-project clean. | Centralize as P0 config/seed constant. |
| P2 | Fixed demo scenario | `backend/dvas/demo_data.py` lung-screening example | Allowed as sample, but must not be the only business scenario long-term. | Keep isolated demo provider; add neutral sample later. |
| P2 | Fixed quality weights and scoring | `app.py:191-201`, `services.py:1340-1346` | Good enough skeleton, not final parameterized quality module. | Move weights to `quality_metric_template`/system parameters. |
| P2 | Fixed total revenue default | `DashboardService.quick_run`, `AllocationService.run` default to `1000` | Convenient demo default; should be explicit user/system parameter. | Move to system parameter or require input. |
| P2 | MD-DShap config echo/hardcoded defaults | `app.py:253-262`, `repository.py:23-26` | Defaults are allowed, but route should read from `SystemParameterService`. | Refactor config route. |
| P2 | Report filenames | `ReportService.generate_*` uses fixed file names | Acceptable P0 file contract, but should be centralized. | Extract report field/file contract constants. |
| P2 | Disclaimer text in multiple locations | `contracts.SIMULATION_DISCLAIMER`, `ReportService.EXTENDED_DISCLAIMER`, dashboard risk strings | No semantic conflict, but scattered. | Centralize template/config and reference everywhere. |
| P3 | `.DS_Store` and `__pycache__` | root/backend/docs `.DS_Store`, backend/scripts pycache | Generated/local debris. | Delete after dirty-tree gate. |

## Allowed Hardcodes

- `LOCAL_OPERATOR` is centralized in `backend/dvas/contracts.py` and is allowed for P0.
- `MD_DSHAP` as default algorithm is allowed, but should come through enum/parameter paths consistently.
- P0 export formats Markdown/CSV/JSON/JSONL are allowed.
- State and constraint enums are allowed when centralized; they are not centralized enough today.

## No Secrets Found

No cloud tokens, API keys, or real credentials were found in backend source. The default PostgreSQL password `password` appears only as local development/CI configuration and should remain non-production.

