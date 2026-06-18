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
- MD-DShap weights are not payment instructions or legal settlement ratios.

## Allocation Sequence

```text
total_revenue
-> contract priority allocation for eligible non-data parties
-> data_provider_revenue_pool
-> MD-DShap or approved fallback weight allocation for data providers
-> contract constraints
-> allocation simulation reference
-> manual lock or copy new version
-> report and audit export
```

## Non-Data Parties

Operators, pilot bases, technical service providers, expert reviewers, and
similar non-data contribution parties do not enter the MD-DShap pool by default.
They are handled through contract priority allocation, fixed ratio, floor, cap,
minimum, maximum, or related constraints.

## Version And Audit Rules

- Single data-provider scenarios use weight 1 and disclose single-party
  simplified allocation.
- Weights normalize to 1 and display with 6 decimals.
- Recalculation creates new task/result/trace versions.
- Reports must preserve input snapshots, parameter snapshots, result snapshots,
  algorithm version, assumptions, and boundary notes.
