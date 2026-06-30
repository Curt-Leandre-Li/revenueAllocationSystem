**数据收益分配系统 V1.2**

**数据库设计与 ER 关系图（导航结构更新版）**

输出用途：数据库设计、后端开发、UI 菜单权限、测试验收、算法审计说明

系统结果仅为模拟参考，非法律结算。

| **项目**     | **内容**                                                                                                             |
|--------------|----------------------------------------------------------------------------------------------------------------------|
| 文档名称     | 《数据收益分配系统 V1.2 数据库设计与 ER 关系图》                                                                     |
| 系统名称     | 数据收益分配系统（DVAS，Data Value Allocation System）                                                               |
| 文档版本     | V1.0-导航结构更新版                                                                                                  |
| 编写日期     | 2026 年 6 月 17 日                                                                                                   |
| 设计依据     | 《数据收益分配系统 V1.2 需求规格说明书》《系统详细功能设计 V1.0》及更新后的左侧导航结构                              |
| 适用范围     | P0 本地演示系统与 P1 权限/PDF/异步任务扩展的数据库设计输入                                                           |
| 本次更新重点 | 更新左侧导航结构、菜单权限、模块映射、路由路径、ER 图分组和 DDL 种子数据；业务表、算法表、审计快照策略保持不变。 |

| **版本**            | **日期**   | **修改内容**                                                                                         | **状态**   |
|---------------------|------------|------------------------------------------------------------------------------------------------------|------------|
| V1.0                | 2026-06-17 | 基于 V1.2 需求规格说明书和系统详细功能设计生成数据库设计、ER 图、DDL、导出字段映射。                 | 已生成     |
| V1.0-导航结构更新版 | 2026-06-17 | 按更新后的左侧导航结构重组菜单、路由、权限、模块映射和 ER 图分组；保持无关业务表与算法存储模型一致。 | 已提交 |
| V1.1-资源质量评估版 | 2026-06-25 | 新增后端逐资源质量评估表、关系、索引、按钮副作用和导出字段映射。 | 本次提交稿 |
| V1.2-代码同步版 | 2026-06-28 | 按当前 `db/` DDL、`JsonFileRepository` 运行时 state、`persistence_mapping.py` 和合同比例主流程重新标注已落表、JSON 运行时对象、PostgreSQL 预留与枚举映射。 | 代码同步稿 |

## 0. 当前代码同步基线（2026-06-28）

本节是本轮数据库设计同步的最高优先级说明。若后续表格仍出现候选表或早期字段，与本节冲突时，以本节为当前实现口径。

### 0.1 当前存储模型

| 层级 | 当前事实 | 文档口径 |
|------|----------|----------|
| P0 runtime | 后端默认使用 `JsonFileRepository`，写入 `backend/runtime/dvas_state.json`。 | 当前业务写入以 JSON state 为准。 |
| PostgreSQL 验收 schema | `db/dvas_p0_01_schema.sql` 创建 38 张表；`db/dvas_p0_02_seed.sql` 初始化菜单、权限、参数和质量模板；`db/dvas_p0_03_demo_data.sql` 写演示数据。 | 作为验收/参考 DDL，不等同于当前默认写入运行时。 |
| Postgres read model | `PostgresReadService` 只提供健康检查、项目、状态、审计、报告等只读查询。 | 不承担 P0 主写路径。 |
| 枚举映射 | `persistence_mapping.py` 将 runtime 枚举映射到 SQL 枚举。 | 文档必须列出映射，不得把 runtime 与 SQL 字段混写成同一值域。 |

### 0.2 当前 PostgreSQL DDL 已有表

`db/dvas_p0_01_schema.sql` 当前只有以下 38 张表：

```text
nav_menu, permission, user_account, role, user_role, role_permission,
allocation_project, snapshot_store, input_snapshot, data_package,
upload_validation_result, data_resource, data_resource_field, party,
data_resource_party_relation, quality_metric_template, quality_assessment,
quality_score_detail, shuyuan_metering, shuyuan_metering_detail,
contribution_record, utility_function_snapshot, utility_record, utility_trace,
md_dshap_task, md_dshap_result, md_dshap_marginal_trace,
algorithm_audit_snapshot, allocation_scenario, allocation_priority_item,
contract_constraint, allocation_result, constraint_apply_trace,
report_record, export_file, audit_log, system_parameter, parameter_version
```

以下对象当前存在于 JSON runtime state，但没有出现在 `db/dvas_p0_01_schema.sql` 中，不能写成已落 PostgreSQL 表：`contract_ratio_plans`、`contract_ratio_items`、`quality_resource_assessments`、`quality_resource_score_details`、`report_manifests`、`sessions`、`async_jobs`、`business_drafts`。

### 0.3 运行时与 SQL 关键映射

| 领域 | runtime 当前值 | PostgreSQL DDL/验收值 | 说明 |
|------|----------------|------------------------|------|
| 报告格式 | `MARKDOWN` | `MD` | `ReportFormat.MARKDOWN` 通过 `persistence_mapping.py` 映射到 SQL `MD`。 |
| 分配模式 | `MD_DSHAP_WEIGHT_WITH_CONSTRAINTS` | `MD_DSHAP_WEIGHT` | 项目级合同比例路径仍以 MD-DShap 权重分配数据源收益池；SQL 值是兼容缩写。 |
| 合同约束类型 | `PRIORITY_ALLOCATION` | `PRIORITY_AMOUNT` | 旧约束兼容接口映射到 SQL 值；当前合同比例主流程不依赖该表。 |
| 快照类型 | `ALGORITHM_AUDIT` | `ALGORITHM` | runtime 能写算法审计快照；SQL `snapshot_store` 当前没有 `ALGORITHM_AUDIT` 枚举，映射到 `ALGORITHM`，独立 `algorithm_audit_snapshot` 表保留算法审计明细。 |
| 数据包状态 | `VALIDATED` | `VALID` | 运行时上传成功状态映射为 SQL 验收状态。 |
| MD-DShap 任务状态 | `COMPLETED` | `SUCCESS` | 运行时任务完成映射为 SQL 成功状态。 |
| 导出文件主键 | `export_file_id` | `file_id` | 运行时对象字段与 SQL `export_file.file_id` 名称不同。 |

### 0.4 合同比例与收益分配存储边界

当前完整链路使用运行时 JSON 对象 `contract_ratio_plans` / `contract_ratio_items` 保存项目合同比例方案。项目级模拟 `POST /projects/{project_id}/allocation/simulate` 写入 `allocation_scenarios` / `allocation_results`，结果行通过 `amount_source=CONTRACT_RATIO` 或 `amount_source=MD_DSHAP_WEIGHT` 标识金额来源。

`contract_constraint` / `constraint_apply_trace` 是旧约束兼容模型，只影响旧 `allocation/simulation/run` 或 `allocation-scenarios` 路径。项目级合同比例主流程通常不生成普通 `constraint_apply_trace`，不得把旧约束表写成当前合同分配规则页的主表。

### 0.5 nav_menu 与前端侧边栏差异

当前 `ui_prototype/src/app/menu.ts` 的一级分组码为 `NAV_GROUP_DATA`、`NAV_GROUP_MEASURE`、`NAV_GROUP_ALLOCATION`、`NAV_GROUP_SYSTEM`，属于前端侧边栏分组节点；`db/dvas_p0_02_seed.sql` 的一级分组码为 `NAV_DATA_ROOT`、`NAV_MEASURE_ROOT`、`NAV_ALLOC_ROOT`、`NAV_SYSTEM_ROOT`。二级页面 `NAV_DATA_PACKAGE`、`NAV_DATA_RESOURCE`、`NAV_DATA_PARTY`、`NAV_MEASURE_QUALITY`、`NAV_MEASURE_SHUYUAN`、`NAV_MEASURE_UTILITY`、`NAV_ALLOC_MDS`、`NAV_ALLOC_CONSTRAINT`、`NAV_ALLOC_SIMULATION`、`NAV_REPORT_EXPORT`、`NAV_SYSTEM_PARAMETER`、`NAV_SYSTEM_USER`、`NAV_SYSTEM_AUDIT` 与前端路由保持同一业务含义。

前端当前收益分配计算下的显示顺序是 MD-DShap 计算管理、合同分配规则、收益分配模拟；`db/dvas_p0_02_seed.sql` 中仍是 MD-DShap 计算管理、收益分配模拟、合同约束管理。本文档按“前端当前显示 + db seed 当前事实”双口径记录，不在本轮修改数据库脚本。

# 1. 文档定位与更新边界

本文档承接需求规格说明书与系统详细功能设计，说明数据库建模、后端接口、UI 菜单权限、测试验收和软著材料需要引用的数据模型。

本次更新不重建计算模型，主要根据新的左侧导航结构调整菜单表、权限表、模块编码、路由映射、ER 图分组和 DDL 初始化数据。

业务表、MD-DShap 存储模型、收益分配存储模型、报告导出字段和快照审计机制不因左侧导航重组而改变；需要新导航入口时，补充 nav_menu、permission、menu_code、module_code 等字段和映射。

| **更新项**                                         | **处理方式**                                                        | **是否改变核心业务表** |
|----------------------------------------------------|---------------------------------------------------------------------|------------------------|
| 一级导航从技术模块调整为 6 个业务入口              | 新增/更新 nav_menu 父子节点和 sort_no；ER 图按新导航分组。          | 否                     |
| 数据接入、数据资源、参与方统一归入“数据管理”       | 更新 route_path 和 module-table 映射；资源-主体关系表保持不变。     | 否                     |
| 质量、数元、贡献效用统一归入“数元贡献度计量”       | 更新菜单分组；质量/计量/效用表仍按原计算链路引用。                  | 否                     |
| MD-DShap、收益分配、合同分配规则统一归入“收益分配计算” | 更新菜单分组；新增合同比例方案逻辑对象，旧约束 trace 仅保留兼容。   | 否                     |
| 审计日志移动到系统管理                             | audit_log 增加或保留 menu_code/module_code 映射；审计表不迁移数据。 | 否                     |
| 用户与权限管理标注 P1                              | P0 保留 local_operator；P1 启用 user/role/permission。              | 否                     |

# 2. 更新后的左侧导航结构与数据库映射

本章记录本次更新的主要差异。左侧导航结构变更会影响菜单表、权限表、路由路径、页面模块编码和 UI 到数据库对象的映射关系。

| **序号** | **一级导航**   | **二级页面**         | **menu_code**        | **module_code** | **route_path**          | **阶段** | **主表**                                                                          | **权限动作**                         |
|----------|----------------|----------------------|----------------------|-----------------|-------------------------|----------|-----------------------------------------------------------------------------------|--------------------------------------|
| 1        | 系统首页       | 无；页面内部区块     | NAV_SYS_HOME         | SYS             | /dashboard              | P0       | allocation_project, audit_log, snapshot_store, report_record, system_parameter    | VIEW, CREATE, CALCULATE              |
| 2        | 数据管理       | 数据接入管理         | NAV_DATA_PACKAGE     | DATA            | /data/ingestion         | P0       | data_package, input_snapshot, upload_validation_result                            | CREATE, VIEW, DELETE_DISABLE         |
| 2        | 数据管理       | 数据资源管理         | NAV_DATA_RESOURCE    | RES             | /data/resources         | P0       | data_resource, data_resource_field, data_resource_party_relation                  | VIEW, UPDATE, EXPORT                 |
| 2        | 数据管理       | 参与方管理           | NAV_DATA_PARTY       | PARTY           | /data/parties           | P0       | party, data_resource_party_relation                                               | CREATE, UPDATE, DELETE_DISABLE, VIEW |
| 3        | 数元贡献度计量 | 质量评估管理         | NAV_MEASURE_QUALITY  | QUAL            | /metering/quality       | P0       | SQL: quality_assessment, quality_score_detail, parameter_version；runtime JSON: quality_resource_assessments, quality_resource_score_details | UPDATE, CALCULATE, VIEW      |
| 3        | 数元贡献度计量 | 数元计量管理         | NAV_MEASURE_SHUYUAN  | DU              | /metering/shuyuan       | P0       | shuyuan_metering, shuyuan_metering_detail                                         | UPDATE, CALCULATE, VIEW              |
| 3        | 数元贡献度计量 | 贡献度与效用计算     | NAV_MEASURE_UTILITY  | UTIL            | /metering/utility       | P0       | contribution_record, utility_function_snapshot, utility_record, utility_trace     | UPDATE, CALCULATE, VIEW              |
| 4        | 收益分配计算   | MD-DShap 计算管理    | NAV_ALLOC_MDS        | MDS             | /allocation/md-dshap    | P0       | md_dshap_task, md_dshap_result, md_dshap_marginal_trace, algorithm_audit_snapshot | CALCULATE, VIEW, EXPORT              |
| 4        | 收益分配计算   | 收益分配模拟         | NAV_ALLOC_SIMULATION | ALLOC           | /allocation/simulation  | P0       | SQL: allocation_scenario, allocation_result；runtime JSON: contract_ratio_plans/items | CALCULATE, CONFIRM, EXPORT           |
| 4        | 收益分配计算   | 合同分配规则         | NAV_ALLOC_CONSTRAINT | CONS            | /allocation/constraints | P0       | runtime JSON: contract_ratio_plans/items；SQL: contract_constraint 仅旧约束兼容      | CREATE, UPDATE, DELETE_DISABLE, VIEW |
| 5        | 报告生成与导出 | 报告生成与导出       | NAV_REPORT_EXPORT    | REP             | /reports                | P0/P1    | report_record, export_file, snapshot_store                                        | VIEW, EXPORT                         |
| 6        | 系统管理       | 参数配置             | NAV_SYSTEM_PARAMETER | PARAM           | /system/parameters      | P0       | system_parameter, parameter_version                                               | VIEW, UPDATE                         |
| 6        | 系统管理       | 用户与权限管理（P1） | NAV_SYSTEM_USER      | USER            | /system/users           | P1       | user_account, role, permission, user_role, role_permission                        | CREATE, UPDATE, VIEW, DELETE_DISABLE |
| 6        | 系统管理       | 审计日志管理         | NAV_SYSTEM_AUDIT     | AUD             | /system/audit           | P0       | audit_log, snapshot_store, report_record                                          | VIEW, EXPORT                         |

