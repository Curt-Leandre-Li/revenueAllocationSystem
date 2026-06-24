# 前端重建 Phase 0 审计

更新时间：2026-06-23
范围：只读扫描、接口对齐、规则对齐和后续重建输入产物。未重构页面，未修改前端、后端或业务逻辑。

## 规则来源

- 用户要求读取 `docs/frontend-skills/` 下全部规则；Phase 1A.5 已将规则包统一归档到该目录。
- 已读取规则文件：
  - `docs/frontend-skills/01-api-contract-no-frontend-calculation.md`
  - `docs/frontend-skills/02-navigation-route-status.md`
  - `docs/frontend-skills/03-page-template-button-behavior.md`
  - `docs/frontend-skills/04-visualization-mapping.md`
  - `docs/frontend-skills/05-enterprise-ui-reference.md`
  - `docs/frontend-skills/06-p0-p1-acceptance-checklist.md`
- 路径漂移：已收口为 `docs/frontend-skills/`。

## 扫描范围

| 类别 | 已检查文件或目录 | 结论 |
| --- | --- | --- |
| 项目入口 | `README.md`, `AGENTS.md`, `ui_prototype/package.json` | README 提到 `ui_prototype`，当前实际前端目录是 `ui_prototype`。 |
| 产品/路由文档 | `docs/product_navigation.md`, `docs/ui_route_field_action_matrix.md`, `docs/ui/button_interaction_matrix.md`, `docs/ui_backend_api_contract_mapping.md` | 产品文档要求 `/metering/*`，当前前端主路由仍是 `/measure/*`。 |
| 前端路由和布局 | `ui_prototype/src/app/routes.tsx`, `ui_prototype/src/app/menu.ts`, `ui_prototype/src/app/AppShell.tsx` | 菜单结构基本符合新版分组，但计量路由不符合新版路径。 |
| 前端页面 | `ui_prototype/src/pages/**` | 所有 P0/P1 页面存在，但多页仍使用 mock、硬编码或页面级业务推导。 |
| 前端 API 层 | `ui_prototype/src/domain/api/**`, `apiClient.ts`, `backendAdapter.ts`, `services/**` | 新 API 层已接大量 Phase 2C 端点；旧 `apiClient.ts/backendAdapter.ts` 仍残留。 |
| 后端接口 | `backend/openapi.yaml`, `backend/dvas/app.py`, `backend/dvas/services.py`, `backend/dvas/state_machine.py` | 当前后端已提供多数 P0 端点和 Phase 2C 别名；没有 chart DTO 专用端点。 |
| mock/自算 | `ui_prototype/src/domain/mockData.ts`, `ui_prototype/src/pages/**`, `ui_prototype/src/domain/services/backendWorkspace.ts` | 核心计算展示仍有前端硬编码、reduce 汇总和 mock fallback。 |

## 当前前端结构

### 实际路由

| 实际路由 | 页面 | 模块 | Phase | 对齐状态 |
| --- | --- | --- | --- | --- |
| `/dashboard` | `OverviewPage` | SYS | P0 | 基本对齐。 |
| `/data/ingestion` | `DataPackagesPage` | DATA | P0 | 基本对齐。 |
| `/data/resources` | `DataResourcesPage` | RES | P0 | 基本对齐，但有前端统计和未接按钮。 |
| `/data/parties` | `DataPartiesPage` | PARTY | P0 | 基本对齐，但有 mock 摘要和未接按钮。 |
| `/measure/quality` | `QualityPage` | QUAL | P0 | 路径不对齐，应为 `/metering/quality`。 |
| `/measure/shuyuan` | `ShuyuanPage` | DU | P0 | 路径不对齐，应为 `/metering/shuyuan`。 |
| `/measure/utility` | `UtilityPage` | UTIL | P0 | 路径不对齐，应为 `/metering/utility`。 |
| `/allocation/md-dshap` | `MDDShapPage` | MDS | P0 | 路径对齐，但页面有权重合计自算。 |
| `/allocation/simulation` | `SimulationPage` | ALLOC | P0 | 路径对齐，但页面有收益池/差额自算。 |
| `/allocation/constraints` | `ConstraintsPage` | CONS | P0 | 基本对齐。 |
| `/reports` | `ReportsPage` | REP | P0/P1 | PDF 禁用对齐；`REP-009` 无后端专用契约。 |
| `/system/parameters` | `ParametersPage` | PARAM | P0 | 基本对齐。 |
| `/system/users` | `UsersP1Page` | USER | P1 | P1 说明页，未伪装实现。 |
| `/system/audit` | `AuditPage` | AUD | P0 | 基本对齐，但快照/导出计数来自 mock。 |

