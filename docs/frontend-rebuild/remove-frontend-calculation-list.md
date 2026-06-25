# 前端自算移除清单

更新时间：2026-06-24
原则：前端只允许格式化金额、百分比、权重显示、状态标签映射和空值占位。质量分、数元金额、贡献度、效用值、MD-DShap 权重、收益分配金额、约束调整金额、权重合计和比例归一化均不得在浏览器端计算。

## Phase 1B 清理状态

已清理并改为后端字段、空状态或禁用态：

- DONE：FC-001 至 FC-025，质量、数元、效用、MD-DShap、收益分配页面的硬编码结果、前端计算、trace 伪造和导出 metadata 伪造已移除。
- DONE：FC-026 至 FC-028，首页不再从 mock 资源、权重池或收益池推导指标。
- DONE：FC-030 至 FC-035，数据资源和参与方页不再用资源聚合、fallback 主体或 mock 权重摘要展示业务结果。
- DONE：FC-036 至 FC-039，数据包页不再使用本地数据包、校验错误和指标 fallback；上传 JSON 只提交用户文件内容。
- DONE：FC-040 至 FC-048，上传默认 payload、后端工作区收益池/权重合计 reduce、utilityValue 错置、边际 trace 伪造已移除或改为后端字段缺失态。
- DONE：FC-049 至 FC-050，报告页不再读取 `mock.exports`，无后端记录时显示空状态，`report_id` 和 `checksum` 只透传后端字段。
- DONE：FC-051 至 FC-053，审计页不再用 mock 日志/快照，`mockData.ts` 已收敛为空的 dev-only fixture。

仍需后续阶段处理：

- TODO：FC-029 拆分比例输入提示是否保留，需要以后端 party relation 表单契约为准；当前入口已禁用。

后端 DTO 缺口记录见 `docs/frontend-rebuild/backend-dto-gap-list.md`。

## 必须移除或改接后端 DTO

