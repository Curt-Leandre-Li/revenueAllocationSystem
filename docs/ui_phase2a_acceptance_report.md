# Phase 2A UI 验收报告

生成时间：2026-06-18

范围：仅验收 `ui_prototype` 中 Phase 1、Phase 1.5、Phase 2A 前端重构成果，以及三张样板页截图证据。未处理既有 `agents/`、`backend/`、其他 `docs/` 脏文件。

## 截图路径

| 页面 | 路由 | 截图 | 文件状态 |
| --- | --- | --- | --- |
| 系统首页驾驶舱 | `/dashboard/overview` | `output/phase2a-screenshots/dashboard-overview.png` | 存在，约 323 KB |
| 资源盘点和主体归属确认工作台 | `/data/resources` | `output/phase2a-screenshots/data-resources.png` | 存在，约 249 KB |
| MD-DShap 算法权重计算管理页 | `/allocation/md-dshap` | `output/phase2a-screenshots/allocation-md-dshap.png` | 存在，约 396 KB |

## 3 个样板页验收结论

| 维度 | `/dashboard/overview` | `/data/resources` | `/allocation/md-dshap` |
| --- | --- | --- | --- |
| 是否像正式中文 B 端 SaaS 产品 | 通过。白底浅灰、深蓝标题、青绿色状态和清晰工作区。 | 通过。筛选、表格、阻断提示和详情入口符合管理后台语境。 | 通过。算法卡、前置条件、参数、任务、权重表形成业务工作台。 |
| 是否有明确业务工作区 | 通过。项目、指标、下一步、风险、流程、报告、审计集中展示。 | 通过。围绕资源盘点、主体归属和计算纳入设置组织。 | 通过。围绕算法权重计算前置条件、任务和结果组织。 |
| 信息层级是否清晰 | 通过。状态、指标、操作、风险和最近记录层级明确。 | 通过。先指标和阻断，再筛选和主表。 | 通过。先算法边界和前置条件，再参数、参与方、任务和权重。 |
| 主界面是否无工程调试信息 | 通过。无 schema/debug 文案，无 forbidden 工程字段可见泄露。 | 通过。主表只展示业务字段，技术字段仅详情技术区。 | 通过。默认视图无禁用工程字段；参数名按需求保留。 |
| 是否风格统一但业务结构不同 | 通过。驾驶舱结构。 | 通过。筛选 + 表格 + 详情结构。 | 通过。算法任务 + 前置条件 + 参数/权重结构。 |
| 按钮/表格/抽屉/弹窗是否真实可用 | 通过。按钮触发路由、抽屉、确认和模拟记录。 | 通过。详情、绑定、导出、切换计算状态均可用。 | 通过。计算、进度、trace、权重、复杂度、导出、审计说明均可用。 |

结论：三页可作为后续页面模板，但只建议作为交互和视觉标准，不代表其余 14 个骨架页已经完成高保真业务实现。

## 页面层级与弹窗结构验收结果

默认进入以下页面时，浏览器自动化检查结果均为：

| 路由 | 默认抽屉数 | 默认弹窗数 | 默认展开 `details` 数 | 结论 |
| --- | ---: | ---: | ---: | --- |
| `/dashboard/overview` | 0 | 0 | 0 | 通过 |
| `/data/resources` | 0 | 0 | 0 | 通过 |
| `/allocation/md-dshap` | 0 | 0 | 0 | 通过 |
| `/reports` | 0 | 0 | 0 | 通过 |

不存在未经触发即默认展开的抽屉、弹窗、详情面板或配置窗口。二级窗口均通过一级页面按钮或操作入口打开，并提供关闭或取消路径。

## 系统首页层级检查

`/dashboard/overview` 符合“仅一级页面”要求。默认首屏不存在抽屉、弹窗或详情面板。风险说明抽屉只在点击“打开风险说明抽屉”后出现，并可关闭。

## 报告生成与导出页面层级检查

`/reports` 当前仍为 Phase 1 骨架页面，但默认进入时不存在抽屉、弹窗或展开详情。PDF 导出按钮在 P0 阶段禁用，并带有明确禁用说明：“P1 能力，当前 P0 阶段仅展示规划”。该页未进入 Phase 2A 高保真业务实现范围。

## 二级窗口触发机制检查结果

