# System Scope

## Positioning

数据收益分配系统 V1.2（DVAS, Data Value Allocation System） is a data revenue
allocation simulation and audit-explanation system.

The system output is a simulation reference only. It does not constitute legal
settlement, statutory settlement, financial payment, contract performance,
formal asset appraisal, or authority approval. All pages, reports, exports, and
software copyright materials must retain this boundary.

## Scenario Boundary

The system is generic and not limited to medical data. 肺癌早筛数据收益分配示例项目
may be used as a sample project, but medical wording must not define the only
schema, workflow, quality formula, utility rule, algorithm behavior, or report
claim.

## P0 Included Scope

- Local operator mode.
- Demo data and JSON upload.
- Data ingestion, resource recognition, and party management.
- Quality assessment.
- Shuyuan metering.
- Contribution and utility calculation.
- MD-DShap weight calculation.
- Allocation simulation.
- Contract constraints.
- Markdown, CSV, JSON, and JSONL export.
- Audit logs and snapshot traceability.

## P0 Excluded Scope

- Login.
- Production-grade RBAC.
- PDF export.
- CSV/XLSX batch import.
- Async queues.
- Multi-tenancy.
- Real financial payment.
- Electronic signature, tax, or bank integration.

## P1 Extension Scope

- Login and RBAC.
- PDF export.
- CSV/XLSX template import.
- Async task progress.
- Historical report management.
- Stronger permission controls.

## Roles

P0 uses `local_operator` as the default operator. The documentation still keeps
role concepts for future P1 permissions:

- system administrator, P1
- business administrator
- algorithm reviewer
- contract reviewer
- auditor
- viewer
- local operator, P0

## Complete Business Chain

```text
创建项目或选择演示数据
-> 上传或初始化数据包并生成输入快照
-> 识别数据资源、字段、模态和基础统计
-> 维护参与方，区分数据源主体和非数据贡献主体
-> 数据资源关联数据源主体
-> 质量评估
-> 数元计量
-> 贡献度计算与效用计算
-> 配置总收益
-> 配置非数据源主体合同优先分配和上限
-> 扣除合同优先分配，形成数据源主体可分配收益池
-> MD-DShap 权重计算
-> 使用 MD-DShap 归一化权重分配数据源主体收益池
-> 应用合同约束和尾差处理
-> 锁定参考方案或复制新版本重算
-> 报告生成与导出
-> 审计追溯
```

## Boundary Rules

- MD-DShap outputs weights only.
- Basic Shapley is only a small-scale `baseline_check`.
- DAUS / utility is an input signal layer for `v(S,t)` or utility values.
- Non-data contribution parties do not enter the MD-DShap algorithm pool by
  default.
- Contract priority allocation and constraints apply before/after data-provider
  pool allocation according to the latest PRD.
- Non-data party contract priority is applied before the data-provider revenue
  pool is formed; MD-DShap then allocates only that remaining pool across data
  providers.
- Recalculation and export create new versions and never silently overwrite
  historical task/result/trace/report records.
