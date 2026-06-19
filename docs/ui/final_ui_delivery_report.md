# 数据收益分配系统 V1.2 / V1.3 UI 原型最终交付报告

## 交付结论

本轮已按三份导航结构更新版 Markdown 文档建立 UI 上下文、页面清单、按钮交互矩阵、路由冲突处理说明、可运行 React/Vite/TypeScript 本地原型、Playwright 截图脚本、页面/按钮/流程 PNG 截图和验收脚本。

本次继续修正左侧导航层级：有二级页面的一级结构改为抽屉式展开；系统首页只保留一个一级入口，项目总览、流程入口、风险提示和一键计算合并为系统首页同页区块。

本次进一步将系统首页从研发验收页调整为业务用户首页：移除首页直出技术字段、按钮编号、菜单编码、route_path、snapshot_id 和 checksum；这些信息不进入首页主内容，需在审计日志管理或报告记录中追溯。首页主体改为业务总览指标、完整流程入口、一键计算主操作、失败详情与计算日志、快捷操作和显著风险提示。

系统输出在页面、弹窗和报告说明中统一展示：系统结果仅为模拟参考，非法律结算；不构成法律结算、财务付款、合同履约或主管单位审批结果。

## 变更文件

| 路径 | 变更原因 |
|---|---|
| `docs/ui/source_context_index.md` | 记录三份源文档、菜单结构、状态机、P0/P1 边界、数据库映射和冲突记录。 |
| `docs/ui/ui_inventory.md` | 14 个页面的 route_path、module_code、核心区块、主对象、核心按钮和页面状态清单。 |
| `docs/ui/button_interaction_matrix.md` | 66 个核心按钮的入口、前置条件、输入字段、交互状态、业务副作用、审计要求和截图路径。 |
| `docs/ui/route_conflict_resolution.md` | 记录系统首页单一入口修正，并按数据库设计优先其余 route_path、详细功能设计优先交互、需求规格说明书优先 P0/P1 边界处理冲突。 |
| `docs/ui/page_structure.md` | 页面级结构说明和工程实现参考。 |
| `docs/product_navigation.md` | 将系统首页主路由收敛为 `/dashboard`，旧首页拆分路径仅作兼容别名。 |
| `docs/current_project_baseline.md` | 同步系统首页单一入口和旧首页路径兼容说明。 |
| `docs/deliverables/01_需求规格说明书.md`, `docs/deliverables/04_UI设计方案.md`, `agents/ui_designer.md` | 将旧的系统首页拆分表述改为单一一级入口和同页区块表述。 |
| `docs/ui/design_images/*.png` | 14 张 1440x900 工程级页面设计图。 |
| `docs/ui/screenshots/pages/*.png` | 14 张 1440x900 页面级截图。 |
| `docs/ui/screenshots/button_demos/**.png` | 66 个按钮目录，共 210 张点击前/点击后/确认/运行/成功/失败/审计截图。 |
| `docs/ui/screenshots/flows/full_pipeline/*.png` | 12 张完整链路流程演示截图。 |
| `ui_prototype/` | 新增本地 React + Vite + TypeScript 原型，用 Mock 数据表达三份源文档字段和状态；左侧导航实现有二级页面的一级展开和二级缩进；系统首页改为业务看板，风险提示为内联区块，不设置二级窗口。 |
| `ui_prototype/scripts/generate-ui-docs.mjs` | 从共享 UI inventory 生成文档交付物。 |
| `ui_prototype/scripts/capture-ui-screenshots.mjs` | 使用 Playwright 自动生成页面、按钮和流程截图，并清理旧页面图避免残留。 |
| `scripts/check_ui_deliverables.py` | 检查文档、图片非空、1440x900 尺寸、免责声明、P1 边界、MD-DShap、baseline_check、report_id/checksum、审计快照、导航标签和系统首页单一入口。 |

## 页面图片清单

共 14 张，位于 `docs/ui/design_images/`：

01_system_home.png, 02_data_ingestion.png, 03_data_resources.png, 04_data_parties.png, 05_measure_quality.png, 06_measure_shuyuan.png, 07_measure_utility.png, 08_allocation_md_dshap.png, 09_allocation_simulation.png, 10_allocation_constraints.png, 11_reports_export.png, 12_system_parameters.png, 13_system_users_p1.png, 14_system_audit.png.

