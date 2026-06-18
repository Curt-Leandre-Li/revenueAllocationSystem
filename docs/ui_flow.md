# UI Flow And Design Input

This file is the compatibility entrypoint for UI flow references. Detailed UI
requirements live in `docs/ui_design_spec.md`.

## Global UI Baseline

- 1440x900 desktop Web management backend.
- Chinese interface.
- B-end SaaS / consulting-company style.
- White background, dark blue navigation, light blue information regions, gray
  dividers.
- Every page prominently displays: 系统结果仅为模拟参考，非法定/非法律结算结果.

## Navigation

Use the six primary navigation groups from `docs/product_navigation.md`.
Historical linear pages such as Input Package, Pipeline Review, and Export are
now mapped into the left navigation modules.

## Required Interaction Rules

- Calculation buttons show precondition checks before execution.
- Export dialogs show files, field scope, report version, `report_id` /
  `checksum` behavior, and disclaimer.
- Recalculation warns that history is not overwritten.
- Confirmed/exported projects gray out edit buttons and offer copy new version.
- Empty states explain the next operation.
- Error states identify the field, precondition, or business rule.
