# Backend Duplication Report

No code changes or consolidation were performed in this pass.

## Duplicate/Scattered Logic

| Rule | Evidence | Keep | Merge/delete target | Modified | Test result |
|---|---|---|---|---|---|
| JSON upload validation has one authority | `DataIngestionService._validate_upload_payload` | Keep `DataIngestionService` or move to schema module | None immediate | No | 69 backend tests pass |
| Amount precision and rounding | `ShuyuanMeteringService._number`, `AllocationService._amount`, allocation rounding helpers | Keep one money/precision utility | Duplicate service-private validators | No | 69 backend tests pass |
| Weight normalization | `MdDshapService._weights`, `_baseline_weights`, `AllocationService._weight_results` | Keep one weight utility for normalize/check | Service-private weight math | No | 69 backend tests pass |
| Project status progression | `DashboardService.preconditions`, per-service precondition checks, direct `update_project` calls | Create `ProjectStateMachine` | Scattered status gates | No | 69 backend tests pass |
| Audit log write | `write_audit` is central for success paths | Keep and harden `write_audit` | Add wrapper for failed operations | No | 69 backend tests pass |
| Snapshot generation/checksum | `_snapshot` repeated in multiple services | Create `SnapshotService` | Repeated `_snapshot` methods | No | 69 backend tests pass |
| Report export fields | `ReportService._csv_files`, `_json_payload`, `_markdown_content` | Keep `ReportService`, extract field contract constants | Duplicated field names across methods | No | 69 backend tests pass |
| MD-DShap entry | `MdDshapService.run` called by two route aliases | Keep `MdDshapService.run` | No duplicate algorithm implementation | No | 69 backend tests pass |
| Contract constraint order | `AllocationService._apply_constraints` | Keep, but document as canonical order | No separate duplicate found | No | 69 backend tests pass |
| `local_operator` | `contracts.LOCAL_OPERATOR`; SQL defaults repeat literal | Keep `contracts.LOCAL_OPERATOR`, map SQL seed/defaults | DB literals can remain seed defaults | No | 69 backend tests pass |

## Highest-Risk Duplication

1. Persistence model duplication: JSON runtime repository and PostgreSQL schema/read model are not the same write model.
2. State machine duplication: route/service/precondition checks are spread across services.
3. Snapshot duplication: repeated `_snapshot` methods create consistent enough outputs today, but there is no single place to enforce snapshot type, checksum, and audit references.
4. Validation duplication: numeric parsing and precision are repeated with slightly different field names and messages.

## Recommended Consolidation Order

1. Add canonical enums/constants for status, snapshot type, allocation mode, constraint type, report format, and operation type.
2. Add `ProjectStateMachine` and route all project-status transitions through it.
3. Add `SnapshotService` and require every calculation/export service to call it.
4. Add `AuditService.record_success/record_failure` and wrap failed calculation operations.
5. Add schema/DTO module for upload, party, constraint, MD-DShap, allocation, report, and system parameter inputs.
6. Decide authoritative persistence mode: SQL write model or explicitly mapped P0 JSON adapter.

