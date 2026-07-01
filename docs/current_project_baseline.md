# Current Project Baseline

## Authority Order

This file freezes the current Codex working baseline for 数据收益分配系统 V1.2.
When older repository documents conflict with this baseline, use this authority
order:

1. `数据收益分配系统_V1.4_需求规格说明书_增加后端逐资源质量评估.md`
2. `数据收益分配系统_系统详细功能设计_V1.2_增加后端逐资源质量评估.md`
3. `数据收益分配系统_数据库设计与ER关系图_V1.1_增加后端逐资源质量评估.md`
4. `AGENTS.md`
5. V1.2 docs under `docs/`
6. historical freeze/archive docs, only where explicitly marked compatible

## System Identity

- System name: 数据收益分配系统 V1.2.
- English short name: DVAS, Data Value Allocation System.
- Positioning: 数据收益分配模拟与审计说明系统.
- Output boundary: simulation reference only. Outputs are not legal settlement,
  statutory settlement, payment instructions, contract performance, formal asset
  appraisal, or authority approval.

All UI pages, report exports, audit notes, and software copyright materials must
retain the disclaimer: 系统结果仅为模拟参考，非法律结算 / 非法定结算结果.

## Example Boundary

肺癌早筛数据收益分配示例项目 may be used as an example project. It is not the
only system scenario and must not imply real medical production data.

## Left Navigation

- 系统首页
- 数据管理
  - 数据接入管理
  - 数据资源管理
  - 参与方管理
- 数元贡献度计量
  - 质量评估管理
  - 数元计量管理
  - 贡献度与效用计算
- 收益分配计算
  - MD-DShap 计算管理
  - 合同分配规则
  - 收益分配模拟
- 报告生成与导出
- 系统管理
  - 参数配置
  - 用户与权限管理（P1）
  - 审计日志管理

Left navigation labels must not display Arabic numeric prefixes.

## Main Business Chain

```text
创建项目或选择演示数据
-> 上传或初始化数据包并生成输入快照
-> 识别数据资源、字段、模态和基础统计
-> 维护参与方，区分数据源主体和非数据贡献主体
-> 数据资源关联数据源主体
-> 质量评估
-> 数元计量
-> 贡献度计算与效用计算
-> MD-DShap 权重计算
-> 配置总收益和合同比例方案，形成非数据主体合同金额和数据源主体收益池
-> 收益分配模拟，使用 MD-DShap 归一化权重分配数据源主体收益池
-> 应用尾差处理
-> 锁定参考方案或复制新版本重算
-> 报告生成与导出
-> 审计追溯
```

Use `完整链路` for this process.

## Quality Assessment Indicator Baseline

Quality assessment uses the data asset quality assessment common indicator
framework from the uploaded PDF. The default framework has 7 primary indicators:
规范性、准确性、完整性、唯一性、一致性、时效性、可访问性.

The 17 secondary indicators are: 命名规范性、数据长度规范性、数据精度规范性、
数据格式规范性、元数据规范性、参考数据规范性、数据模型规范性、数据范围准确性、
编码/代码准确性、数据元素完整性、数据记录完整性、数据唯一标识程度、数据冗余性、
相同数据一致性、关联数据一致性、数据记录及时性、数据字段可访问性.

Quality scores are weighted from secondary indicators to primary indicators and
then to the total score. Primary weights sum to 1, and secondary weights under
the same primary indicator sum to 1. Frontend pages display backend-returned
`quality_score`, `quality_level`, `dimension_scores`, `quality_score_detail`,
and `evidence_summary`; they must not recalculate the quality score.

Optional indicators may be added for specific scenarios, such as 管理信息完整性、
应用场景完整性、调用成功率、数据来源权威性、采集方式、流通交易情况、
数据资产登记情况、投资收益率稳定性. Optional indicators do not replace the common
indicator framework.

## P0/P1 Boundary

P0 includes local operator mode, demo data / JSON upload, data ingestion,
resource recognition, party management, quality assessment, shuyuan metering,
contribution and utility calculation, MD-DShap weight calculation, allocation
simulation, contract allocation rules, Markdown/CSV/JSON/JSONL export, audit
logs, and snapshot traceability.

P0 excludes login, production-grade RBAC, PDF export, CSV/XLSX batch import,
async queues, multi-tenancy, real financial payment, electronic signature, tax,
and bank integration.

P1 may add login/RBAC, PDF export, CSV/XLSX template import, async task
progress, historical report management, and stronger permission control.

## Algorithm Baseline

- MD-DShap is the default contribution weight strategy.
- Basic Shapley is only a small-scale `baseline_check`.
- MD-DShap outputs weights only and must not be described as a payment or legal
  settlement instruction or as directly allocating total revenue.
- DAUS / utility layer carries contribution, quality, usage, and scenario
  signals and provides `v(S,t)` or utility input.
- Non-data contribution parties are handled through saved contract-ratio items
  by default. The saved contract-ratio plan forms the data-provider revenue pool
  before MD-DShap weights are applied.
- Single data-provider scenarios use weight 1 and disclose single-party
  simplified allocation.
- Weights normalize to 1 and display with 6 decimals.
- Recalculation creates new task/result/trace versions and never overwrites
  historical outputs.

## Allocation Formula Baseline

```text
non_data_contract_amount_j = min(contract_requested_amount_j, contract_cap_amount_j)
total_contract_priority_amount = sum(non_data_contract_amount_j)
data_provider_revenue_pool = total_revenue - total_contract_priority_amount
data_provider_amount_i = data_provider_revenue_pool × md_dshap_normalized_weight_i
```

Constraints:

- `total_contract_priority_amount <= total_revenue`
- `data_provider_revenue_pool >= 0`
- `sum(md_dshap_normalized_weight_i) = 1`

## Reporting And Audit Baseline

P0 export formats are Markdown, CSV, JSON, and JSONL. PDF is P1.

Every export must generate `report_id` and `checksum`; repeated exports create
new versions instead of silently overwriting files. Export dialogs must show
file list, field scope, report version, and disclaimer.

Core exports include:

- `allocation_summary.md`
- `source_level_allocation.csv`
- `quality_assessment_report.md`
- `quality_assessment_result.json`
- `shuyuan_metering_statement.md`
- `contribution_utility_result.csv`
- `participant_weight.csv`
- `task_level_weight.csv`
- `marginal_contribution_trace.csv`
- `md_dshap_audit_report.md`
- `allocation_confirmation_statement.md`
- `audit_log.jsonl`
- `assumptions.json`
- `run_summary.json` or `report_manifest.json` as compatible manifest names

## Route Compatibility Notes

The product navigation treats `系统首页` as a single first-level entry at
`/dashboard`.

- `menu_code`: `NAV_SYS_HOME`
- `module_code`: `SYS`
- `children`: `[]`

Project overview, process entry, risk notices, and one-click calculation are
sections inside the home page. They are not secondary menu items, backend
modules, permission menu nodes, or independent routes. Other historical path
variants such as `/data/packages` remain compatibility aliases until
implementation chooses the canonical route table.
