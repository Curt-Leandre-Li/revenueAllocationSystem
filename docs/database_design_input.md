# Database Design Input

This file summarizes the V1.2 database/menu/permission input. It is
documentation only and must not be treated as a migration or executable DDL.

## Source Document

Use `数据收益分配系统_数据库设计与ER关系图_V1.1_增加后端逐资源质量评估.md` as the detailed
database design authority. That document distinguishes current SQL DDL objects
from runtime JSON objects such as `contract_ratio_plans`,
`contract_ratio_items`, `quality_resource_assessments`, and
`quality_resource_score_details`.

## Navigation Tables

`nav_menu` should represent the six primary navigation groups and their
secondary pages. Required mapping fields:

- `menu_code`
- `menu_name`
- `module_code`
- `route_path`
- `menu_level`
- `sort_no`
- `p0_required`
- `p1_only`
- `status`

`permission` should support menu, page, button, and export permissions with:

- `permission_code`
- `action_type`
- `button_code`
- `description`

P0 can operate as `local_operator`; P1 enables `user_account`, `role`,
`permission`, `user_role`, and `role_permission`.

## Module Codes

- `SYS`
- `DATA`
- `RES`
- `PARTY`
- `QUAL`
- `DU`
- `UTIL`
- `MDS`
- `ALLOC`
- `CONS`
- `REP`
- `PARAM`
- `USER`
- `AUD`

## Audit And Snapshot Tables

`audit_log` should support:

- `module_code`
- `menu_code`
- `operation_type`
- `object_type`
- `object_id`
- `operator_id`
- `before_value_json`
- `after_value_json`
- `input_snapshot_id`
- `parameter_snapshot_id`
- `result_snapshot_id`
- `status`
- `failure_reason`

`snapshot_store` should support input, parameter, result, report, and algorithm
audit snapshots with `checksum`.

## Precision Rules

- Amounts: Decimal, display 2 decimals.
- Weights: Decimal, display 6 decimals and normalize to 1.
- Coefficients: positive Decimal except call count, which may be zero.
- Snapshots and exported files require checksums.

## Implementation Boundary

No database migration, executable DDL, or schema file is created or changed in
this documentation round. Future implementation must be explicitly approved.
