# Algorithm Scope

## Default Strategy

MD-DShap is the default contribution weight calculation strategy for DVAS V1.2.
Basic Shapley is only a small-scale `baseline_check`; it is not the default
final allocation mode.

## Layering

| Layer | Responsibility | Not allowed |
| --- | --- | --- |
| Quality assessment | Produce quality score, quality level, dimension scores, evidence. | Legal/compliance certification. |
| Shuyuan metering | Produce resource, party, and project metering values. | Final allocation or payment. |
| Contribution calculation | Produce contribution and normalized contribution signals. | Contract settlement. |
| DAUS / utility | Provide utility values and `v(S,t)` inputs from contribution, quality, usage, and scenario signals. | Final allocation. |
| MD-DShap | Produce participant and task-level weights with marginal trace. | Payment instruction or legal settlement. |
| Allocation simulation | Apply the saved contract-ratio plan, data-provider revenue pool, MD-DShap weights, and tail-difference handling to produce simulation reference. | Real financial payment. |

## MD-DShap Rules

- Participant set includes only data-provider parties with
  `include_in_md_dshap=true`.
- Non-data contribution parties default to saved contract-ratio items outside
  the MD-DShap participant pool.
- Single data-provider scenario does not run the full algorithm; weight is 1
  and the page/report discloses single-party simplified allocation.
- Weight sum must normalize to 1. Display precision is 6 decimals.
- Recalculation creates new `task_id`, `result_id`, and trace versions.
- Reports disclose algorithm mode, version, participant set, task set, utility
  source, `v(S,t)` definition, parameters, marginal contribution summary,
  weights, complexity note, approximation assumptions, and boundary notes.

## Basic Shapley Baseline

Basic Shapley may be used when participant count is small and a baseline audit
comparison is useful. It must be labeled as `baseline_check`; any difference
from MD-DShap must be disclosed and must not silently replace the default
MD-DShap result.

## Required Outputs

- `participant_weight`
- `task_level_weight`
- `marginal_contribution_trace`
- `approximation_note`
- `algorithm_audit_snapshot`

## Failure Conditions

- No data-provider participant.
- Utility values missing for multi-party calculation.
- Weight normalization failure.
- Saved contract-ratio plan is missing, invalid, or does not sum to 1.000000.
- Required input, parameter, or output snapshot cannot be generated.