### 路由漂移

- `ui_prototype/src/app/routes.tsx` 将 `/metering/quality|shuyuan|utility` 映射到 `/measure/*` 兼容路由。
- `ui_prototype/src/app/menu.ts` 本地菜单使用 `/measure/*`。
- `backend/dvas/services.py` 导航菜单已返回 `/metering/*`。
- `AppShell` 从后端菜单读取后仍调用 `resolveRoute()`，会把后端 `/metering/*` 转回 `/measure/*`。

Phase 1 应把 `/metering/*` 作为主路由，旧 `/measure/*` 仅作为兼容 alias。

## 页面和组件清单

### 页面

- Dashboard：`OverviewPage`，旧的 `OneClickPage`、`ProcessPage`、`RiskPage` 仍存在但未进入当前 route map。
- 数据管理：`DataPackagesPage`、`DataResourcesPage`、`DataPartiesPage`。
- 数元贡献度计量：`QualityPage`、`ShuyuanPage`、`UtilityPage`。
- 收益分配计算：`MDDShapPage`、`SimulationPage`、`ConstraintsPage`。
- 报告与系统：`ReportsPage`、`ParametersPage`、`UsersP1Page`、`AuditPage`。
- 通用旧骨架：`ModulePageScaffold`、`WorkbenchPage`。

### 组件

- 布局和导航：`SideNav`、`PageHeader`、`StatusStepper`、`WorkbenchCard`、`SectionCard`。
- 操作和状态：`ActionButton`、`ConfirmModal`、`PreconditionPanel`、`RiskNotice`、`EmptyGuide`。
- 数据展示：`MetricCard`、`DataTable`、`ExportFieldList`、`TechnicalDetails`。
- 详情/追溯：`DetailDrawer`、`DrawerSection`、`DrawerFooter`、`TraceDrawer`。

## API 调用清单

### 当前前端 API 层

- 活跃 API 层：`ui_prototype/src/domain/api/index.ts` + `endpoints.ts`。
- 旧 API 层：`ui_prototype/src/domain/apiClient.ts` + `backendAdapter.ts`，仍在仓库中但当前 store 使用 `services/backendWorkspace.ts`。
- Store 默认不主动连接后端，只有 `VITE_DVAS_BACKEND_ENABLED` 或 URL `?backend=1` 时同步。

### 前端当前调用的主要端点

