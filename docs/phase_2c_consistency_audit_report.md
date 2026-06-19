# Phase 2C 前端、后端、数据库一致性审计报告

## 1. 审计基线

- 审计基线 HEAD: `ecac004 Add regenerated DOCX deliverables`
- 生成时间: 2026-06-19
- 审计结论: 部分一致，存在 Major 需修复
- 是否建议冻结: 不建议冻结
- Blocker: 0
- Major: 8
- Minor: 0
- Open Question: 0

## 2. Source Of Truth

本次 Phase 2C 审计以本地三份 Markdown 为业务 source of truth：

1. `数据收益分配系统_V1.3_需求规格说明书_导航结构更新版.md`
2. `数据收益分配系统_系统详细功能设计_V1.1_导航结构更新版.md`
3. `数据收益分配系统_数据库设计与ER关系图_V1.0_导航结构更新版.md`

`docs/generated_docx/` 中三份 DOCX 只作为由 Markdown 生成的交付物校验对象，不作为独立业务事实来源。

## 3. DOCX 生成物校验

`docs/generated_docx/` 当前仅包含三份正式 DOCX：

- 需求规格说明书 DOCX
- 系统详细功能设计 DOCX
- 数据库设计与 ER 关系图 DOCX

校验结果：

- 三份 DOCX 未发现 `宽表已按原表头转换为字段块` 或 `DOCX 横向裁切` 生成残留。
- 三份 DOCX 未发现 `NAV_SYS_OVERVIEW`、`NAV_SYS_PROCESS`、`NAV_SYS_RISK`、`NAV_SYS_ONE_CLICK`。
- 三份 DOCX 未发现 `/dashboard/overview`、`/dashboard/process`、`/dashboard/flow`、`/dashboard/risk`、`/dashboard/quick-run`、`/dashboard/one-click`。
- 三份 DOCX 未发现指定的 MD-DShap 异常控制字符、`“ ” 本地操作员` 等异常字符。
- DOCX 与当前 Markdown 的系统首页新口径一致：系统首页为一级导航页面，路由为 `/dashboard`，不设置二级窗口，首页内部区块不进入菜单、路由或权限配置。个别精确短语未在某份 DOCX 中逐字出现时，原因是对应 Markdown 本身使用了等价表述，并非 DOCX 生成漂移。

## 4. 历史 Major 复核

