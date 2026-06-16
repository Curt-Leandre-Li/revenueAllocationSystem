# Test Plan

## Test Scope

Testing covers documentation contracts, deterministic pipeline behavior, API/data contract compatibility, UI acceptance, report output, and regression checks.

Testing does not cover production deployment, authentication, payment processing, or live third-party integrations in the MVP.

## Unit Tests

- Validation: required fields, unknown participant references, invalid numeric ranges, simulated-data flag.
- Quality: completeness, validity, consistency, traceability formula boundaries.
- Metering: Data Unit quantity and Token count handling.
- Utility: deterministic utility output for fixed input.
- Contribution: DAUS and Shapley reference stability.
- Allocation: minimum guarantee, cap, confirmation-required flags, zero revenue pool, zero contribution total.
- Reporting: section presence and warning propagation.

## Integration Tests

- Valid input package runs through the full pipeline.
- Invalid input stops before computation.
- Contract constraints are applied after contribution references.
- Report artifact contains input summary, intermediate artifacts, allocation reference, and audit trace.

## Contract Tests

- Input JSON follows `docs/api_and_data_contract.md`.
- Output JSON contains expected top-level keys.
- Error structure includes `code`, `message`, `path`, and `severity`.
- API or local function names do not introduce unapproved fields.

## UI Acceptance

- UI can load a simulated sample.
- UI shows validation result.
- UI shows pipeline step state.
- UI shows quality, metering, utility, contribution, and allocation reference sections.
- UI labels simulated data.
- UI does not claim final payment or settlement.

## Report Acceptance

- Report includes title, generated time, simulated-data flag, summary, sections, warnings, and audit trace.
- Report identifies Shapley as contribution reference only.
- Report identifies contract constraints and confirmation-required states.
- Report does not describe simulated examples as real business outcomes.

## Regression Tests

- Golden sample input produces stable output.
- Re-running the same input produces the same deterministic values.
- Boundary cases for empty data units, missing participants, and invalid constraints remain covered.

## Validation Commands

Initial commands before code exists:

```bash
git status --short
git diff --check
find docs -maxdepth 1 -type f | sort
```

Expected future commands after Python code exists:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m pytest -q -p no:cacheprovider
```

Expected future commands after frontend code exists:

```bash
npm --prefix demo_ui test
npm --prefix demo_ui run build
```

Do not claim future commands pass until the related code and project files exist.

## Test Case Matrix

| ID | Type | Fixture | Expected Result | Current Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| TC-VAL-001 | Contract | valid simulated package | Validation returns `ok = true` | Not run | Code not implemented |
| TC-VAL-002 | Contract | missing participant ID | Structured error with field path | Not run | Code not implemented |
| TC-PIPE-001 | Integration | valid simulated package | Full artifact envelope returned | Not run | Code not implemented |
| TC-ALLOC-001 | Unit | cap lower than base amount | Cap warning and adjusted reference | Not run | Code not implemented |
| TC-REPORT-001 | Report | complete pipeline artifact | Report contains simulated-data statement | Not run | Code not implemented |
| TC-UI-001 | UI | valid report artifact | UI renders report and warnings | Not run | UI not implemented |
