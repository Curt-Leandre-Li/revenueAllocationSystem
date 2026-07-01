# 页面 API 映射矩阵

更新时间：2026-06-23
用途：作为 Phase 1 前端重建的接口契约输入。页面指标、表格、详情、trace、图表均必须来自后端字段或后端 DTO；前端只做格式化、状态标签映射和空值占位。

## 总体状态

| 项 | 当前状态 | Phase 1 要求 |
| --- | --- | --- |
| 主路由 | `ui_prototype` 使用 `/measure/*` | 改为 `/metering/*`，旧 `/measure/*` 仅做兼容 alias。 |
| 菜单 | 本地菜单 `/measure/*`，后端菜单 `/metering/*` | 以后端 `/navigation/menus` 或统一本地常量为准。 |
| 状态条 | `StatusStepper` 已覆盖草稿到已导出 | 保持，按钮禁用使用后端 disabled_actions + 本地只读规则。 |
| API 来源 | 混合 `domain/api/*`、旧 `apiClient.ts`、mockData | 收敛到一个 API client + DTO mapper。 |
| 图表 | 无真实 chart DTO | 图表只消费后端 chart DTO 或已有后端结果字段。 |
| mock | 默认 mock 工作区 + 后端 fallback | 写操作不得 mock 成功；业务结果展示要逐页移除 mock。 |

## 页面映射

