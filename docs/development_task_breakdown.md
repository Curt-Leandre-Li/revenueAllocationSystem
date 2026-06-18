# Development Task Breakdown

## Current Round

Documentation synchronization only. No code, tests, migrations, dependencies,
UI implementation, API implementation, or runnable scripts are changed.

## Future Implementation Tasks

These tasks are not authorized until the user explicitly opens implementation
scope.

### Product And Contract

- Freeze the canonical route paths where V1.3/V1.1/V1.0 docs differ.
- Convert V1.2 data objects into implemented contracts.
- Define sample JSON fixtures for demo data without sensitive real data.

### Backend

- Implement data ingestion and validation.
- Implement snapshot and audit logging.
- Implement quality assessment, shuyuan metering, contribution, and utility.
- Implement MD-DShap task/result/trace.
- Implement allocation simulation and contract constraints.
- Implement report/export generation.

### Frontend

- Implement the six-group left navigation.
- Implement module pages, precondition checks, dialogs, empty states, locked
  states, and copy-new-version flow.
- Show disclaimers on every page.

### QA

- Implement module and button-level tests from `docs/acceptance_checklist.md`.
- Add export field and checksum checks.
- Add audit trace and snapshot checks.

### DevOps

- Document local run commands after implementation exists.
- P1/P2 deployment, CI/CD, secrets, and cloud work require separate approval.

## Assignment Rules

- Backend implementation remains with `backend_agent`.
- Frontend implementation remains with `frontend_agent`.
- UI design input remains with `ui_designer`.
- QA checks remain with `qa_agent`.
- Documentation and copyright mapping remain with `docs_agent`.
- Compliance and audit boundary remain with `compliance_audit_agent`.
- DevOps remains documentation-only unless explicitly approved.
