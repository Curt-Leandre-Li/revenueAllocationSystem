# DVAS V1.2 Project Operating Rules

These rules are the project-level entry point for all Codex agents in this
repository. They override global defaults when stricter.

## Current Product Baseline

- System name: 数据收益分配系统 V1.2.
- English short name: DVAS, Data Value Allocation System.
- Positioning: 数据收益分配模拟与审计说明系统.
- Output boundary: all pages, reports, exports, and copyright materials must
  state that results are simulation references only and are not legal
  settlement, statutory settlement, payment instructions, contract performance,
  or authority approval.
- Example boundary: 肺癌早筛 may be used as a sample project only. It must not
  be written as the only business scenario or as real medical production data.

Highest-priority product inputs for this documentation alignment round:

1. `数据收益分配系统_V1.3_需求规格说明书_导航结构更新版.md`
2. `数据收益分配系统_系统详细功能设计_V1.1_导航结构更新版.md`
3. `数据收益分配系统_数据库设计与ER关系图_V1.0_导航结构更新版.md`

If older repository docs conflict with these files, update the older docs or
mark them as superseded. Do not change runtime implementation to force
alignment.

## Current Round Boundary

This round is documentation synchronization only.

Allowed:

- `AGENTS.md`
- `.codex/agents/*.toml` when agent role configuration needs alignment
- `docs/**/*.md`
- `README.md` or project explanation Markdown files

Forbidden:

- `src/`
- `demo_ui/`
- `tests/`
- runnable scripts under `scripts/`
- dependency files such as `package.json`, lock files, `pyproject.toml`, or
  `requirements*.txt`
- database migration or executable DDL implementation scripts
- frontend, backend, algorithm, API, test, UI, or database implementation

If full alignment requires code changes, record them as future implementation
tasks only.

## Navigation Baseline

Left navigation must use this structure, without Arabic numeric prefixes in
menu labels:

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

系统首页为一级导航页面，不设置二级窗口。页面内部集成项目总览、流程入口、风险提示和一键计算四类功能区块。

- menu_code: NAV_SYS_HOME
- module_code: SYS
- route_path: /dashboard
- children: []

首页内部区块不进入 nav_menu，不作为独立路由，不单独配置权限菜单。

Historical routes or module names may be documented as compatibility aliases,
but must not replace the navigation baseline.

## Core Business Chain

The current complete chain is:

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

Use `完整链路`; do not use `端到端` as the standard term.

## P0/P1 Boundary

P0 includes:

- 本地操作员模式
- 演示数据 / JSON 上传
- 数据接入、资源识别、参与方管理
- 质量评估
- 数元计量
- 贡献度与效用计算
- MD-DShap 权重计算
- 收益分配模拟
- 合同约束
- Markdown / CSV / JSON / JSONL 导出
- 审计日志和快照追溯

P0 excludes:

- 登录
- 生产级 RBAC
- PDF 导出
- CSV/XLSX 批量导入
- 异步队列
- 多租户
- 真实财务付款
- 电子签章、税务、银行系统

P1 may extend:

- 登录与 RBAC
- PDF 导出
- CSV/XLSX 模板导入
- 异步任务进度
- 历史报告管理
- 更完整的权限控制

## Algorithm Rules

- MD-DShap is the default contribution weight calculation strategy.
- Basic Shapley is only a small-scale `baseline_check`; it is not the default
  final allocation mode.
- MD-DShap outputs weights only. It must not be described as creating payment
  instructions or final legal allocation.
- DAUS / utility layer carries contribution, quality, usage, and scenario
  signals and provides `v(S,t)` or utility input for MD-DShap.
- Non-data contribution parties do not enter the MD-DShap pool by default.
  Operators, pilot bases, technical service providers, experts, and similar
  parties are handled first through contract priority allocation, fixed ratio,
  floor, cap, minimum, or maximum constraints.
- A single data-provider scenario does not run the full MD-DShap process. Its
  weight is 1, and pages/reports must disclose single-party simplified
  allocation.
- Weights must normalize to 1 and display with 6 decimal places.
- Recalculation must generate new `task_id`, `result_id`, and trace versions.
  It must not overwrite history.

## Reporting And Audit Rules

- P0 exports are Markdown, CSV, JSON, and JSONL. PDF is P1.
- Every export must generate `report_id` and `checksum`.
- Historical report files must not be silently overwritten.
- Export dialogs and report bodies must include the simulation-reference,
  non-legal-settlement disclaimer.
- Required report/export contract is documented in
  `docs/reporting_contract.md`.
- Audit records must preserve input snapshots, parameter snapshots, output
  snapshots, algorithm version, calculation trace, `menu_code`, `module_code`,
  operator, status, failure reason, and export checksum where applicable.

## Agent Workflow

- PM Strategy Agent coordinates scope freeze, P0/P1 boundary, milestones, risk
  closure, and agent task routing.
- PRD Agent owns requirements, button-level requirements, acceptance cases, and
  GAP-001 to GAP-005 closure.
- UI Designer Agent owns 1440x900 Chinese management-backend design inputs,
  button/dialog/state requirements, risk notices, and route mapping. It does
  not generate UI code in this round.
- Frontend Agent documents route, page, and component breakdown only in this
  round. It does not write React or frontend code.
- Backend Agent documents service boundaries, data objects, and interface
  contracts only in this round. It does not write backend code.
- QA Agent owns acceptance matrix, regression checklist, and documentation
  consistency checks. It does not write test code in this round.
- Docs Agent owns document index, terminology, version notes, software
  copyright mapping, and stale-doc cleanup.
- Compliance/Audit Agent owns simulation-reference language, non-legal
  settlement boundary, sensitive-data boundary, audit disclosure, and algorithm
  boundary.
- DevOps Agent records P0/P1 deployment and runtime boundaries only in this
  round. It does not add CI/CD, dependencies, services, or deployment changes.

## Prohibited Without Explicit User Approval

- Production code changes.
- API, schema, migration, or data model implementation changes.
- Core algorithm semantic changes.
- Dependency installation.
- Security/auth/deployment/cloud/secrets changes.
- File deletion at scale.
- Commit, push, merge, branch deletion, worktree removal, or history rewrite.

## Documentation Alignment Acceptance

Before reporting completion, run:

```bash
git diff --check
git status --short
rg -n "基础 Shapley|Basic Shapley|Shapley 为主|默认 Shapley|MD-Shapley|MD-DShap|MD_DSHAP" .
rg -n "PDF|RBAC|登录|异步|P0|P1" docs AGENTS.md agents
rg -n "MAR|真实结算|法律结算|付款|银行|税务|电子签章|生产级" docs AGENTS.md agents
rg -n "端到端|AI 化|医疗数据数元计量|肺癌|肺癌早筛" docs AGENTS.md agents
rg -n "系统首页|数据管理|数元贡献度计量|收益分配计算|报告生成与导出|系统管理" docs AGENTS.md agents
rg -n "模拟参考|非法律结算|非法定结算|审计|trace|snapshot|checksum|report_id" docs AGENTS.md agents
```

Final reports for documentation work must list checked files, drift found,
updated documents, validation results, `git status --short`, and remaining
documentation or future implementation tasks.
