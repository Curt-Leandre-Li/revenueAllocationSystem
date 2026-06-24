# 后端 DTO 缺口清单

更新时间：2026-06-24

用途：Phase 1B 清理前端自算后，记录不能由浏览器端临时计算补齐的后端展示 DTO / 接口缺口。

| ID | 页面 | 缺口 | 影响 | 前端处理 |
| --- | --- | --- | --- | --- |
| DTO-001 | 系统首页 | `dashboard_summary` 缺少 `resource_blocked_count`, `md_dshap_pool_count`, `current_revenue_pool`, `latest_report`, `flow_steps` | 首页不能展示权重池主体数、当前收益池和最近报告卡 | 显示“后端未返回”，不从资源/报告列表聚合 |
| DTO-002 | 数据资源管理 | resource summary/chart DTO 缺少模态分布、缺失率统计、敏感字段汇总、资源-主体关系图 | 摘要卡和图表不能展示业务聚合 | 只展示后端 rows；图表容器显示缺 DTO |
| DTO-003 | 参与方管理 | party summary DTO 缺少数据源主体数、非数据主体数、权重池主体数、停用主体数 | 指标卡不能展示聚合值 | 显示“后端摘要待补”，不前端 filter 统计 |
| DTO-004 | 参与方管理 | party-centric resource relation DTO / 保存契约未在页面侧明确 | 参与方页不能安全做批量关联资源 | 入口显示缺口，不展示 mock 资源列表 |
| DTO-005 | 质量评估管理 | quality chart DTO、weight validation DTO 缺失 | 维度图和权重合计校验不能展示 | 表格展示 latest/detail；图表显示缺 DTO |
| DTO-006 | 数元计量管理 | shuyuan chart DTO、party-level metering summary DTO、call-count draft view 缺失 | 资源/参与方金额图、调用量排行和草稿默认值不能展示 | 只展示 latest/detail；参数/调用量保存入口禁用 |
| DTO-007 | 贡献度与效用计算 | utility chart DTO、contribution factor draft view 缺失 | 贡献排行、效用排行和贡献因子草稿不能展示 | 只展示 utility trace；配置入口禁用 |
| DTO-008 | MD-DShap 计算管理 | `md_dshap_view` 缺少 `weight_sum`, `weight_validation_status`, `task_set_count`, complexity/audit display DTO | 不能展示权重合计、归一化校验和复杂度说明 | 显示缺口，不计算权重合计 |
| DTO-009 | MD-DShap 计算管理 | 页面级 marginal trace DTO 未接入到 workspace page data | 边际贡献抽屉不能展示 trace 明细 | 显示“等待后端 trace DTO”，不从权重结果推导 |
| DTO-010 | 收益分配模拟 | allocation summary DTO 缺少 `total_revenue`, `priority_allocation_amount`, `data_provider_revenue_pool` | 指标卡不能展示收益池 | 显示缺口；后端模拟仍接收用户输入 |
| DTO-011 | 收益分配模拟 | constraint apply trace / compare DTO 缺少 `constraint_adjustment_amount` 和应用轨迹 | 不能展示约束前后差额和轨迹 | 表格只展示后端 result rows；缺失字段显示“后端未返回” |
| DTO-012 | 报告生成与导出 | report export view 缺少统一文件清单 DTO，`/reports` OpenAPI 仍是通用成功响应 | 不能稳定展示文件清单、`report_id`、`checksum`、生成时间和字段范围 | 只展示后端 reports rows；缺失字段显示“后端未返回”，不再使用 fallback 文件 |
| DTO-013 | 审计日志管理 | audit detail view 的 `snapshot_refs` / snapshots 未接入页面 data | 快照抽屉不能展示真实快照 | 显示缺 DTO，不展示 mock 快照 |
| DTO-014 | 数据接入管理 | data package summary / validation summary DTO 缺少有效数据包数、校验失败数、字段级失败详情、修复建议 | 数据接入卡片不能展示聚合校验结果 | 只展示 package rows；缺少详情时显示“后端未返回” |
| DTO-015 | 系统首页流程 / 一键计算 | process / pipeline summary DTO 缺少通过检查数、阻塞检查数和阶段摘要 | 流程页不能展示聚合检查计数 | 只展示后端 precondition rows；指标显示缺 DTO |
| DTO-016 | 合同约束管理 | constraints summary DTO 缺少约束总数、启用约束数、约束对象数和检查结果 | 约束卡片不能展示聚合统计 | 只展示 constraint rows；摘要显示缺 DTO |
| DTO-017 | 审计日志管理 | audit summary DTO 缺少失败日志数和快照详情计数 | 审计卡片不能展示失败/快照聚合 | 只展示 audit rows；摘要显示缺 DTO |