# 3. 模块分组与业务域设计

| **一级导航**   | **模块编码**   | **二级页面**                                    | **涉及表**                                                                                                                                                                                       | **说明**                                                                       |
|----------------|----------------|-------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------|
| 系统首页       | SYS            | 无二级页面；内部区块为项目总览、流程入口、风险提示、一键计算 | allocation_project, audit_log, snapshot_store, report_record, system_parameter                                                                                                                   | 项目状态聚合、流程状态条、一键计算管线、风险提示文案。                         |
| 数据管理       | DATA/RES/PARTY | 数据接入管理 / 数据资源管理 / 参与方管理        | data_package, input_snapshot, upload_validation_result, data_resource, data_resource_field, data_resource_party_relation, party                                                                  | 导航合并为“数据管理”后，三个二级页面共享 project_id 和资源-主体关系。          |
| 数元贡献度计量 | QUAL/DU/UTIL   | 质量评估管理 / 数元计量管理 / 贡献度与效用计算  | SQL: quality_assessment, quality_score_detail, shuyuan_metering, shuyuan_metering_detail, contribution_record, utility_function_snapshot, utility_record, utility_trace；runtime JSON: quality_resource_assessments, quality_resource_score_details | 质量、计量、贡献和效用按顺序构成 MD-DShap 输入。 |
| 收益分配计算   | MDS/CONS/ALLOC | MD-DShap 计算管理 / 合同分配规则 / 收益分配模拟 | SQL: md_dshap_task, md_dshap_result, md_dshap_marginal_trace, algorithm_audit_snapshot, allocation_scenario, allocation_result, contract_constraint；runtime JSON: contract_ratio_plans, contract_ratio_items | 算法权重、合同比例方案、数据源收益池和分配结果集中在收益分配计算域。 |
| 报告生成与导出 | REP            | 报告生成与导出                                  | report_record, export_file, snapshot_store                                                                                                                                                       | 保持 P0 Markdown/CSV/JSON/JSONL，PDF 为 P1。                                   |
| 系统管理       | PARAM/USER/AUD | 参数配置 / 用户与权限管理（P1） / 审计日志管理  | system_parameter, parameter_version, user_account, role, permission, user_role, role_permission, audit_log, snapshot_store, nav_menu                                                             | 将参数、权限、审计集中到系统管理；审计日志从独立技术模块变为系统管理二级页面。 |

# 4. 逻辑数据模型总览

数据库采用“项目根对象 + 业务事实表 + 版本快照 + 审计日志 + 菜单权限”的结构。allocation_project 是业务根对象，nav_menu/permission 支撑左侧导航和按钮权限，snapshot_store/audit_log 贯穿全链路。

| **业务域**     | **职责**                         | **主要表**                                                                            | **设计约束**                                     |
|----------------|--------------------------------------|---------------------------------------------------------------------------------------|------------------------------------------------------|
| 项目与首页     | 项目状态、流程进度、一键计算入口     | allocation_project, snapshot_store, audit_log                                         | 首页仅读取聚合状态，不重复计算业务结果。             |
| 数据管理       | 数据包、资源、字段、参与方和主体关联 | data_package, data_resource, data_resource_field, party, data_resource_party_relation | 资源进入计算前必须关联数据源主体。                   |
| 数元贡献度计量 | 质量、逐资源质量、数元、贡献和效用   | SQL: quality_assessment, quality_score_detail, shuyuan_metering, contribution_record, utility_record；runtime JSON: quality_resource_assessments/details | 质量/资源级质量/计量/效用均版本化并可追溯。 |
| 收益分配计算   | MD-DShap、合同比例方案、数据源收益池和分配结果 | SQL: md_dshap_task, allocation_scenario, allocation_result, contract_constraint；runtime JSON: contract_ratio_plans/items | MD-DShap 只产生权重，合同分配规则先划分数据源收益池。 |
| 报告生成与导出 | 报告记录、导出文件、字段清单         | report_record, export_file                                                            | 每次导出生成 report_id 和 checksum，不覆盖历史文件。 |
| 系统管理       | 参数、用户权限、审计日志、菜单       | system_parameter, user_account, role, permission, nav_menu, audit_log                 | P0 不强制登录但仍保留权限设计；P1 启用 RBAC。        |

# 5. ER 关系图

下图按更新后的六类一级导航分组展示主要表关系。PNG、SVG 和 Mermaid 源码随本文档一起保存。

<img src="assets/数据收益分配系统_数据库设计与ER关系图_V1.0_导航结构更新版/media/image1.png" style="width:2.45066in;height:5.25in" />

图 5-1 数据收益分配系统数据库 ER 关系图（导航结构更新版）

# 6. 数据表清单总览

| **表名**                     | **中文名**        | **主键**             | **外键/关系**                                                      | **关键字段**                                     | **设计说明**                                   |
|------------------------------|-------------------|----------------------|--------------------------------------------------------------------|--------------------------------------------------|------------------------------------------------|
| allocation_project           | 项目主表          | project_id           | current_package_id/current_algorithm_task_id/current_allocation_id | 项目状态、当前版本、操作人                       | 左侧导航所有模块的项目根对象。                 |
| nav_menu                     | 导航菜单表        | menu_id              | parent_id                                                          | menu_code、route_path、module_code、sort_no      | 记录六大一级导航和二级页面。                 |
| permission                   | 按钮/动作权限表   | permission_id        | menu_id                                                            | action_type、button_code                         | P1 RBAC 与 P0 按钮可用性说明共用。             |
| user_account                 | 用户表（P1）      | user_id              |                                                                    | username、display_name、status                   | P0 可只保留 local_operator。                   |
| role                         | 角色表（P1）      | role_id              |                                                                    | role_code、role_name                             | 系统管理员、业务管理员、算法审核员等。         |
| user_role                    | 用户角色关系      | id                   | user_id、role_id                                                   |                                                  | 多角色权限取并集。                             |
| role_permission              | 角色权限关系      | id                   | role_id、permission_id                                             |                                                  | 菜单级、按钮级、导出级权限。                   |
| data_package                 | 数据包表          | package_id           | project_id、input_snapshot_id                                      | source_type、checksum、status                    | 数据接入管理主表。                             |
| input_snapshot               | 输入快照表        | snapshot_id          | project_id                                                         | content_json、checksum                           | 上传或演示数据初始化时生成。                   |
| upload_validation_result     | 上传校验结果表    | validation_result_id | project_id、package_id                                             | is_valid、error_field、detail_json               | 失败详情页面读取。                             |
| data_resource                | 数据资源表        | resource_id          | package_id、project_id                                             | modality、field_count、sample_count              | 数据资源管理主表。                             |
| data_resource_field          | 资源字段表        | field_id             | resource_id                                                        | field_name、is_sensitive、missing_rate           | 支持字段统计与脱敏预览。                       |
| party                        | 参与方表          | party_id             | project_id                                                         | party_type、include_in_md_dshap、status          | 参与方管理主表。                               |
| data_resource_party_relation | 资源主体关系表    | relation_id          | resource_id、party_id                                              | split_ratio、is_primary_provider                 | 资源进入算法前必须关联数据源主体。             |
| quality_metric_template      | 质量指标模板表    | metric_id            |                                                                    | metric_code、parent_metric_code、default_weight  | P0 默认 7 个一级指标和 17 个二级指标权重模板。 |
| quality_assessment           | 质量评估表        | assessment_id        | project_id、package_id                                             | score、level、quality_factor                     | 质量评估管理主表。                             |
| quality_score_detail         | 质量得分明细      | detail_id            | assessment_id                                                      | dimension_code、weight、score                    | 包级一级指标和二级指标得分、证据和问题摘要。   |
| quality_resource_assessment  | 资源级质量评估表  | resource_assessment_id | assessment_id、resource_id、project_id、package_id                | resource_score、resource_level、resource_quality_factor | 每个数据资源一条资源级质量评估主结果。          |
| quality_resource_score_detail | 资源级质量得分明细 | resource_detail_id    | resource_assessment_id、assessment_id、resource_id                 | dimension_code、weight、score、rule_code         | 资源级一级/二级指标得分、证据和规则编码。      |
| shuyuan_metering             | 数元计量表        | metering_id          | project_id、assessment_id                                          | base_price、coefficients、total_amount           | 数元计量管理主表。                             |
| shuyuan_metering_detail      | 数元计量明细      | detail_id            | metering_id、resource_id、party_id                                 | call_count、metering_amount                      | 资源级/参与方级计量明细。                      |
| contribution_record          | 贡献度记录        | contribution_id      | project_id、party_id                                               | valid_units、weights、normalized_contribution    | 贡献度与效用计算输入。                         |
| utility_function_snapshot    | 效用函数快照      | snapshot_id          | project_id                                                         | utility_source、formula_text、parameter_json     | 报告披露效用函数来源。                         |
| utility_record               | 效用记录          | utility_id           | project_id、party_id、utility_function_snapshot_id                 | utility_value、task_key                          | MD-DShap 的 v(S,t) 来源。                      |
| utility_trace                | 效用 trace        | trace_id             | utility_id                                                         | formula_text、input_json、output_json            | 效用可解释追溯。                               |
| md_dshap_task                | MD-DShap 任务     | task_id              | project_id、utility_function_snapshot_id                           | algorithm_mode、participant_set_json、status     | 默认算法任务。                                 |
| md_dshap_result              | MD-DShap 权重结果 | result_id            | task_id、party_id                                                  | participant_weight、baseline_weight、weight_diff | 仅数据源主体权重进入数据源收益池分配。         |
| md_dshap_marginal_trace      | 边际贡献明细      | trace_id             | task_id、party_id                                                  | coalition_before、v_before、v_after              | 算法审计明细。                                 |
| algorithm_audit_snapshot     | 算法审计快照      | snapshot_id          | task_id、project_id                                                | input/parameter/output snapshot                  | 算法报告导出依据。                             |
| contract_ratio_plan          | 合同比例方案      | plan_id              | project_id                                                         | total_revenue、data_provider_pool_ratio、ratio_sum、data_provider_revenue_pool、status | 合同分配规则页保存的方案；ratio_sum 必须为 1.000000。 |
| contract_ratio_item          | 合同比例项        | item_id              | plan_id、party_id                                                  | bucket_type、ratio、calculated_amount、amount_source、basis_text | 包含 DATA_PROVIDER_POOL 与 NON_DATA_PARTY 行。 |
| allocation_scenario          | 收益分配场景      | allocation_id        | project_id、weight_task_id、contract_ratio_plan_id                 | total_revenue、non_data_contract_amount、data_provider_revenue_pool、allocation_mode、status | 引用合同比例方案并生成分配结果。 |
| allocation_result            | 分配结果表        | result_id            | allocation_id、party_id                                            | amount_source、contract_ratio、base_pool_amount、raw_weight、normalized_weight、final_amount | 非数据主体使用 CONTRACT_RATIO；数据源主体使用 MD_DSHAP_WEIGHT。 |
| report_record                | 报告记录表        | report_id            | project_id、source_snapshot_id                                     | report_type、file_path、checksum                 | 报告生成与导出主表。                           |
| export_file                  | 导出文件明细      | file_id              | report_id                                                          | file_type、field_scope_json、checksum            | 一次导出多个文件时使用。                       |
| audit_log                    | 审计日志表        | log_id               | project_id、snapshot ids                                           | module_code、menu_code、operation_type           | 审计日志管理主表。                             |
| snapshot_store               | 通用快照表        | snapshot_id          | project_id                                                         | snapshot_type、content_json、checksum            | 输入/参数/结果/报告快照统一存储。              |
| system_parameter             | 系统参数表        | parameter_id         |                                                                    | parameter_code、current_value、scope             | 参数配置主表。                                 |
| parameter_version            | 参数版本表        | version_id           | parameter_id、project_id                                           | version_no、value_json                           | 参数版本化，不回改历史结果。                   |