| 前端方法 | 端点 | 状态 |
| --- | --- | --- |
| `getProject` | `GET /projects/current/status` | 后端存在。 |
| `getNavigationMenus` | `GET /navigation/menus` | 后端存在。 |
| `getDashboardOverview` | `GET /dashboard` | 后端存在。 |
| `getDashboardPreconditions` | `GET /dashboard/preconditions` | 后端存在。 |
| `runPipeline` | `POST /projects/{project_id}/pipeline/run` | 后端存在。 |
| `initializeDemoCase` | `POST /demo-cases/{demo_case_id}/select` | 后端存在，别名到 initialize。 |
| `uploadJson` | `POST /data/packages/upload` | 后端存在，但当前默认发送内置 demo payload。 |
| `listDataPackages` | `GET /data/packages` | 后端存在。 |
| `listDataResources` | `GET /data/resources` | 后端存在。 |
| `bindResourceParty` | `PUT /data-resources/{resource_id}/party-relations` | 后端存在；前端用参与方名称反查 party_id。 |
| `listParties/create/update/status` | `/data/parties*` | 后端存在。 |
| `runQualityAssessment` | `POST /metering/quality/evaluate` | 后端存在。 |
| `runShuyuanMetering` | `POST /metering/shuyuan/calculate` | 后端存在。 |
| `runContribution` | `POST /metering/utility/contribution/calculate` | 后端存在。 |
| `runUtility` | `POST /metering/utility/calculate` | 后端存在。 |
| `runMdDshap` | `POST /allocation/md-dshap/tasks` | 后端存在。 |
| `getMdDshapTaskResults` | `GET /allocation/md-dshap/tasks/{task_id}/results` | 后端存在。 |
| `exportMdDshapAudit` | `POST /allocation/md-dshap/tasks/{task_id}/audit-export` 或 `POST /reports/md-dshap-audit` | 后端存在。 |
| `runAllocationSimulation` | `POST /allocation/simulation/run` | 后端存在。 |
| `lockCurrentAllocation` | `POST /allocation/simulation/{allocation_id}/lock` | 后端存在。 |
| `exportCurrentAllocationJson` | `POST /allocation/simulation/{allocation_id}/export` | 后端存在。 |
| `listAllocationConstraints` | `GET /allocation/constraints` | 后端存在。 |
| `reportPreview/markdown/csv/json/audit/md-dshap` | `/reports/*` | 后端存在。 |
| `systemParameters` | `/system/parameters*` | 后端存在。 |
| `auditLogs/detail` | `/system/audit/logs`, `/audit-logs/{id}` | 后端存在。 |

## 后端接口概览

当前后端 `backend/openapi.yaml` 与 `backend/dvas/app.py` 提供以下 P0/别名端点：

- 项目/导航/首页：`/projects/current`, `/projects/current/status`, `/projects/{project_id}/status`, `/projects/{project_id}/flow`, `/navigation/menu-tree`, `/navigation/menus`, `/navigation/button-permissions`, `/dashboard`, `/sys/home`, `/dashboard/preconditions`, `/dashboard/actions/quick-run`, `/projects/{project_id}/pipeline/run`。
- 数据接入：`/demo-cases/{demo_case_id}/initialize`, `/demo-cases/{demo_case_id}/select`, `/data-packages/upload`, `/data/packages/upload`, `/data-packages`, `/data/packages`, `/data-packages/{package_id}`, `/data/packages/{package_id}/preview`, `/data-packages/{package_id}/validation-result`。
- 数据资源/参与方：`/data-resources`, `/data/resources`, `/data-resources/{resource_id}`, `/data-resources/{resource_id}/party-relations`, `/parties`, `/data/parties`, `/parties/{party_id}`, `/data/parties/{party_id}`, `/parties/{party_id}/status`, `/data/parties/{party_id}/status`。
- 质量/数元/效用：`/quality-assessments/run`, `/metering/quality/weights`, `/metering/quality/evaluate`, `/quality-assessments/latest`, `/quality-assessments/{assessment_id}/details`, `/shuyuan-meterings/run`, `/metering/shuyuan/parameters`, `/metering/shuyuan/call-counts`, `/metering/shuyuan/calculate`, `/shuyuan-meterings/latest`, `/shuyuan-meterings/{metering_id}/details`, `/contributions/run`, `/metering/utility/contribution-factors`, `/metering/utility/contribution/calculate`, `/metering/utility/function`, `/metering/utility/calculate`, `/utilities/run`, `/utilities/latest`, `/utilities/{utility_id}/trace`。
- MD-DShap：`/md-dshap/tasks`, `/md-dshap/tasks/{task_id}`, `/md-dshap/tasks/{task_id}/results`, `/md-dshap/tasks/{task_id}/marginal-traces`, `/allocation/md-dshap/config`, `/allocation/md-dshap/participant-pool`, `/allocation/md-dshap/tasks`, `/allocation/md-dshap/tasks/{task_id}`, `/allocation/md-dshap/tasks/{task_id}/results`, `/allocation/md-dshap/tasks/{task_id}/audit-export`。
- 收益分配/约束：`/contract-constraints`, `/contract-constraints/{constraint_id}`, `/contract-constraints/{constraint_id}/status`, `/allocation/constraints`, `/allocation/constraints/{constraint_id}`, `/allocation/constraints/{constraint_id}/status`, `/allocation-scenarios`, `/allocation-scenarios/{allocation_id}/simulate`, `/allocation-scenarios/{allocation_id}/lock`, `/allocation-scenarios/{allocation_id}/results`, `/allocation/simulation/revenue-pool`, `/allocation/simulation/priority-items`, `/allocation/simulation/mode`, `/allocation/simulation/run`, `/allocation/simulation/{allocation_id}/lock`, `/allocation/simulation/{allocation_id}/export`。
- 报告/审计/参数：`/reports`, `/reports/preview`, `/reports/markdown`, `/reports/csv`, `/reports/json`, `/reports/audit-log`, `/reports/md-dshap-audit`, `/system/parameters`, `/system/parameters/{parameter_code}`, `/system/parameters/{parameter_code}/restore-default`, `/audit-logs`, `/audit-logs/{log_id}`, `/system/audit/logs`, `/system/audit/logs/{log_id}`。

