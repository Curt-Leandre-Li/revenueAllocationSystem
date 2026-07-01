# UI Design Spec

## Design Target

- Canvas: 1440x900.
- Platform: desktop Web management backend.
- Language: Chinese.
- Tone: B-end SaaS / consulting-company operational interface.
- Visual system: white page background, dark blue primary navigation, light
  blue information panels, gray dividers, compact tables, restrained status
  colors.

## Global Page Requirements

- Header shows system name, current project, current project status, current
  operator, and risk entry.
- Every page shows: 系统结果仅为模拟参考，非法定/非法律结算结果.
- Every module includes functional buttons, dialogs, preconditions, exception
  states, empty states, and next actions.
- Calculation actions must first show precondition checks.
- Export dialogs must show export files, field range, report version, and
  disclaimer.
- Recalculation must warn that historical results are not overwritten.
- Confirmed/exported projects have edit actions disabled and expose copy new
  version.

## Module Inputs

| Navigation | Required UI inputs |
| --- | --- |
| 系统首页 | 单页区块：项目总览, process entry, risk cards, one-click calculation, recent reports, next step. |
| 数据接入管理 | Demo data selection, JSON upload, validation result, failure detail, input snapshot. |
| 数据资源管理 | Resource table, field statistics, modality tags, data-provider relation, summary export. |
| 参与方管理 | Party type, data-provider flag, MD-DShap inclusion flag, resource relation, contribution result. |
| 质量评估管理 | Metric weights, precondition check, score cards, dimension details, evidence, re-evaluation. |
| 数元计量管理 | Base price, coefficients, call count, detail table, formula note, export. |
| 贡献度与效用计算 | Contribution factors, normalized contribution, utility function, trace drawer. |
| MD-DShap 计算管理 | Algorithm mode, participant set, task set, parameters, progress, marginal trace, weights, audit export. |
| 合同分配规则 | Total revenue, data-provider pool ratio, non-data-party ratio items, ratio sum, backend-calculated amounts, can-simulate state. |
| 收益分配模拟 | Saved contract-ratio plan, data-provider revenue pool, MD-DShap weighted allocation, amount source, tail-difference handling, lock scheme. |
| 报告生成与导出 | Preview, file list, field scope, history, Markdown/CSV/JSON/JSONL export, local P1 PDF state. |
| 参数配置 | Quality weights, MD-DShap parameters, risk copy, precision rules, versioning. |
| 用户与权限管理（P1） | Users, roles, permission matrix, button-level permission, local P1 login/session state. |
| 审计日志管理 | Filters, log details, snapshot links, trace, JSONL export. |

## Example Project Copy

Use 肺癌早筛数据收益分配示例项目 only as a sample project label. Pair it with
copy that states it is demo/simulated data and not the system's only scenario.
