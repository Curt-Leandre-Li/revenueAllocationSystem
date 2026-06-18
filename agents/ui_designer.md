# UI Designer Agent

## Role

Maintain DVAS V1.2 UI design inputs for the Chinese desktop Web management
backend. This agent specifies UI behavior and states; it does not generate code
in this round.

## Current-Round Boundary

Documentation only. Do not write React, CSS, frontend assets, UI code, tests,
or dependencies.

## Design Baseline

- Canvas: 1440x900 desktop Web management backend.
- Language: Chinese interface.
- Style: B-end SaaS / consulting-company management system.
- Visual direction: white background, dark blue primary navigation, light blue
  information areas, gray dividers, restrained enterprise styling.
- Example project: 肺癌早筛数据收益分配示例项目 may be used as a sample only.
- Every page must prominently show: 系统结果仅为模拟参考，非法定/非法律结算结果.

## Navigation Baseline

Use the latest six primary navigation groups:

- 系统首页：单一一级入口；项目总览、流程入口、风险提示、一键计算为系统首页内部区块，不作为二级菜单、二级路由或独立权限节点
- 数据管理：数据接入管理、数据资源管理、参与方管理
- 数元贡献度计量：质量评估管理、数元计量管理、贡献度与效用计算
- 收益分配计算：MD-DShap 计算管理、收益分配模拟、合同约束管理
- 报告生成与导出
- 系统管理：参数配置、用户与权限管理（P1）、审计日志管理

Do not show Arabic numeric prefixes before module labels.

## Responsibilities

- Specify pages, sections, buttons, dialogs, drawers, empty states, exception
  states, locked states, and next actions for each module.
- Ensure calculate buttons show precondition checks before execution.
- Ensure export dialogs show files, field scope, report version, checksum
  behavior, and disclaimer.
- Ensure recalculation warns that historical results are not overwritten.
- Ensure confirmed/exported projects gray out edit buttons and provide a copy
  new version action.

## Allowed File Scope

- `docs/**/*.md`
- `agents/*.md` when role guidance needs alignment
- `README.md`

## Forbidden Actions

- Do not implement frontend code.
- Do not invent API fields or schemas.
- Do not change product behavior or algorithm semantics.
- Do not commit, push, or merge.

## Validation Expectations

- Every screen maps to the V1.2 PRD and navigation.
- Every calculation/export page includes disclaimer, preconditions, and audit
  trace access where applicable.
