# DVAS Route Conflict Resolution

## Authority Order

1. 本次 UI 修正优先：系统首页是单一一级入口，`项目总览`、`流程入口`、`风险提示`、`一键计算` 是同页区块，不进入左侧二级导航。
2. 数据库设计文档优先：其余页面沿用 `nav_menu`、`permission`、`module_code`、`route_path`。
3. 系统详细功能设计优先：页面内容、按钮状态、弹窗、Trace、错误提示。
4. 需求规格说明书优先：P0/P1 边界、业务规则、验收标准。

## Resolved Route Set

| 一级导航 | 二级页面 | route_path | menu_code | module_code | 处理结论 |
| --- | --- | --- | --- | --- | --- |
| 系统首页 | 系统首页 | /dashboard | NAV_SYS_HOME | SYS | P0 主展示路径 |
| 数据管理 | 数据接入管理 | /data/ingestion | NAV_DATA_PACKAGE | DATA | P0 主展示路径 |
| 数据管理 | 数据资源管理 | /data/resources | NAV_DATA_RESOURCE | RES | P0 主展示路径 |
| 数据管理 | 参与方管理 | /data/parties | NAV_DATA_PARTY | PARTY | P0 主展示路径 |
| 数元贡献度计量 | 质量评估管理 | /metering/quality | NAV_MEASURE_QUALITY | QUAL | P0 主展示路径 |
| 数元贡献度计量 | 数元计量管理 | /metering/shuyuan | NAV_MEASURE_SHUYUAN | DU | P0 主展示路径 |
| 数元贡献度计量 | 贡献度与效用计算 | /metering/utility | NAV_MEASURE_UTILITY | UTIL | P0 主展示路径 |
| 收益分配计算 | MD-DShap 计算管理 | /allocation/md-dshap | NAV_ALLOC_MDS | MDS | P0 主展示路径 |
| 收益分配计算 | 合同分配规则 | /allocation/constraints | NAV_ALLOC_CONSTRAINT | CONS | P0 主展示路径 |
| 收益分配计算 | 收益分配模拟 | /allocation/simulation | NAV_ALLOC_SIMULATION | ALLOC | P0 主展示路径 |
| 报告生成与导出 | 报告生成与导出 | /reports | NAV_REPORT_EXPORT | REP | P0 主展示路径 |
| 系统管理 | 参数配置 | /system/parameters | NAV_SYSTEM_PARAMETER | PARAM | P0 主展示路径 |
| 系统管理 | 用户与权限管理（P1） | /system/users | NAV_SYSTEM_USER | USER | P1 已接入登录/RBAC |
| 系统管理 | 审计日志管理 | /system/audit | NAV_SYSTEM_AUDIT | AUD | P0 主展示路径 |

## Compatibility Aliases

系统首页历史拆分路由、独立菜单码和二级窗口口径均已废止，不作为当前兼容别名或权限菜单节点保留。历史路由如 `/quality`、`/shuyuan`、`/utility`、`/md-dshap`、`/allocation`、`/constraints`、`/audit`、`/parameters`、`/users` 可作为兼容别名记录，但不得替代新版左侧导航主展示路径。