# 7. 表结构字段详细设计

字段类型以 PostgreSQL 为参考；若 P0 使用本地文件或轻量数据库，仍应保持同名字段、同义约束和同等快照粒度。

## 7.1 项目、导航与权限表

### allocation_project

| **字段**                  | **类型**     | **必填** | **键** | **说明**                                                                                            |
|---------------------------|--------------|----------|--------|-----------------------------------------------------------------------------------------------------|
| project_id                | varchar(64)  | Y        | PK     | 项目主键，贯穿数据接入、计量、算法、分配、报告和审计。                                              |
| project_name              | varchar(200) | Y        |        | 项目名称。                                                                                          |
| scenario_name             | varchar(200) | N        |        | 收益分配模拟场景名称。                                                                              |
| status                    | varchar(32)  | Y        | IDX    | DRAFT/INGESTED/ASSESSED/METERED/UTILITY_CALCULATED/WEIGHT_CALCULATED/ALLOCATED/CONFIRMED/EXPORTED。 |
| current_package_id        | varchar(64)  | N        | FK     | 当前有效数据包。                                                                                    |
| current_algorithm_task_id | varchar(64)  | N        | FK     | 当前有效 MD-DShap 任务。                                                                            |
| current_allocation_id     | varchar(64)  | N        | FK     | 当前有效分配方案。                                                                                  |
| created_by                | varchar(64)  | Y        |        | P0 默认为 local_operator。                                                                          |
| created_at                | timestamp    | Y        |        | 创建时间。                                                                                          |
| updated_at                | timestamp    | Y        |        | 更新时间。                                                                                          |

### nav_menu

| **字段**    | **类型**     | **必填** | **键** | **说明**                                                            |
|-------------|--------------|----------|--------|---------------------------------------------------------------------|
| menu_id     | varchar(64)  | Y        | PK     | 菜单节点主键。                                                      |
| parent_id   | varchar(64)  | N        | FK     | 父菜单；一级导航为空。                                              |
| menu_code   | varchar(64)  | Y        | UK     | 菜单编码，按更新后的左侧导航固化。                                  |
| menu_name   | varchar(100) | Y        |        | 菜单显示名称。                                                      |
| module_code | varchar(32)  | Y        | IDX    | SYS/DATA/RES/PARTY/QUAL/DU/UTIL/MDS/ALLOC/CONS/REP/PARAM/USER/AUD。 |
| route_path  | varchar(200) | Y        |        | 前端路由。                                                          |
| menu_level  | smallint     | Y        |        | 1=一级导航，2=二级页面。                                            |
| sort_no     | int          | Y        | IDX    | 同级排序号。                                                        |
| p0_required | boolean      | Y        |        | P0 是否必须可见。                                                   |
| p1_only     | boolean      | Y        |        | 是否 P1 才启用。                                                    |
| status      | varchar(16)  | Y        |        | ENABLED/DISABLED。                                                  |

### permission

| **字段**        | **类型**     | **必填** | **键** | **说明**                                                     |
|-----------------|--------------|----------|--------|--------------------------------------------------------------|
| permission_id   | varchar(64)  | Y        | PK     | 权限主键。                                                   |
| menu_id         | varchar(64)  | Y        | FK     | 所属菜单。                                                   |
| permission_code | varchar(100) | Y        | UK     | 权限编码。                                                   |
| action_type     | varchar(32)  | Y        | IDX    | VIEW/CREATE/UPDATE/DELETE_DISABLE/CALCULATE/EXPORT/CONFIRM。 |
| button_code     | varchar(64)  | N        |        | 按钮级权限编码，如 MDS-011、ALLOC-015、USER-005、USER-010。   |
| description     | varchar(300) | N        |        | 权限说明。                                                   |
| status          | varchar(16)  | Y        |        | ENABLED/DISABLED。                                           |

P1 用户管理需保留以下明确权限码：USER_CREATE、USER_UPDATE、USER_DISABLE、USER_RESET_PASSWORD、USER_CHANGE_OWN_PASSWORD。后端权限校验以当前登录用户的 role_code=SYSTEM_ADMIN 或这些权限码为准，不使用账号名、显示名或前端 label。

### user_account

| **字段**             | **类型**     | **必填** | **键** | **说明**                                       |
|----------------------|--------------|----------|--------|------------------------------------------------|
| user_id              | varchar(64)  | Y        | PK     | P1 用户主键；P0 使用 local_operator 虚拟用户。 |
| username             | varchar(80)  | Y        | UK     | 登录账号。                                     |
| display_name         | varchar(100) | Y        |        | 显示名称。                                     |
| email                | varchar(200) | N        |        | 邮箱。                                         |
| password_hash        | varchar(255) | N        |        | P1 登录密码不可逆哈希；P0 可为空；不得出现在列表、详情、日志、导出或接口响应。 |
| password_updated_at  | timestamp    | N        |        | 最近一次密码更新时间。                         |
| must_change_password | boolean      | Y        |        | 是否要求下次登录后修改密码。                   |
| status               | varchar(16)  | Y        | IDX    | ENABLED/DISABLED/LOCKED。                      |
| disabled_by          | varchar(64)  | N        | FK     | 禁用操作人 user_id；无法扩展字段时需在 audit_log 等价记录。 |
| disabled_at          | timestamp    | N        |        | 禁用时间；无法扩展字段时需在 audit_log 等价记录。 |
| last_login_at        | timestamp    | N        |        | 最近登录时间。                                 |
| created_at           | timestamp    | Y        |        | 创建时间。                                     |

### role

| **字段**    | **类型**     | **必填** | **键** | **说明**           |
|-------------|--------------|----------|--------|--------------------|
| role_id     | varchar(64)  | Y        | PK     | 角色主键。         |
| role_code   | varchar(64)  | Y        | UK     | 角色编码。         |
| role_name   | varchar(100) | Y        |        | 角色名称。         |
| description | varchar(300) | N        |        | 角色说明。         |
| status      | varchar(16)  | Y        |        | ENABLED/DISABLED。 |

### user_role

| **字段**   | **类型**    | **必填** | **键** | **说明**           |
|------------|-------------|----------|--------|--------------------|
| id         | varchar(64) | Y        | PK     | 用户角色关系主键。 |
| user_id    | varchar(64) | Y        | FK     | 用户。             |
| role_id    | varchar(64) | Y        | FK     | 角色。             |
| created_at | timestamp   | Y        |        | 创建时间。         |

### role_permission

| **字段**      | **类型**    | **必填** | **键** | **说明**           |
|---------------|-------------|----------|--------|--------------------|
| id            | varchar(64) | Y        | PK     | 角色权限关系主键。 |
| role_id       | varchar(64) | Y        | FK     | 角色。             |
| permission_id | varchar(64) | Y        | FK     | 权限。             |
| created_at    | timestamp   | Y        |        | 创建时间。         |

## 7.2 数据管理表

### data_package

| **字段**             | **类型**     | **必填** | **键** | **说明**                           |
|----------------------|--------------|----------|--------|------------------------------------|
| package_id           | varchar(64)  | Y        | PK     | 数据包主键。                       |
| project_id           | varchar(64)  | Y        | FK     | 所属项目。                         |
| package_name         | varchar(200) | Y        |        | 数据包名称。                       |
| source_type          | varchar(32)  | Y        |        | DEMO/UPLOAD。                      |
| file_name            | varchar(255) | N        |        | 上传文件名。                       |
| file_size            | bigint       | N        |        | 文件大小。                         |
| checksum             | varchar(128) | Y        | IDX    | 文件或输入摘要，用于防篡改。       |
| status               | varchar(32)  | Y        | IDX    | VALID/INVALID/DISABLED/WITHDRAWN。 |
| input_snapshot_id    | varchar(64)  | Y        | FK     | 输入快照。                         |
| validation_result_id | varchar(64)  | N        | FK     | 校验结果。                         |
| created_at           | timestamp    | Y        |        | 创建时间。                         |

### input_snapshot

| **字段**     | **类型**     | **必填** | **键** | **说明**         |
|--------------|--------------|----------|--------|------------------|
| snapshot_id  | varchar(64)  | Y        | PK     | 输入快照主键。   |
| project_id   | varchar(64)  | Y        | FK     | 所属项目。       |
| object_type  | varchar(64)  | Y        |        | 快照对象类型。   |
| object_id    | varchar(64)  | Y        |        | 快照对象 ID。    |
| content_json | jsonb        | Y        |        | 结构化输入内容。 |
| checksum     | varchar(128) | Y        |        | 快照摘要。       |
| created_at   | timestamp    | Y        |        | 创建时间。       |

### upload_validation_result

| **字段**             | **类型**     | **必填** | **键** | **说明**                             |
|----------------------|--------------|----------|--------|--------------------------------------|
| validation_result_id | varchar(64)  | Y        | PK     | 上传校验结果主键。                   |
| project_id           | varchar(64)  | Y        | FK     | 所属项目。                           |
| package_id           | varchar(64)  | N        | FK     | 上传成功时关联数据包；失败时可为空。 |
| is_valid             | boolean      | Y        | IDX    | 是否通过校验。                       |
| error_code           | varchar(80)  | N        |        | 错误码。                             |
| error_field          | varchar(200) | N        |        | 错误字段路径。                       |
| error_message        | text         | N        |        | 错误说明。                           |
| detail_json          | jsonb        | N        |        | 字段级失败详情。                     |
| created_at           | timestamp    | Y        |        | 校验时间。                           |

### data_resource

| **字段**               | **类型**      | **必填** | **键** | **说明**                                          |
|------------------------|---------------|----------|--------|---------------------------------------------------|
| resource_id            | varchar(64)   | Y        | PK     | 数据资源主键。                                    |
| package_id             | varchar(64)   | Y        | FK     | 所属数据包。                                      |
| project_id             | varchar(64)   | Y        | FK     | 冗余项目 ID，便于查询。                           |
| resource_name          | varchar(200)  | Y        |        | 资源名称。                                        |
| modality               | varchar(32)   | Y        | IDX    | TEXT/IMAGE/MEDICAL_IMAGE/AUDIO/STRUCTURED/MIXED。 |
| field_count            | int           | Y        |        | 字段数量。                                        |
| sample_count           | int           | Y        |        | 样本数量。                                        |
| missing_rate           | numeric(10,6) | N        |        | 缺失率。                                          |
| include_in_calculation | boolean       | Y        | IDX    | 是否进入后续计算。                                |
| status                 | varchar(32)   | Y        |        | ACTIVE/DISABLED。                                 |

### data_resource_field

| **字段**              | **类型**      | **必填** | **键** | **说明**                   |
|-----------------------|---------------|----------|--------|----------------------------|
| field_id              | varchar(64)   | Y        | PK     | 资源字段主键。             |
| resource_id           | varchar(64)   | Y        | FK     | 所属数据资源。             |
| field_name            | varchar(200)  | Y        |        | 字段名称。                 |
| field_type            | varchar(64)   | N        |        | 字段类型。                 |
| is_sensitive          | boolean       | Y        |        | 是否疑似敏感字段。         |
| missing_rate          | numeric(10,6) | N        |        | 字段缺失率。               |
| sample_preview_masked | text          | N        |        | 脱敏预览，不保存敏感原文。 |

### party