## 前端自算和 mock 风险摘要

完整清单见 `docs/frontend-rebuild/remove-frontend-calculation-list.md`。高优先级问题如下：

1. `QualityPage` 使用硬编码质量总分、质量等级、质量因子、维度得分和进度条宽度。
2. `ShuyuanPage` 使用硬编码总计量金额、系数、调用量，并用 `sampleCount * 2`、`sampleCount * 2.5` 推导调用量和金额。
3. `UtilityPage` 使用硬编码贡献度、归一化贡献和效用值。
4. `MDDShapPage` 用 `reduce` 计算权重合计，并在页面端判断权重是否等于 1。
5. `SimulationPage` 用本地 `allocationRows`、`totalRevenue - priorityAmount`、`row.after - row.before` 展示分配和约束差额。
6. `backendWorkspace.ts` 从 allocation results `reduce` 得出数据源收益池和 total_revenue，并从 MD-DShap results `reduce` 得出权重合计。
7. `OverviewPage`、`DataResourcesPage`、`DataPartiesPage`、`AuditPage` 和 `ReportsPage` 多处用 mock 或前端列表聚合替代后端聚合字段。

## 后端不存在或前端未接入的入口

| 入口 | 当前位置 | 后端状态 | 当前前端行为 | Phase 1 处理 |
| --- | --- | --- | --- | --- |
| `DATA-009` 停用数据包 | `DataPackagesPage` | 未发现数据包停用端点 | 点击后服务层返回接口未接入 | 隐藏/禁用，或先补后端契约。 |
| `RES-007` 导出资源摘要 | `DataResourcesPage` | 未发现资源摘要专用导出端点 | 服务层返回接口未接入，但页面会打开“已生成”导出抽屉 | 先移除“已生成”假态；后端补 DTO/导出后再启用。 |
| `RES-005` 计算纳入开关 | `DataResourcesPage` | 后端有主体绑定；未发现 `include_in_calculation` 独立更新契约 | 页面发送 `resource-calculation-toggle`，服务层不处理该 payload | 改为后端字段/接口驱动；无接口则禁用开关。 |
| `PARTY-006` 参与方页关联资源 | `DataPartiesPage` | 后端为资源中心绑定接口，无参与方中心批量关联接口 | 服务层返回接口未接入，抽屉仍可操作 | 改成跳转资源页，或补 party-centric DTO。 |
| `MDS-017` 导出算法结果 | `MDDShapPage` | 有算法审计导出；未发现单独权重结果文件导出 | 服务层返回接口未接入，页面显示硬编码 checksum | 不显示“已生成”；改为已有 `/reports/md-dshap-audit` 或补权重导出契约。 |
| `ALLOC-014` 复制新版本 | `routes.tsx` actionIds | 未发现 copy allocation scenario 端点 | 路由元数据有 action，页面未显式按钮 | Phase 1 前不新增入口；保留为未来任务。 |
| `REP-009` 导出收益分配确认书 | `ReportsPage` | 未发现确认书专用导出端点 | 服务层返回接口未接入，但按钮可见 | 隐藏/禁用，或后端补确认书契约且保留模拟参考边界。 |

