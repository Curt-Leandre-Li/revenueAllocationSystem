# Product Navigation

## Left Navigation

| Primary navigation | Secondary page | Stage | Main route input | Compatibility aliases |
| --- | --- | --- | --- | --- |
| 系统首页 | 系统首页 | P0 | `/dashboard` | none |
| 数据管理 | 数据接入管理 | P0 | `/data/ingestion` | `/data/packages` |
| 数据管理 | 数据资源管理 | P0 | `/data/resources` | none |
| 数据管理 | 参与方管理 | P0 | `/data/parties` | none |
| 数元贡献度计量 | 质量评估管理 | P0 | `/metering/quality` | `/measure/quality`, `/quality` |
| 数元贡献度计量 | 数元计量管理 | P0 | `/metering/shuyuan` | `/measure/shuyuan`, `/shuyuan` |
| 数元贡献度计量 | 贡献度与效用计算 | P0 | `/metering/utility` | `/measure/utility`, `/utility` |
| 收益分配计算 | MD-DShap 计算管理 | P0 | `/allocation/md-dshap` | `/md-dshap` |
| 收益分配计算 | 合同分配规则 | P0 | `/allocation/constraints` | `/constraints` |
| 收益分配计算 | 收益分配模拟 | P0 | `/allocation/simulation` | `/allocation` |
| 报告生成与导出 | 报告生成与导出 | P0/P1 | `/reports` | `/export` |
| 系统管理 | 参数配置 | P0 | `/system/parameters` | `/parameters` |
| 系统管理 | 用户与权限管理（P1） | P1 | `/system/users` | `/users` |
| 系统管理 | 审计日志管理 | P0 | `/system/audit` | `/audit` |

## Menu Rules

- Do not display Arabic numeric prefixes in left navigation labels.
- 系统首页 is a single first-level entry. 项目总览、流程入口、风险提示 and
  一键计算 are sections within that page, not left-nav secondary pages.
- 系统首页 uses `menu_code=NAV_SYS_HOME`, `module_code=SYS`,
  `route_path=/dashboard`, and `children=[]`.
- P1 user/permission pages may be visible as disabled or planned entries in P0.
- Every route and report must keep the simulation-reference, non-legal
  settlement boundary visible.