| **字段**            | **类型**     | **必填** | **键**      | **说明**                                                                        |
|---------------------|--------------|----------|-------------|---------------------------------------------------------------------------------|
| party_id            | varchar(64)  | Y        | PK          | 参与方主键。                                                                    |
| project_id          | varchar(64)  | Y        | FK          | 所属项目。                                                                      |
| party_name          | varchar(200) | Y        | UK(project) | 项目内唯一。                                                                    |
| party_type          | varchar(40)  | Y        | IDX         | DATA_PROVIDER/OPERATOR/PILOT_BASE/TECH_SERVICE/EXPERT_REVIEWER/CONTRACT_PARTY。 |
| is_data_provider    | boolean      | Y        | IDX         | 是否数据源主体。                                                                |
| include_in_md_dshap | boolean      | Y        | IDX         | 是否进入 MD-DShap 参与方集合。                                                  |
| credit_code         | varchar(100) | N        |             | 统一社会信用代码或主体编码。                                                    |
| contact_name        | varchar(100) | N        |             | 联系人。                                                                        |
| description         | text         | N        |             | 备注。                                                                          |
| status              | varchar(32)  | Y        | IDX         | ACTIVE/DISABLED。                                                               |

### data_resource_party_relation

| **字段**            | **类型**      | **必填** | **键** | **说明**               |
|---------------------|---------------|----------|--------|------------------------|
| relation_id         | varchar(64)   | Y        | PK     | 资源-参与方关系主键。  |
| resource_id         | varchar(64)   | Y        | FK     | 数据资源。             |
| party_id            | varchar(64)   | Y        | FK     | 数据源主体或关联主体。 |
| split_ratio         | numeric(18,6) | Y        |        | 多主体拆分比例。       |
| is_primary_provider | boolean       | Y        |        | 是否主提供方。         |
| status              | varchar(32)   | Y        |        | ACTIVE/DISABLED。      |

## 7.3 数元贡献度计量表

### quality_metric_template

| **字段**           | **类型**      | **必填** | **键** | **说明**           |
|--------------------|---------------|----------|--------|--------------------|
| metric_id          | varchar(64)   | Y        | PK     | 质量指标模板主键。 |
| metric_code        | varchar(64)   | Y        | UK     | 指标编码。         |
| metric_name        | varchar(100)  | Y        |        | 指标名称。         |
| parent_metric_code | varchar(64)   | N        |        | 上级指标。         |
| default_weight     | numeric(18,6) | Y        |        | 默认权重。         |
| metric_level       | smallint      | Y        |        | 1=一级，2=二级。   |
| status             | varchar(16)   | Y        |        | ENABLED/DISABLED。 |

P0 默认初始化 7 个一级指标和 17 个二级指标。`metric_level=1` 表示一级指标，`metric_level=2` 表示二级指标；二级指标通过 `parent_metric_code` 关联所属一级指标。一级指标权重之和必须为 1，同一一级指标下的二级指标权重之和必须为 1。

默认一级指标种子记录：

| **metric_level** | **metric_code** | **metric_name** | **parent_metric_code** |
|------------------|-----------------|-----------------|------------------------|
| 1                | QUALITY_NORM    | 规范性          |                        |
| 1                | QUALITY_ACC     | 准确性          |                        |
| 1                | QUALITY_COMP    | 完整性          |                        |
| 1                | QUALITY_UNIQ    | 唯一性          |                        |
| 1                | QUALITY_CONS    | 一致性          |                        |
| 1                | QUALITY_TIME    | 时效性          |                        |
| 1                | QUALITY_ACCESS  | 可访问性        |                        |

默认二级指标种子记录：

| **所属一级指标** | **二级指标** |
|------------------|--------------|
| 规范性           | 命名规范性、数据长度规范性、数据精度规范性、数据格式规范性、元数据规范性、参考数据规范性、数据模型规范性 |
| 准确性           | 数据范围准确性、编码/代码准确性 |
| 完整性           | 数据元素完整性、数据记录完整性 |
| 唯一性           | 数据唯一标识程度、数据冗余性 |
| 一致性           | 相同数据一致性、关联数据一致性 |
| 时效性           | 数据记录及时性 |
| 可访问性         | 数据字段可访问性 |

可选指标可根据具体场景扩展，例如管理信息完整性、应用场景完整性、调用成功率、数据来源权威性、采集方式、流通交易情况、数据资产登记情况、投资收益率稳定性等。可选指标不替代通用指标框架。

### quality_assessment

| **字段**              | **类型**      | **必填** | **键** | **说明**                     |
|-----------------------|---------------|----------|--------|------------------------------|
| assessment_id         | varchar(64)   | Y        | PK     | 质量评估主键。               |
| project_id            | varchar(64)   | Y        | FK     | 所属项目。                   |
| package_id            | varchar(64)   | Y        | FK     | 评估数据包。                 |
| score                 | numeric(8,4)  | Y        |        | 质量总分。                   |
| level                 | varchar(32)   | Y        |        | 质量等级。                   |
| quality_factor        | numeric(18,6) | Y        |        | 质量系数，供计量和效用读取。 |
| parameter_snapshot_id | varchar(64)   | Y        | FK     | 质量参数快照。               |
| evidence_summary      | text          | N        |        | 证据摘要。                   |
| version_no            | int           | Y        | IDX    | 评估版本。                   |
| created_at            | timestamp     | Y        |        | 创建时间。                   |

### quality_score_detail

| **字段**              | **类型**      | **必填** | **键** | **说明**           |
|-----------------------|---------------|----------|--------|--------------------|
| detail_id             | varchar(64)   | Y        | PK     | 质量得分明细主键。 |
| assessment_id         | varchar(64)   | Y        | FK     | 质量评估。         |
| dimension_code        | varchar(64)   | Y        | IDX    | 指标编码。         |
| dimension_name        | varchar(100)  | Y        |        | 指标名称。         |
| parent_dimension_code | varchar(64)   | N        |        | 上级指标。         |
| weight                | numeric(18,6) | Y        |        | 权重。             |
| score                 | numeric(8,4)  | Y        |        | 得分。             |
| evidence_text         | text          | N        |        | 证据说明。         |

`quality_score_detail` 用于保存一级指标和二级指标的得分、权重、证据、问题摘要和规则编码，并支持通过 `parent_dimension_code` 还原二级指标所属一级指标。如果当前 P0 schema 未包含全部字段，则问题摘要、规则编码和扩展证据作为 `evidence_text` 的结构化快照字段或结果快照字段说明，不在本轮修改 schema。


### quality_resource_assessment（运行时 JSON 对象，PostgreSQL 预留）

当前 `db/dvas_p0_01_schema.sql` 未创建该表。后端运行时通过 `JsonFileRepository.state["quality_resource_assessments"]` 保存资源级质量结果；下表为 PostgreSQL 后续映射建议，不表示当前 DDL 已落表。

| **字段**                   | **类型**      | **必填** | **键** | **说明**                                      |
|----------------------------|---------------|----------|--------|-----------------------------------------------|
| resource_assessment_id     | varchar(64)   | Y        | PK     | 资源级质量评估主键。                          |
| assessment_id              | varchar(64)   | Y        | FK     | 所属包级质量评估。                            |
| project_id                 | varchar(64)   | Y        | FK     | 所属项目。                                    |
| package_id                 | varchar(64)   | Y        | FK     | 所属数据包。                                  |
| resource_id                | varchar(64)   | Y        | FK     | 被评估数据资源。                              |
| resource_score             | numeric(8,4)  | Y        |        | 资源级质量总分。                              |
| resource_level             | varchar(32)   | Y        |        | 资源级质量等级。                              |
| resource_quality_factor    | numeric(18,6) | Y        |        | 资源级质量系数，供资源级计量和效用计算读取。  |
| resource_weight            | numeric(18,6) | Y        |        | 包级汇总时采用的资源权重。                    |
| weight_strategy            | varchar(40)   | Y        |        | SAMPLE_COUNT/FIELD_COUNT/EQUAL/MANUAL。       |
| status                     | varchar(32)   | Y        | IDX    | SUCCESS/PARTIAL_SUCCESS/FAILED。              |
| error_detail_json          | jsonb         | N        |        | 资源级失败详情。                              |
| evidence_summary           | text          | N        |        | 资源级证据摘要。                              |
| version_no                 | int           | Y        | IDX    | 资源级评估版本。                              |
| created_at                 | timestamp     | Y        |        | 创建时间。                                    |

### quality_resource_score_detail（运行时 JSON 对象，PostgreSQL 预留）

当前 `db/dvas_p0_01_schema.sql` 未创建该表。后端运行时通过 `JsonFileRepository.state["quality_resource_score_details"]` 保存资源级指标明细；下表为 PostgreSQL 后续映射建议。

| **字段**                   | **类型**      | **必填** | **键** | **说明**                              |
|----------------------------|---------------|----------|--------|---------------------------------------|
| resource_detail_id         | varchar(64)   | Y        | PK     | 资源级质量得分明细主键。              |
| resource_assessment_id     | varchar(64)   | Y        | FK     | 资源级质量评估。                      |
| assessment_id              | varchar(64)   | Y        | FK     | 冗余包级评估 ID，便于汇总查询。       |
| resource_id                | varchar(64)   | Y        | FK     | 被评估数据资源。                      |
| dimension_code             | varchar(64)   | Y        | IDX    | 指标编码。                            |
| dimension_name             | varchar(100)  | Y        |        | 指标名称。                            |
| parent_dimension_code      | varchar(64)   | N        |        | 上级指标。                            |
| weight                     | numeric(18,6) | Y        |        | 当次资源级有效权重。                  |
| score                      | numeric(8,4)  | Y        |        | 资源级指标得分。                      |
| evidence_text              | text          | N        |        | 证据说明。                            |
| rule_code                  | varchar(80)   | N        |        | 后端评分规则编码。                    |
| issue_count                | int           | N        |        | 该指标识别的问题数量。                |
| not_applicable_reason      | text          | N        |        | 模态不适用或跳过评分原因。            |

### shuyuan_metering

| **字段**                | **类型**      | **必填** | **键** | **说明**                 |
|-------------------------|---------------|----------|--------|--------------------------|
| metering_id             | varchar(64)   | Y        | PK     | 数元计量主表主键。       |
| project_id              | varchar(64)   | Y        | FK     | 所属项目。               |
| assessment_id           | varchar(64)   | Y        | FK     | 质量评估版本。           |
| base_price              | numeric(18,6) | Y        |        | 基准数元价，必须大于 0。 |
| scenario_coefficient    | numeric(18,6) | Y        |        | 场景系数，必须大于 0。   |
| quality_coefficient     | numeric(18,6) | Y        |        | 质量系数，必须大于 0。   |
| technology_coefficient  | numeric(18,6) | Y        |        | 技术系数，必须大于 0。   |
| expert_coefficient      | numeric(18,6) | Y        |        | 专家系数，必须大于 0。   |
| development_coefficient | numeric(18,6) | Y        |        | 发展系数，必须大于 0。   |
| total_amount            | numeric(18,2) | Y        |        | 项目级计量金额。         |
| parameter_snapshot_id   | varchar(64)   | Y        | FK     | 计量参数快照。           |
| version_no              | int           | Y        | IDX    | 计量版本。               |


### shuyuan_metering_detail

| **字段**         | **类型**      | **必填** | **键** | **说明**              |
|------------------|---------------|----------|--------|-----------------------|
| detail_id        | varchar(64)   | Y        | PK     | 数元计量明细主键。    |
| metering_id      | varchar(64)   | Y        | FK     | 数元计量主表。        |
| resource_id      | varchar(64)   | Y        | FK     | 数据资源。            |
| party_id         | varchar(64)   | Y        | FK     | 参与方。              |
| call_count       | bigint        | Y        |        | 调用量，必须 \>=0。   |
| coefficient_json | jsonb         | Y        |        | 资源级系数快照。      |
| metering_amount  | numeric(18,2) | Y        |        | 资源/主体级计量金额。 |

### contribution_record

| **字段**                | **类型**      | **必填** | **键** | **说明**                              |
|-------------------------|---------------|----------|--------|---------------------------------------|
| contribution_id         | varchar(64)   | Y        | PK     | 贡献度记录主键。                      |
| project_id              | varchar(64)   | Y        | FK     | 所属项目。                            |
| party_id                | varchar(64)   | Y        | FK     | 参与方。                              |
| valid_units             | numeric(18,6) | Y        |        | 有效数据量，不得为负。                |
| usage_weight            | numeric(18,6) | Y        |        | 使用权重，必须大于 0。                |
| coverage_weight         | numeric(18,6) | Y        |        | 覆盖度权重，必须大于 0。              |
| scarcity_weight         | numeric(18,6) | Y        |        | 稀缺性权重，必须大于 0。              |
| contribution_score      | numeric(18,6) | Y        |        | 贡献度得分。                          |
| normalized_contribution | numeric(18,6) | N        |        | 归一化贡献度，总贡献为 0 时不得生成。 |
| parameter_snapshot_id   | varchar(64)   | Y        | FK     | 贡献参数快照。                        |

### utility_function_snapshot

