# 数据收益分配系统 V1.2

DVAS, Data Value Allocation System, is a data revenue allocation simulation and
audit-explanation system.

System outputs are simulation references only. They are not legal settlement,
statutory settlement, payment instructions, contract performance, formal asset
appraisal, or authority approval.

## Current Documentation Baseline

Start here:

1. `AGENTS.md`
2. `docs/current_project_baseline.md`
3. `docs/product_navigation.md`
4. `docs/algorithm_scope.md`
5. `docs/reporting_contract.md`
6. `docs/acceptance_checklist.md`

Latest detailed source inputs:

- `数据收益分配系统_V1.3_需求规格说明书_导航结构更新版.md`
- `数据收益分配系统_系统详细功能设计_V1.1_导航结构更新版.md`
- `数据收益分配系统_数据库设计与ER关系图_V1.0_导航结构更新版.md`

## Previous Documentation Alignment Round

The previous repository update was documentation alignment only. That round did
not change product code, frontend code, backend code, tests, dependencies,
scripts, or database migrations.

## P0 Database Acceptance

PostgreSQL P0 database assets are under `db/`. The local acceptance path is:

```bash
make db-acceptance
```

The command starts PostgreSQL, creates `dvas_p0`, loads the `dvas` schema,
inserts seed and demo data, runs validation SQL, and executes the smoke test
against `DATABASE_URL=postgresql://dvas_app:password@localhost:5432/dvas_p0`.