| 页面 | 二级窗口 | 触发入口 | 关闭路径 | 结论 |
| --- | --- | --- | --- | --- |
| `/dashboard/overview` | 风险与合规边界抽屉 | 打开风险说明抽屉 | 关闭 | 通过 |
| `/data/resources` | 数据资源详情抽屉 | 资源行“详情” | 关闭 | 通过 |
| `/data/resources` | 绑定数据源主体弹窗 | 资源行“关联主体” | 取消 / 保存绑定 | 通过 |
| `/data/resources` | 资源摘要导出抽屉 | 导出资源摘要 | 关闭 | 通过 |
| `/allocation/md-dshap` | 确认执行弹窗 | 启动 MD-DShap / 重新计算 | 取消 / 确认 | 通过 |
| `/allocation/md-dshap` | 计算进度抽屉 | 查看计算进度 | 关闭 | 通过 |
| `/allocation/md-dshap` | 边际贡献明细抽屉 | 查看边际贡献明细 | 关闭 | 通过 |
| `/allocation/md-dshap` | 参与方权重抽屉 | 查看参与方权重 | 关闭 | 通过 |
| `/allocation/md-dshap` | 复杂度优化说明抽屉 | 查看复杂度优化说明 | 关闭 | 通过 |
| `/allocation/md-dshap` | 算法结果导出抽屉 | 导出算法结果 | 关闭 | 通过 |
| `/allocation/md-dshap` | 算法审计说明抽屉 | 生成算法审计说明 | 关闭 | 通过 |

## 按钮功能完整性检查结果

自动化覆盖结果：

- 左侧 17 个菜单项均可跳转到 canonical route。
- `/dashboard/overview`：选择演示数据有业务反馈；进入数据接入、查看报告可跳转；风险抽屉可打开关闭。
- `/data/resources`：详情、关联主体、保存绑定、取消、导出资源摘要均可触发可见业务结果。
- `/allocation/md-dshap`：默认“启动 MD-DShap”和“重新计算”在前置条件不满足时禁用，禁用说明可见；补齐资源主体后启动计算可确认执行并生成权重；所有查看/导出/审计入口可打开并关闭二级窗口。
- `/reports`：PDF P1 按钮禁用且说明明确。

未发现无法关闭的弹窗、抽屉或二级窗口。未发现无法返回上一级的交互流程。

## 假按钮排查结果

静态扫描：

- `<button>` 总体扫描：未发现缺失 `onClick` 且非 submit 的按钮。
- 未发现 `onClick={() => {}}`、`onClick={undefined}`。
- 未发现 `console.log`、toast、`TODO`、`FIXME`、`假按钮`、`占位`、`临时`。
- `actionRegistry` 共 68 个 action，均包含 `label`、`moduleCode`、`permission`、`sideEffect`，并通过 `handlerName` 映射到 dispatcher 中的 service handler。
- 14 个 service handler 文件均存在并已被 dispatcher 注册。

结论：三张样板页范围内未发现假按钮。非样板骨架页按钮已接入 dispatcher，可写模拟审计，但其完整业务副作用仍属于后续 Phase 2B 页面实现范围。

## 无用内容清理结果

本次清理：

- 关闭默认后端自动探测；只有 URL 带 `?backend=1` 时才执行后端同步，默认样板环境不再产生 `ERR_CONNECTION_REFUSED` 控制台噪声。
- 将工作区默认提示从后端探测口径改为演示工作区口径。
- 清理 `WorkbenchPage` 中的“临时/fallback/canonical”可见文案，改为中文兜底页面说明。
- 清理样板页可见 `mock` 文案，改为“演示参数”或“模拟记录”。

保留内容：

- `ModulePageScaffold`：作为未高保真页面的 Phase 1 骨架模板保留。
- `WorkbenchPage`：只作为未匹配 route component 的兜底保留，不作为主路由页面。
- `src/ui/*`：所有导出的 UI 组件均有引用，无删除。
- `src/domain/apiClient.ts` 与 `backendAdapter.ts`：保留显式后端联调入口，不默认触发。

## 字段与工程信息检查结果

- 工程字段可见泄露扫描：3 个样板页默认可见文本均无 `project_id`、`page_id`、`route_aliases`、`audit_events`、`checksum`、`snapshot_id`、`relation_id`、`include_in_md_dshap`、`party_type`、`DATA_PROVIDER` 等泄露。
- `fieldMap` visibleInTable 工程字段扫描：`engineeringVisibleInTable = []`。
- 工程字段只允许在 `TechnicalDetails` 中出现；MD-DShap 抽屉内的 `output_snapshot_id` 属于技术详情区。

## WorkbenchPage 主路由引用检查

扫描结果：

- `routeComponents` 不引用 `WorkbenchPage`。
- `AppShell` 仅保留 `routeComponents[route.path] ?? WorkbenchPage` 兜底。
- `WorkbenchPage` 不作为任何 canonical route 的主页面。

结论：主路由未继续复用 `WorkbenchPage`。

## 可复用的页面模板规则

后续页面必须遵守：

