# Current Project Baseline

## Authority Order

This file freezes the current Codex working baseline for 数据收益分配系统 V1.2.
When older repository documents conflict with this baseline, use this authority
order:

1. `数据收益分配系统_V1.3_需求规格说明书_导航结构更新版.md`
2. `数据收益分配系统_系统详细功能设计_V1.1_导航结构更新版.md`
3. `数据收益分配系统_数据库设计与ER关系图_V1.0_导航结构更新版.md`
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
  - 收益分配模拟
  - 合同约束管理
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
-> 配置总收益、合同优先分配、数据源收益池
-> 合同约束调整
-> 收益分配模拟
-> 锁定参考方案或复制新版本重算
-> 报告生成与导出
-> 审计追溯
```

Use `完整链路` for this process.

## P0/P1 Boundary

P0 includes local operator mode, demo data / JSON upload, data ingestion,
resource recognition, party management, quality assessment, shuyuan metering,
contribution and utility calculation, MD-DShap weight calculation, allocation
simulation, contract constraints, Markdown/CSV/JSON/JSONL export, audit logs,
and snapshot traceability.

P0 excludes login, production-grade RBAC, PDF export, CSV/XLSX batch import,
async queues, multi-tenancy, real financial payment, electronic signature, tax,
and bank integration.

P1 may add login/RBAC, PDF export, CSV/XLSX template import, async task
progress, historical report management, and stronger permission control.

## Algorithm Baseline

- MD-DShap is the default contribution weight strategy.
- Basic Shapley is only a small-scale `baseline_check`.
- MD-DShap outputs weights only and must not be described as a payment or legal
  settlement instruction.
- DAUS / utility layer carries contribution, quality, usage, and scenario
  signals and provides `v(S,t)` or utility input.
- Non-data contribution parties are handled through contract priority
  allocation or constraints by default.
- Single data-provider scenarios use weight 1 and disclose single-party
  simplified allocation.
- Weights normalize to 1 and display with 6 decimals.
- Recalculation creates new task/result/trace versions and never overwrites
  historical outputs.

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
