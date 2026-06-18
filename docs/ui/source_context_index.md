# DVAS UI Source Context Index

## Source Documents

| 文档 | 作用 | 读取状态 |
| --- | --- | --- |
| 数据收益分配系统_V1.3_需求规格说明书_导航结构更新版.md | P0/P1 边界、业务规则、按钮验收、MD-DShap 默认策略、导出字段清单 | 904 行，已完整读取 |
| 数据收益分配系统_系统详细功能设计_V1.1_导航结构更新版.md | 页面内容、按钮状态、弹窗、Trace、错误提示、服务和快照要求 | 1208 行，已完整读取 |
| 数据收益分配系统_数据库设计与ER关系图_V1.0_导航结构更新版.md | nav_menu、permission、menu_code、module_code、route_path、表字段与导出映射 | 878 行，已完整读取 |

## Product Boundary

- 系统名称：数据收益分配系统 V1.2。
- 默认项目：肺癌早筛数据收益分配示例项目。
- 操作员：local_operator。
- 全局声明：系统结果仅为模拟参考，非法律结算；不构成法律结算、财务付款、合同履约或主管单位审批结果。
- P0：本地操作员、演示数据/JSON 上传、质量评估、数元计量、贡献度与效用计算、MD-DShap、收益分配模拟、合同约束、Markdown/CSV/JSON/JSONL 导出、审计日志。
- P1：登录、RBAC、PDF 导出、CSV/XLSX 批量导入、异步任务、历史报告管理；P1 功能在原型中只显示规划态，不伪装为 P0 已上线。

## Navigation And Database Mapping

数据库设计文档的 nav_menu / permission / module_code / route_path 作为本轮路由基础来源；本次 UI 修正明确系统首页为单一一级入口，项目总览、流程入口、风险提示和一键计算作为同页区块，不再作为左侧二级页面。

| 一级导航 | 页面/二级页面 | route_path | menu_code | module_code | 阶段 | 数据库主对象 |
| --- | --- | --- | --- | --- | --- | --- |
| 系统首页 | 系统首页 | /dashboard | NAV_SYS_HOME | SYS | P0 | allocation_project, audit_log, report_record |
| 数据管理 | 数据接入管理 | /data/ingestion | NAV_DATA_PACKAGE | DATA | P0 | data_package, input_snapshot, upload_validation_result |
| 数据管理 | 数据资源管理 | /data/resources | NAV_DATA_RESOURCE | RES | P0 | data_resource, data_resource_field, data_resource_party_relation |
| 数据管理 | 参与方管理 | /data/parties | NAV_DATA_PARTY | PARTY | P0 | party, data_resource_party_relation |
| 数元贡献度计量 | 质量评估管理 | /metering/quality | NAV_MEASURE_QUALITY | QUAL | P0 | quality_assessment, quality_score_detail, parameter_version |
| 数元贡献度计量 | 数元计量管理 | /metering/shuyuan | NAV_MEASURE_SHUYUAN | DU | P0 | shuyuan_metering, shuyuan_metering_detail |
| 数元贡献度计量 | 贡献度与效用计算 | /metering/utility | NAV_MEASURE_UTILITY | UTIL | P0 | contribution_record, utility_function_snapshot, utility_record, utility_trace |
| 收益分配计算 | MD-DShap 计算管理 | /allocation/md-dshap | NAV_ALLOC_MDS | MDS | P0 | md_dshap_task, md_dshap_result, md_dshap_marginal_trace, algorithm_audit_snapshot |
| 收益分配计算 | 收益分配模拟 | /allocation/simulation | NAV_ALLOC_SIMULATION | ALLOC | P0 | allocation_scenario, allocation_priority_item, allocation_result |
| 收益分配计算 | 合同约束管理 | /allocation/constraints | NAV_ALLOC_CONSTRAINT | CONS | P0 | contract_constraint, constraint_apply_trace |
| 报告生成与导出 | 报告生成与导出 | /reports | NAV_REPORT_EXPORT | REP | P0/P1 | report_record, export_file, snapshot_store |
| 系统管理 | 参数配置 | /system/parameters | NAV_SYSTEM_PARAMETER | PARAM | P0 | system_parameter, parameter_version |
| 系统管理 | 用户与权限管理（P1） | /system/users | NAV_SYSTEM_USER | USER | P1 | user_account, role, permission, user_role, role_permission |
| 系统管理 | 审计日志管理 | /system/audit | NAV_SYSTEM_AUDIT | AUD | P0 | audit_log, snapshot_store, report_record |

## Page Structure

每个页面统一包含：页面标题、面包屑、当前项目、当前状态、local_operator、风险提示入口、模拟参考声明、状态进度条、前置条件卡、页面核心区块、按钮区和审计/快照摘要。

## Button Structure

按钮从系统详细功能设计附录 A 抽取，并补齐功能编号、前置条件、输入字段、loading/success/error/disabled、业务副作用、审计日志、截图路径和验收标准。完整矩阵见 `button_interaction_matrix.md`。

## State Machine

1. 草稿
2. 已接入
3. 已评估
4. 已计量
5. 已计算效用
6. 已计算权重
7. 已分配
8. 已确认
9. 已导出

## Database Mapping Rules

- 所有业务页面必须显示 `menu_code` 与 `module_code`。
- 计算类操作必须显示输入快照、参数快照、输出快照、算法版本和失败原因。
- 导出类操作必须显示 `report_id`、文件名、字段范围和 `checksum`。
- 审计日志必须保留 `menu_code`、`module_code`、operator、status、failure_reason 和快照引用。

## Document Conflict Records

| 冲突或差异 | 处理原则 | 本轮处理 |
| --- | --- | --- |
| 历史路由如 /dashboard、/quality、/allocation 与新版二级路由并存 | 数据库设计文档优先 nav_menu/route_path | 原型只使用新版 route_path；历史路由仅作为兼容别名说明 |
| 系统首页内部项目总览、流程入口、风险提示、一键计算是否作为二级页面 | 本次 UI 修正优先：系统首页只保留一级入口 | 四项合并为系统首页同页区块；删除左侧二级页面和独立截图路由 |
| PDF、登录、RBAC、异步任务在需求中出现 | 需求规格说明书优先 P0/P1 边界 | P1 页面和按钮显示规划态，不执行 P0 功能 |
| MD-DShap 与基础 Shapley 同时出现 | 需求规格说明书优先算法边界 | MD_DSHAP 为默认；基础 Shapley 仅以 baseline_check 展示 |
| 详细功能设计强调弹窗、Trace、错误提示 | 系统详细功能设计优先交互 | 计算、高风险、导出按钮均生成对应演示截图 |