说明：`QUAL-002`、`DU-002`、`DU-003`、`UTIL-001`、`UTIL-007`、`ALLOC-003`、`ALLOC-005`、`ALLOC-007` 后端已有对应 Phase 2C 端点或参数/草稿端点，但当前页面服务 handler 未完全接入，应在 Phase 1 做接口接线，不应在页面端保存 mock 成功状态。

## 图表和可视化审计

当前没有独立 `Chart` 组件、ECharts/Recharts/Canvas 图表，也没有前端消费后端 chart DTO。

| 页面 | 当前可视化 | 数据来源 | 风险 |
| --- | --- | --- | --- |
| 系统首页 | 指标卡、状态条、流程轨道、最近报告卡、快照时间线 | 部分后端 metrics，部分 mock 聚合 | 首页指标应全部来自 `/dashboard` 或 dashboard chart DTO。 |
| 数据接入 | 指标卡、上传区、校验列表 | 后端 rows 或 fallback mock | 失败详情 fallback 会掩盖真实后端字段缺失。 |
| 数据资源 | 指标卡、筛选表、字段统计 | mock resources 或后端转换 rows | 缺失率/敏感字段统计由前端聚合。 |
| 参与方 | 指标卡、角色分组、贡献摘要表 | 后端 rows + mock 权重 | 贡献摘要应来自后端 DTO。 |
| 质量评估 | 指标卡、进度条、维度卡 | 硬编码 | 必须改为 quality assessment/detail DTO。 |
| 数元计量 | 指标卡、系数卡、资源表 | 硬编码 + mock resources | 必须改为 shuyuan metering/detail DTO。 |
| 效用计算 | 指标卡、贡献效用表、trace drawer | 硬编码 + mock mdsParticipants | 必须改为 contribution/utility/trace DTO。 |
| MD-DShap | 指标卡、进度条、权重表、trace drawer | 后端部分结果 + 前端自算合计 + mock traces | 权重合计、复杂度和边际 trace 应来自后端。 |
| 收益分配 | 指标卡、结果表、对比抽屉、轨迹抽屉 | 后端 rows 或本地 fallback + 前端差额 | 流向图和差额必须由后端 allocation/constraint trace DTO 提供。 |
| 合同约束 | 指标卡、约束表、trace drawer | 后端 rows | 约束命中/未命中缺后端 chart DTO。 |
| 报告导出 | 导出卡、记录列表 | mock reports/exports 或后端 records | 需要展示 report_id/checksum/生成时间，不能用 fallback 文件名。 |
| 审计日志 | 指标卡、日志表、快照列表、trace drawer | mock audit/snapshots | 快照详情应来自 `/audit-logs/{log_id}`。 |

Phase 1 不应在浏览器端拼业务图表数据。若需要图表，先让后端增加 `chart_dto` 或展示 DTO。

## Phase 0 结论

- P0 页面基本都存在；P1 用户权限页和 PDF 以规划/禁用形式存在。
- 当前后端 P0/Phase 2C 端点覆盖度较高，但前端路由、页面数据源和服务 handler 尚未完全对齐。
- 最大风险不是缺少页面，而是页面用 hardcoded/mock/reduce 继续展示业务结果，违反“禁止前端计算”规则。
- 下一阶段应按顺序做：接口契约确认 -> `/metering/*` 路由收敛 -> 后端 DTO/页面数据源接线 -> 移除页面自算 -> 禁用缺后端契约的按钮 -> 再接入图表 DTO。
