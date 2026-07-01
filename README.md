# 数据收益分配系统 V1.2 / P0 本地演示版

DVAS, Data Value Allocation System, is a data revenue allocation simulation and audit-explanation system. P0 本地演示版用于展示数据接入、质量评估、数元计量、贡献与效用计算、合同比例方案配置、数据源主体 MD-DShap 权重分配、报告导出和审计追溯的完整链路。

系统输出仅为模拟参考，非法律结算 / 非法定结算结果，不构成付款指令、合同履行、资产评估报告、正式审计报告或主管机关审批。

## 启动后端

```bash
cd <项目根目录>
python3.12 -m backend.dvas.server
```

默认后端监听本机 8000 端口，API 前缀为 `/api/v1`。

## 启动前端

```bash
cd <项目根目录>/ui_prototype
npm install
npm run dev
```

前端 API Base URL 通过 `VITE_API_BASE_URL` 或 `VITE_DVAS_API_BASE_URL` 配置；未配置时使用默认 `http://127.0.0.1:8000/api/v1`。

## 构建前端

```bash
cd <项目根目录>/ui_prototype
npm run build
```

## 运行后端测试

优先命令：

```bash
cd <项目根目录>/backend
pytest tests/test_api_contract.py
```

如果当前 Python 环境没有 `pytest`，可运行同一测试文件的 unittest 路径：

```bash
cd <项目根目录>
PYTHONDONTWRITEBYTECODE=1 python3.12 -m unittest backend.tests.test_api_contract
```

## P0 功能范围

- 本地操作员模式：`local_operator`
- 演示数据选择
- 结构化 JSON 上传、上传校验、失败详情
- 数据资源管理和参与方管理
- 质量评估
- 数元计量
- 贡献度与效用计算
- MD-DShap 权重计算
- 合同分配规则
- 收益分配模拟
- 方案锁定
- Markdown / CSV / JSON / JSONL 导出
- 审计日志查询、详情和导出
- 首页一键完整计算

## 收益分配口径

当前产品口径为：先保存合同比例方案，明确总收益、数据源主体收益池比例和非数据贡献主体比例项；执行收益分配模拟时，非数据主体按保存的合同比例项计算合同金额，剩余的数据源主体收益池按 MD-DShap 归一化权重分配，并应用尾差和报告说明。

MD-DShap 只计算数据源主体之间的归一化权重，不直接分配总收益；非数据源主体不进入贡献度、效用、MD-DShap 权重池，通过合同分配规则页保存的合同比例方案参与收益模拟说明。当前运行链路没有默认或伪造的合同比例方案，未保存有效方案时模拟接口返回 `DVAS_CONTRACT_RATIO_REQUIRED`。旧的 `contract_constraint` / `constraint_apply_trace` 属于 SQL 设计兼容对象，不是当前前端主链路。

## P1/P2 边界

- 登录与 RBAC 为 P1 本地扩展；不属于 P0，也不代表生产级身份系统。
- PDF 导出为 P1 本地扩展；P0 导出仍为 Markdown / CSV / JSON / JSONL。
- CSV/XLSX 批量导入为 P1。
- 异步任务队列为 P1 设计边界，当前 P0 链路仍以本地同步演示为主。
- 多租户
- 真实支付、付款、结算
- 电子签章、银行、税务系统
- 正式法律结算结果

## JSON 上传格式

```json
{
  "package_name": "P0 本地上传样例",
  "file_name": "p0_upload_sample.json",
  "resources": [
    {
      "resource_name": "structured_sample_resource",
      "modality": "TABULAR",
      "field_count": 8,
      "sample_count": 120,
      "provider_party_name": "样例数据源主体A"
    }
  ],
  "parties": [
    {
      "party_name": "样例数据源主体A",
      "party_type": "DATA_PROVIDER",
      "include_in_md_dshap": true
    },
    {
      "party_name": "样例运营服务方",
      "party_type": "OPERATOR",
      "include_in_md_dshap": false
    }
  ]
}
```

上传入口只接受 `.json`。前端会显示解析失败、字段缺失、重复参与方、负金额错误；失败不得生成有效数据包。后端标准错误信封包含 `code`、`message`、`trace_id` 和 `field_errors`。

## Documentation Baseline

Start here:

1. `AGENTS.md`
2. `docs/current_project_baseline.md`
3. `docs/product_navigation.md`
4. `docs/algorithm_scope.md`
5. `docs/reporting_contract.md`
6. `docs/acceptance_checklist.md`

Latest detailed source inputs:

- `数据收益分配系统_V1.4_需求规格说明书_增加后端逐资源质量评估.md`
- `数据收益分配系统_系统详细功能设计_V1.2_增加后端逐资源质量评估.md`
- `数据收益分配系统_数据库设计与ER关系图_V1.1_增加后端逐资源质量评估.md`

## P0 Database Acceptance

PostgreSQL P0 database assets are under `db/`. The local acceptance path is:

```bash
make db-acceptance
```

The command starts PostgreSQL, creates `dvas_p0`, loads the `dvas` schema, inserts seed and demo data, runs validation SQL, and executes the smoke test against `DATABASE_URL=postgresql://dvas_app:password@localhost:5432/dvas_p0`.