| ID | 文件位置 | 类型 | 当前行为 | 违反点 | Phase 1 目标 |
| --- | --- | --- | --- | --- | --- |
| FC-001 | `ui_prototype/src/pages/measure/QualityPage.tsx:15` | 质量得分硬编码 | `dimensionScores` 写死少量一级指标得分、权重和证据，未覆盖规范性、准确性、完整性、唯一性、一致性、时效性、可访问性及 17 个二级指标。 | 质量评分和权重不得在前端定义。 | 从 `GET /quality-assessments/{id}/details` 或 quality chart DTO 读取。 |
| FC-002 | `ui_prototype/src/pages/measure/QualityPage.tsx:37` | 质量总分硬编码 | 指标卡写死 `88.75`, `A`, `1.063200`, `v3`。 | 页面指标必须来自后端字段。 | 从 latest assessment DTO 显示 `quality_score`, `quality_level`, `quality_factor`, `version_no`。 |
| FC-003 | `ui_prototype/src/pages/measure/QualityPage.tsx:87` | 质量进度条硬编码 | `style={{ width: "88.75%" }}`。 | 前端用硬编码表现业务得分。 | 后端返回 display percent 或 chart DTO；前端只渲染。 |
| FC-004 | `ui_prototype/src/pages/measure/QualityPage.tsx:138` | 权重合计硬编码 | 显示“当前一级权重合计：1.000000”。 | 权重合计/校验应由后端完成。 | 后端返回权重校验结果，前端只显示。 |
| FC-005 | `ui_prototype/src/pages/measure/ShuyuanPage.tsx:15` | 数元系数硬编码 | `factors` 写死场景/质量/技术/专家/发展系数。 | 数元计量参数不得由页面定义。 | 从 `/metering/shuyuan/parameters` 或 system parameter DTO 读取。 |
| FC-006 | `ui_prototype/src/pages/measure/ShuyuanPage.tsx:26` | 数元总金额硬编码 | `totalAmount = 126840`。 | 项目总计量金额必须由后端计算。 | 从 latest metering DTO 显示。 |
| FC-007 | `ui_prototype/src/pages/measure/ShuyuanPage.tsx:40` | 数元指标硬编码 | 写死项目总计量金额、基准价、调用量、质量系数、版本。 | 页面指标必须来自后端字段。 | 从 shuyuan latest/detail DTO 显示。 |
| FC-008 | `ui_prototype/src/pages/measure/ShuyuanPage.tsx:99` | 数元金额前端计算 | `resource.sampleCount * 2` 推调用量，`resource.sampleCount * 2.5` 推金额。 | 调用量和计量金额不得由前端推导。 | 从 shuyuan detail rows 读取 `call_count` 和 `metering_amount`。 |
| FC-009 | `ui_prototype/src/pages/measure/ShuyuanPage.tsx:114` | 参与方计量金额前端生成 | `42000 - index * 8600` 生成参与方金额。 | 参与方汇总金额必须由后端返回。 | 从参与方级 metering summary DTO 读取。 |
| FC-010 | `ui_prototype/src/pages/measure/ShuyuanPage.tsx:165` | 调用量输入默认值推导 | 默认输入值使用 `resource.sampleCount * 2`。 | P0 可录入调用量，但不能由前端推导业务默认值。 | 默认空值或后端 draft `call_count`。 |
| FC-011 | `ui_prototype/src/pages/measure/UtilityPage.tsx:15` | 贡献/效用硬编码 | `contributionRows` 写死有效单元、贡献度、归一化贡献、效用值。 | 贡献度、归一化、效用值不得在前端定义。 | 从 contribution/utility DTO 读取。 |
| FC-012 | `ui_prototype/src/pages/measure/UtilityPage.tsx:37` | 贡献和效用指标硬编码 | 写死归一化贡献 `1.000000`、效用记录 `3`。 | 指标必须来自后端。 | 从 `/utilities/latest` 或 dashboard DTO 读取。 |
| FC-013 | `ui_prototype/src/pages/measure/UtilityPage.tsx:55` | 贡献因子硬编码 | 写死使用/覆盖/稀缺权重。 | 贡献因子属于后端参数/草稿。 | 从 `/metering/utility/contribution-factors` 或 parameter DTO 读取。 |
| FC-014 | `ui_prototype/src/pages/measure/UtilityPage.tsx:153` | 效用合计硬编码 | trace output 写死 `效用合计: 1.129978`。 | 效用结果/trace 不得前端伪造。 | 从 `/utilities/{id}/trace` 读取。 |
| FC-015 | `ui_prototype/src/pages/allocation/MDDShapPage.tsx:33` | 前置条件前端聚合 | 用 mock resources 计算 blocked resources。 | 前置条件应由后端 preconditions/disabled_actions 返回。 | 用 `/dashboard/preconditions` 或页面 DTO。 |
| FC-016 | `ui_prototype/src/pages/allocation/MDDShapPage.tsx:35` | 权重合计前端计算 | `mock.mdsWeights.reduce(...)` 计算权重合计。 | 权重归一化/合计校验不得在前端做。 | 后端返回 `weight_sum` 或 validation DTO；前端格式化。 |
| FC-017 | `ui_prototype/src/pages/allocation/MDDShapPage.tsx:90` | 权重合计容差判断 | `Math.abs(weightTotal - 1) < 0.000001` 决定成功/警告。 | 归一化校验不得在前端判断。 | 后端返回 `weight_validation_status`。 |
| FC-018 | `ui_prototype/src/pages/allocation/MDDShapPage.tsx:198` | 任务集合数量前端聚合 | `mock.resources.filter(...).length` 显示资源效用任务数。 | 算法任务集合应由后端 task/participant DTO 返回。 | 从 task DTO 读取 `task_set_count`。 |
| FC-019 | `ui_prototype/src/pages/allocation/MDDShapPage.tsx:412` | 边际贡献 trace mock | 用 `mock.mdsTraces` 显示 vBefore/vAfter/marginal。 | 边际贡献明细必须来自后端 trace。 | 接 `GET /md-dshap/tasks/{id}/marginal-traces`。 |
| FC-020 | `ui_prototype/src/pages/allocation/MDDShapPage.tsx:472` | 导出 metadata 硬编码 | `checksum: sha256:md-dshap-weights-demo`。 | report_id/checksum 必须由后端导出返回。 | 展示后端 report/export DTO。 |
| FC-021 | `ui_prototype/src/pages/allocation/MDDShapPage.tsx:507` | 审计说明 metadata 硬编码 | `task_id`, `checksum` 使用 demo 值。 | 审计导出 metadata 不得前端伪造。 | 用 `/reports/md-dshap-audit` 或 task audit-export 响应。 |
| FC-022 | `ui_prototype/src/pages/allocation/SimulationPage.tsx:17` | 分配结果硬编码 | `allocationRows` 写死约束前/后金额和权重。 | 分配金额和权重必须由后端返回。 | 从 allocation results DTO 读取。 |
| FC-023 | `ui_prototype/src/pages/allocation/SimulationPage.tsx:42` | 收益池前端计算 | fallback 用 `totalRevenue - priorityAmount` 计算数据源收益池。 | 收益池扣减规则不得在前端计算。 | 后端返回 `data_provider_revenue_pool`。 |
| FC-024 | `ui_prototype/src/pages/allocation/SimulationPage.tsx:205` | 约束差额前端计算 | `row.after - row.before` 展示约束前后差额。 | 约束调整金额必须由后端结果或 trace 返回。 | 后端返回 `constraint_adjustment_amount` 或 compare DTO。 |
| FC-025 | `ui_prototype/src/pages/allocation/SimulationPage.tsx:221` | trace 输出金额前端拼接 | `最终合计: formatAmount(totalRevenue)`。 | 约束轨迹输出应来自后端 trace。 | 从 constraint apply trace DTO 读取。 |
| FC-026 | `ui_prototype/src/pages/dashboard/OverviewPage.tsx:110` | 首页阻断资源前端聚合 | 用 resources filter 计算阻断项。 | 首页应只读取聚合状态，不重复计算业务结果。 | 从 `/dashboard` metrics/preconditions 读取。 |
| FC-027 | `ui_prototype/src/pages/dashboard/OverviewPage.tsx:111` | 权重池主体数前端聚合 | 用 mock dataProviders 计算 poolCount。 | 权重池指标应由后端聚合。 | 从 dashboard 或 participant-pool DTO 读取。 |
| FC-028 | `ui_prototype/src/pages/dashboard/OverviewPage.tsx:159` | 当前收益池 mock | 用 `mock.currentRevenuePool` 展示收益池。 | 收益池金额必须由后端分配/收益池 DTO 返回。 | 从 allocation summary DTO 读取。 |
| FC-029 | `ui_prototype/src/pages/data/DataResourcesPage.tsx:65` | 拆分比例合计前端校验 | `ratioTotal` 在前端求和并要求 100%。 | UI 可做输入提示，但保存校验必须以后端为准；不得作为业务约束最终结果。 | 保留为即时输入提示，保存结果以后端响应为准。 |
| FC-030 | `ui_prototype/src/pages/data/DataResourcesPage.tsx:66` | 阻断资源数前端聚合 | `resources.filter(isResourceBlocked).length`。 | 前置条件/阻断状态由后端返回。 | 使用 preconditions 或 resource summary DTO。 |
| FC-031 | `ui_prototype/src/pages/data/DataResourcesPage.tsx:67` | 涉敏字段数前端聚合 | `resources.reduce(...sensitiveFieldCount)`。 | 页面指标应来自后端聚合或 chart DTO。 | 后端返回 resource summary metrics。 |
| FC-032 | `ui_prototype/src/pages/data/DataResourcesPage.tsx:68` | 高缺失率计数前端聚合 | `missingRate >= 0.05` 由前端判断。 | 质量/风险口径不得前端定义阈值。 | 后端返回 missing risk flag/count。 |
| FC-033 | `ui_prototype/src/pages/data/DataPartiesPage.tsx:37` | fallback 主体列表 | 前端写死 fallback parties。 | 页面表格应来自后端，后端无数据时应空状态。 | 移除业务 fallback，显示空状态/下一步。 |
| FC-034 | `ui_prototype/src/pages/data/DataPartiesPage.tsx:90` | 主体指标前端聚合 | 用 parties filter 统计数据源/权重池/停用主体。 | 指标应来自后端聚合或 party summary DTO。 | 后端返回 party metrics。 |
| FC-035 | `ui_prototype/src/pages/data/DataPartiesPage.tsx:398` | 参与方贡献摘要 mock | 使用 `mock.mdsWeights` 展示贡献、效用、权重。 | 贡献/效用/权重摘要不得 mock。 | 接 participant contribution summary DTO。 |
| FC-036 | `ui_prototype/src/pages/data/DataPackagesPage.tsx:31` | 数据包 fallback | 写死演示数据包和上传候选包。 | 后端无 rows 时应空状态，不应伪造包。 | 移除 fallbackDataPackages。 |
| FC-037 | `ui_prototype/src/pages/data/DataPackagesPage.tsx:60` | 校验问题 fallback | 写死 participants 缺失、收益为负等失败详情。 | 校验结果必须来自后端 validation DTO。 | 无后端失败详情时显示“后端未返回详情”。 |
| FC-038 | `ui_prototype/src/pages/data/DataPackagesPage.tsx:81` | 指标 fallback | 写死数据包/校验/输入快照数量。 | 指标必须来自后端。 | 只用 pageData.metrics 或 dashboard DTO。 |
| FC-039 | `ui_prototype/src/pages/data/DataPackagesPage.tsx:141` | 上传状态误导 | 选择文件后提示“进入本地校验队列”，但 API 调用仍发送 demo payload。 | 上传入口与真实后端输入不一致。 | 解析用户 JSON 并提交后端；失败显示后端错误。 |
| FC-040 | `ui_prototype/src/domain/api/index.ts:18` | 上传 payload mock | `demoUploadPayload` 作为 `uploadJson` 默认值。 | 用户上传不应变成内置数据。 | 删除默认业务 payload；只允许显式演示数据按钮走 demo。 |
| FC-041 | `ui_prototype/src/domain/apiClient.ts:186` | 旧上传 payload mock | 旧 API client 保留 demoUploadPayload。 | 旧代码容易被误用伪造上传。 | Phase 1 删除或明确废弃旧 client。 |
| FC-042 | `ui_prototype/src/domain/services/backendWorkspace.ts:377` | 当前收益池前端聚合 | allocation results `reduce` post_constraint_amount 得出 `currentRevenuePool`。 | 收益池不是约束后金额求和的前端结果。 | 后端返回 allocation summary/revenue pool 字段。 |
| FC-043 | `ui_prototype/src/domain/services/backendWorkspace.ts:575` | 权重合计前端聚合 | `mdResults.reduce(normalized_weight)` 得出权重合计。 | 权重合计/归一化校验由后端负责。 | 后端返回 `weight_sum`/validation。 |
| FC-044 | `ui_prototype/src/domain/services/backendWorkspace.ts:623` | 数据源收益池前端聚合 | allocation results `reduce(post_constraint_amount)` 作为 total。 | 分配池金额必须由后端返回。 | 后端 DTO 增加 `total_revenue`, `priority_allocation_amount`, `data_provider_revenue_pool`。 |
| FC-045 | `ui_prototype/src/domain/services/backendWorkspace.ts:637` | total_revenue 前端填充 | 把前端 reduce 的 total 写入每行 `total_revenue`。 | 不得由前端回填业务字段。 | 逐行使用后端字段或页面 summary DTO。 |
| FC-046 | `ui_prototype/src/domain/services/backendWorkspace.ts:638` | 优先分配硬编码 | `priority_allocation_amount: "0.00"`。 | 合同优先金额必须来自后端。 | 从 allocation scenario DTO 读取。 |
| FC-047 | `ui_prototype/src/domain/services/backendWorkspace.ts:343` | utilityValue 错置 | MD-DShap weight model 中 `utilityValue` 用 `normalized_weight` 填充。 | 效用值不能用权重代替。 | 若后端无 utility_value，则字段为空或不展示。 |
| FC-048 | `ui_prototype/src/domain/services/backendWorkspace.ts:349` | 边际 trace 伪造 | 用 weight result 生成 coalition/vBefore/vAfter。 | 边际贡献 trace 必须来自后端。 | 接 marginal traces endpoint。 |
| FC-049 | `ui_prototype/src/pages/reports/ReportsPage.tsx:148` | 导出记录 mock | `mock.exports` 展示导出文件。 | 导出文件、checksum、生成时间必须来自后端。 | 从 report/export DTO 读取。 |
| FC-050 | `ui_prototype/src/pages/reports/ReportsPage.tsx:214` | 导出详情 fallback | fallback 文件名 `resource_summary.csv`、状态“已生成”。 | 不得伪造导出成功。 | 无后端记录时显示空状态。 |
| FC-051 | `ui_prototype/src/pages/system/AuditPage.tsx:20` | 审计列表 mock | 用 `mock.auditLogs` 和 `mock.snapshots`。 | 审计日志和快照详情必须来自后端。 | 从 `/system/audit/logs` 和 detail DTO 读取。 |
| FC-052 | `ui_prototype/src/pages/system/AuditPage.tsx:147` | 审计 trace 硬编码 | traceRows 写死输入/参数/输出快照已生成。 | 快照详情不得伪造。 | 用 audit detail `snapshot_refs`。 |
| FC-053 | `ui_prototype/src/domain/mockData.ts` | 全局业务 mock | 包含质量、数元、贡献、权重、分配、报告和审计示例结果。 | 可作启动占位，但不能作为业务成功来源。 | Phase 1 后仅保留空状态/演示数据初始化前说明。 |