| **字段**       | **类型**     | **必填** | **键** | **说明**           |
|----------------|--------------|----------|--------|--------------------|
| snapshot_id    | varchar(64)  | Y        | PK     | 效用函数快照主键。 |
| project_id     | varchar(64)  | Y        | FK     | 所属项目。         |
| utility_source | varchar(100) | Y        |        | 效用函数来源。     |
| formula_text   | text         | Y        |        | 公式说明。         |
| parameter_json | jsonb        | Y        |        | 效用函数参数。     |
| checksum       | varchar(128) | Y        |        | 快照摘要。         |
| created_at     | timestamp    | Y        |        | 创建时间。         |

### utility_record

| **字段**                     | **类型**      | **必填** | **键** | **说明**       |
|------------------------------|---------------|----------|--------|----------------|
| utility_id                   | varchar(64)   | Y        | PK     | 效用记录主键。 |
| project_id                   | varchar(64)   | Y        | FK     | 所属项目。     |
| party_id                     | varchar(64)   | Y        | FK     | 参与方。       |
| task_key                     | varchar(64)   | Y        | IDX    | 任务或场景键。 |
| normalized_contribution      | numeric(18,6) | Y        |        | 归一化贡献度。 |
| quality_factor               | numeric(18,6) | Y        |        | 质量因子。     |
| usage_factor                 | numeric(18,6) | Y        |        | 使用因子。     |
| scenario_factor              | numeric(18,6) | Y        |        | 场景因子。     |
| utility_value                | numeric(18,6) | Y        |        | 效用值。       |
| utility_function_snapshot_id | varchar(64)   | Y        | FK     | 效用函数快照。 |
| trace_id                     | varchar(64)   | N        | FK     | 效用 trace。   |

### utility_trace

| **字段**     | **类型**    | **必填** | **键** | **说明**              |
|--------------|-------------|----------|--------|-----------------------|
| trace_id     | varchar(64) | Y        | PK     | 效用计算 trace 主键。 |
| utility_id   | varchar(64) | Y        | FK     | 效用记录。            |
| formula_text | text        | Y        |        | 公式展开。            |
| input_json   | jsonb       | Y        |        | 输入值。              |
| output_json  | jsonb       | Y        |        | 输出值。              |
| created_at   | timestamp   | Y        |        | 创建时间。            |

## 7.4 收益分配计算表

### md_dshap_task

| **字段**                     | **类型**      | **必填** | **键** | **说明**                                   |
|------------------------------|---------------|----------|--------|--------------------------------------------|
| task_id                      | varchar(64)   | Y        | PK     | MD-DShap 任务主键。                        |
| project_id                   | varchar(64)   | Y        | FK     | 所属项目。                                 |
| algorithm_mode               | varchar(32)   | Y        | IDX    | 默认 MD_DSHAP；BASIC_SHAPLEY 仅作基线。    |
| baseline_enabled             | boolean       | Y        |        | 是否启用基础 Shapley 基线。                |
| participant_set_json         | jsonb         | Y        |        | 进入算法的数据源主体集合。                 |
| task_set_json                | jsonb         | Y        |        | 任务集合。                                 |
| utility_function_snapshot_id | varchar(64)   | Y        | FK     | 效用函数快照。                             |
| seed                         | bigint        | Y        |        | 随机种子。                                 |
| sample_rounds                | int           | N        |        | 采样轮次。                                 |
| epsilon                      | numeric(18,8) | N        |        | 收敛阈值。                                 |
| status                       | varchar(32)   | Y        | IDX    | PENDING/RUNNING/SUCCESS/FAILED/CANCELLED。 |
| algorithm_version            | varchar(64)   | Y        |        | 算法版本。                                 |
| parameter_snapshot_id        | varchar(64)   | Y        | FK     | 算法参数快照。                             |

### md_dshap_result

| **字段**               | **类型**      | **必填** | **键** | **说明**                     |
|------------------------|---------------|----------|--------|------------------------------|
| result_id              | varchar(64)   | Y        | PK     | MD-DShap 结果主键。          |
| task_id                | varchar(64)   | Y        | FK     | 算法任务。                   |
| party_id               | varchar(64)   | Y        | FK     | 数据源主体。                 |
| participant_weight     | numeric(18,6) | Y        |        | 参与方综合权重。             |
| normalized_weight      | numeric(18,6) | Y        |        | 归一化权重，任务内合计为 1。 |
| baseline_weight        | numeric(18,6) | N        |        | 基础 Shapley 基线权重。      |
| weight_diff            | numeric(18,6) | N        |        | 与基线差异。                 |
| task_level_weight_json | jsonb         | N        |        | 任务维度权重。               |
| approximation_note     | text          | N        |        | 近似假设和边界说明。         |

### md_dshap_marginal_trace

| **字段**              | **类型**      | **必填** | **键** | **说明**           |
|-----------------------|---------------|----------|--------|--------------------|
| trace_id              | varchar(64)   | Y        | PK     | 边际贡献明细主键。 |
| task_id               | varchar(64)   | Y        | FK     | 算法任务。         |
| party_id              | varchar(64)   | Y        | FK     | 参与方。           |
| task_key              | varchar(64)   | Y        | IDX    | 任务键。           |
| iteration_no          | int           | N        |        | 迭代轮次。         |
| coalition_before      | jsonb         | Y        |        | 加入前联盟。       |
| v_before              | numeric(18,6) | Y        |        | 加入前效用。       |
| v_after               | numeric(18,6) | Y        |        | 加入后效用。       |
| marginal_contribution | numeric(18,6) | Y        |        | 边际贡献。         |
| seed                  | bigint        | N        |        | 随机种子。         |
| created_at            | timestamp     | Y        |        | 创建时间。         |

### algorithm_audit_snapshot

| **字段**                | **类型**     | **必填** | **键** | **说明**                     |
|-------------------------|--------------|----------|--------|------------------------------|
| snapshot_id             | varchar(64)  | Y        | PK     | 算法审计快照主键。           |
| task_id                 | varchar(64)  | Y        | FK     | MD-DShap 任务。              |
| project_id              | varchar(64)  | Y        | FK     | 项目。                       |
| input_snapshot_json     | jsonb        | Y        |        | 算法输入快照。               |
| parameter_snapshot_json | jsonb        | Y        |        | 算法参数快照。               |
| output_snapshot_json    | jsonb        | Y        |        | 算法输出快照。               |
| assumption_text         | text         | N        |        | 近似假设、复杂度和边界说明。 |
| checksum                | varchar(128) | Y        |        | 快照摘要。                   |
| created_at              | timestamp    | Y        |        | 创建时间。                   |

### allocation_scenario

`db/dvas_p0_01_schema.sql` 当前的 SQL 表字段以 `weight_task_id`、`scenario_name`、`total_revenue`、`priority_allocation_amount`、`data_provider_revenue_pool`、`allocation_mode`、`status`、`version_no` 等为主。下表中标为 DTO/runtime 的字段来自当前 JSON state 或接口响应，不表示当前 PostgreSQL DDL 已有对应列。

| **字段**                   | **类型**      | **必填** | **键** | **说明**                                                                |
|----------------------------|---------------|----------|--------|-------------------------------------------------------------------------|
| allocation_id              | varchar(64)   | Y        | PK     | 分配场景主键。                                                          |
| project_id                 | varchar(64)   | Y        | FK     | 所属项目。                                                              |
| total_revenue              | numeric(18,2) | Y        |        | 总收益，必须 \>=0。                                                     |
| currency                   | varchar(16)   | Y        | DTO/runtime | 币种；当前 SQL DDL 未建该列。                                           |
| contract_ratio_plan_id     | varchar(64)   | N        | DTO/runtime | 引用的运行时合同比例方案；当前 SQL DDL 未建该列和外键。                 |
| non_data_contract_amount   | numeric(18,2) | Y        | DTO/runtime | 非数据主体按合同比例获得的合同金额合计；当前 SQL DDL 未建该列。          |
| data_provider_revenue_pool | numeric(18,2) | Y        |        | 按合同比例划分后，留给数据源主体分配的收益池。                          |
| allocation_mode            | varchar(40)   | Y        | IDX    | SQL 当前为 MD_DSHAP_WEIGHT/CONTRIBUTION/UTILITY/MANUAL；runtime 当前主值映射自 MD_DSHAP_WEIGHT_WITH_CONSTRAINTS。 |
| weight_task_id             | varchar(64)   | N        | FK     | 引用的 MD-DShap 任务。                                                  |
| status                     | varchar(32)   | Y        | IDX    | DRAFT/ALLOCATED/CONFIRMED/EXPORTED。                                    |
| locked_by                  | varchar(64)   | N        |        | 锁定人。                                                                |
| locked_at                  | timestamp     | N        |        | 锁定时间。                                                              |
| version_no                 | int           | Y        | IDX    | 分配版本。                                                              |

### contract_ratio_plan（运行时 JSON 对象，PostgreSQL 预留）

当前 `db/dvas_p0_01_schema.sql` 未创建该表。项目级合同比例方案由运行时 `contract_ratio_plans` 保存，并通过 `/projects/{project_id}/allocation/contract-ratio` 读写。PostgreSQL 正式落表时可采用下列字段。

| **字段**                   | **类型**      | **必填** | **键** | **说明**                              |
|----------------------------|---------------|----------|--------|---------------------------------------|
| plan_id                    | varchar(64)   | Y        | PK     | 合同比例方案主键。                    |
| project_id                 | varchar(64)   | Y        | FK     | 所属项目。                            |
| total_revenue              | numeric(18,2) | Y        |        | 保存方案时使用的总收益。              |
| currency                   | varchar(16)   | Y        |        | 币种。                                |
| data_provider_pool_ratio   | numeric(18,6) | Y        |        | 数据源收益池比例。                    |
| ratio_sum                  | numeric(18,6) | Y        |        | 数据源收益池比例 + 非数据主体比例合计。 |
| data_provider_revenue_pool | numeric(18,2) | Y        |        | 数据源收益池金额。                    |
| status                     | varchar(32)   | Y        | IDX    | EMPTY/SAVED/LOCKED。                  |
| version_no                 | int           | Y        | IDX    | 方案版本。                            |

### contract_ratio_item（运行时 JSON 对象，PostgreSQL 预留）

当前 `db/dvas_p0_01_schema.sql` 未创建该表。非数据主体合同比例项和数据源收益池比例项由运行时 `contract_ratio_items` 保存；下表为后续正式库映射建议。

| **字段**          | **类型**      | **必填** | **键** | **说明**                                           |
|-------------------|---------------|----------|--------|----------------------------------------------------|
| item_id           | varchar(64)   | Y        | PK     | 合同比例项主键。                                   |
| plan_id           | varchar(64)   | Y        | FK     | 合同比例方案。                                     |
| project_id        | varchar(64)   | Y        | FK     | 所属项目。                                         |
| bucket_type       | varchar(32)   | Y        | IDX    | DATA_PROVIDER_POOL 或 NON_DATA_PARTY。             |
| party_id          | varchar(64)   | N        | FK     | 非数据主体；数据源收益池行为空。                   |
| party_name        | varchar(200)  | Y        |        | 展示名称，保存时从 party 或数据源收益池派生。      |
| party_type        | varchar(40)   | N        |        | 非数据主体类型。                                   |
| ratio             | numeric(18,6) | Y        |        | 合同比例。                                         |
| calculated_amount | numeric(18,2) | Y        |        | 后端按 total_revenue × ratio 计算的金额。          |
| amount_source     | varchar(40)   | Y        |        | DATA_PROVIDER_POOL 行为 MD_DSHAP_WEIGHT，非数据主体行为 CONTRACT_RATIO。 |
| basis_text        | text          | N        |        | 依据说明。                                         |
| sort_no           | int           | Y        |        | 展示排序。                                         |

### contract_constraint（PostgreSQL 已落表，旧约束兼容）

| **字段**         | **类型**      | **必填** | **键** | **说明**                                                                        |
|------------------|---------------|----------|--------|---------------------------------------------------------------------------------|
| constraint_id    | varchar(64)   | Y        | PK     | 旧约束兼容主键；不作为合同分配规则页主表。                                      |
| project_id       | varchar(64)   | Y        | FK     | 所属项目。                                                                      |
| party_id         | varchar(64)   | Y        | FK     | 约束对象。                                                                      |
| constraint_name  | varchar(200)  | Y        |        | 约束名称。                                                                      |
| constraint_type  | varchar(40)   | Y        | IDX    | runtime 使用 MIN_AMOUNT/MAX_AMOUNT/CAP_AMOUNT/FLOOR_AMOUNT/FIXED_RATIO/PRIORITY_ALLOCATION；SQL DDL 对应为 MIN_AMOUNT/MAX_AMOUNT/CAP_AMOUNT/FLOOR_AMOUNT/FIXED_RATIO/PRIORITY_AMOUNT。 |
| value_type       | varchar(16)   | Y        |        | AMOUNT/RATIO。                                                                  |
| constraint_value | numeric(18,6) | Y        |        | 约束值。                                                                        |
| priority         | int           | Y        | IDX    | 处理顺序。                                                                      |
| status           | varchar(32)   | Y        | IDX    | ACTIVE/DISABLED。                                                               |
| description      | text          | N        |        | 说明。                                                                          |
| version_no       | int           | Y        |        | 约束版本。                                                                      |

