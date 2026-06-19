# Phase 2C 前端、后端、数据库一致性审计报告

## 1. 审计基线

- 审计基线 HEAD: `a7f405f Fix Phase 2C consistency gaps`
- 生成时间: 2026-06-19
- 审计结论: 一致，可以冻结
- 是否建议冻结: 建议冻结
- Blocker: 0
- Major: 0
- Minor: 0
- Open Question: 0

## 2. Source Of Truth

本次 Phase 2C 复核以本地三份 Markdown 为业务 source of truth：

1. `数据收益分配系统_V1.3_需求规格说明书_导航结构更新版.md`
2. `数据收益分配系统_系统详细功能设计_V1.1_导航结构更新版.md`
3. `数据收益分配系统_数据库设计与ER关系图_V1.0_导航结构更新版.md`

`docs/generated_docx/` 中三份 DOCX 仅作为由 Markdown 生成的交付物校验对象，不作为独立业务事实来源。本轮未修改 DOCX 生成流程，未修改三份 DOCX，未修改三份 Markdown source。

## 3. 历史 Major 复核

| 编号 | 复核项 | 当前结论 | 证据 |
|---|---|---|---|
| P2C-001 | 数据接入 canonical route | 通过 | 前端 route、侧栏 fallback、mock/fallback 快照、字段映射和首页跳转均以 `/data/ingestion` 为数据接入页面主路由；`/data/packages` 仅保留为前端兼容 alias 和后端 API endpoint。 |
| P2C-002 | 前端侧栏是否消费后端菜单树 | 通过 | `AppShell` 启动时优先读取 `/navigation/menus`，`SideNav` 接收后端菜单节点；后端不可用时保留本地 fallback，并在操作消息中明确标记 fallback。后端菜单仍保持系统首页一级页面、`children=[]`。 |
| P2C-003 | 参与方新增、编辑、启停是否接后端 | 通过 | `PartyService` 已接真实 create/update/status API；参与方页面保存和状态切换传入 `party_id`、`party_type`、`include_in_md_dshap` 等 payload，成功后刷新后端工作区，失败时展示后端错误与 trace。 |
| P2C-004 | 合同约束新增、编辑、启停是否接后端 | 通过 | `ConstraintService` 已接真实 create/update/status API；约束页面保存和状态切换传入 `constraint_id`、`party_id`、`constraint_type`、`value_type`、`constraint_value`、`priority` 等 payload，成功后刷新约束和分配相关快照。 |
| P2C-005 | 参数保存、恢复默认、风险文案保存是否接后端 | 通过 | `ParameterService` 已接真实 update/restore API；参数页可保存 seed、sample_rounds、epsilon、baseline_check 和风险文案，可通过后端 restore 恢复默认值。 |
| P2C-006 | MDS-018 / REP-006 是否生成 MD-DShap 算法审计说明 | 通过 | 后端新增 MD-DShap 算法审计说明导出，生成 `md_dshap_audit_report.md/json`，写入 report_record、export_file 和 audit_log。MDS-018 与 REP-006 均调用算法审计说明 endpoint，不再误用审计日志 JSONL。 |
| P2C-007 | OpenAPI path responses 是否引用统一响应 schema | 通过 | `backend/openapi.yaml` 关键 path responses 已引用 `StandardSuccess` / `StandardError`，统一响应 schema 覆盖 success、data、project_status、trace_id，以及 nested error.code、error.field、error.message、error.detail。 |
| P2C-008 | 前端错误处理是否读取 nested error.message / trace_id | 通过 | 前端 API 错误解析已优先读取 nested error.message，同时兼容 top-level message、nested error.field、trace_id、field_errors 和 disabled_reason，并在 UI 文案中展示 trace。 |

## 4. 浏览器 Smoke

已执行浏览器上下文 smoke，覆盖以下页面路由并确认页面加载：

- `/dashboard`
- `/data/ingestion`
- `/data/resources`
- `/data/parties`
- `/metering/quality`
- `/metering/shuyuan`
- `/metering/utility`
- `/allocation/md-dshap`
- `/allocation/simulation`
- `/allocation/constraints`
- `/reports`
- `/system/parameters`
- `/system/audit`

完整链路 smoke 结果：

- 选择演示数据: 通过，项目进入 `INGESTED`。
- 一键计算: 通过，pipeline 返回 `COMPLETED`，项目进入 `ALLOCATED`。
- 参与方新增、编辑、启停: 通过，最终状态 `DISABLED`。
- 合同约束新增、编辑、启停: 通过，最终状态 `DISABLED`。
- 参数保存与恢复默认: 通过，恢复默认返回后端默认值。
- MD-DShap 算法审计说明导出: 通过，主文件为 `md_dshap_audit_report.md`，不是审计日志 JSONL。
- Markdown、CSV、JSON、JSONL 导出: 通过，四类导出均返回 `report_id` 和 64 位 checksum。
- 审计日志查询: 通过，系统审计路由返回审计记录。

## 5. 旧首页口径检查

旧系统首页二级窗口口径未恢复。复核结果：

- 当前菜单、路由、后端实现、OpenAPI 当前业务路径和前端代码均未恢复旧系统首页菜单码。
- 当前业务路由未恢复旧 dashboard 子路由。
- 旧口径检查仅允许命中后端负向测试中的 forbidden list。

## 6. 验证命令

| 命令 | 结果 |
|---|---|
| `PYTHONDONTWRITEBYTECODE=1 python3 -m py_compile backend/dvas/*.py` | 通过 |
| `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s backend/tests -v` | 通过，69 个测试通过 |
| `cd ui_prototype && npm run build` | 通过，`tsc && vite build` 成功 |
| `git diff --check` | 通过 |
| 旧首页口径 `git grep` | 仅命中后端负向测试中的 forbidden list |
| 浏览器 smoke | 通过，覆盖 Markdown、CSV、JSON、JSONL 导出 |

## 7. 冻结建议

建议冻结。8 项历史 Major 已关闭，验证命令与浏览器 smoke 均通过。未发现 Blocker、Major、Minor 或 Open Question。

## 8. 不进入本次提交的文件

以下 untracked 文件/目录继续不纳入本次提交：

- `output/`
- `scripts/check_ui_deliverables.py`
- `数据收益分配系统_ER关系图_V1.0_导航结构更新版.svg`