| 页面 | 当前路由 | 目标路由 | 后端接口 | 后端字段/DTO | 按钮 | 状态守卫 | 图表/可视化数据源 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 系统首页 | `/dashboard` | `/dashboard` | `GET /dashboard`, `GET /dashboard/preconditions`, `POST /demo-cases/{id}/select`, `POST /projects/{project_id}/pipeline/run`, `GET /reports`, `GET /audit-logs` | `project_id`, `project_name`, `scenario_name`, `project_status`, `operator_id`, `metrics`, `risk_notices`, `next_step`, `preconditions`, `available_actions`, `disabled_actions`, `report_id`, `checksum`, `created_at` | `SYS-002`, `DATA-003`, `SYS-004`, `SYS-005`, `REP-001` | 后端 preconditions；`CONFIRMED/EXPORTED` 禁止写操作；一键计算必须二次确认 | 流程进度、项目状态卡、最近报告卡、风险卡来自 dashboard/report/audit DTO；不在前端聚合收益池。 |
| 数据接入管理 | `/data/ingestion` | `/data/ingestion` | `POST /demo-cases/{id}/select`, `POST /data/packages/upload`, `GET /data/packages`, `GET /data/packages/{id}/preview`, `GET /data-packages/{id}/validation-result` | `package_id`, `package_name`, `source_type`, `file_name`, `status`, `file_size`, `validation_result_id`, `input_snapshot_id`, `checksum`, `field_errors`, `repair_suggestion` | `DATA-002`, `DATA-003`, `DATA-007`, `DATA-008`, `DATA-009` | 上传仅支持 P0 JSON；无停用接口时禁用 `DATA-009`；写操作二次确认按 registry | 数据包状态分布、校验结果、字段/模态摘要必须来自 data package/validation DTO。 |
| 数据资源管理 | `/data/resources` | `/data/resources` | `GET /data/resources`, `GET /data-resources/{id}`, `PUT /data-resources/{id}/party-relations` | `resource_id`, `package_id`, `resource_name`, `modality`, `field_count`, `sample_count`, `missing_rate`, `sensitive_field_count`, `include_in_calculation`, `party_id`, `provider_party_name`, `party_relations`, `status` | `RES-002`, `RES-005`, `RES-007` | 资源主体关系缺失时阻断后续评估；无 `include_in_calculation` 保存契约时禁用开关；无资源导出端点时禁用 `RES-007` | 资源模态分布、缺失率条形图、主体关系图来自 resource DTO 或 chart DTO。 |
| 参与方管理 | `/data/parties` | `/data/parties` | `GET /data/parties`, `POST /data/parties`, `PATCH /data/parties/{id}`, `PATCH /data/parties/{id}/status`, `PUT /data-resources/{id}/party-relations`, `GET /allocation/md-dshap/participant-pool` | `party_id`, `party_name`, `party_type`, `include_in_md_dshap`, `status`, `description`, `linked_resource_count`, `contribution_score`, `utility_value`, `quality_factor` | `PARTY-002`, `PARTY-003`, `PARTY-005`, `PARTY-006`, `PARTY-008` | 非数据主体默认不进入 MD-DShap；最后一个数据源主体不可停用由后端守卫；无 party-centric 关联接口时跳转资源页 | 主体类型分布、MD-DShap 标记、贡献摘要来自 party/participant-pool/utility DTO。 |
| 质量评估管理 | `/measure/quality` | `/metering/quality` | `GET /metering/quality/weights`, `PUT /metering/quality/weights`, `POST /metering/quality/evaluate`, `GET /quality-assessments/latest`, `GET /quality-assessments/{id}/details`, `GET /metering/quality/resource-results`, `GET /metering/quality/resource-results/{resource_id}` | `assessment_id`, `quality_score`, `quality_level`, `quality_factor`, `package_score`, `package_level`, `assessed_resource_count`, `average_resource_score`, `low_score_resource_count`, `dimension_scores`, `resources[].total_score`, `resources[].dimension_scores`, `details[].weight`, `details[].score`, `details[].evidence_text`, `heatmap`, `version_no`, snapshot ids | `QUAL-002`, `QUAL-003`, `QUAL-006`, `QUAL-009`, `QUAL-011` | 需有效数据包和资源主体关系；重评生成新版本；权重保存必须后端校验合计；默认指标为 7 个一级指标和 17 个二级指标；资源级结果由后端规则生成，前端只展示。 | 质量总分卡、资源评分总览、资源 × 一级指标热力图、7 个一级指标和 17 个二级指标明细来自 assessment/detail/resource-results DTO。 |
| 数元计量管理 | `/measure/shuyuan` | `/metering/shuyuan` | `PUT /metering/shuyuan/parameters`, `PUT /metering/shuyuan/call-counts`, `POST /metering/shuyuan/calculate`, `GET /shuyuan-meterings/latest`, `GET /shuyuan-meterings/{id}/details` | `metering_id`, `base_shuyuan_price`, `call_count`, coefficients, `metering_amount`, `total_amount`, `resource_id`, `party_id`, snapshot ids, `version_no` | `DU-002`, `DU-003`, `DU-009`, `DU-010`, report CSV export via `REP-004` | 需质量评估完成；调用量可为 0；金额由后端计算；参数保存走后端草稿/参数版本 | 资源级/参与方级金额柱状图、调用量排行来自 shuyuan detail/chart DTO。 |
| 贡献度与效用计算 | `/measure/utility` | `/metering/utility` | `PUT /metering/utility/contribution-factors`, `POST /metering/utility/contribution/calculate`, `PUT /metering/utility/function`, `POST /metering/utility/calculate`, `GET /utilities/latest`, `GET /utilities/{id}/trace` | `contribution_score`, `normalized_contribution`, `utility_value`, `quality_factor`, `scenario_utility`, `trace`, `utility_id`, snapshot ids | `UTIL-001`, `UTIL-006`, `UTIL-007`, `UTIL-008`, `UTIL-009` | 需数元计量完成；总贡献为 0 时由后端返回错误；效用函数来源必须披露 | 贡献排行、效用排行、trace 摘要来自 contribution/utility/trace DTO。 |
| MD-DShap 计算管理 | `/allocation/md-dshap` | `/allocation/md-dshap` | `GET /allocation/md-dshap/config`, `PUT /allocation/md-dshap/config`, `GET /allocation/md-dshap/participant-pool`, `POST /allocation/md-dshap/tasks`, `GET /allocation/md-dshap/tasks/{id}`, `GET /allocation/md-dshap/tasks/{id}/results`, `GET /md-dshap/tasks/{id}/marginal-traces`, `POST /allocation/md-dshap/tasks/{id}/audit-export` | `task_id`, `algorithm_mode`, `seed`, `sample_rounds`, `epsilon`, `status`, `party_name`, `participant_weight`, `normalized_weight`, `weight_diff`, marginal trace rows, snapshot ids, `algorithm_version` | `PARAM-004`, `MDS-011`, `MDS-012`, `MDS-013`, `MDS-014`, `MDS-015`, `MDS-016`, `MDS-017`, `MDS-018` | 需效用计算完成；单数据源主体走简化披露；权重合计校验由后端返回字段；导出需 checksum/report_id | 参与方权重图、边际贡献热力表、复杂度说明来自 result/marginal_trace/audit DTO；无纯权重导出时禁用 `MDS-017`。 |
| 合同分配规则 | `/allocation/constraints` | `/allocation/constraints` | `GET /projects/{project_id}/allocation/contract-ratio`, `PUT /projects/{project_id}/allocation/contract-ratio`, `DELETE /projects/{project_id}/allocation/contract-ratio`, `GET /projects/{project_id}/allocation/summary` | `plan_id`, `total_revenue`, `currency`, `data_provider_pool_ratio`, `data_provider_revenue_pool`, `items[].party_id`, `items[].bucket_type`, `items[].ratio`, `items[].calculated_amount`, `ratio_sum`, `can_simulate` | `CONS-002`, `CONS-003`, `CONS-004`, `CONS-011` | 比例合计必须为 1.000000；非数据主体项不得引用数据源主体；后端计算金额；不得生成默认方案 | 合同比例页展示总收益、数据源池比例、非数据主体比例项、后端金额和可模拟状态。 |
| 收益分配模拟 | `/allocation/simulation` | `/allocation/simulation` | `POST /projects/{project_id}/allocation/simulate`, `GET /allocation-scenarios/{id}/results`, `POST /allocation-scenarios/{id}/lock`, report export routes | `allocation_id`, `summary.total_revenue`, `summary.non_data_contract_amount`, `summary.data_provider_revenue_pool`, `contract_ratio_plan`, `contract_ratio_items[]`, `data_provider_allocations[]`, `party_name`, `raw_weight`, `normalized_weight`, `amount_source`, `contract_ratio`, `base_pool_amount`, `final_amount`, `report_id`, `checksum` | `ALLOC-011`, `ALLOC-013`, `ALLOC-015`, `ALLOC-016` | 需保存合同比例方案且 MD-DShap 权重完成；未保存方案返回 `DVAS_CONTRACT_RATIO_REQUIRED`；已确认/已导出只读；无 copy 接口时不显示 `ALLOC-014` | 收益流向必须展示“总收益 -> 合同比例方案 -> 数据源主体收益池 -> MD-DShap 权重分配”，金额和来源必须来自后端 DTO。 |
| 报告生成与导出 | `/reports` | `/reports` | `GET /reports`, `GET /reports/preview`, `POST /reports/markdown`, `POST /reports/csv`, `POST /reports/json`, `POST /reports/audit-log`, `POST /reports/md-dshap-audit` | `report_id`, `report_type`, `file_name`, `file_format`, `checksum`, `created_at`, `export_file_ids`, `simulation_disclaimer`, `field_scope` | `REP-001`, `REP-002`, `REP-003`, `REP-004`, `REP-005`, `REP-006`, `REP-009` | PDF `REP-003` 为 local P1；报告导出需已完成收益分配；确认书无后端专用接口时禁用 `REP-009` | 导出文件清单、report_id、checksum、生成时间来自 report/export DTO。 |
| 参数配置 | `/system/parameters` | `/system/parameters` | `GET /system/parameters`, `GET /system/parameters/{code}`, `PUT /system/parameters/{code}`, `POST /system/parameters/{code}/restore-default`, plus grouped endpoints `/metering/*/weights`, `/allocation/md-dshap/config` | `parameter_code`, `parameter_name`, `parameter_type`, `current_value`, `default_value`, `scope`, `editable`, `version_no`, `updated_at` | `PARAM-001`, `PARAM-002`, `PARAM-004`, `PARAM-008` | 不可编辑参数禁用保存；算法模式默认 MD_DSHAP；参数只影响新计算 | 参数版本卡和变更表来自 system parameter DTO。 |
| 用户与权限管理（P1） | `/system/users` | `/system/users` | `/auth/*`, `/system/users*`, `/users*`, `/system/roles*`, `/system/permissions` | `user_id`, `username`, `display_name`, `status`, `roles[]`, `permissions[]`, current user/session state | `USER-001`, `USER-002`, `USER-003`, `USER-004`, `USER-005`, `USER-007`, `USER-008`, `USER-009`, `USER-010`, `USER-011` | Local P1 only；不作为 P0 或生产级 RBAC；权限不足显示后端错误 | 用户表、角色权限矩阵和当前用户状态来自本地 P1 后端。 |
| 审计日志管理 | `/system/audit` | `/system/audit` | `GET /system/audit/logs`, `GET /system/audit/logs/{id}`, `GET /audit-logs`, `GET /audit-logs/{id}`, `POST /reports/audit-log` | `log_id`, `module_code`, `menu_code`, `operation_type`, `object_type`, `object_id`, `operator_id`, `status`, `failure_reason`, snapshot refs, `created_at`, `checksum` | `AUD-002`, `AUD-006`, `AUD-007` | 查询只读；导出需保留模拟参考边界和 checksum | 操作时间线、模块筛选、快照详情来自 audit log/detail DTO。 |