### allocation_result

| **字段**                     | **类型**      | **必填** | **键** | **说明**                 |
|------------------------------|---------------|----------|--------|--------------------------|
| result_id                    | varchar(64)   | Y        | PK     | 收益分配结果主键。       |
| allocation_id                | varchar(64)   | Y        | FK     | 分配场景。               |
| project_id                   | varchar(64)   | Y        | FK     | 所属项目。               |
| party_id                     | varchar(64)   | Y        | FK     | 参与方。                 |
| subject_track                | varchar(40)   | N        | DTO/快照 | DATA_PROVIDER_POOL 或 CONTRACT_RATIO。 |
| amount_source                | varchar(40)   | Y        |        | CONTRACT_RATIO 或 MD_DSHAP_WEIGHT。 |
| contract_ratio               | numeric(18,6) | N        |        | 非数据主体合同比例；数据源主体为空。 |
| base_pool_amount             | numeric(18,2) | Y        |        | 计算该主体金额使用的基础金额池。 |
| raw_weight                   | numeric(18,6) | Y        |        | 原始权重。               |
| normalized_weight            | numeric(18,6) | Y        |        | 归一化权重。             |
| pre_constraint_amount        | numeric(18,2) | Y        |        | P0 合同比例路径下等于最终模拟前金额。 |
| post_constraint_amount       | numeric(18,2) | Y        |        | P0 合同比例路径下等于最终金额。 |
| final_amount                 | numeric(18,2) | Y        |        | 最终模拟参考金额。       |
| constraint_adjustment_reason | text          | N        |        | 金额来源或尾差说明。     |
| rounding_delta               | numeric(18,2) | N        |        | 尾差。                   |
| final_status                 | varchar(32)   | Y        |        | RESULT/ADJUSTED/LOCKED。 |

### constraint_apply_trace（PostgreSQL 已落表，旧约束兼容）

| **字段**          | **类型**      | **必填** | **键** | **说明**              |
|-------------------|---------------|----------|--------|-----------------------|
| trace_id          | varchar(64)   | Y        | PK     | 约束执行 trace 主键。 |
| allocation_id     | varchar(64)   | Y        | FK     | 分配场景。            |
| constraint_id     | varchar(64)   | N        | FK     | 合同约束。            |
| party_id          | varchar(64)   | Y        | FK     | 参与方。              |
| before_amount     | numeric(18,2) | Y        |        | 调整前金额。          |
| after_amount      | numeric(18,2) | Y        |        | 调整后金额。          |
| adjustment_amount | numeric(18,2) | Y        |        | 调整额。              |
| reason            | text          | Y        |        | 调整原因。            |
| step_no           | int           | Y        |        | 处理步骤。            |

## 7.5 报告、审计与参数表

### report_record

| **字段**           | **类型**     | **必填** | **键** | **说明**                                                                  |
|--------------------|--------------|----------|--------|---------------------------------------------------------------------------|
| report_id          | varchar(64)  | Y        | PK     | 报告记录主键。                                                            |
| project_id         | varchar(64)  | Y        | FK     | 所属项目。                                                                |
| report_type        | varchar(40)  | Y        | IDX    | QUALITY/SHUYUAN/UTILITY/MD_DSHAP/ALLOCATION/AUDIT/CONFIRMATION/MANIFEST。 |
| file_name          | varchar(255) | Y        |        | 文件名。                                                                  |
| file_format        | varchar(16)  | Y        |        | MD/CSV/JSON/JSONL/PDF。                                                   |
| file_path          | varchar(500) | Y        |        | 文件路径。                                                                |
| checksum           | varchar(128) | Y        |        | 文件摘要。                                                                |
| source_snapshot_id | varchar(64)  | N        | FK     | 引用快照。                                                                |
| created_by         | varchar(64)  | Y        |        | 导出人。                                                                  |
| created_at         | timestamp    | Y        |        | 导出时间。                                                                |

### export_file

| **字段**         | **类型**     | **必填** | **键** | **说明**                                                |
|------------------|--------------|----------|--------|---------------------------------------------------------|
| file_id          | varchar(64)  | Y        | PK     | 导出文件主键。                                          |
| report_id        | varchar(64)  | Y        | FK     | 所属报告。                                              |
| file_name        | varchar(255) | Y        |        | 文件名。                                                |
| file_type        | varchar(40)  | Y        |        | ALLOCATION_RESULT/SOURCE_LEVEL/MDS_TRACE/AUDIT_LOG 等。 |
| field_scope_json | jsonb        | Y        |        | 导出字段范围。                                          |
| checksum         | varchar(128) | Y        |        | 文件摘要。                                              |
| created_at       | timestamp    | Y        |        | 创建时间。                                              |

### audit_log

| **字段**              | **类型**    | **必填** | **键** | **说明**                                                     |
|-----------------------|-------------|----------|--------|--------------------------------------------------------------|
| log_id                | varchar(64) | Y        | PK     | 审计日志主键。                                               |
| project_id            | varchar(64) | N        | FK     | 所属项目；系统级日志可为空。                                 |
| module_code           | varchar(32) | Y        | IDX    | 按更新后的模块编码记录。                                     |
| menu_code             | varchar(64) | N        | IDX    | 所属菜单编码。                                               |
| operation_type        | varchar(32) | Y        | IDX    | CREATE/UPDATE/DELETE/DISABLE/CALCULATE/EXPORT/CONFIRM/VIEW。 |
| object_type           | varchar(64) | Y        |        | 对象类型。                                                   |
| object_id             | varchar(64) | N        |        | 对象 ID。                                                    |
| operator_id           | varchar(64) | Y        |        | 操作人。                                                     |
| before_value_json     | jsonb       | N        |        | 修改前值。                                                   |
| after_value_json      | jsonb       | N        |        | 修改后值。                                                   |
| input_snapshot_id     | varchar(64) | N        | FK     | 输入快照。                                                   |
| parameter_snapshot_id | varchar(64) | N        | FK     | 参数快照。                                                   |
| result_snapshot_id    | varchar(64) | N        | FK     | 结果快照。                                                   |
| status                | varchar(32) | Y        | IDX    | SUCCESS/FAILED。                                             |
| failure_reason        | text        | N        |        | 失败原因。                                                   |
| created_at            | timestamp   | Y        | IDX    | 创建时间。                                                   |

### snapshot_store

| **字段**      | **类型**     | **必填** | **键** | **说明**                                        |
|---------------|--------------|----------|--------|-------------------------------------------------|
| snapshot_id   | varchar(64)  | Y        | PK     | 通用快照主键。                                  |
| project_id    | varchar(64)  | N        | FK     | 所属项目。                                      |
| snapshot_type | varchar(40)  | Y        | IDX    | INPUT/PARAMETER/RESULT/REPORT/ALGORITHM_AUDIT。 |
| object_type   | varchar(64)  | Y        |        | 对象类型。                                      |
| object_id     | varchar(64)  | Y        |        | 对象 ID。                                       |
| content_json  | jsonb        | Y        |        | 快照内容。                                      |
| checksum      | varchar(128) | Y        |        | 快照摘要。                                      |
| created_by    | varchar(64)  | Y        |        | 创建人。                                        |
| created_at    | timestamp    | Y        |        | 创建时间。                                      |

### system_parameter

| **字段**       | **类型**     | **必填** | **键** | **说明**                                                |
|----------------|--------------|----------|--------|---------------------------------------------------------|
| parameter_id   | varchar(64)  | Y        | PK     | 系统参数主键。                                          |
| parameter_code | varchar(100) | Y        | UK     | 参数编码。                                              |
| parameter_name | varchar(200) | Y        |        | 参数名称。                                              |
| parameter_type | varchar(40)  | Y        |        | QUALITY_WEIGHT/ALGORITHM/RISK_TEXT/PRECISION/SCENARIO。 |
| default_value  | jsonb        | Y        |        | 默认值。                                                |
| current_value  | jsonb        | Y        |        | 当前值。                                                |
| scope          | varchar(32)  | Y        |        | GLOBAL/PROJECT。                                        |
| is_editable    | boolean      | Y        |        | 是否可编辑。                                            |
| version_no     | int          | Y        |        | 当前版本。                                              |
| updated_at     | timestamp    | Y        |        | 更新时间。                                              |

### parameter_version

| **字段**       | **类型**    | **必填** | **键** | **说明**               |
|----------------|-------------|----------|--------|------------------------|
| version_id     | varchar(64) | Y        | PK     | 参数版本主键。         |
| parameter_id   | varchar(64) | Y        | FK     | 系统参数。             |
| project_id     | varchar(64) | N        | FK     | 项目级参数时关联项目。 |
| version_no     | int         | Y        |        | 版本号。               |
| value_json     | jsonb       | Y        |        | 参数值。               |
| effective_from | timestamp   | Y        |        | 生效时间。             |
| created_by     | varchar(64) | Y        |        | 创建人。               |
| created_at     | timestamp   | Y        |        | 创建时间。             |

# 8. 主外键与关系设计

| **主表**                  | **子表**                     | **关系** | **说明**                             |
|---------------------------|------------------------------|----------|--------------------------------------|
| allocation_project        | data_package                 | 1:N      | 一个项目可有多个数据包版本。         |
| allocation_project        | party                        | 1:N      | 一个项目包含多个参与方。             |
| data_package              | data_resource                | 1:N      | 一个数据包包含多个数据资源。         |
| data_resource             | data_resource_field          | 1:N      | 一个资源包含多个字段统计。           |
| data_resource             | data_resource_party_relation | 1:N      | 一个资源可关联多个主体。             |
| party                     | data_resource_party_relation | 1:N      | 一个参与方可关联多个资源。           |
| data_package              | quality_assessment           | 1:N      | 同一数据包可多次评估并形成版本。     |
| quality_assessment        | quality_score_detail         | 1:N      | 一次质量评估包含包级多维度得分明细。 |
| quality_assessment        | quality_resource_assessment  | 1:N      | 一次包级质量评估包含多个资源级评估结果。 |
| data_resource             | quality_resource_assessment  | 1:N      | 一个数据资源可在不同质量评估版本中产生多条资源级结果。 |
| quality_resource_assessment | quality_resource_score_detail | 1:N    | 一次资源级评估包含一级和二级指标明细。 |
| quality_assessment        | shuyuan_metering             | 1:N      | 计量引用质量评估版本。               |
| shuyuan_metering          | shuyuan_metering_detail      | 1:N      | 计量主表聚合明细。                   |
| party                     | contribution_record          | 1:N      | 参与方产生贡献记录。                 |
| party                     | utility_record               | 1:N      | 参与方产生任务级效用。               |
| utility_function_snapshot | utility_record               | 1:N      | 效用记录引用函数快照。               |
| utility_record            | utility_trace                | 1:1      | 效用记录可展开 trace。               |
| allocation_project        | md_dshap_task                | 1:N      | 一个项目可多次执行算法任务。         |
| md_dshap_task             | md_dshap_result              | 1:N      | 一个算法任务输出多个参与方权重。     |
| md_dshap_task             | md_dshap_marginal_trace      | 1:N      | 一个算法任务可保存大量边际贡献明细。 |
| md_dshap_task             | algorithm_audit_snapshot     | 1:1/N    | 算法任务生成审计快照。               |
| allocation_project        | allocation_scenario          | 1:N      | 一个项目可生成多个分配方案版本。     |
| md_dshap_task             | allocation_scenario          | 1:N      | 分配场景可引用某次算法权重。         |
| allocation_project        | contract_ratio_plan          | 1:N      | 一个项目可保存多个合同比例方案版本。 |
| contract_ratio_plan       | contract_ratio_item          | 1:N      | 一个方案包含数据源收益池行和非数据主体行。 |
| contract_ratio_plan       | allocation_scenario          | 1:N      | 分配场景引用执行时的合同比例方案。   |
| allocation_scenario       | allocation_result            | 1:N      | 分配场景输出参与方级分配结果。       |
| contract_constraint       | constraint_apply_trace       | 1:N      | 旧约束兼容路径被执行时产生 trace。   |
| allocation_scenario       | constraint_apply_trace       | 1:N      | 旧约束兼容路径记录约束调整过程。     |
| allocation_project        | report_record                | 1:N      | 一个项目可导出多个报告文件。         |
| report_record             | export_file                  | 1:N      | 一次报告记录可包含多个导出文件。     |
| allocation_project        | audit_log                    | 1:N      | 项目内操作和计算写审计日志。         |
| snapshot_store            | audit_log                    | 1:N      | 日志可引用输入/参数/结果快照。       |
| nav_menu                  | nav_menu                     | 1:N      | 一级导航与二级页面自关联。           |
| nav_menu                  | permission                   | 1:N      | 菜单下定义按钮和动作权限。           |
| role                      | role_permission              | 1:N      | 角色拥有多个权限。                   |
| permission                | role_permission              | 1:N      | 权限可被多个角色引用。               |
| user_account              | user_role                    | 1:N      | 用户可拥有多个角色。                 |
| role                      | user_role                    | 1:N      | 角色可分配给多个用户。               |
| system_parameter          | parameter_version            | 1:N      | 参数修改生成新版本。                 |

