# Acceptance Checklist

## GAP Closure

- GAP-001: P0 local operator is documented; login/RBAC are P1.
- GAP-002: P0 Markdown/CSV/JSON/JSONL export is documented; PDF is P1.
- GAP-003: MD-DShap is default; Basic Shapley is only `baseline_check`.
- GAP-004: Core buttons have preconditions, fields, flow, exceptions, logs, and
  acceptance criteria.
- GAP-005: Export files have field/section lists.

## Module-Level Acceptance

| Module | Minimum checks |
| --- | --- |
| 数据接入管理 | Demo data, JSON upload, validation failure detail, input snapshot, sensitive-data warning. |
| 数据资源管理 | Resource statistics, modality, field summary, data-provider relation, summary export. |
| 参与方管理 | Data-provider vs non-data party, MD-DShap inclusion default, status, resource relation. |
| 质量评估管理 | Weight validity, score, level, dimension details, evidence, new version on re-evaluation. |
| 数元计量管理 | Base price, coefficients, call count, resource/party/project detail, formula note. |
| 贡献度与效用计算 | Contribution factors, normalized contribution, utility source, utility value, trace. |
| MD-DShap 计算管理 | Default mode, participant set, single-party simplification, weights sum to 1, marginal trace, audit report. |
| 收益分配模拟 | Total revenue, priority allocation, data-provider pool, pre/post constraint amounts, scheme lock. |
| 合同约束管理 | Constraint type, value, priority, enable/disable, apply trace. |
| 报告生成与导出 | Markdown/CSV/JSON/JSONL, fields, `report_id`, `checksum`, disclaimer, no overwrite. |
| 参数配置 | Parameter versions, MD-DShap defaults, risk text. |
| 用户与权限管理（P1） | P1 label; no P0 login/RBAC requirement. |
| 审计日志管理 | Query, detail, snapshot links, trace, JSONL export. |

## Button-Level Acceptance Principles

- Check visibility and enabled/disabled state.
- Check permission role or P0 local operator behavior.
- Check preconditions before calculation.
- Check successful output and state transition.
- Check exception message and failed audit log where applicable.
- Check input, parameter, result, report, and algorithm snapshots where
  applicable.
- Check high-risk actions require confirmation.
- Check recalculation creates a new version and preserves history.

## Documentation Validation Commands

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