## 按钮接入状态

| 按钮 | 后端契约 | 当前前端接入 | Phase 1 处理 |
| --- | --- | --- | --- |
| `SYS-002` | 已有 demo select/init | 已接 | 保持。 |
| `SYS-004` | 已有 pipeline run | 已接 | 保持后端前置检查。 |
| `DATA-002` | 已有 demo select/init | 已接 | 保持。 |
| `DATA-003` | 已有 JSON upload | 已接但默认 demo payload | 改为读取用户文件 JSON 后提交。 |
| `DATA-007/008` | 已有 detail/validation | 刷新 workspace，页面本地抽屉 | 详情抽屉改用真实 package/validation DTO。 |
| `DATA-009` | 缺少数据包停用端点 | 未接 | 禁用/隐藏或补后端。 |
| `RES-002` | 已有 resource detail | 当前刷新列表 | 详情改为读取 detail DTO。 |
| `RES-005` | 已有 party-relations | 绑定部分接入；计算开关未接 | 拆成绑定接口和计算纳入接口；无后端则禁用。 |
| `RES-007` | 缺少资源摘要导出端点 | 未接且 UI 假显示已生成 | 移除假导出，等后端契约。 |
| `PARTY-002/003/005` | 已有 | 已接 | 保持后端枚举/唯一性错误映射。 |
| `PARTY-006` | 仅资源中心绑定接口 | 未接 | 改跳转资源页或补后端 DTO。 |
| `PARTY-008` | 无独立摘要；可由 participant/utility/result DTO 组合 | 刷新 workspace + mock 摘要 | 增加后端摘要 DTO 或只显示已有后端字段。 |
| `QUAL-002` | 已有 `/metering/quality/weights` | 当前服务未处理 | 接入专用端点，禁止前端合计校验替代后端。 |
| `QUAL-003/009` | 已有 evaluate/run | 已接 | 保持。 |
| `QUAL-006` | 已有 details | 当前仅刷新 workspace | 详情改用 detail DTO。 |
| `DU-002/003` | 已有 shuyuan parameters/call-counts | 当前服务未处理 | 接入后端保存草稿/参数版本。 |
| `DU-009` | 已有 calculate | 已接 | 保持。 |
| `DU-010` | 已有 details | 当前仅刷新 workspace | 详情改用 detail DTO。 |
| `UTIL-001/007` | 已有 contribution-factors/function | 当前服务未处理 | 接入后端保存接口。 |
| `UTIL-006/008` | 已有 calculate | 已接 | 保持。 |
| `UTIL-009` | 已有 utility trace | 当前仅刷新 workspace | trace drawer 改用后端 trace DTO。 |
| `MDS-011/016` | 已有 tasks | 已接 | 保持。 |
| `MDS-012/013/014/015` | 已有 task/results/marginal trace/config | 当前刷新 + mock trace | 接入对应详情 DTO。 |
| `MDS-017` | 缺少纯算法结果导出 | 未接 | 禁用或映射到已存在审计导出。 |
| `MDS-018` | 已有 audit export | 已接 | 展示真实 report_id/checksum。 |
| `ALLOC-003/005/007` | 历史收益/优先级/模式草稿接口 | 非当前合同比例主流程 | 当前项目级模拟以保存的合同比例方案为准；旧草稿接口只按兼容能力处理。 |
| `ALLOC-011/015/016` | 已有 run/lock/export | 已接 | 保持。 |
| `ALLOC-013` | 结果读取存在 | 当前刷新 + 页面自算差额 | 改用后端 compare/trace DTO。 |
| `ALLOC-014` | 缺少 copy scenario | 元数据存在，页面未显式显示 | 暂不显示。 |
| `CONS-002/003/004/011` | 已有 | 已接或刷新 | 保持，trace 改后端。 |
| `REP-001/002/004/005/006` | 已有 | 已接 | 展示真实 report/export metadata。 |
| `REP-003` | local P1 | 已有后端 PDF 接口 | 标注 P1；不可作为 P0 必选验收或生产文档服务。 |
| `REP-009` | 缺少确认书专用接口 | 未接但按钮可见 | 禁用/隐藏或补后端。 |
| `USER-*` | local P1 | 已有后端 auth/user/RBAC 接口 | 标注 P1；权限不足展示后端错误，不伪装为生产级 RBAC。 |
| `AUD-002/006/007` | 已有 audit logs/detail/export | 查询/导出部分接入 | 详情改用 `/audit-logs/{id}`。 |