## 可保留但需约束的前端逻辑

| 文件位置 | 当前行为 | 处理 |
| --- | --- | --- |
| `ui_prototype/src/pages/backendPageData.ts` | 金额、权重和空值展示格式化 | 可保留，仅用于展示后端字段，不计算业务结果。 |
| `ui_prototype/src/domain/permissions.ts` | P1/锁定状态禁用逻辑 | 可保留，并叠加后端 `disabled_actions`。 |
| `ui_prototype/src/domain/status.ts` | 状态标签映射 | 可保留。 |
| `ui_prototype/src/domain/api/dtoMappers.ts` | snake/camel、枚举标签、空值占位、时间格式 | 可保留；禁止在 mapper 中制造业务值。 |
| `DataResourcesPage` filter/search | 表格筛选和输入提示 | 可保留；不能把筛选结果当业务指标或前置条件。 |

## 后端 DTO 补齐建议

这些不是 Phase 0 实现项，仅作为移除前端自算的后端契约输入。

| DTO | 字段建议 |
| --- | --- |
| `dashboard_summary` | `resource_blocked_count`, `md_dshap_pool_count`, `current_revenue_pool`, `latest_report`, `risk_notices`, `flow_steps`。 |
| `quality_assessment_view` | `quality_score`, `quality_level`, `quality_factor`, `weight_validation_status`, `dimension_scores[]`, `chart_dto`。 |
| `shuyuan_metering_view` | `total_amount`, `base_price`, `call_count_total`, `coefficients[]`, `resource_rows[]`, `party_rows[]`, `chart_dto`。 |
| `utility_view` | `contribution_rows[]`, `utility_rows[]`, `normalized_total`, `trace_rows[]`, `chart_dto`。 |
| `md_dshap_view` | `participant_count`, `task_count`, `weight_sum`, `weight_validation_status`, `weights[]`, `marginal_traces[]`, `audit_export_metadata`。 |
| `allocation_summary_view` | `total_revenue`, `priority_allocation_amount`, `data_provider_revenue_pool`, `rows[]`, `adjustment_rows[]`, `flow_chart_dto`。 |
| `report_export_view` | `report_id`, `file_name`, `file_format`, `checksum`, `created_at`, `field_scope`, `simulation_disclaimer`。 |
| `audit_detail_view` | `log`, `snapshot_refs`, `snapshots`, `failure_reason`, `repair_suggestion`。 |

## Phase 1 移除顺序

1. 先接后端 DTO：质量、数元、效用、MD-DShap、分配、报告、审计。
2. 再移除页面 hardcoded arrays 和 fallback rows。
3. 移除 `backendWorkspace.ts` 中的业务 reduce 回填，改为读取后端 summary fields。
4. 禁用后端无契约按钮：`DATA-009`, `RES-007`, `MDS-017`, `ALLOC-014`, `REP-009`。
5. 最后接图表；无 chart DTO 时只展示后端表格和空状态。
