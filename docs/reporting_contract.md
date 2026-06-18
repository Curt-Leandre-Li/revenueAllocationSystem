# Reporting Contract

## Boundary

P0 exports Markdown, CSV, JSON, and JSONL. PDF is P1.

Every export must include or be associated with:

- `report_id`
- `checksum`
- `project_id`
- source snapshot references
- generated timestamp
- created by
- field scope
- disclaimer: 系统结果仅为模拟参考，非法律结算 / 非法定结算结果

Repeated exports create new versions and must not silently overwrite historical
files.

## Core Export Files

| File | Format | P0 | Required content |
| --- | --- | --- | --- |
| `allocation_summary.md` | Markdown | Yes | Project summary, input summary, participants, total revenue, priority allocation, data-provider pool, algorithm mode, allocation result, constraints, rounding, disclaimer. |
| `source_level_allocation.csv` | CSV | Yes | `project_id`, `scenario_id`, `party_id`, `party_name`, `party_type`, `is_data_provider`, `raw_weight`, `normalized_weight`, `pre_constraint_amount`, `post_constraint_amount`, `constraint_adjustment_reason`. |
| `quality_assessment_report.md` | Markdown | Yes | Quality score, level, dimension scores, evidence, warnings, parameter snapshot. |
| `quality_assessment_result.json` | JSON | Yes | `assessment_id`, `project_id`, `package_id`, metric version, weights, scores, evidence, warnings, `created_at`. |
| `shuyuan_metering_statement.md` | Markdown | Yes | Base price, coefficients, call count, resource/party/project amounts, formula note. |
| `contribution_utility_result.csv` | CSV | Yes | Party contribution, normalized contribution, quality/usage/scenario factors, utility value. |
| `participant_weight.csv` | CSV | Yes | `task_id`, `algorithm_mode`, party, participant weight, normalized weight, baseline weight, diff, version. |
| `task_level_weight.csv` | CSV | Yes | Task-level weight details when task dimension exists. |
| `marginal_contribution_trace.csv` | CSV | Yes | Trace rows, coalition, utility before/after, marginal contribution, seed, timestamp. |
| `md_dshap_audit_report.md` | Markdown | Yes | Algorithm mode, version, participant set, task set, utility source, `v(S,t)`, parameters, marginal summary, weights, approximation, boundary. |
| `allocation_confirmation_statement.md` | Markdown | Yes | Confirmation id, allocation version, confirmer, time, summary table, manual notes, contract boundary, disclaimer. |
| `audit_log.jsonl` | JSONL | Yes | One log per line with operator, module, menu, object, before/after, snapshot ids, status, failure reason, checksum. |
| `assumptions.json` | JSON | Yes | Data boundary, algorithm assumptions, utility source, approximation, contract boundary, P0 limitations, P1 plan, disclaimer. |
| `run_summary.json` | JSON | Compatible | May be used as a run-level summary if already present. |
| `report_manifest.json` | JSON | Recommended | `report_id`, file list, checksums, source result ids, created by. |

## Export Dialog Requirements

- File list.
- Field/section scope.
- Report version.
- Disclaimer.
- Expected `report_id` and checksum behavior.
- Disabled PDF action in P0 with P1 label.
