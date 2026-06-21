# Phase 2D UI Acceptance Plan

Phase 2D 目标是在 Phase 2C 真实 API 接入基础上完成页面完整性、真实数据展示、操作演示、截图包和软著验收材料。本阶段不重做 UI，不改数据库表结构，不重构算法，不实现 PDF、RBAC、多租户、异步队列或真实付款/银行/税务/电子签章。

## 输入依据

- `docs/PHASE_2C_UI_API_MAPPING.md`
- `数据收益分配系统_V1.3_需求规格说明书_导航结构更新版.md`
- `数据收益分配系统_系统详细功能设计_V1.1_导航结构更新版.md`
- `ui_prototype/src/app/routes.tsx`
- Phase 2A/2B/2C 已验收的 PostgreSQL-backed API

## 路由说明

当前前端真实路由使用 `/measure/quality`、`/measure/shuyuan`、`/measure/utility`。历史兼容路由 `/metering/quality`、`/metering/shuyuan`、`/metering/utility` 继续映射到对应 `/measure/*` 页面，不在 Phase 2D 改动主路由。

## 页面缺口审计

| 页面路径 | 页面名称 | 已接真实 API | 有真实数据 | Mock fallback 提示 | Loading | Error | Empty | 核心按钮 | 二次确认 | 模拟参考提示 | 需新增最小只读接口 | 纳入截图包 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|
| `/dashboard` | 系统首页 | 是 | 是 | 是 | 是 | 是 | 是 | 是 | 是 | 是 | 否 | 是 |
| `/data/ingestion` | 数据接入管理 | 是 | 部分 | 是 | 是 | 是 | 是 | 是 | 否 | 是 | 上传校验结果可由状态和写接口错误返回补足 | 是 |
| `/data/resources` | 数据资源管理 | 部分 | 部分 | 是 | 是 | 是 | 是 | 只读刷新 | 不适用 | 是 | `GET /api/projects/:projectId/resources` | 是 |
| `/data/parties` | 参与方管理 | 部分 | 部分 | 是 | 是 | 是 | 是 | 只读刷新 | 不适用 | 是 | `GET /api/projects/:projectId/parties` | 是 |
| `/measure/quality` | 质量评估管理 | 部分 | 部分 | 是 | 是 | 是 | 是 | 执行完整计算 | 是 | 是 | `GET /api/projects/:projectId/quality-summary` | 是 |
| `/measure/shuyuan` | 数元计量管理 | 部分 | 部分 | 是 | 是 | 是 | 是 | 执行完整计算 | 是 | 是 | `GET /api/projects/:projectId/shuyuan-summary` | 是 |
| `/measure/utility` | 贡献度与效用计算 | 部分 | 部分 | 是 | 是 | 是 | 是 | 执行完整计算 | 是 | 是 | `GET /api/projects/:projectId/utility-summary` | 是 |
| `/allocation/md-dshap` | MD-DShap 计算管理 | 是 | 是 | 是 | 是 | 是 | 是 | 执行完整计算、生成报告 | 是 | 是 | 否 | 是 |
| `/allocation/simulation` | 收益分配模拟 | 是 | 是 | 是 | 是 | 是 | 是 | 执行完整计算、确认方案、生成报告 | 是 | 是 | 否 | 是 |
| `/allocation/constraints` | 合同约束管理 | 部分 | 部分 | 是 | 是 | 是 | 是 | 只读刷新 | 不适用 | 是 | `GET /api/projects/:projectId/constraints-summary` | 是 |
| `/reports` | 报告生成与导出 | 是 | 是 | 是 | 是 | 是 | 是 | 生成报告、查看导出 | 是 | 是 | `GET /api/projects/:projectId/export-files` | 是 |
| `/system/audit` | 审计日志管理 | 是 | 是 | 是 | 是 | 是 | 是 | 只读刷新 | 不适用 | 是 | 否 | 是 |
| `/system/parameters` | 参数配置 | 部分 | 部分 | 是 | 是 | 是 | 是 | 只读刷新 | 不适用 | 是 | 否 | 是 |
| `/system/users` | 用户与权限管理（P1） | 不适用 | 是 | 不适用 | 是 | 是 | 是 | 无 P0 写按钮 | 不适用 | 是 | 否 | 是 |

## 最小只读接口补齐范围

Phase 2D 需要让截图呈现真实明细，而不是只显示项目级计数。因此补齐以下只读接口：

- `GET /api/projects/:projectId/resources`
- `GET /api/projects/:projectId/parties`
- `GET /api/projects/:projectId/quality-summary`
- `GET /api/projects/:projectId/shuyuan-summary`
- `GET /api/projects/:projectId/utility-summary`
- `GET /api/projects/:projectId/constraints-summary`
- `GET /api/projects/:projectId/export-files`

这些接口只读取 PostgreSQL 真实表，显式使用 `dvas.*` 表名，不改表结构、不改写库流程、不改算法、不引入 ORM。

## 截图链路

截图脚本覆盖一条真实演示链路：

1. 打开 `/dashboard`。
2. 选择演示数据。
3. 启动完整计算。
4. 确认分配方案。
5. 生成报告。
6. 查看 MD-DShap、收益分配、报告、审计等页面。
7. 保存截图到 `output/phase_2d_screenshots/` 或由 GitHub Actions 上传 artifact。

截图不得伪造真实数据；若本地无法生成完整 PNG，脚本和 CI artifact 作为交付路径，报告中记录原因。

## 验收边界

- 页面必须保留“模拟参考，非法律结算”提示。
- 前端只格式化后端返回的金额和权重，不重新计算分配结果。
- PDF 标记为 P1，不实现假 PDF。
- 用户与权限管理标记为 P1，P0 保持 `local_operator` 模式。
- 后端不可用时 UI 显示明确错误或离线 fallback 提示，不白屏。
