# System Architecture

## Overall Architecture

The MVP is a local-first, deterministic pipeline with a light demonstration UI added only after data contracts are frozen.

```text
Demo UI or local runner
-> API / pipeline entry
-> input validation
-> quality assessment
-> Data Unit metering
-> utility modeling
-> DAUS / Shapley contribution reference
-> contract constraint application
-> allocation reference
-> report builder
```

## Module Split

- `src/contracts`: shared input and output data structures.
- `src/validation`: schema checks, range checks, and structured errors.
- `src/quality`: quality signal calculation.
- `src/metering`: Data Unit metering.
- `src/utility`: utility signal calculation.
- `src/contribution`: DAUS and Shapley contribution reference.
- `src/allocation`: contract constraint application and final allocation reference.
- `src/reporting`: audit report artifact builder.
- `src/pipeline`: orchestration across modules.
- `demo_ui`: lightweight frontend demo after contracts freeze.
- `tests`: unit, integration, contract, report, and UI acceptance tests.

These paths are coding suggestions, not existing implementation claims.

## Data Flow

- Input package enters through a local runner or API endpoint.
- Validation produces errors and warnings before computation.
- Quality, metering, and utility modules produce intermediate artifacts.
- Contribution module calculates DAUS and Shapley references from approved signals.
- Allocation module applies contract constraints after contribution references.
- Reporting module reads all artifacts and produces an audit-readable report.

## Pipeline Flow

1. Load input package.
2. Validate required fields and numeric ranges.
3. Normalize allowed internal representation without changing business meaning.
4. Compute quality signals.
5. Compute Data Unit metering.
6. Compute utility signals.
7. Compute DAUS and Shapley contribution references.
8. Apply contract constraints.
9. Build allocation reference.
10. Build report artifact.

## Input And Output Contracts

The coding source for contracts is `docs/api_and_data_contract.md`. Implementation must not invent extra fields. If a required field is missing, coding must stop and request PM/user approval before changing the contract.

## Module Responsibility Boundaries

- Validation may reject input but must not calculate contribution.
- Quality may calculate quality scores but must not allocate revenue.
- Metering may calculate Data Unit quantities but must not decide final allocation.
- Utility may calculate utility signals but must not apply contract constraints.
- Contribution may calculate DAUS and Shapley references but must not represent them as final allocation.
- Allocation applies approved constraints and emits allocation reference.
- Reporting explains artifacts and warnings but must not change computation.
- UI displays approved fields and must not implement independent business math.

## Suggested Coding Directory

```text
src/
  contracts/
  validation/
  quality/
  metering/
  utility/
  contribution/
  allocation/
  reporting/
  pipeline/
tests/
demo_ui/
```

No directory should be created until its coding task is assigned.
