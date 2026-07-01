# DVAS Page Structure Notes

## 系统首页

- 导航：系统首页
- 路由：/dashboard
- 数据库映射：NAV_SYS_HOME / SYS / allocation_project, audit_log, report_record
- 核心区块：项目总览、流程入口、风险提示、一键计算
- 核心按钮：选择演示数据、上传 JSON 输入文件、继续计算：启动 MD-DShap 权重计算、报告预览、查看系统风险提示、查看日志详情
- 页面状态：正常、空状态、前置条件未满足、计算中、失败、已导出
- 截图：docs/ui/screenshots/pages/01_system_home.png

## 数据接入管理

- 导航：数据管理
- 路由：/data/ingestion
- 数据库映射：NAV_DATA_PACKAGE / DATA / data_package, input_snapshot, upload_validation_result
- 核心区块：数据包列表、JSON 上传、校验结果、失败详情、输入快照
- 核心按钮：选择演示数据、上传 JSON 输入文件、数据预览、上传失败详情查看、删除/停用数据包
- 页面状态：正常、空状态、前置条件未满足、失败、已导出
- 截图：docs/ui/screenshots/pages/02_data_ingestion.png

## 数据资源管理

- 导航：数据管理
- 路由：/data/resources
- 数据库映射：NAV_DATA_RESOURCE / RES / data_resource, data_resource_field, data_resource_party_relation
- 核心区块：资源列表、字段统计、模态标签、数据源主体关联、资源摘要导出
- 核心按钮：数据资源详情、数据源主体关联、数据资源导出
- 页面状态：正常、空状态、前置条件未满足、已锁定、已导出
- 截图：docs/ui/screenshots/pages/03_data_resources.png

## 参与方管理

- 导航：数据管理
- 路由：/data/parties
- 数据库映射：NAV_DATA_PARTY / PARTY / party, data_resource_party_relation
- 核心区块：参与方列表、主体类型、算法集合标记、合同主体标记、贡献结果摘要
- 核心按钮：新增参与方、编辑参与方、启用/停用参与方、关联数据资源、查看参与方贡献结果
- 页面状态：正常、空状态、前置条件未满足、已锁定
- 截图：docs/ui/screenshots/pages/04_data_parties.png

## 质量评估管理

- 导航：数元贡献度计量
- 路由：/metering/quality
- 数据库映射：NAV_MEASURE_QUALITY / QUAL / quality_assessment, quality_score_detail, parameter_version
- 核心区块：指标权重、前置条件检查、质量评分、证据说明、低质量提示
- 核心按钮：质量指标权重配置、启动质量评估、查看二级指标得分、重新评估
- 页面状态：正常、前置条件未满足、计算中、失败、已锁定
- 截图：docs/ui/screenshots/pages/05_measure_quality.png

## 数元计量管理

- 导航：数元贡献度计量
- 路由：/metering/shuyuan
- 数据库映射：NAV_MEASURE_SHUYUAN / DU / shuyuan_metering, shuyuan_metering_detail
- 核心区块：基准价、调用量、系数配置、计量明细、参数版本
- 核心按钮：基准数元配置、调用量录入、执行数元计量、查看数元计量明细
- 页面状态：正常、前置条件未满足、计算中、失败、已导出
- 截图：docs/ui/screenshots/pages/06_measure_shuyuan.png

## 贡献度与效用计算

- 导航：数元贡献度计量
- 路由：/metering/utility
- 数据库映射：NAV_MEASURE_UTILITY / UTIL / contribution_record, utility_function_snapshot, utility_record, utility_trace
- 核心区块：贡献因子、归一化贡献、效用函数、效用值、Trace 面板
- 核心按钮：贡献因子配置、贡献度计算、效用函数配置、效用值计算、查看效用计算过程
- 页面状态：正常、前置条件未满足、计算中、失败、已导出
- 截图：docs/ui/screenshots/pages/07_measure_utility.png

## MD-DShap 计算管理

