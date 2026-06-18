# System Architecture Input

## Architecture Positioning

This document is a design input, not an implementation claim. It describes the
service and domain boundaries that future code should follow after the user
explicitly opens implementation scope.

## Domain Layers

```text
System home / orchestration
-> data ingestion and snapshots
-> data resource recognition and party relations
-> quality assessment
-> shuyuan metering
-> contribution and utility
-> MD-DShap weight calculation
-> allocation simulation and contract constraints
-> reporting and audit
-> system parameters and P1 access control
```

## Service Boundary Input

| Service | Documentation responsibility |
| --- | --- |
| ProjectService | Project creation, copy new version, status summary. |
| DataIngestionService | Demo case selection, JSON upload, validation, preview, input snapshot. |
| ResourceService | Resource metadata, field statistics, party binding, resource summary export. |
| PartyService | Party create/update/status, data-provider flag, MD-DShap inclusion flag. |
| QualityService | Weight configuration, assessment, score detail, versioning. |
| ShuyuanService | Base price, coefficient, call count, metering detail. |
| UtilityService | Contribution factors, normalized contribution, utility function, trace. |
| MDDShapService | Task creation, progress, marginal trace, weights, rerun, audit export. |
| AllocationService | Revenue pool, priority items, simulation, scheme lock, comparison. |
| ConstraintService | Constraint create/update/disable/apply trace. |
| ReportService | Markdown/CSV/JSON/JSONL export, report manifest, checksum; PDF P1. |
| AuditService | Log query, snapshot detail, JSONL export. |
| ParameterService | Parameter versions and risk text. |
| UserAccessService | P1 login/RBAC only. |

## Boundary Rules

- UI must not implement independent allocation math.
- Report generation consumes saved results and snapshots; it must not
  recompute.
- API/schema/data model implementation changes require PM and user approval.
- Database design docs are inputs only; do not treat example DDL as migration
  implementation in this round.
- Every calculation boundary must preserve input, parameter, output, and audit
  snapshots.
