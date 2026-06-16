# Development Task Breakdown

## Task Rules

- Do not start coding until `docs/pre_coding_freeze_checklist.md` allows it.
- Each task must name input docs, output files, and validation commands.
- API/schema changes after freeze require PM and user approval.
- No push without explicit user approval.
- No new dependency without explicit user approval.

## Backend Tasks

Task: Define contracts.

- Input: `docs/api_and_data_contract.md`, `docs/system_architecture.md`
- Output: contract data structures under the approved backend path.
- Acceptance: fields match the frozen contract and tests cover valid/invalid samples.

Task: Build validation and pipeline skeleton.

- Input: frozen contracts and `docs/test_plan.md`
- Output: validation module and pipeline orchestration.
- Acceptance: invalid input returns structured errors and valid input reaches placeholder artifacts without hidden fields.

Task: Implement report artifact builder.

- Input: `docs/compliance_and_audit_boundary.md`
- Output: report structure with audit trace and simulated-data labels.
- Acceptance: report contains required sections and warnings.

## Frontend Tasks

Task: Build workflow shell.

- Input: `docs/ui_flow.md`, `docs/api_and_data_contract.md`
- Output: page layout and navigation for the demo flow.
- Acceptance: UI shows approved pages and states without custom business math.

Task: Build signal and allocation panels.

- Input: backend output contract.
- Output: quality, metering, utility, contribution, allocation, and warning panels.
- Acceptance: panels use only approved fields.

Task: Build report and export views.

- Input: report artifact contract.
- Output: report display and export entry points.
- Acceptance: simulated-data and confirmation-required labels are visible.

## Algorithm Tasks

Task: Implement quality, Data Unit metering, and utility formulas.

- Input: `docs/allocation_logic_design.md`
- Output: deterministic formula modules.
- Acceptance: tests prove stable output for fixed input.

Task: Implement DAUS and Shapley contribution reference.

- Input: contribution signals and approved formula notes.
- Output: contribution reference artifacts.
- Acceptance: output is not labeled final allocation.

Task: Implement contract constraint application.

- Input: contribution references and contract constraints.
- Output: final allocation reference.
- Acceptance: minimum guarantee, cap, and confirmation-required cases are tested.

## Report Tasks

Task: Create audit report sections.

- Input: all pipeline artifacts.
- Output: summary, assumptions, formulas, constraints, warnings, and trace appendix.
- Acceptance: report is audit-readable and avoids real-data claims.

## Testing Tasks

Task: Unit and integration tests.

- Input: `docs/test_plan.md`
- Output: tests for validation, formulas, pipeline, allocation, and report.
- Acceptance: project test command passes once code exists.

Task: Contract tests.

- Input: `docs/api_and_data_contract.md`
- Output: tests that compare sample input/output with schema expectations.
- Acceptance: unapproved field drift fails tests.

## Documentation Tasks

Task: Keep freeze docs aligned with implementation.

- Input: code changes and agent reports.
- Output: updated docs only when behavior is approved.
- Acceptance: docs do not claim unimplemented behavior as current fact.

Task: Update formal system test report after coding.

- Input: actual test commands, logs, defects, and fixes.
- Output: updated `docs/deliverables/06_系统测试报告.md`.
- Acceptance: report uses real execution evidence and does not claim unrun tests passed.

Task: Complete administrator manual runtime commands after coding.

- Input: actual local run commands and configuration files.
- Output: updated `docs/deliverables/07_管理员手册.md`.
- Acceptance: manual distinguishes implemented commands from planned commands.

Task: Reconcile database design with actual storage implementation.

- Input: implemented storage approach.
- Output: updated `docs/deliverables/03_数据库设计.md`.
- Acceptance: document states whether the MVP remains file/in-memory based or adds approved persistence.

Task: Reconcile UI design with actual pages.

- Input: implemented frontend pages and screenshots when available.
- Output: updated `docs/deliverables/04_UI设计方案.md`.
- Acceptance: page list, states, and component descriptions match the actual UI.

## Agent Assignment Readiness

- Backend tasks can be assigned to `backend_agent` with QA review.
- Frontend tasks can be assigned to `frontend_agent` with UI and QA review.
- Algorithm tasks remain under `backend_agent` unless a separate algorithm agent is approved later.
- Testing tasks can be assigned to `qa_agent`.
- Documentation and compliance tasks can be assigned to `docs_agent` and `compliance_audit_agent`.
