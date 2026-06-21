# Phase 2C UI API Mapping

Phase 2C 目标是让 `ui_prototype/` 默认通过 Phase 2A/2B 后端接口读取和触发真实 PostgreSQL 流程。Mock 文件允许保留为离线开发 fallback，但页面不得把 mock 数据伪装成真实数据库结果；后端不可用时 UI 显示明确失败提示。

## 统一接入

- API client: `ui_prototype/src/lib/api.ts`
- API base: `VITE_API_BASE_URL`
- 默认示例: `ui_prototype/.env.example`
- 错误处理: `ui_prototype/src/lib/errors.ts`
- 展示格式化: `ui_prototype/src/lib/formatters.ts`
- 数据类型: `ui_prototype/src/lib/types.ts`

## 页面映射

| 页面路径 | 页面模块 | 当前数据来源 | Phase 2C 目标 API | 需要接入的按钮 | Mock fallback | 未覆盖原因 |
|---|---|---|---|---|---|---|
| `/dashboard` | 系统首页 | `backendWorkspace` 聚合真实 API，报告/审计由真实 API 派生 | `GET /health/db`, `GET /api/projects`, `GET /api/projects/:projectId/status`, `GET /api/reports`, `GET /api/audit/logs`, `GET /api/projects/:projectId/allocation-summary`, `GET /api/projects/:projectId/md-dshap-summary` | `POST /api/demo-cases/load`, `POST /api/data/upload-json`, `POST /api/projects/:projectId/pipeline/run`, `POST /api/projects/:projectId/allocation/confirm`, `POST /api/projects/:projectId/reports/generate` | 仅后端不可用时显示离线/不可用提示 | 无 |
| `/data/ingestion` | 数据接入管理 | 真实项目、数据包和输入快照计数 | `GET /api/projects/:projectId/status` | `POST /api/demo-cases/load`, `POST /api/data/upload-json` | 不用 mock 伪造接入成功 | 上传校验历史明细列表暂未由 plain API 暴露；失败字段由 POST 错误返回 |
| `/data/resources` | 数据资源管理 | 真实资源计数和项目级摘要 | `GET /api/projects/:projectId/status` | 只读刷新 | 不伪造资源明细 | 缺少 resources list/detail plain read API |
| `/data/parties` | 参与方管理 | `allocation-summary` 和 `md-dshap-summary` 中可追溯 party 摘要 | `GET /api/projects/:projectId/status`, `GET /api/projects/:projectId/allocation-summary`, `GET /api/projects/:projectId/md-dshap-summary` | 只读刷新 | 不伪造参与方 CRUD | 缺少完整 parties list plain read API |
| `/measure/quality` | 质量评估管理 | 最新质量评估摘要 | `GET /api/projects/:projectId/status` | `POST /api/projects/:projectId/pipeline/run` | 不显示静态质量分 | 缺少 quality details plain read API |
| `/measure/shuyuan` | 数元计量管理 | 最新数元计量摘要 | `GET /api/projects/:projectId/status` | `POST /api/projects/:projectId/pipeline/run` | 不显示静态资源级计量 | 缺少 shuyuan detail plain read API |
| `/measure/utility` | 贡献度与效用计算 | 真实贡献/效用计数和权重摘要 | `GET /api/projects/:projectId/status`, `GET /api/projects/:projectId/md-dshap-summary` | `POST /api/projects/:projectId/pipeline/run` | 不显示静态贡献表 | 缺少 utility trace/detail plain read API |
| `/allocation/md-dshap` | MD-DShap 计算管理 | 真实 MD-DShap summary | `GET /api/projects/:projectId/md-dshap-summary` | `POST /api/projects/:projectId/pipeline/run`, `POST /api/projects/:projectId/reports/generate` | 不用 Basic Shapley 伪造默认结果 | 边际 trace 明细接口暂缺 |
| `/allocation/simulation` | 收益分配模拟 | 真实 allocation summary | `GET /api/projects/:projectId/allocation-summary` | `POST /api/projects/:projectId/pipeline/run`, `POST /api/projects/:projectId/allocation/confirm`, `POST /api/projects/:projectId/reports/generate` | 前端不重算金额 | 无完整约束列表；仅展示约束前/后金额摘要 |
| `/allocation/constraints` | 合同约束管理 | 分配结果中的约束前/后金额摘要 | `GET /api/projects/:projectId/allocation-summary` | 只读刷新 | 不伪造约束 CRUD | 缺少 contract constraints plain read API |
| `/reports` | 报告生成与导出 | 真实 `report_record` 和 `export_file` | `GET /api/reports?project_id=...` | `POST /api/projects/:projectId/reports/generate` | 不生成假 PDF | 无 |
| `/system/audit` | 审计日志管理 | 真实 `audit_log` 最近 50 条 | `GET /api/audit/logs?project_id=...&limit=50` | 只读刷新，导出走报告生成接口 | 不伪造审计日志 | 快照详情列表暂缺；只显示 snapshot_store 计数 |
| `/system/parameters` | 参数配置 | P0 只读参数边界说明 | `GET /api/projects/:projectId/status` | 只读刷新 | 不伪造参数编辑成功 | 缺少 Phase 2C 参数写接口；P0 不做完整参数编辑 |
| `/system/users` | 用户与权限管理（P1） | 本地 P1 说明 | 不接后端 | 无真实 P0 写按钮 | 不适用 | 登录/RBAC 为 P1 |

## Mock 处理结论

- 默认路径是真实 API。
- 后端不可用时，工作区保留离线 fallback，但操作消息明确显示“后端不可用 / 未用 mock 伪造成功”。
- 静态 mock 文件未删除，用于离线开发；CI smoke 不依赖 mock。
- Phase 2C 未新增后端只读接口，资源、参与方、质量明细、数元明细、效用 trace、约束列表等缺口已在页面和本文档记录。

## 边界

- 所有页面继续保留“模拟参考，非法律结算”提示。
- 前端只格式化后端返回的金额和权重，不重新计算分配结果。
- PDF、RBAC、多租户、真实付款、银行、税务、电子签章均不属于 Phase 2C。
