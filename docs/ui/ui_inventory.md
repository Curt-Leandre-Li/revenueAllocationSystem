# DVAS UI Inventory

## Page Inventory

| 一级导航 | 二级页面 | route_path | module_code | 核心区块 | 页面主对象 | 核心按钮 | 页面状态 | 截图 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 系统首页 | 系统首页 | /dashboard | SYS | 项目总览、流程入口、风险提示、一键计算 | allocation_project, audit_log, report_record | SYS-002, DATA-003, SYS-004, REP-001, SYS-005, AUD-006 | 正常、空状态、前置条件未满足、计算中、失败、已导出 | docs/ui/screenshots/pages/01_system_home.png |
| 数据管理 | 数据接入管理 | /data/ingestion | DATA | 数据包列表、JSON 上传、校验结果、失败详情、输入快照 | data_package, input_snapshot, upload_validation_result | DATA-002, DATA-003, DATA-007, DATA-008, DATA-009 | 正常、空状态、前置条件未满足、失败、已导出 | docs/ui/screenshots/pages/02_data_ingestion.png |
| 数据管理 | 数据资源管理 | /data/resources | RES | 资源列表、字段统计、模态标签、数据源主体关联、资源摘要导出 | data_resource, data_resource_field, data_resource_party_relation | RES-002, RES-005, RES-007 | 正常、空状态、前置条件未满足、已锁定、已导出 | docs/ui/screenshots/pages/03_data_resources.png |
| 数据管理 | 参与方管理 | /data/parties | PARTY | 参与方列表、主体类型、算法集合标记、合同主体标记、贡献结果摘要 | party, data_resource_party_relation | PARTY-002, PARTY-003, PARTY-005, PARTY-006, PARTY-008 | 正常、空状态、前置条件未满足、已锁定 | docs/ui/screenshots/pages/04_data_parties.png |
| 数元贡献度计量 | 质量评估管理 | /metering/quality | QUAL | 指标权重、前置条件检查、质量评分、证据说明、低质量提示 | quality_assessment, quality_score_detail, parameter_version | QUAL-002, QUAL-003, QUAL-006, QUAL-009 | 正常、前置条件未满足、计算中、失败、已锁定 | docs/ui/screenshots/pages/05_measure_quality.png |
| 数元贡献度计量 | 数元计量管理 | /metering/shuyuan | DU | 基准价、调用量、系数配置、计量明细、参数版本 | shuyuan_metering, shuyuan_metering_detail | DU-002, DU-003, DU-009, DU-010 | 正常、前置条件未满足、计算中、失败、已导出 | docs/ui/screenshots/pages/06_measure_shuyuan.png |
| 数元贡献度计量 | 贡献度与效用计算 | /metering/utility | UTIL | 贡献因子、归一化贡献、效用函数、效用值、Trace 面板 | contribution_record, utility_function_snapshot, utility_record, utility_trace | UTIL-001, UTIL-006, UTIL-007, UTIL-008, UTIL-009 | 正常、前置条件未满足、计算中、失败、已导出 | docs/ui/screenshots/pages/07_measure_utility.png |
| 收益分配计算 | MD-DShap 计算管理 | /allocation/md-dshap | MDS | 算法模式、参与方集合、前置条件检查、边际贡献、权重表、算法审计快照 | md_dshap_task, md_dshap_result, md_dshap_marginal_trace, algorithm_audit_snapshot | MDS-011, MDS-012, MDS-013, MDS-014, MDS-015, MDS-016, MDS-017, MDS-018 | 正常、前置条件未满足、计算中、失败、已锁定、已导出 | docs/ui/screenshots/pages/08_allocation_md_dshap.png |
| 收益分配计算 | 合同分配规则 | /allocation/constraints | CONS | 总收益、数据源主体收益池比例、非数据主体比例项、比例合计、可模拟状态 | runtime contract_ratio_plan, contract_ratio_item | CONS-002, CONS-003, CONS-004, CONS-011 | 正常、空状态、失败、已锁定、已导出 | docs/ui/screenshots/pages/10_allocation_constraints.png |
| 收益分配计算 | 收益分配模拟 | /allocation/simulation | ALLOC | 已保存合同比例方案、数据源收益池、MD-DShap 权重分配、金额来源、方案对比 | allocation_scenario, allocation_result, runtime contract_ratio_plan/items | ALLOC-011, ALLOC-013, ALLOC-015, ALLOC-016 | 正常、前置条件未满足、计算中、失败、已锁定、已导出 | docs/ui/screenshots/pages/09_allocation_simulation.png |
| 报告生成与导出 | 报告生成与导出 | /reports | REP | 报告预览、导出记录、文件清单、字段范围、P1 PDF 生成与下载状态 | report_record, export_file, snapshot_store, runtime report_manifest | REP-001, REP-002, REP-003, REP-004, REP-005, REP-006, REP-009 | 正常、前置条件未满足、失败、已锁定、已导出 | docs/ui/screenshots/pages/11_reports_export.png |
| 系统管理 | 参数配置 | /system/parameters | PARAM | 场景系数、质量权重模板、MD-DShap 参数、风险提示文案、参数版本 | system_parameter, parameter_version | PARAM-001, PARAM-002, PARAM-004, PARAM-008 | 正常、前置条件未满足、失败、已锁定 | docs/ui/screenshots/pages/12_system_parameters.png |
| 系统管理 | 用户与权限管理（P1） | /system/users | USER | P1 能力边界、用户列表、角色权限矩阵、按钮权限、当前用户说明 | user_account, role, permission, user_role, role_permission | USER-001, USER-002, USER-003, USER-004, USER-005, USER-007, USER-008, USER-009, USER-010, USER-011 | P1 本地启用、权限不足、正常、失败 | docs/ui/screenshots/pages/13_system_users_p1.png |
| 系统管理 | 审计日志管理 | /system/audit | AUD | 日志查询、计算 Trace、输入快照、参数快照、输出快照、导出记录 | audit_log, snapshot_store, report_record | AUD-002, AUD-006, AUD-007 | 正常、空状态、失败、已导出 | docs/ui/screenshots/pages/14_system_audit.png |

## State Coverage

页面设计统一覆盖正常、空状态、前置条件未满足、计算中、失败、已锁定、已导出。P1 页面额外覆盖本地 P1 启用、权限不足和不可用说明。
