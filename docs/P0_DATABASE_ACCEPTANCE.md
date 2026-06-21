# DVAS P0 PostgreSQL 数据库验收记录

## 执行环境

- 系统：数据收益分配系统 V1.2 / DVAS P0
- 数据库：PostgreSQL 16-alpine（`docker-compose.yml`）
- 数据库名：`dvas_p0`
- schema：`dvas`
- 应用用户：`dvas_app`
- 只读用户：`dvas_readonly`
- 连接串：`DATABASE_URL=postgresql://dvas_app:password@localhost:5432/dvas_p0`
- 服务端口：`localhost:5432`
- 持久化：`dvas_p0_postgres_data` Docker volume

系统输出仅为收益分配模拟参考，不构成法律结算、财务付款、合同履约或主管单位审批结果。

## Local Docker 验收路径

```bash
cp .env.example .env
make db-check-tools
make db-up
make db-create
make db-schema
make db-seed
make db-demo
make db-validate
make db-smoke
```

干净环境推荐直接执行：

```bash
make db-acceptance 2>&1 | tee output/p0_database_acceptance.log
```

`make db-acceptance` 会先执行 `db-check-tools`。缺少 Docker 或 Docker Compose 时必须快速失败并输出明确错误；缺少宿主机 `psql` 时仅提示信息，因为本地 Docker 路径使用 PostgreSQL service container 内置的 `psql`。

## CI 验收路径

GitHub Actions workflow：

```text
.github/workflows/p0-database-acceptance.yml
```

Workflow 名称：`P0 Database Acceptance`

Job 名称：`p0-database-acceptance`

CI 使用 PostgreSQL 16 service container，先以 PostgreSQL bootstrap 用户启动
service，再执行 `00_create_database` 创建 `dvas_p0`、`dvas_app` 与
`dvas_readonly`：

```text
POSTGRES_DB=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
DATABASE_URL=postgresql://dvas_app:password@localhost:5432/dvas_p0
```

CI 顺序执行 5 个 SQL 文件和 `python3 scripts/db_smoke_test.py`。
`db/dvas_p0_04_validation.sql` 或 smoke test 任一失败时 workflow 必须失败。

## SQL 执行顺序

1. `db/dvas_p0_00_create_database.sql`
2. `db/dvas_p0_01_schema.sql`
3. `db/dvas_p0_02_seed.sql`
4. `db/dvas_p0_03_demo_data.sql`
5. `db/dvas_p0_04_validation.sql`

`Makefile` 中的 `db-reset` 会删除并重建 `dvas_p0`、`dvas_app`、`dvas_readonly`，随后按上述顺序执行 create、schema、seed、demo 和 validation。

## Validation 输出摘要

`db/dvas_p0_04_validation.sql` 输出 `check_item/status/actual_value/expected` 四列。验收成功时以下检查应全部为 `PASS`；如果任一检查为 `FAIL`，SQL 会 `RAISE EXCEPTION`，并在 `psql -v ON_ERROR_STOP=1` 下返回非 0。

| 检查项 | 期望结果 |
|---|---|
| `01_schema_exists` | `dvas` schema 存在 |
| `02_core_table_count` | 核心表数量 `>= 38` |
| `03_nav_first_level` | 六大一级导航存在 |
| `04_nav_second_level` | 二级页面数量 `>= 12` |
| `05_permission_actions` | permission 含按钮/动作权限 |
| `06_local_operator` | `user_account` 含 `local_operator` |
| `07_demo_project_status` | `PRJ_DEMO_001` 状态为 `EXPORTED` |
| `08_input_snapshot` 至 `16_md_dshap_task_mode` | 完整链路核心业务表均有演示记录，`algorithm_mode=MD_DSHAP` |
| `17_md_dshap_weight_sum` | 权重合计 `1.000000`，误差不超过 `0.000001` |
| `18_allocation_scenario_total_revenue` | `allocation_scenario` 有总收益 |
| `19_allocation_result_amount_sum` | 分配金额合计等于总收益，误差不超过 `0.01` |
| `20_report_record` | `report_record` 有记录 |
| `21_export_file_checksum` | `export_file` 有记录且 checksum 非空 |
| `22_audit_log` | `audit_log` 有记录 |
| `23_snapshot_store` | `snapshot_store` 有记录 |
| `24_algorithm_audit_snapshot` | `algorithm_audit_snapshot` 有记录 |

## 核心表数量检查

标准 schema 目标为 38 张核心表。validation 使用以下查询确认：

```sql
SELECT COUNT(*)
FROM information_schema.tables
WHERE table_schema = 'dvas' AND table_type = 'BASE TABLE';
```

## 演示项目

- 演示项目 ID：`PRJ_DEMO_001`
- 期望状态：`EXPORTED`
- 总收益：`1000000.00`
- 数据源收益池：`850000.00`
- 合同优先分配：运营服务方 `100000.00`，技术服务方 `50000.00`

## MD-DShap 权重校验结果

演示任务：`MDS_TASK_DEMO_001`

| 参与方 | 权重 |
|---|---:|
| 数据源主体A | `0.620000` |
| 数据源主体B | `0.380000` |
| 合计 | `1.000000` |

validation 接受误差：`0.000001`。

## 收益分配金额校验结果

演示场景：`ALLOC_DEMO_001`