| 编号 | 复核项 | 结论 | 证据 |
|---|---|---|---|
| P2C-001 | `/data/ingestion` 是否已经是数据接入 canonical route | Major | 三份 Markdown 和后端菜单树使用 `/data/ingestion`，但前端 `appRoutes` 与 `sideNavMenuNodes` 仍以 `/data/packages` 作为数据接入页面 route，并仅将 `/data/ingestion` 映射为兼容入口。见 `ui_prototype/src/app/routes.tsx:30`、`ui_prototype/src/app/routes.tsx:174`、`ui_prototype/src/app/menu.ts:34`、`backend/dvas/services.py:141`、`backend/dvas/services.py:144`。 |
| P2C-002 | 前端侧栏是否仍是静态菜单，是否存在与后端菜单树漂移风险 | Major | 后端有 `/navigation/menu-tree` 菜单树，且 `NAV_SYS_HOME`/`/data/ingestion` 已按 source of truth 输出；前端侧栏仍由 `ui_prototype/src/app/menu.ts` 的静态 `sideNavMenuNodes` 驱动，没有读取后端菜单树。见 `backend/dvas/services.py:131`、`ui_prototype/src/app/menu.ts:18`、`ui_prototype/src/ui/SideNav.tsx`。 |
| P2C-003 | 参与方新增/编辑/启停前端是否接后端 | Major | 后端已提供参与方 create/update/status 能力，但前端 `PartyService` 只有 `PARTY-008` 刷新，其余参与方动作返回 `backendUnavailableStore`。见 `backend/dvas/app.py:147`、`backend/dvas/app.py:153`、`backend/dvas/app.py:162`、`backend/dvas/services.py:1170`、`ui_prototype/src/domain/services/PartyService.ts:8`、`ui_prototype/src/domain/services/PartyService.ts:12`。 |
| P2C-004 | 合同约束新增/编辑/启停前端是否接后端 | Major | 后端已提供合同约束 create/update/status 能力，但前端 `ConstraintService` 只有 `CONS-011` 刷新，其余约束动作返回 `backendUnavailableStore`。见 `backend/dvas/services.py:2312`、`backend/dvas/services.py:2333`、`backend/dvas/services.py:2360`、`ui_prototype/src/domain/services/ConstraintService.ts:8`、`ui_prototype/src/domain/services/ConstraintService.ts:12`。 |
| P2C-005 | 参数保存/恢复默认/风险文案保存前端是否接后端 | Major | 后端已提供参数列表、更新和恢复默认能力；前端 `ParameterService` 只有 `PARAM-001` 刷新，其余保存/恢复/风险文案动作返回 `backendUnavailableStore`。见 `backend/dvas/app.py:330`、`backend/dvas/app.py:334`、`backend/dvas/app.py:337`、`ui_prototype/src/domain/services/ParameterService.ts:8`、`ui_prototype/src/domain/services/ParameterService.ts:12`。 |
| P2C-006 | `MDS-018 / REP-006` 是否真的生成 MD-DShap 算法审计说明 | Major | Markdown 要求输出 `md_dshap_audit_report.md/json`，并披露算法模式、参数、效用函数来源、近似假设和边界。当前 `MDS-018` 未接后端动作；`REP-006` 调用的是 `dvasApi.exportAuditLog()` 和 `/reports/audit-log`，生成审计日志 JSONL，不是 MD-DShap 算法审计说明。见 `数据收益分配系统_V1.3_需求规格说明书_导航结构更新版.md:377`、`ui_prototype/src/domain/services/MDDShapService.ts:26`、`ui_prototype/src/domain/services/ReportService.ts:49`、`ui_prototype/src/domain/services/ReportService.ts:52`、`backend/dvas/services.py:2910`。 |
| P2C-007 | OpenAPI path responses 是否引用统一 `StandardResponse` / `ErrorResponse` schema | Major | `backend/openapi.yaml` 定义了 `StandardResponse` 和 `ErrorResponse`，但 path responses 仍是描述文本，没有 `$ref` 到统一 schema。见 `backend/openapi.yaml:760` 至 `backend/openapi.yaml:1006`、`backend/openapi.yaml:1009`。 |
| P2C-008 | 前端错误处理是否读取 nested `error.message` / `trace_id` | Major | 后端错误 envelope 已包含 top-level `trace_id` 和 nested `error.message`；前端新 API 错误解析读取 top-level `message`、`trace_id` 和 `field_errors`，未建模 nested `error.message`，因此仍可能丢失字段级 nested message。见 `backend/dvas/contracts.py:60`、`backend/dvas/contracts.py:69`、`ui_prototype/src/domain/api/errors.ts:17`、`ui_prototype/src/domain/api/errors.ts:43`。 |
| P2C-009 | 浏览器 smoke 是否完整覆盖 Markdown / CSV / JSON / JSONL 导出 | 通过 | 本次额外执行浏览器上下文 smoke：启动本地后端和 Vite，在 Playwright 页面上下文中完成演示数据、质量评估、数元计量、贡献、效用、MD-DShap、收益分配、锁定，并触发 `/reports/markdown`、`/reports/csv`、`/reports/json`、`/reports/audit-log`。四类导出均返回 `report_id` 和 64 位 checksum。 |

## 5. 系统首页旧口径检查

执行旧首页菜单码和旧 dashboard 子路由检查后，仅命中 `backend/tests/test_api_contract.py` 中用于断言禁止出现旧菜单码的负向测试数据。未在 Markdown source、后端实现、脚本实现或前端实现中发现旧系统首页菜单码/旧 dashboard 子路由作为当前业务口径使用。

系统首页当前口径：

- Markdown source: `NAV_SYS_HOME`、`/dashboard`、`children: []`，首页内部区块不进入 `nav_menu`。
- 后端菜单树: `NAV_SYS_HOME` 为一级菜单，`children=[]`。
- 前端路由: `/dashboard` 为系统首页唯一当前页面；旧 dashboard 子路由未恢复。

## 6. 验证命令

| 命令 | 结果 |
|---|---|
| `git diff --check` | 通过 |
| `PYTHONDONTWRITEBYTECODE=1 python3 -m py_compile backend/dvas/*.py` | 通过 |
| `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s backend/tests -v` | 通过，67 个测试通过 |
| `cd ui_prototype && npm run build` | 通过，`tsc && vite build` 成功 |
| 旧首页口径 `git grep` | 仅命中后端负向测试中的 forbidden list |
| DOCX 正文 XML 检查 | 通过，无旧菜单码、旧 dashboard 子路由、DOCX 生成残留或指定异常字符 |
| 浏览器 smoke | 通过，覆盖 Markdown、CSV、JSON、JSONL 导出 |

## 7. 冻结建议

不建议冻结。后端完整链路、导出和系统首页导航测试已通过，浏览器 smoke 也覆盖了四类 P0 导出；但当前前端仍有 8 项 Major 级一致性缺口，主要集中在 canonical route、菜单树来源、写操作接后端、算法审计导出和 OpenAPI/错误 envelope 契约。

## 8. 不进入本次提交的文件

以下 untracked 文件/目录继续不纳入本次审计报告提交：

- `output/`
- `scripts/check_ui_deliverables.py`
- `数据收益分配系统_ER关系图_V1.0_导航结构更新版.svg`