1. 页面入口必须使用 `PageHeader`，标题、副标题、职责均为中文业务口径。
2. 主界面只展示业务字段；工程字段只能放入 `TechnicalDetails`，且默认不展开。
3. 页面按钮必须来自 `actionRegistry` 或明确路由导航，不得直接硬编码权限或按钮编号。
4. 页面按钮不得直接改 store；业务副作用必须走 `onAction -> actionDispatcher -> service`。
5. 二级窗口必须默认关闭，只能由按钮、行操作或明确入口触发。
6. 所有抽屉、弹窗必须有关闭、取消或返回路径。
7. 禁用按钮必须给出 `title` 禁用原因。
8. P1 功能只读或禁用展示，不得伪装成 P0 可用能力。
9. 不得恢复 schema/debug UI，不得在主界面展示 route alias、page id、snapshot id、checksum 等字段。
10. 视觉密度遵循三页样板：浅灰背景、白底卡片、青绿色主色、深蓝标题、8px 以内圆角、卡片不过度嵌套。

## 后续页面必须复用的 UI 组件清单

- `AppShell`
- `PageHeader`
- `StatusStepper`
- `MetricCard`
- `SectionCard`
- `WorkbenchCard`
- `ActionButton`
- `DataTable`
- `DetailDrawer`
- `ConfirmModal`
- `EmptyGuide`
- `RiskNotice`
- `TechnicalDetails`
- `PreconditionPanel`
- `TraceDrawer`

## 后续 agents 禁止修改的共享文件清单

除主控 agent 明确批准外，后续页面 agents 不得修改：

- `ui_prototype/src/app/menu.ts`
- `ui_prototype/src/app/routes.tsx`
- `ui_prototype/src/app/AppShell.tsx`
- `ui_prototype/src/domain/actionRegistry.ts`
- `ui_prototype/src/domain/fieldMap.ts`
- `ui_prototype/src/domain/status.ts`
- `ui_prototype/src/domain/permissions.ts`
- `ui_prototype/src/domain/store.ts`
- `ui_prototype/src/domain/mockData.ts`
- `ui_prototype/src/domain/services/*`
- `ui_prototype/src/ui/*`
- `ui_prototype/src/pages/ModulePageScaffold.tsx`
- `ui_prototype/src/pages/WorkbenchPage.tsx`
- `ui_prototype/src/pages/phase2aUtils.ts`
- `ui_prototype/src/styles.css`

共享样式确需扩展时，必须由主控 agent 合并，避免多 agents 并行互相覆盖。

## 后续 agents 可修改的页面范围

后续 agents 只应在各自页面文件内实现业务高保真，不得跨边界修改共享文件：

- Dashboard agent：`src/pages/dashboard/ProcessPage.tsx`、`RiskPage.tsx`、`OneClickPage.tsx`。`OverviewPage.tsx` 只作为模板参照，默认不改。
- Data module agent：`src/pages/data/DataPackagesPage.tsx`、`DataPartiesPage.tsx`。`DataResourcesPage.tsx` 只作为模板参照，默认不改。
- Measure module agent：`src/pages/measure/QualityPage.tsx`、`ShuyuanPage.tsx`、`UtilityPage.tsx`。
- Allocation module agent：`src/pages/allocation/SimulationPage.tsx`、`ConstraintsPage.tsx`。`MDDShapPage.tsx` 只作为模板参照，默认不改。
- Report/System module agent：`src/pages/reports/ReportsPage.tsx`、`src/pages/system/ParametersPage.tsx`、`AuditPage.tsx`、`UsersP1Page.tsx`。

## 当前未完成项

- 除 3 个样板页外，其余 14 个页面仍为 Phase 1 骨架或半成品，需要 Phase 2B 分批高保真实现。
- 报告生成与导出页目前只完成一级骨架和 P1 禁用边界，尚未完成高保真报告预览、导出确认、文件记录详情。
- 部分 service 仍为通用模拟写审计结果，尚未针对每个业务按钮生成完整 mock 业务记录。
- 仅完成 1440x900 视觉截图验收，未执行移动端和窄屏视觉验收。
- 未接真实后端接口；默认关闭后端同步，需显式 `?backend=1` 才尝试后端联调。

## 已发现风险项

- 后续多 agents 如果直接修改共享 `styles.css`，容易造成样式冲突；建议主控 agent 统一合并共享样式。
- 非样板骨架页虽然按钮不是假按钮，但业务副作用深度不足，不能作为最终验收页面。
- `DataTable`/`ModulePageScaffold` 适合骨架，不适合所有复杂页面；复杂页面应参考 `DataResourcesPage` 和 `MDDShapPage` 的页面专属布局。
- 截图证据位于 `output/phase2a-screenshots/`，当前未纳入 commit 范围；如果后续需要可审计视觉基线，应明确是否纳入版本控制。

## 是否建议进入 Phase 2B

建议进入 Phase 2B，但必须按页面组分批推进，并保持以下条件：

- 三个样板页作为只读模板，不再由并行 agents 随意改动。
- 每个 agent 只实现自己负责的页面文件。
- 共享路由、菜单、fieldMap、actionRegistry、store、services、UI 组件和全局样式由主控 agent 统一管理。
- 每批页面完成后必须重复本报告中的字段泄露、按钮、二级窗口、build、diff check 和截图验收。