| 参与方 | 约束后金额 |
|---|---:|
| 数据源主体A | `500000.00` |
| 数据源主体B | `350000.00` |
| 运营服务方 | `100000.00` |
| 技术服务方 | `50000.00` |
| 合计 | `1000000.00` |

validation 接受误差：`0.01`。

## Report / Export Checksum 校验

- 报告 ID：`RPT_DEMO_001`
- 报告包 checksum：`8fa89292c84e91b3e58dd46b3c8c61b942422e6c4a5f06fc2d1b5303d90854af`

| 文件 | checksum |
|---|---|
| `allocation_simulation_report.md` | `c3a98efd237f1c58a66792b815cbaf41f89000878f9472b07d39f9ecb1b35eb0` |
| `source_level_allocation.csv` | `b9812816710a488478bcb8ebe386778e2175f21eb29762082a5ce32c19795bb2` |
| `participant_weight.csv` | `531ec0b7321378fe20c1bccb76a1926589b2a6a8ee3eeff3ebadbace963093ae` |
| `md_dshap_audit_report.md` | `58714bb18422ef8495460b1193392010b3471d36b22a056d78f91f68b9255972` |
| `audit_log.jsonl` | `747927e6b45176cc9ca263db1b2225862375f8faf1c1454c06cccb598713baf2` |
| `assumptions.json` | `1070d14cfb80ba09978ba97ea6e0309c759e4cd880b8a1dc8d59a39935b67008` |
| `report_manifest.json` | `9459551d18c4f635c8ef63ca47106259e5cc1402e727144cc9f9b85a811e0b32` |

## PostgreSQL 后端读取接口

新增的验收接口均从 `DATABASE_URL` 指向的 PostgreSQL 读取：

```text
GET /health/db
GET /api/projects
GET /api/projects/PRJ_DEMO_001/status
GET /api/audit/logs?project_id=PRJ_DEMO_001
GET /api/reports?project_id=PRJ_DEMO_001
GET /api/projects/PRJ_DEMO_001/allocation-summary
GET /api/projects/PRJ_DEMO_001/md-dshap-summary
```

旧 `/api/v1/...` 本地 JSON 演示链路未在本次改为写数据库，避免扩大 P0 数据库落地范围。
Phase 2A 后端读库联调在 CI 中追加 `scripts/backend_api_smoke_test.py`，
复用 PostgreSQL 16 service container 和 00-04 SQL 初始化结果，验证
`/health/db`、项目列表、项目状态、报告、审计日志、收益分配摘要和
MD-DShap 摘要均从真实 PostgreSQL 表读取。

## 真实执行结果区域

当前状态：已通过 GitHub Actions CI 真实 PostgreSQL 验收。

| 项目 | 真实结果 |
|---|---|
| 验收方式 | GitHub Actions |
| Workflow | `P0 Database Acceptance` |
| Run ID | `27894194835` |
| 分支 | `p0-postgres-acceptance` |
| 验收 commit | `7db4a38` |
| PostgreSQL 版本 | PostgreSQL 16 service container |
| SQL 执行顺序 | `db/dvas_p0_00_create_database.sql` -> `db/dvas_p0_01_schema.sql` -> `db/dvas_p0_02_seed.sql` -> `db/dvas_p0_03_demo_data.sql` -> `db/dvas_p0_04_validation.sql` |
| validation 结果 | PASS |
| smoke test 结果 | PASS |
| 验收结论 | P0 PostgreSQL database acceptance passed in CI. |

| 项目 | 真实结果 |
|---|---|
| validation 执行时间 | 2026-06-21 05:03:40-05:03:41 UTC（GitHub Actions run `27894194835`） |
| PostgreSQL 版本 | PostgreSQL 16 service container |
| 核心表数量 | PASS |
| `PRJ_DEMO_001` 状态 | PASS |
| `MD_DSHAP` 校验 | PASS |
| 权重合计校验 | PASS |
| 收益金额合计校验 | PASS |
| export checksum 记录校验 | PASS |
| smoke test 结果 | PASS |

## 本次 Codex 环境状态

本次工作环境已完成仓库内落地、脚本编写、checksum 更新、Python 单元测试和静态校验。真实 PostgreSQL 执行已在 GitHub Actions run `27894194835` 通过。本机仍未执行本地 validation，原因是当前环境缺少 Docker 与 PostgreSQL 客户端/服务端：

```text
docker --version -> command not found
command -v psql -> empty
command -v postgres -> empty
command -v initdb -> empty
```

此外，本机 `/usr/bin/make` 在 `make --version` 和临时两行 Makefile dry-run 下均未及时返回；本次对 `Makefile` 使用目标存在性与 recipe 制表符静态检查。具备正常 `make` 与 Docker 的验收环境应直接执行 `make db-acceptance`。

在具备 Docker 的干净环境中，仍可使用 `make db-acceptance` 复现本地完整数据库验收；当前数据库 gate 以 GitHub Actions 真实 PostgreSQL 验收通过为准。

## 已知限制

- 本轮只落地 PostgreSQL 标准数据库、验收脚本和最小只读查询接口。
- 不实现登录、生产级 RBAC、PDF 导出、CSV/XLSX 批量导入、异步队列、多租户、银行、税务、电子签章或真实付款。
- PostgreSQL 验收接口只读，不实现完整计算服务写库。
- 本地复现需要 Docker 或可用 PostgreSQL/`psql` 环境才能执行 SQL 与截图验收；CI 真实 PostgreSQL 验收已通过。
