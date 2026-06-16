# Milestone Plan

All dates use Beijing Time. The plan is a coding-readiness plan, not an implementation record.

## Phase 0: Pre-Coding Freeze

Input:

- User-approved hard boundaries.
- Current agent governance files.
- Existing `system_scope.md` and `milestone_plan.md` drafts.
- Orchestrator review from all project-scoped custom agents.

Output:

- Frozen scope, requirements, architecture, API/data contract, UI flow, allocation logic, test plan, compliance boundary, development task breakdown, and checklist.
- Formal R&D archive deliverables under `docs/deliverables/`, including requirements, detailed design, database design, UI design, test plan, test report baseline, and administrator manual.

Acceptance Criteria:

- All eleven freeze documents exist under `docs/`.
- All eight formal archive deliverables exist under `docs/deliverables/`.
- The documents state what the MVP does and does not do.
- Shapley, DAUS, contract constraints, simulated data, and medical sample boundaries are unambiguous.
- `docs/pre_coding_freeze_checklist.md` states whether coding may start.

## Phase 1: Core Data Structures And Pipeline

Input:

- `docs/api_and_data_contract.md`
- `docs/system_architecture.md`
- `docs/development_task_breakdown.md`

Output:

- Repository package layout for core modules.
- Data models for input package, participant, data unit, quality signal, utility signal, contribution result, contract constraint, allocation reference, and report artifact.
- Deterministic pipeline skeleton with validation and artifact handoff points.

Acceptance Criteria:

- No dependency is added without approval.
- Schema names match the frozen API/data contract.
- Invalid input returns structured errors.
- Pipeline output can be inspected without frontend code.

## Phase 2: Contribution Metering, Quality Assessment, And Utility Modeling

Input:

- Phase 1 data structures.
- `docs/allocation_logic_design.md`
- `docs/test_plan.md`

Output:

- Deterministic quality assessment logic.
- Data Unit metering logic.
- Utility modeling logic.
- Unit tests for formula boundaries, missing fields, and stable repeat output.

Acceptance Criteria:

- Identical input produces identical output.
- Formula assumptions are documented in code comments only where needed and in docs.
- No hidden medical assumptions are introduced.
- Results remain intermediate signals, not final business settlement.

## Phase 3: DAUS / Shapley / Contract Constraints

Input:

- Phase 2 contribution, quality, and utility signals.
- Frozen contract constraint draft.

Output:

- DAUS contribution signal.
- Shapley weight reference.
- Contract constraint application for minimum guarantee, cap, expert confirmation, and human confirmation flags.
- Final allocation reference output.

Acceptance Criteria:

- Shapley is represented only as a computation-layer weight method.
- Final allocation reference explicitly records applied constraints.
- No MAR, Effective DU, or `token_weighting` main-flow term appears.
- Edge cases for zero totals, caps, and confirmation-required outputs are tested.

## Phase 4: Report And Audit

Input:

- Pipeline artifacts from Phases 1-3.
- `docs/compliance_and_audit_boundary.md`
- `docs/test_plan.md`

Output:

- Report data structure.
- Audit summary with inputs, intermediate signals, formulas, constraints, warnings, and generated timestamp.
- Simulated example report.

Acceptance Criteria:

- Report labels simulated examples as simulated.
- Report does not claim real hospital or real business settlement results.
- Audit trace links output fields back to input and intermediate artifacts.
- Report validation checks are documented.

## Phase 5: Lightweight Frontend Demo

Input:

- Frozen API/data contract.
- Report artifact structure.
- `docs/ui_flow.md`

Output:

- Lightweight demo UI for input review, pipeline execution, signal inspection, allocation reference, report display, and export entry point.

Acceptance Criteria:

- UI uses only approved API fields.
- UI does not invent backend schema.
- UI states simulated data boundaries.
- Demo path can be validated by QA with the frozen acceptance checks.

## Cross-Phase Controls

- PM Strategy Agent coordinates scope and escalation.
- PRD becomes the single source of truth after freeze.
- API/schema changes after Phase 0 require PM and user approval.
- No push without explicit user approval.
- Product code starts only after Phase 0 checklist permits coding.