# 9. 索引与唯一约束设计

| **表**                       | **索引**                         | **字段**                                          | **唯一** | **用途**                           |
|------------------------------|----------------------------------|---------------------------------------------------|----------|------------------------------------|
| allocation_project           | idx_project_status_created       | status, created_at                                | N        | 项目总览和项目状态筛选。           |
| nav_menu                     | uk_nav_menu_code                 | menu_code                                         | Y        | 保证更新后的导航编码唯一。         |
| nav_menu                     | idx_nav_parent_sort              | parent_id, sort_no                                | N        | 左侧菜单按父级和排序加载。         |
| permission                   | uk_permission_code               | permission_code                                   | Y        | 按钮级权限唯一。                   |
| party                        | uk_party_project_name            | project_id, party_name                            | Y        | 同一项目参与方名称唯一。           |
| party                        | idx_party_type_md                | project_id, party_type, include_in_md_dshap       | N        | 构造 MD-DShap 参与方集合。         |
| data_package                 | idx_package_project_status       | project_id, status                                | N        | 数据接入列表。                     |
| data_resource                | idx_resource_package_modality    | package_id, modality                              | N        | 资源列表和模态筛选。               |
| data_resource_party_relation | uk_resource_party                | resource_id, party_id                             | Y        | 同一资源-主体关系唯一。            |
| quality_assessment           | idx_quality_project_version      | project_id, version_no                            | N        | 质量评估历史版本。                 |
| quality_resource_assessment  | idx_quality_resource_version     | assessment_id, resource_id, version_no             | N        | 资源级质量评估版本查询。             |
| quality_resource_assessment  | uk_quality_resource_assessment   | assessment_id, resource_id                         | Y        | 同一包级评估中每个资源一条主结果。   |
| quality_resource_score_detail | idx_quality_resource_detail      | resource_assessment_id, dimension_code             | N        | 资源级指标明细查询。                 |
| shuyuan_metering             | idx_metering_project_version     | project_id, version_no                            | N        | 数元计量历史版本。                 |
| contribution_record          | idx_contribution_project_party   | project_id, party_id                              | N        | 贡献度结果查询。                   |
| utility_record               | idx_utility_project_party_task   | project_id, party_id, task_key                    | N        | 效用值和任务维度查询。             |
| md_dshap_task                | idx_mds_project_status_mode      | project_id, status, algorithm_mode, created_at    | N        | 算法任务列表。                     |
| md_dshap_result              | uk_mds_result_task_party         | task_id, party_id                                 | Y        | 一个任务中每个主体一条权重结果。   |
| md_dshap_marginal_trace      | idx_mds_trace_task_party         | task_id, party_id, task_key                       | N        | 边际贡献分页筛选。                 |
| contract_ratio_plan          | idx_contract_ratio_project_status | project_id, status, version_no                    | N        | 运行时 JSON 对象的后续 PostgreSQL 预留索引，当前 DDL 未创建。 |
| contract_ratio_item          | idx_contract_ratio_item_plan      | plan_id, bucket_type, party_id                    | N        | 运行时 JSON 对象的后续 PostgreSQL 预留索引，当前 DDL 未创建。 |
| allocation_scenario          | idx_alloc_project_status         | project_id, status, version_no                    | N        | 分配方案列表。                     |
| allocation_result            | uk_alloc_result_party            | allocation_id, party_id                           | Y        | 一个分配场景中每个参与方一条结果。 |
| contract_constraint          | idx_constraint_project_party     | project_id, party_id, status, priority            | N        | 旧约束兼容路径读取。               |
| report_record                | idx_report_project_type_created  | project_id, report_type, created_at               | N        | 报告历史记录。                     |
| audit_log                    | idx_audit_project_module_time    | project_id, module_code, created_at               | N        | 审计日志筛选。                     |
| snapshot_store               | idx_snapshot_project_type_object | project_id, snapshot_type, object_type, object_id | N        | 快照追溯。                         |
| system_parameter             | uk_parameter_code                | parameter_code                                    | Y        | 参数编码唯一。                     |

# 10. 枚举字典设计

| **枚举**        | **建议取值**                                                                                                         | **说明**                                |
|-----------------|----------------------------------------------------------------------------------------------------------------------|-----------------------------------------|
| project_status  | runtime: DRAFT, INGESTED, ASSESSED, METERED, UTILITY_CALCULATED, WEIGHT_CALCULATED, ALLOCATED, CONFIRMED, EXPORTED；SQL 另保留 DISABLED | 项目状态机。 |
| menu_level      | 1, 2                                                                                                                 | 1=一级导航，2=二级功能页面。            |
| menu_status     | ENABLED, DISABLED                                                                                                    | 菜单启用状态。                          |
| action_type     | VIEW, CREATE, UPDATE, DELETE_DISABLE, CALCULATE, EXPORT, CONFIRM                                                     | 按钮/动作权限类型。                     |
| party_type      | DATA_PROVIDER, PILOT_BASE, OPERATOR, TECH_SERVICE, EXPERT_REVIEWER, CONTRACT_PARTY                                   | 参与方类型。                            |
| modality        | TEXT, IMAGE, MEDICAL_IMAGE, AUDIO, STRUCTURED, MIXED                                                                 | 数据模态。                              |
| source_type     | runtime: DEMO, UPLOAD_JSON, CSV_UPLOAD, XLSX_UPLOAD；SQL P0 DDL: DEMO, UPLOAD_JSON                                  | CSV/XLSX 是 P1 本地扩展。               |
| algorithm_mode  | MD_DSHAP, BASIC_SHAPLEY                                                                                              | 默认 MD_DSHAP；BASIC_SHAPLEY 仅作基线。 |
| task_status     | runtime: COMPLETED/FAILED 等；SQL: PENDING, RUNNING, SUCCESS, FAILED, CANCELLED                                      | 通过 `persistence_mapping.py` 映射。     |
| allocation_mode | runtime: MD_DSHAP_WEIGHT_WITH_CONSTRAINTS, CONTRIBUTION, UTILITY, MANUAL；SQL: MD_DSHAP_WEIGHT, CONTRIBUTION, UTILITY, MANUAL | 收益分配模式。 |
| constraint_type | runtime: MIN_AMOUNT, MAX_AMOUNT, CAP_AMOUNT, FLOOR_AMOUNT, FIXED_RATIO, PRIORITY_ALLOCATION；SQL: MIN_AMOUNT, MAX_AMOUNT, CAP_AMOUNT, FLOOR_AMOUNT, FIXED_RATIO, PRIORITY_AMOUNT | 合同约束类型。 |
| value_type      | AMOUNT, RATIO                                                                                                        | 金额或比例值类型。                      |
| report_type     | runtime: P0_MARKDOWN_REPORT/P0_CSV_EXPORT/P0_JSON_EXPORT/P0_AUDIT_LOG_EXPORT/MD_DSHAP_AUDIT_REPORT/P1_PDF_REPORT 等 | 报告类型。 |
| snapshot_type   | runtime: INPUT, PARAMETER, RESULT, REPORT, ALGORITHM, ALGORITHM_AUDIT, ALLOCATION, ASSUMPTION, OTHER；SQL DDL 不含 ALGORITHM_AUDIT，映射为 ALGORITHM | 快照类型。 |
| operation_type  | CREATE, UPDATE, DELETE, DISABLE, CALCULATE, EXPORT, CONFIRM, LOGIN, VIEW                                             | 审计操作类型。                          |
| result_status   | SUCCESS, FAILED                                                                                                      | 日志和导出结果状态。                    |

# 11. 按钮与数据库副作用映射

本章用于保证新的导航页面、按钮、数据库写入和审计记录可以反向追溯。

| **页面**             | **按钮/功能**                  | **主要写入表**                                                                                                | **日志/快照**             | **状态变化**              |
|----------------------|--------------------------------|---------------------------------------------------------------------------------------------------------------|---------------------------|---------------------------|
| 项目总览             | SYS-002 选择演示数据           | allocation_project, data_package, input_snapshot                                                              | audit_log                 | 草稿/无数据 -\> 已接入    |
| 一键计算             | SYS-004 启动完整计算           | quality_assessment, shuyuan_metering, contribution_record, utility_record, md_dshap_task, allocation_scenario | audit_log, snapshot_store | 按阶段推进至已分配        |
| 数据接入管理         | DATA-003 上传 JSON 输入文件    | data_package, input_snapshot, upload_validation_result                                                        | audit_log                 | 无数据 -\> 已接入         |
| 数据资源管理         | RES-005 数据源主体关联         | data_resource_party_relation                                                                                  | audit_log                 | 已接入 -\> 可评估         |
| 参与方管理           | PARTY-002/003/005              | party, data_resource_party_relation                                                                           | audit_log                 | 有效/停用                 |
| 质量评估管理         | QUAL-003 启动质量评估          | SQL: quality_assessment, quality_score_detail；runtime JSON: quality_resource_assessments, quality_resource_score_details | audit_log, snapshot_store | 已接入 -\> 已评估 |
| 质量评估管理         | 资源级质量结果读取             | runtime JSON: quality_resource_assessments, quality_resource_score_details                                      | 只读，无新增审计要求       | 状态不变                  |
| 质量评估管理         | 资源级质量导出                 | 当前无独立 P0 导出接口                                                                                         | 无成功导出日志             | 禁用/待接入               |
| 数元计量管理         | DU-009 执行数元计量            | shuyuan_metering, shuyuan_metering_detail                                                                     | audit_log, snapshot_store | 已评估 -\> 已计量         |
| 贡献度与效用计算     | UTIL-006/008 计算贡献度/效用值 | contribution_record, utility_record, utility_trace                                                            | audit_log, snapshot_store | 已计量 -\> 已计算效用     |
| MD-DShap 计算管理    | MDS-011 启动计算               | md_dshap_task, md_dshap_result, md_dshap_marginal_trace, algorithm_audit_snapshot                             | audit_log, snapshot_store | 已计算效用 -\> 已计算权重 |
| 合同分配规则         | CONS-002/003 保存方案          | runtime JSON: contract_ratio_plans, contract_ratio_items                                                       | audit_log, snapshot_store | 未配置 -\> 已保存         |
| 收益分配模拟         | ALLOC-011 执行模拟             | SQL/runtime: allocation_scenario, allocation_result；runtime 引用 contract_ratio_plan_id                       | audit_log, snapshot_store | 已计算权重 -\> 已分配     |
| 收益分配模拟         | ALLOC-015 锁定方案             | allocation_scenario                                                                                           | audit_log                 | 已分配 -\> 已确认         |
| 报告生成与导出       | REP-002/004/005 导出           | report_record, export_file                                                                                    | audit_log, snapshot_store | 已分配/已确认 -\> 已导出  |
| 参数配置             | PARAM-004/008 保存参数         | system_parameter, parameter_version                                                                           | audit_log                 | 参数版本化                |
| 用户与权限管理（P1） | USER-002/005/007/010/011/009 用户、密码与权限 | user_account, role, permission, user_role, role_permission                                                    | audit_log，不记录明文密码或 password_hash | P1 RBAC；禁用、重置、本人改密和一次性密码展示 |
| 审计日志管理         | AUD-002/006/007 查询/导出日志  | audit_log, snapshot_store, report_record                                                                      | audit_log                 | 只读追溯                  |

# 12. 报告导出字段与数据来源映射

P0 真实导出由 `ReportService` 生成，每次写 `report_record`、`export_file`、报告快照和 checksum。下表只列当前后端实际会生成的文件；未实现文件标为禁用或 P1。