- 导航：收益分配计算
- 路由：/allocation/md-dshap
- 数据库映射：NAV_ALLOC_MDS / MDS / md_dshap_task, md_dshap_result, md_dshap_marginal_trace, algorithm_audit_snapshot
- 核心区块：算法模式、参与方集合、前置条件检查、边际贡献、权重表、算法审计快照
- 核心按钮：启动 MD-DShap 计算、查看计算进度、查看边际贡献明细、查看参与方权重、查看复杂度优化说明、重新计算、导出算法结果、生成算法审计说明
- 页面状态：正常、前置条件未满足、计算中、失败、已锁定、已导出
- 截图：docs/ui/screenshots/pages/08_allocation_md_dshap.png

## 收益分配模拟

- 导航：收益分配计算
- 路由：/allocation/simulation
- 数据库映射：NAV_ALLOC_SIMULATION / ALLOC / allocation_scenario, allocation_result；运行时读取 contract_ratio_plan, contract_ratio_item
- 核心区块：已保存合同比例方案、数据源收益池、MD-DShap 权重分配、金额来源、方案对比
- 核心按钮：查看合同比例方案、执行收益分配模拟、查看分配方案对比、锁定分配方案、导出分配结果
- 页面状态：正常、前置条件未满足、计算中、失败、已锁定、已导出
- 截图：docs/ui/screenshots/pages/09_allocation_simulation.png

## 合同分配规则

- 导航：收益分配计算
- 路由：/allocation/constraints
- 数据库映射：NAV_ALLOC_CONSTRAINT / CONS / 运行时 contract_ratio_plan, contract_ratio_item；旧 contract_constraint, constraint_apply_trace 仅为兼容对象
- 核心区块：总收益、数据源主体收益池比例、非数据主体合同比例项、比例合计、可模拟状态
- 核心按钮：保存合同比例方案、清空合同比例方案、查看比例校验结果
- 页面状态：正常、空状态、失败、已锁定、已导出
- 截图：docs/ui/screenshots/pages/10_allocation_constraints.png

## 报告生成与导出

- 导航：报告生成与导出
- 路由：/reports
- 数据库映射：NAV_REPORT_EXPORT / REP / report_record, export_file, snapshot_store
- 核心区块：报告预览、导出记录、文件清单、字段范围、P1 PDF 生成与下载状态
- 核心按钮：报告预览、生成 Markdown 报告、生成 PDF 报告（P1）、导出 CSV 明细、导出 JSON 结果、导出算法审计说明、导出收益分配确认书
- 页面状态：正常、前置条件未满足、失败、已锁定、已导出
- 截图：docs/ui/screenshots/pages/11_reports_export.png

## 参数配置

- 导航：系统管理
- 路由：/system/parameters
- 数据库映射：NAV_SYSTEM_PARAMETER / PARAM / system_parameter, parameter_version
- 核心区块：场景系数、质量权重模板、MD-DShap 参数、风险提示文案、参数版本
- 核心按钮：场景系数配置、质量权重配置、MD-DShap 参数配置、风险提示文案配置
- 页面状态：正常、前置条件未满足、失败、已锁定
- 截图：docs/ui/screenshots/pages/12_system_parameters.png

## 用户与权限管理（P1）

- 导航：系统管理
- 路由：/system/users
- 数据库映射：NAV_SYSTEM_USER / USER / user_account, role, permission, user_role, role_permission
- 核心区块：P1 能力边界、用户列表、角色权限矩阵、按钮权限、当前用户说明
- 核心按钮：用户查询、新增用户、编辑用户、启用/停用用户、重置密码、配置角色、查看权限矩阵、修改本人密码
- 页面状态：P1 本地启用、权限不足、正常、失败
- 截图：docs/ui/screenshots/pages/13_system_users_p1.png

## 审计日志管理

- 导航：系统管理
- 路由：/system/audit
- 数据库映射：NAV_SYSTEM_AUDIT / AUD / audit_log, snapshot_store, report_record
- 核心区块：日志查询、计算 Trace、输入快照、参数快照、输出快照、导出记录
- 核心按钮：计算日志查询、查看日志详情、导出审计日志
- 页面状态：正常、空状态、失败、已导出
- 截图：docs/ui/screenshots/pages/14_system_audit.png