## 页面截图清单

共 14 张，位于 `docs/ui/screenshots/pages/`，文件名与页面图片清单一致，均为 1440x900 PNG。

## 按钮演示清单

共 66 个按钮目录，位于 `docs/ui/screenshots/button_demos/`。完整按钮编号和截图路径见 `docs/ui/button_interaction_matrix.md`。

覆盖范围包括：

- 计算类按钮：`SYS-004`, `QUAL-003`, `QUAL-009`, `DU-009`, `UTIL-006`, `UTIL-008`, `MDS-011`, `MDS-016`, `ALLOC-011`，均包含前置条件、运行中、成功、失败截图。
- 高风险按钮：`DATA-009`, `PARTY-005`, `ALLOC-015`, `CONS-004`，均包含确认弹窗、成功结果、审计日志截图。
- 导出类按钮：`RES-007`, `MDS-017`, `MDS-018`, `ALLOC-016`, `REP-002`, `REP-004`, `REP-005`, `REP-006`, `REP-009`, `AUD-007`，均包含导出确认、成功结果、report_id/checksum 或审计记录截图。
- P1 按钮：`REP-003`, `USER-001`, `USER-002`, `USER-007`, `USER-009`，均显示 P1 规划态，不伪装为 P0 已上线功能。

## 流程演示清单

共 12 张，位于 `docs/ui/screenshots/flows/full_pipeline/`：

选择演示数据、数据预览、关联参与方、启动质量评估、执行数元计量、贡献度计算、效用计算、MD-DShap、收益分配模拟、锁定方案、导出报告、查看审计日志。

## PPT 与 Figma

- PPT：未生成。PPT 为可选辅助材料，本轮以工程级 PNG、可运行原型、交互截图和验收脚本为主。
- Figma：未同步。当前没有用户提供的 Figma fileKey、team/planKey 或目标文件；Figma 为可选项，且最终验收以本地 PNG 和工程级页面成果为准。

## 验收结果

| 命令 | 结果 |
|---|---|
| `npm run generate:docs`（在 `ui_prototype/`） | 已通过，生成 `docs/ui/*.md`。 |
| `npm run build`（在 `ui_prototype/`） | 已通过，TypeScript 与 Vite 生产构建成功。 |
| `npx playwright install chromium`（在 `ui_prototype/`） | 已通过，安装本地截图所需 Chromium。 |
| `npm run screenshots`（在 `ui_prototype/`） | 已通过，生成 14 页面 + 210 按钮 + 12 流程 PNG。 |
| `python3 scripts/check_ui_deliverables.py` | 已通过，检查文档、截图、设计图、按钮图、流程图和业务边界。 |

## 是否修改业务代码

否。未修改 `src/`、`demo_ui/`、`tests/`、算法逻辑、收益分配口径、数据库迁移或生产 API。新增的是本地 UI 原型包、UI 文档、截图资产和验收脚本。

## 文档冲突处理方式

- 本次 UI 修正优先处理系统首页结构：系统首页只保留一级入口，四个首页能力作为同页区块，不进入左侧二级导航。
- 数据库设计文档优先处理其余 `nav_menu`、`permission`、`menu_code`、`module_code`、`route_path`。
- 系统详细功能设计优先处理页面内容、按钮状态、弹窗、Trace、错误提示。
- 需求规格说明书优先处理 P0/P1 边界、业务规则、验收标准。
- 历史路由仅作为兼容别名记录，不替代新版左侧导航。
- MD-DShap 作为默认策略；基础 Shapley 仅展示为 `baseline_check`。

## P1 规划项

登录与 RBAC、PDF 导出、CSV/XLSX 批量导入、异步任务进度、历史报告管理、更完整权限控制。原型中这些能力均以 P1 规划或只读说明表达。

## 未完成项与风险

- `npm install` 报告原型依赖树存在 2 个 high severity audit findings；未运行 `npm audit fix --force`，避免未经确认的依赖大版本变更。
- Image Gen 概念图未形成可安全引用的新增本地文件；本轮交付以可运行原型和 Playwright 生成的工程页面 PNG 为准。
- Figma/PPT 未生成，均属于可选展示材料，不影响 PNG、交互截图、验收脚本和本地原型交付。
