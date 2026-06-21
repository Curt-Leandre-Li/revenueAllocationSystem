# P0 CI Evidence Summary

| Workflow | Branch | Commit | Run ID | Result | Coverage | Artifact |
|---|---|---|---:|---|---|---|
| P0 Database Acceptance | `p0-postgres-acceptance` | `7db4a38` | `27894194835` | PASS | PostgreSQL 16, SQL 00-04, validation SQL, DB smoke | None |
| P0 Database Acceptance | `phase-2a-backend-postgres-read-api` | `e6081c5e4bafd6f9e01eceebf7fc7f53985fc3bd` | `27894627475` | PASS | PostgreSQL 16, SQL 00-04, backend read API smoke | None |
| Phase 2B Pipeline Write DB | `phase-2b-pipeline-write-db` | `fdb94158696ba8023045d86cafd0cf6ce25a3b81` | `27895440063` | PASS | Seed DB, backend demo load, pipeline run, confirmation, report generate | None |
| Phase 2C Frontend Real API | `phase-2c-frontend-real-api` | `41bbc80d2f5617ff4b3c9db6b133eec1d77f4dc3` | `27896151068` | PASS | Phase 2B write smoke, backend API smoke, frontend real API smoke, frontend build | None |
| Phase 2D UI Acceptance | `phase-2d-ui-acceptance-screenshots` | `8b7ba9310b332e8ffa905bcf1f0cfe23d4320288` | `27897363388` | PASS | Phase 2B write smoke, backend API smoke, frontend real API smoke, frontend build, screenshot capture | `phase-2d-screenshots`, artifact id `7773025213` |
| P0 Final Release Gate | `phase-2e-final-release-audit` | Phase 2E package commit | assigned after push | pending before push | Final DB/write/API/frontend/build/unit/screenshot/doc gate | `p0-final-ui-screenshots`, `p0-final-release-docs` when CI completes |

## Evidence Interpretation

- Earlier phase runs prove the implementation slice that each phase introduced.
- The final release gate is intended to rerun the full P0 path on the Phase 2E branch before PR/merge to `main`.
- Screenshot PNG files are CI artifacts, not source-controlled files.
