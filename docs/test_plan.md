# Test Plan

## Current Round

This round validates documentation consistency only. Do not write tests or
modify `tests/`.

## Documentation Checks

- Authority order points to the three latest root baseline documents.
- Navigation matches `docs/product_navigation.md`.
- P0/P1 boundary matches `docs/current_project_baseline.md`.
- MD-DShap default and Basic Shapley baseline rules match
  `docs/algorithm_scope.md`.
- Export files, fields, `report_id`, and `checksum` match
  `docs/reporting_contract.md`.
- UI requirements match `docs/ui_design_spec.md`.
- Audit and compliance language match `docs/compliance_and_audit_boundary.md`.

## Future Implementation Test Scope

Only after user approval opens implementation:

- Input validation tests for demo/JSON packages.
- Quality assessment tests.
- Shuyuan metering tests.
- Contribution and utility tests.
- MD-DShap task/result/trace tests.
- Allocation simulation and contract constraint tests.
- Report/export field tests.
- Audit log and snapshot tests.
- UI acceptance tests for the six navigation groups.

## Acceptance Matrix

Use `docs/acceptance_checklist.md` as the module and button-level acceptance
matrix.

## Commands

Current documentation validation:

```bash
git diff --check
git status --short
```

Future tests must not be claimed as passing until code exists and commands have
actually run.