| **文件名** | **数据来源** | **格式** | **字段/章节清单** | **当前阶段** |
|------------|--------------|----------|-------------------|--------------|
| allocation_summary.md | project、data_package、data_resource、party、quality_assessment、shuyuan_metering、utility_record、md_dshap_task/result、allocation_scenario/result、runtime contract_ratio objects | Markdown | 项目概览、模拟参考声明、数据包与资源摘要、质量摘要、数元摘要、贡献效用摘要、MD-DShap 权重摘要、合同比例/旧约束兼容摘要、分配结果、审计说明 | P0 |
| source_level_allocation.csv | allocation_result、allocation_scenario、party | CSV | allocation_id, project_id, scenario_id, party_id, party_name, party_type, is_data_provider, raw_weight, normalized_weight, contract_ratio, base_pool_amount, pre_constraint_amount, post_constraint_amount, final_amount, amount_source, constraint_adjustment_reason | P0 |
| allocation_result.csv | allocation_result、allocation_scenario、party | CSV | 与 `source_level_allocation.csv` 同字段，作为分配结果别名文件 | P0 |
| quality_assessment_summary.csv | quality_assessment | CSV | assessment_id, quality_score, quality_level, quality_factor, output_snapshot_id；仅当存在质量评估时生成 | P0 条件生成 |
| shuyuan_metering_detail.csv | shuyuan_metering、shuyuan_metering_detail | CSV | metering_id, resource_id, party_id, party_name, valid_units, metering_amount；仅当存在计量明细时生成 | P0 条件生成 |
| md_dshap_weights.csv | md_dshap_task、md_dshap_result | CSV | task_id, party_id, party_name, participant_weight, normalized_weight, baseline_weight, weight_diff；仅当存在权重结果时生成 | P0 条件生成 |
| constraint_apply_trace.csv | constraint_apply_trace | CSV | allocation_id, constraint_id, party_id, before_amount, after_amount, adjustment_amount, reason, version_no；只在旧约束兼容路径有普通约束 trace 时生成 | P0 条件生成 |
| allocation_result.json | allocation_scenario/result、runtime contract_ratio objects、quality/shuyuan/utility/md_dshap 结果、snapshot_store | JSON | project_id, allocation_id, contract_ratio_plan, contract_ratio_items, priority_allocation, data_provider_revenue_pool, weight_source, results, constraints, snapshot refs, quality_result, metering_result, utility_result, md_dshap_result, allocation_summary, assumptions, disclaimer | P0 |
| md_dshap_audit_report.md | md_dshap_task/result/marginal_trace、utility_record/trace、snapshot refs | Markdown | algorithm_mode, algorithm_version, task_set, parameters, utility source, participant set, weights, marginal trace summary, snapshot refs, checksum note | P0 |
| md_dshap_audit_report.json | md_dshap_task/result/marginal_trace、utility_record/trace、snapshot refs | JSON | 与 Markdown 审计说明同源的结构化 payload | P0 |
| audit_log.jsonl | audit_log、report_record、export_file | JSONL | record_type, log/report/export fields, status, failure_reason, checksum | P0 |
| p1_simulation_reference_report.pdf | Markdown 报告内容、report_record、export_file、report_manifest runtime object | PDF | 模拟参考报告摘要、英文和中文免责声明、manifest | P1 本地扩展 |
| resource_quality_assessment_result.json / resource_quality_assessment.csv | runtime quality resource objects | JSON/CSV | 当前后端没有独立资源质量导出接口 | 禁用/待接入 |
| allocation_confirmation_statement.md | allocation_scenario/result | Markdown | 当前后端没有确认书专用导出接口 | 禁用/待接入 |
| assumptions.json | snapshot_store/system_parameter | JSON | 当前后端没有独立 assumptions 导出接口；assumptions 在 `allocation_result.json` 内嵌 | 禁用/待接入 |

# 13. 快照、版本与审计策略

| **策略项**   | **数据库实现**                                                           | **规则**                                                                              |
|--------------|--------------------------------------------------------------------------|---------------------------------------------------------------------------------------|
| 输入快照     | input_snapshot + snapshot_store(snapshot_type=INPUT)                     | 演示数据初始化、JSON 上传、复制新版本时生成；后续计算引用 checksum。                  |
| 参数快照     | snapshot_store(snapshot_type=PARAMETER) + parameter_version + runtime business_drafts | 质量权重、数元系数、贡献因子、效用函数、MD-DShap 参数、收益池、合同比例方案在计算前固化；部分草稿当前仅在 JSON state。 |
| 结果快照     | snapshot_store(snapshot_type=RESULT)                                     | 每次质量评估、计量、效用、算法、分配成功后生成；报告只消费结果快照。                  |
| 算法审计快照 | runtime: algorithm_audit_snapshot + snapshot_store(snapshot_type=ALGORITHM_AUDIT)；SQL DDL: algorithm_audit_snapshot + snapshot_store(snapshot_type=ALGORITHM) | 保存参与方集合、任务集合、v(S,t)、参数、输出、近似说明、算法版本。 |
| 报告快照     | report_record + export_file + snapshot_store(snapshot_type=REPORT)       | 每次导出生成 report_id、file_path、checksum，不得静默覆盖。                           |
| 审计日志     | audit_log                                                                | 新增、编辑、删除/停用、计算、导出、确认等高风险操作必须记录 before/after 和快照 ID。  |
| 导航审计     | audit_log.menu_code + audit_log.module_code                              | 本次更新后，日志可按新导航二级页面筛选。                                              |

# 14. MD-DShap 与收益分配存储模型

MD-DShap 是默认权重计算策略。数据库设计将算法任务、算法结果、边际贡献 trace 和算法审计快照拆分存储，避免算法明细污染收益分配结果表。

| **对象**   | **表**                                       | **关键字段**                                                                              | **说明**                                                           |
|------------|----------------------------------------------|-------------------------------------------------------------------------------------------|--------------------------------------------------------------------|
| 算法任务   | md_dshap_task                                | algorithm_mode, participant_set_json, task_set_json, seed, sample_rounds, epsilon, status | 默认 algorithm_mode=MD_DSHAP；基础 Shapley 仅作 baseline_enabled。 |
| 参与方权重 | md_dshap_result                              | participant_weight, normalized_weight, baseline_weight, weight_diff                       | 数据源主体进入收益分配模拟的权重来源；非数据源主体不进入。         |
| 边际贡献   | md_dshap_marginal_trace                      | coalition_before, v_before, v_after, marginal_contribution                                | 用于算法审计和复杂度说明。                                         |
| 算法审计   | algorithm_audit_snapshot                     | input_snapshot_json, parameter_snapshot_json, output_snapshot_json, assumption_text       | 导出 md_dshap_audit_report.md 的核心来源。                         |
| 合同分配规则 | runtime JSON: contract_ratio_plan + contract_ratio_item；PostgreSQL 预留 | total_revenue, data_provider_pool_ratio, ratio_sum, calculated_amount, amount_source      | 先将总收益划分为非数据主体合同金额与数据源收益池；当前 DDL 未建该两张表。 |
| 收益分配   | allocation_scenario + allocation_result；部分合同比例字段来自 runtime DTO | total_revenue, non_data_contract_amount, data_provider_revenue_pool, amount_source, contract_ratio, base_pool_amount, final_amount | 数据源主体按数据源收益池 × MD-DShap normalized_weight 分配。       |
| 合同约束   | contract_constraint + constraint_apply_trace | constraint_type, constraint_value, before_amount, after_amount, reason                    | 旧约束兼容路径保留，不作为 P0 合同分配规则页主流程。               |

收益分配金额公式：

```text
contract_ratio_sum = data_provider_pool_ratio + sum(non_data_party_ratio_j)
non_data_contract_amount_j = total_revenue × non_data_party_ratio_j
data_provider_revenue_pool = total_revenue × data_provider_pool_ratio
data_provider_amount_i = data_provider_revenue_pool × md_dshap_normalized_weight_i
```

约束条件：`contract_ratio_sum = 1.000000`、`data_provider_revenue_pool >= 0`、`sum(md_dshap_normalized_weight_i) = 1`。

# 15. PostgreSQL 参考 DDL 与初始化数据

完整 PostgreSQL 参考 DDL 以 `db/` 目录真实文件为准：`db/dvas_p0_01_schema.sql`、`db/dvas_p0_02_seed.sql`、`db/dvas_p0_03_demo_data.sql`、`db/dvas_p0_04_validation.sql` 和 `db/dvas_p0_er.mmd`。根目录旧 SQL 文件名只作为历史说明，不作为当前审计依据。

| **一级导航**   | **二级页面**         | **menu_code**        | **module_code** | **route_path**          | **阶段** |
|----------------|----------------------|----------------------|-----------------|-------------------------|----------|
| 系统首页       | 无；页面内部区块     | NAV_SYS_HOME         | SYS             | /dashboard              | P0       |
| 数据管理       | 数据接入管理         | NAV_DATA_PACKAGE     | DATA            | /data/ingestion         | P0       |
| 数据管理       | 数据资源管理         | NAV_DATA_RESOURCE    | RES             | /data/resources         | P0       |
| 数据管理       | 参与方管理           | NAV_DATA_PARTY       | PARTY           | /data/parties           | P0       |
| 数元贡献度计量 | 质量评估管理         | NAV_MEASURE_QUALITY  | QUAL            | /metering/quality       | P0       |
| 数元贡献度计量 | 数元计量管理         | NAV_MEASURE_SHUYUAN  | DU              | /metering/shuyuan       | P0       |
| 数元贡献度计量 | 贡献度与效用计算     | NAV_MEASURE_UTILITY  | UTIL            | /metering/utility       | P0       |
| 收益分配计算   | MD-DShap 计算管理    | NAV_ALLOC_MDS        | MDS             | /allocation/md-dshap    | P0       |
| 收益分配计算   | 收益分配模拟         | NAV_ALLOC_SIMULATION | ALLOC           | /allocation/simulation  | P0       |
| 收益分配计算   | 合同分配规则         | NAV_ALLOC_CONSTRAINT | CONS            | /allocation/constraints | P0       |
| 报告生成与导出 | 报告生成与导出       | NAV_REPORT_EXPORT    | REP             | /reports                | P0/P1    |
| 系统管理       | 参数配置             | NAV_SYSTEM_PARAMETER | PARAM           | /system/parameters      | P0       |
| 系统管理       | 用户与权限管理（P1） | NAV_SYSTEM_USER      | USER            | /system/users           | P1       |
| 系统管理       | 审计日志管理         | NAV_SYSTEM_AUDIT     | AUD             | /system/audit           | P0       |

# 16. P0/P1 数据库实施边界

| **能力** | **P0 数据库要求**                                                 | **P1 数据库要求**                                                 |
|----------|-------------------------------------------------------------------|-------------------------------------------------------------------|
| 用户权限 | 可不强制登录，但保留 local_operator、nav_menu、permission 设计。  | 启用 user_account、role、permission、user_role、role_permission。 |
| 输入格式 | 演示数据和 JSON 输入，生成 input_snapshot。                       | 扩展 CSV/XLSX 模板导入和批量校验结果。                            |
| 计算执行 | 同步执行演示规模计算，保存每阶段结果和审计日志。                  | 支持异步任务、任务队列、进度和取消状态。                          |
| 报告导出 | Markdown、CSV、JSON、JSONL，必须写 report_record 和 export_file。 | PDF 模板、历史报告管理和权限控制。                                |
| 算法模型 | 默认 MD-DShap，基础 Shapley 仅作基线校验。                        | 更多采样参数、收敛状态、复杂度统计和异步进度。                    |
| 数据库   | 当前默认本地 JSON state；`db/` 是 PostgreSQL 验收/参考 schema，字段通过 `persistence_mapping.py` 映射。 | 正式 PostgreSQL 写入、索引优化、权限审计、历史归档，并补齐当前 runtime 预留对象表。 |

# 17. 结论

本次数据库设计更新按当前代码区分运行时 JSON state、PostgreSQL 验收 DDL 和后续正式库预留对象。系统首页、数据管理、数元贡献度计量、收益分配计算、报告生成与导出、系统管理六类入口已映射到 nav_menu、permission、module_code、route_path、audit_log.menu_code 和 ER 图分组。业务数据链路仍是“数据接入 -\> 数据资源/参与方 -\> 质量评估 -\> 数元计量 -\> 贡献效用 -\> MD-DShap -\> 合同分配规则 -\> 收益分配 -\> 报告导出 -\> 审计追溯”；当前 P0 合同页以运行时 `contract_ratio_plans` / `contract_ratio_items` 为主，旧 `contract_constraint` / `constraint_apply_trace` 仅作为兼容路径。
