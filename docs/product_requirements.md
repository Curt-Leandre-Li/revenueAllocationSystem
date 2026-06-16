# Product Requirements

## User Roles

- Product owner: approves scope, priorities, acceptance criteria, and phase freeze.
- Data operations user: prepares simulated input packages and resolves validation errors.
- Business analyst: reviews quality, utility, contribution, and allocation reference outputs.
- Auditor or reviewer: checks traceability, assumptions, warnings, and report consistency.
- Developer or agent: implements only the approved scope and file area.

## Use Scenarios

- A user uploads or pastes a simulated generic data contribution package.
- The system validates fields, ranges, participant references, and Data Unit records.
- The system calculates quality, utility, contribution, and allocation reference artifacts.
- The user reviews intermediate signals before viewing the final allocation reference.
- The system produces an audit-readable report for software copyright demonstration and internal review.

## Functional Requirements

- FR-01: Accept a generic JSON input package.
- FR-02: Validate required package, participant, data unit, contract, and report metadata fields.
- FR-03: Produce structured validation errors.
- FR-04: Compute deterministic quality signals.
- FR-05: Compute deterministic Data Unit metering results.
- FR-06: Compute deterministic utility signals.
- FR-07: Produce DAUS and Shapley contribution references.
- FR-08: Apply contract constraints after contribution references are calculated.
- FR-09: Produce final allocation reference and warnings.
- FR-10: Produce a report structure that explains inputs, formulas, assumptions, constraints, and simulated data boundaries.

## Input Requirements

- Input must be JSON.
- Input must identify a scenario as simulated unless a future approved real-data mode exists.
- Participant IDs must be stable strings.
- Data Unit IDs must be stable strings.
- Numeric fields must be finite numbers.
- Contract constraints must be explicit and optional fields must have documented defaults.
- No field may imply real hospital, clinical, or medical production data.

## Output Requirements

- Validation output must include `ok`, `errors`, and `warnings`.
- Pipeline output must include input summary, quality signals, metering results, utility signals, contribution references, allocation reference, and report artifact.
- Every result must preserve traceability to participant and Data Unit IDs.
- Outputs must label simulated examples as simulated.
- Outputs must not claim final legal, payment, or settlement authority.

## Page Requirements

- Input package page.
- Validation result page or panel.
- Pipeline progress page or panel.
- Intermediate signal review page.
- Contribution and allocation reference page.
- Audit report page.
- Export entry point for JSON/report output.

## Report Requirements

- Report title and generated timestamp.
- Scenario and simulated-data statement.
- Input summary.
- Participant summary.
- Data Unit summary.
- Quality, utility, and contribution sections.
- Contract constraints and confirmation requirements.
- Final allocation reference.
- Warnings and assumptions.
- Audit trace appendix.

## Acceptance Criteria

- AC-01: A valid simulated input package produces the report artifact defined in `docs/api_and_data_contract.md`.
- AC-02: Invalid input returns structured errors without producing misleading allocation output.
- AC-03: Shapley appears only as a computation-layer weight reference.
- AC-04: Contract constraints are applied after contribution references.
- AC-05: Medical examples, if used, remain examples and do not alter generic schema.
- AC-06: No MAR, Effective DU, or `token_weighting` main-process term appears.
- AC-07: No test or report copy claims the system has passed tests until those tests are actually run.

## Requirement Traceability

| Requirement | Acceptance | Test Plan Anchor |
| --- | --- | --- |
| FR-01, FR-02, FR-03 | AC-01, AC-02 | Contract tests, integration tests |
| FR-04, FR-05, FR-06 | AC-01 | Unit tests |
| FR-07, FR-08, FR-09 | AC-03, AC-04 | Unit tests, integration tests |
| FR-10 | AC-05, AC-07 | Report acceptance |

## Non-Functional Requirements

- Deterministic output for identical input and configuration.
- Clear audit trail for every major result field.
- Simple local execution before external deployment work.
- No new dependency without explicit approval.
- No production security or payment claim in MVP.
- Documentation and UI copy must be concise and avoid obviously AI-like repeated phrases.