## 字段映射注意事项

- 金额字段：`total_revenue`, `non_data_contract_amount`, `data_provider_revenue_pool`, `base_pool_amount`, `contract_ratio`, `final_amount`, `metering_amount` 只能来自后端。
- 权重字段：`normalized_weight`, `participant_weight`, `weight_diff` 只能来自后端，前端只做 6 位小数格式化。
- 质量字段：`quality_score`, `quality_level`, `quality_factor`, `package_score`, `package_level`, `average_resource_score`, `low_score_resource_count`, `dimension_scores`, `resources[].dimension_scores`, `quality_score_detail`, detail score/weight/evidence_text 只能来自后端；`dimension_scores` 对应 7 个一级指标，二级明细对应 17 个标准二级指标。热力图颜色可做视觉映射，但 tooltip 和数值必须展示后端真实 score。
- 数元字段：`base_shuyuan_price`, `call_count`, coefficients, `metering_amount`, `total_amount` 只能来自后端。
- 效用字段：`contribution_score`, `normalized_contribution`, `utility_value`, trace rows 只能来自后端。
- 审计字段：`report_id`, `checksum`, `created_at`, snapshot refs, `log_id` 必须来自后端，不得用 demo 字符串。

## Phase 1 前置 DTO 缺口

| 缺口 | 需要后端或契约补齐 |
| --- | --- |
| 首页图表 DTO | dashboard 聚合状态、流程进度、最近报告、风险提示、一键计算管线。 |
| 资源图表 DTO | 模态分布、缺失率、资源-主体关系图，不由前端聚合。 |
| 参与方摘要 DTO | 主体类型分布、MD-DShap 标记、贡献/效用/权重摘要。 |
| 质量图表 DTO | 维度得分图、二级指标得分表。 |
| 数元图表 DTO | 资源级/参与方级金额、调用量排行。 |
| 效用 trace DTO | 贡献、归一化、质量因子、效用值轨迹。 |
| MD-DShap trace DTO | 任务进度、权重合计、边际贡献明细、复杂度说明、算法审计 metadata。 |
| 分配 flow/compare DTO | 总收益 -> 合同比例方案 -> 数据源主体收益池 -> 数据源主体分配流向，金额来源和尾差处理。 |
| 报告/导出 metadata DTO | `report_id`, `checksum`, `created_at`, export files。 |
| 审计 snapshot detail DTO | 通过 `audit_log` detail 返回快照摘要和可展示字段。 |
