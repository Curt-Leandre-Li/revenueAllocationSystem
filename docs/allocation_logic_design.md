# Allocation And Algorithm Logic Design

This file is superseded in detail by `docs/algorithm_scope.md`; it remains as a
compatibility entrypoint for older references.

## Current Algorithm Positioning

- Quality assessment, shuyuan metering, contribution calculation, and utility
  calculation produce auditable input signals.
- DAUS / utility layer carries contribution, quality, usage, and scenario
  signals and provides `v(S,t)` or utility input to MD-DShap.
- MD-DShap is the default contribution weight calculation strategy.
- Basic Shapley is only a small-scale `baseline_check` for audit comparison.
- MD-DShap weights are not payment instructions, legal settlement ratios, or
  direct total-revenue allocation results.

## Allocation Sequence

```text
total_revenue
-> saved contract-ratio plan
-> non-data contract amounts from ratio items
-> data_provider_revenue_pool
-> MD-DShap normalized-weight allocation for data providers
-> tail-difference handling
-> allocation simulation reference
-> manual lock or copy new version
-> report and audit export
```

## Non-Data Parties

Operators, pilot bases, technical service providers, expert reviewers, and
similar non-data contribution parties do not enter the MD-DShap pool by default.
They are handled through saved contract-ratio items in the current P0 chain.
Old floor/cap/minimum/maximum constraint wording is compatibility context only,
not the current contract allocation main path.

## Formula Baseline

```text
contract_ratio_sum = data_provider_pool_ratio + sum(non_data_party_ratio_j) = 1.000000
non_data_contract_amount_j = total_revenue × non_data_party_ratio_j
data_provider_revenue_pool = total_revenue × data_provider_pool_ratio
data_provider_amount_i = data_provider_revenue_pool × md_dshap_normalized_weight_i
```

Required constraints:

- saved contract-ratio plan exists
- `contract_ratio_sum = 1.000000`
- `data_provider_revenue_pool >= 0`
- `sum(md_dshap_normalized_weight_i) = 1`

## Version And Audit Rules

- Single data-provider scenarios use weight 1 and disclose single-party
  simplified allocation.
- Weights normalize to 1 and display with 6 decimals.
- Recalculation creates new task/result/trace versions.
- Reports must preserve input snapshots, parameter snapshots, result snapshots,
  algorithm version, assumptions, and boundary notes.
