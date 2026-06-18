# Compliance And Audit Boundary

## Compliance Boundary

DVAS V1.2 is a data revenue allocation simulation and audit-explanation system.
It does not provide legal advice, statutory settlement, financial payment,
contract performance, formal asset appraisal, medical conclusion, compliance
certification, tax workflow, bank workflow, or authority approval.

Required wording for user-facing surfaces:

```text
系统结果仅为模拟参考，非法律结算 / 非法定结算结果。
```

## Sensitive Data Boundary

P0 uses demo data or user-provided JSON. Pages and docs must warn users not to
upload real sensitive data. Medical-looking sample data must be described as
simulated and desensitized demonstration data.

## Algorithm Boundary

- MD-DShap calculates weights only.
- Basic Shapley is only `baseline_check`.
- DAUS / utility values are input signals, not final allocation.
- Weights and allocation outputs are simulation references.
- Non-data contribution parties are handled through contract priority or
  constraints by default.

## Audit Requirements

Calculation and export audit records should preserve:

- input snapshot
- parameter snapshot
- result/output snapshot
- algorithm version
- `task_id`, `result_id`, trace references
- `report_id`
- `checksum`
- `module_code`
- `menu_code`
- operator
- operation type
- before/after values for changes
- status and failure reason

## Software Copyright Material Boundary

Software copyright materials may describe system name, purpose, modules,
navigation, design inputs, audit-readable reports, and simulated sample data.
They must not claim production deployment, real settlement authority, real
payment, real medical data processing, or passed tests without evidence.
