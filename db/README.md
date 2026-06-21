# DVAS P0 标准数据库交付包

本交付包用于在 PostgreSQL 中落地“数据收益分配系统（DVAS）P0 数据库”。范围固定为：标准单库、`dvas` schema、38 张核心表、菜单权限种子数据、系统参数、质量指标模板、P0 演示全链路数据和验收 SQL。

## 文件说明

| 文件 | 用途 |
|---|---|
| `dvas_p0_00_create_database.sql` | 创建 `dvas_app`、`dvas_readonly` 角色和 `dvas_p0` 数据库。需用 PostgreSQL 超级用户或具备建库权限的账号运行。 |
| `dvas_p0_01_schema.sql` | 创建 `dvas` schema、38 张核心表、主键、外键、检查约束和索引。 |
| `dvas_p0_02_seed.sql` | 初始化六大导航、二级页面、权限动作、本地操作员、角色、系统参数、质量指标模板。 |
| `dvas_p0_03_demo_data.sql` | 写入一套 P0 演示数据，覆盖数据接入、质量、数元、效用、MD-DShap、收益分配、报告和审计。 |
| `dvas_p0_04_validation.sql` | 验收查询脚本，检查表数量、菜单权限、演示项目状态、MD-DShap 权重合计、分配金额合计、报告 checksum 和审计快照。 |
| `dvas_p0_er.mmd` | Mermaid ER 草图，可用于软著材料或后续架构说明。 |

## 执行顺序

```bash
# 1. 建库：连接到 postgres 或任意维护库
psql -U postgres -d postgres -f dvas_p0_00_create_database.sql

# 2. 建表：连接到 dvas_p0
psql -U dvas_app -d dvas_p0 -f dvas_p0_01_schema.sql

# 3. 初始化菜单、权限、参数和质量模板
psql -U dvas_app -d dvas_p0 -f dvas_p0_02_seed.sql

# 4. 写入 P0 演示业务数据
psql -U dvas_app -d dvas_p0 -f dvas_p0_03_demo_data.sql

# 5. 执行验收查询
psql -U dvas_app -d dvas_p0 -f dvas_p0_04_validation.sql
```

## P0 数据库边界

- P0 不强制登录，但保留 `local_operator`、`user_account`、`role`、`permission`、`user_role`、`role_permission`。
- P0 导出以 Markdown、CSV、JSON、JSONL 为主；数据库保留 `PDF` 枚举以便 P1 扩展，但 P0 不伪装实现 PDF。
- `MD_DSHAP` 是默认算法模式；`BASIC_SHAPLEY` 只作为小规模基线校验。
- 所有计算类结果均写业务事实表，同时保留 `snapshot_store` 与 `audit_log`。
- 报告导出必须写入 `report_record` 与 `export_file`，并保留 `checksum`，不得静默覆盖历史文件。

## 当前演示数据结果摘要

- 演示项目：`PRJ_DEMO_001`
- 项目状态：`EXPORTED`
- 总收益：`1,000,000.00`
- 合同优先分配：运营服务方 `100,000.00`，技术服务方 `50,000.00`
- 数据源收益池：`850,000.00`
- MD-DShap 权重：数据源主体A `0.620000`，数据源主体B `0.380000`
- 合同约束：数据源主体B保底 `350,000.00`
- 最终参考金额：数据源主体A `500,000.00`，数据源主体B `350,000.00`，运营服务方 `100,000.00`，技术服务方 `50,000.00`

## 注意

系统输出仅为收益分配模拟参考，不构成法律结算、财务付款、合同履约或主管单位审批结果。
