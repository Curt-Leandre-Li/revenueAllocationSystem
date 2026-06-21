# Software Copyright Screenshot Manifest

本清单用于软著验收截图包说明。截图由 `scripts/capture_ui_acceptance_screenshots.py` 生成，默认通过真实 PostgreSQL API 完成操作链路，CI artifact 名称为 `phase-2d-screenshots`，artifact id 为 `7773025213`。

## 边界说明

- 系统名称：数据收益分配系统 V1.2 / DVAS
- 输出定位：数据收益分配模拟与审计说明系统
- 统一声明：系统结果仅为模拟参考，非法律结算、非法定结算、付款指令、合同履约或主管机关审批结果
- P0 导出格式：Markdown、CSV、JSON、JSONL
- P1 功能：PDF、登录/RBAC、多租户、异步队列、真实付款、银行、税务、电子签章

## 截图清单

| 文件名 | 页面路径 | 功能模块 | 对应按钮/功能 | 使用真实 API | P1 边界 |
|---|---|---|---|---|---|
| `01_dashboard_initial.png` | `/dashboard` | 系统首页 | 初始项目状态、流程入口、风险提示 | `GET /health/db`, `GET /api/projects` | 无 |
| `02_dashboard_loaded.png` | `/dashboard` | 系统首页 | 选择演示数据后的项目总览 | `POST /api/demo-cases/load`, `GET /api/projects/:projectId/status` | 无 |
| `03_data_ingestion.png` | `/data/ingestion` | 数据接入管理 | 数据包、上传校验、输入快照 | `GET /api/projects/:projectId/status` | 禁止保存未脱敏敏感原文 |
| `04_data_resources.png` | `/data/resources` | 数据资源管理 | 资源、字段、模态、样本、关联主体 | `GET /api/projects/:projectId/resources` | 无 |
| `05_parties.png` | `/data/parties` | 参与方管理 | 参与方类型、权重池边界、资源关联 | `GET /api/projects/:projectId/parties` | 登录/RBAC 不属于 P0 |
| `06_quality.png` | `/measure/quality` | 质量评估管理 | 质量总分、等级、维度分、证据摘要 | `GET /api/projects/:projectId/quality-summary` | 无 |
| `07_shuyuan.png` | `/measure/shuyuan` | 数元计量管理 | 基准价、系数、调用量、计量金额 | `GET /api/projects/:projectId/shuyuan-summary` | 无 |
| `08_utility.png` | `/measure/utility` | 贡献度与效用计算 | 贡献度、归一化贡献、效用值、trace 摘要 | `GET /api/projects/:projectId/utility-summary` | 无 |
| `09_md_dshap.png` | `/allocation/md-dshap` | MD-DShap 计算管理 | `algorithm_mode=MD_DSHAP`、权重合计、审计快照 | `GET /api/projects/:projectId/md-dshap-summary` | Basic Shapley 仅 baseline，不是默认策略 |
| `10_allocation_simulation.png` | `/allocation/simulation` | 收益分配模拟 | 总收益、数据源收益池、约束前/后金额 | `GET /api/projects/:projectId/allocation-summary` | 不构成法律结算比例 |
| `11_constraints.png` | `/allocation/constraints` | 合同约束管理 | 优先分配、合同约束、约束执行 trace | `GET /api/projects/:projectId/constraints-summary` | 不代表合同实际履约 |
| `12_reports.png` | `/reports` | 报告生成与导出 | report_id、file_path、checksum、导出文件 | `GET /api/reports`, `GET /api/projects/:projectId/export-files` | PDF 为 P1，不生成假 PDF |
| `13_audit_logs.png` | `/system/audit` | 审计日志管理 | module_code、menu_code、operation、失败原因、快照引用 | `GET /api/audit/logs?project_id=...` | 无 |
| `14_parameters.png` | `/system/parameters` | 参数配置 | P0 只读参数、精度规则、风险提示 | `GET /api/projects/:projectId/status` | 不做完整参数编辑 |
| `15_users_p1_notice.png` | `/system/users` | 用户与权限管理（P1） | local_operator 模式、P1 用户权限说明 | 前端 P1 边界说明 | 登录/RBAC 为 P1 |
| `16_upload_error_state.png` | `/data/ingestion` | 数据接入管理 | 非法 JSON 上传字段级错误 | `POST /api/data/upload-json`, `GET /api/projects/:projectId/status` | 禁止真实敏感原文 |
| `17_backend_unavailable_state.png` | `/dashboard` | 系统首页 | 后端不可用 / 离线 fallback 提示 | 后端停止后刷新真实 UI | 不使用 mock 伪造成功 |

## 交付方式

- 本地可运行截图脚本生成 PNG。
- CI 上传 `output/phase_2d_screenshots/` 为 artifact，并包含 `capture_status.json`。
- 若 PNG 文件过大，本仓库提交脚本和 manifest，以 CI artifact 作为截图包交付。
- 若自动化无法生成全部截图，`capture_status.json` 记录实际生成清单和错误原因；不得用 mock 或占位图伪造缺失截图。
