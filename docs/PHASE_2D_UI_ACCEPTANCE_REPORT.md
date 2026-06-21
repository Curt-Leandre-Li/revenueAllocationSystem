# Phase 2D UI Acceptance Report

## 基本信息

- 分支：`phase-2d-ui-acceptance-screenshots`
- 基线 commit：`41bbc80d2f5617ff4b3c9db6b133eec1d77f4dc3`
- 本阶段 commit：提交后记录
- CI workflow：`Phase 2D UI Acceptance`
- CI run ID：GitHub Actions 在 push 后分配，最终验收回复记录实际值
- 数据库：PostgreSQL 16 service container
- 数据来源：真实 PostgreSQL API，不使用 mock 伪装真实结果

## 本阶段结论

Phase 2D 在 Phase 2C 真实 API 接入基础上补齐页面明细数据、关键交互状态、截图脚本和 CI artifact。系统输出继续保持“模拟参考，非法律结算”边界，不生成 PDF，不实现登录/RBAC，不接入真实付款、银行、税务或电子签章。

## 新增最小只读接口

为避免页面截图仅显示项目级计数，本阶段新增以下只读 API：

- `GET /api/projects/:projectId/resources`
- `GET /api/projects/:projectId/parties`
- `GET /api/projects/:projectId/quality-summary`
- `GET /api/projects/:projectId/shuyuan-summary`
- `GET /api/projects/:projectId/utility-summary`
- `GET /api/projects/:projectId/constraints-summary`
- `GET /api/projects/:projectId/export-files`

这些接口只读取 `dvas.*` 真实表，不改表结构、不改写库流程、不改算法、不引入 ORM。

## 页面覆盖

| 页面路径 | 页面名称 | 真实数据来源 | 核心按钮/状态 | 截图 |
|---|---|---|---|---|
| `/dashboard` | 系统首页 | health、projects、status、reports、audit、summary API | 选择演示数据、执行完整链路、确认分配方案、生成报告 | 是 |
| `/data/ingestion` | 数据接入管理 | status、upload validation latest | 选择演示数据、上传 JSON、字段级错误 | 是 |
| `/data/resources` | 数据资源管理 | resources API | 资源、字段、模态、样本、主体关联 | 是 |
| `/data/parties` | 参与方管理 | parties API | 参与方、权重池、资源关联、分配摘要 | 是 |
| `/measure/quality` | 质量评估管理 | quality-summary API | 质量总分、等级、维度分、证据摘要 | 是 |
| `/measure/shuyuan` | 数元计量管理 | shuyuan-summary API | 基准价、系数、调用量、计量金额 | 是 |
| `/measure/utility` | 贡献度与效用计算 | utility-summary API | 贡献度、归一化贡献、效用值、trace 摘要 | 是 |
| `/allocation/md-dshap` | MD-DShap 计算管理 | md-dshap-summary API | `algorithm_mode=MD_DSHAP`、权重、审计快照 | 是 |
| `/allocation/simulation` | 收益分配模拟 | allocation-summary API | 总收益、收益池、约束前/后金额 | 是 |
| `/allocation/constraints` | 合同约束管理 | constraints-summary API | 优先分配、约束、执行 trace | 是 |
| `/reports` | 报告生成与导出 | reports、export-files API | Markdown/CSV/JSON/JSONL、checksum，PDF=P1 | 是 |
| `/system/audit` | 审计日志管理 | audit logs API | module/menu/action/status/failure/snapshot refs | 是 |
| `/system/parameters` | 参数配置 | status API 与 P0 只读边界 | 精度规则、MD-DShap 默认、风险提示 | 是 |
| `/system/users` | 用户与权限管理（P1） | P1 边界说明 | P0 local_operator，无登录/RBAC | 是 |

## 操作演示链路

截图脚本 `scripts/capture_ui_acceptance_screenshots.py` 执行：

```text
打开 dashboard
-> 选择演示数据
-> 启动完整链路计算
-> 确认分配方案
-> 生成报告
-> 查看各业务页面
-> 调用一次非法 JSON 上传展示字段级错误
-> 停止后端并刷新 dashboard 展示后端不可用状态
```

截图输出目录为 `output/phase_2d_screenshots/`。GitHub Actions 上传 artifact：`phase-2d-screenshots`。如本地环境缺少 Playwright 浏览器或数据库，截图以 CI artifact 为准。截图脚本会同时写入 `capture_status.json`，用于记录实际生成的截图、缺失项和自动化错误；缺失截图不会用 mock 或占位图伪造。

## 已知限制

- PDF 导出为 P1，本阶段不实现假 PDF。
- 登录/RBAC 为 P1，本阶段保持 `local_operator`。
- 不支持多租户、异步队列、真实付款、银行、税务、电子签章。
- 前端只展示后端金额和权重，不重新计算分配结果。
- CI run ID 无法在 commit 前预知，最终 run ID 以后续 GitHub Actions 实际结果为准。

## 验收语句

所有页面、报告、导出和截图均应保留“模拟参考，非法律结算”说明。MD-DShap 权重仅作为模拟参考权重，不构成法律结算比例、付款指令或合同履约依据。
