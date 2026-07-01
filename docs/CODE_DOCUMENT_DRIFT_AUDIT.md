# 代码与项目文档差异审计

- 审计时间：2026-07-01 13:00:06 CST
- 当前分支：`main`
- 当前 HEAD：`7a7fd48`
- 审计范围：`backend/dvas/`、`backend/tests/`、`db/`、`ui_prototype/src/`、`docs/`、根目录项目说明与三份中文设计文档。
- 本轮约束：只更新文档，不修改业务代码；不把前端 mock 或临时 fallback 写成正式能力；不 push。

## 当前 git status

```text
 M AGENTS.md
 M BACKEND_API_INVENTORY.md
 M BACKEND_AUDIT_REPORT.md
 M BACKEND_DB_MODEL_CHECK.md
 M README.md
 M docs/P0_DATABASE_ACCEPTANCE.md
 M docs/acceptance_checklist.md
 M docs/algorithm_scope.md
 M docs/allocation_logic_design.md
 M docs/current_project_baseline.md
 M docs/database_design_input.md
 M docs/deliverables/01_需求规格说明书.md
 M docs/deliverables/03_数据库设计.md
 M docs/deliverables/04_UI设计方案.md
 M docs/frontend-rebuild/backend-dto-gap-list.md
 M docs/frontend-rebuild/page-api-matrix.md
 M docs/frontend-rebuild/remove-frontend-calculation-list.md
 M docs/frontend-skills/03-page-template-button-behavior.md
 M docs/frontend-skills/04-visualization-mapping.md
 M docs/product_navigation.md
 M docs/product_requirements.md
 M docs/reporting_contract.md
 M docs/system_scope.md
 M docs/ui/page_structure.md
 M docs/ui/source_context_index.md
 M docs/ui/ui_inventory.md
 M docs/ui_agents_task_split.md
 M docs/ui_backend_api_contract_mapping.md
 M docs/ui_design_spec.md
 M docs/ui_redesign_contract.md
 M docs/ui_route_field_action_matrix.md
 M docs/ui_schema_baseline_traceability.md
 M docs/ui_schema_design.md
 M ui_prototype/src/app/AppShell.tsx
 M ui_prototype/src/domain/services/backendWorkspace.ts
 M ui_prototype/src/pages/data/DataPartiesPage.tsx
 M ui_prototype/src/pages/metering/QualityPage.tsx
 M ui_prototype/src/pages/metering/UtilityPage.tsx
 M ui_prototype/src/pages/reports/ReportsPage.tsx
 M ui_prototype/src/styles.css
 M ui_prototype/src/ui/ConfirmModal.tsx
 M 数据收益分配系统_V1.4_需求规格说明书_增加后端逐资源质量评估.md
 M 数据收益分配系统_数据库设计与ER关系图_V1.1_增加后端逐资源质量评估.md
 M 数据收益分配系统_系统详细功能设计_V1.2_增加后端逐资源质量评估.md
?? .playwright-cli/
?? docs/CODE_DOCUMENT_DRIFT_AUDIT.docx
?? docs/CODE_DOCUMENT_DRIFT_AUDIT.md
?? docs/frontend_backend_stage_alignment.md
?? docs/p1_api_alignment.md
?? docs/p1_async_task_design.md
?? docs/p1_auth_my_content_validation.md
?? docs/p1_full_link_validation_report.md
?? docs/p1_import_template_spec.md
?? docs/p1_rbac_matrix.md
?? docs/p1_report_history_and_pdf.md
?? docs/runtime_validation/
?? docs/soft_copyright/
?? docs/stage_contract_runtime_validation.md
?? docs/stage_io_contract.md
?? docs/stage_io_contract_code_audit.md
?? mds-page-screenshots/
?? output/
?? 数据收益分配系统_V1.4_需求规格说明书_增加后端逐资源质量评估.docx
?? 数据收益分配系统_数据库设计与ER关系图_V1.1_增加后端逐资源质量评估.docx
?? 数据收益分配系统_系统详细功能设计_V1.2_增加后端逐资源质量评估.docx
```

## 被检查文件清单

### 前端文件

- `ui_prototype/src/App.tsx`
- `ui_prototype/src/app/AppShell.tsx`
- `ui_prototype/src/app/menu.ts`
- `ui_prototype/src/app/routes.tsx`
- `ui_prototype/src/domain/actionRegistry.ts`
- `ui_prototype/src/domain/api/config.ts`
- `ui_prototype/src/domain/api/dtoMappers.ts`
- `ui_prototype/src/domain/api/endpoints.ts`
- `ui_prototype/src/domain/api/errors.ts`
- `ui_prototype/src/domain/api/httpClient.ts`
- `ui_prototype/src/domain/api/index.ts`
- `ui_prototype/src/domain/services/*.ts`
- `ui_prototype/src/domain/services/backendWorkspace.ts`
- `ui_prototype/src/domain/stateGuards.ts`
- `ui_prototype/src/domain/status.ts`
- `ui_prototype/src/domain/store.ts`
- `ui_prototype/src/domain/types.ts`
- `ui_prototype/src/pages/ModulePageScaffold.tsx`
- `ui_prototype/src/pages/WorkbenchPage.tsx`
- `ui_prototype/src/pages/allocation/*.tsx`
- `ui_prototype/src/pages/allocation/allocationContext.ts`
- `ui_prototype/src/pages/dashboard/*.tsx`
- `ui_prototype/src/pages/data/*.tsx`
- `ui_prototype/src/pages/metering/*.tsx`
- `ui_prototype/src/pages/reports/ReportsPage.tsx`
- `ui_prototype/src/pages/system/*.tsx`
- `ui_prototype/src/ui/*.tsx`
- `ui_prototype/src/styles.css`

### 后端文件

- `backend/dvas/__init__.py`
- `backend/dvas/app.py`
- `backend/dvas/audit.py`
- `backend/dvas/constants.py`
- `backend/dvas/contracts.py`
- `backend/dvas/demo_data.py`
- `backend/dvas/persistence_mapping.py`
- `backend/dvas/postgres_read_model.py`
- `backend/dvas/repository.py`
- `backend/dvas/server.py`
- `backend/dvas/services.py`
- `backend/dvas/state_machine.py`

### 数据库文件

- `db/README.md`
- `db/SHA256SUMS.txt`
- `db/dvas_p0_00_create_database.sql`
- `db/dvas_p0_01_schema.sql`
- `db/dvas_p0_02_seed.sql`
- `db/dvas_p0_03_demo_data.sql`
- `db/dvas_p0_04_validation.sql`
- `db/dvas_p0_er.mmd`

### 测试文件

- `backend/tests/test_api_contract.py`
- `backend/tests/test_frontend_upload_state_guards.py`

### 三份中文设计文档

- `数据收益分配系统_V1.4_需求规格说明书_增加后端逐资源质量评估.md`
- `数据收益分配系统_系统详细功能设计_V1.2_增加后端逐资源质量评估.md`
- `数据收益分配系统_数据库设计与ER关系图_V1.1_增加后端逐资源质量评估.md`

## 代码真实情况摘要

- 前端主路由共 14 个：`/dashboard`、`/data/ingestion`、`/data/resources`、`/data/parties`、`/metering/quality`、`/metering/shuyuan`、`/metering/utility`、`/allocation/md-dshap`、`/allocation/constraints`、`/allocation/simulation`、`/reports`、`/system/parameters`、`/system/users`、`/system/audit`。`dashboardSectionRouteMap` 为空，旧首页子页面组件仍在源码中但不进入当前路由。
- 前端侧边栏实际顺序为：系统首页、数据管理、数元贡献度计量、收益分配计算、报告生成与导出、系统管理；收益分配计算下实际顺序是 MD-DShap 计算管理、合同分配规则、收益分配模拟。
- 后端为 `DvasApplication` + `DvasRequestHandler` 的本地 HTTP/内存分发，不是 FastAPI。标准接口前缀为 `/api/v1`，成功/失败均返回 `success/code/message/trace_id/data|field_errors/error` 信封。
- HTTP 业务接口需要登录 token；本地直接 `handle()` 测试路径使用 `local_operator`。P1 开发账号、RBAC、CSV/XLSX 模板导入、异步 job、PDF 本地生成和历史报告接口存在，但不等于 P0 生产级能力。
- P0 默认运行态是 `JsonFileRepository`，默认写 `backend/runtime/dvas_state.json`。`db/` 是 PostgreSQL 验收/参考 schema，`PostgresReadService` 只提供健康检查、项目、状态、审计和报告等只读查询。
- 当前状态机为 `DRAFT -> INGESTED -> ASSESSED -> METERED -> UTILITY_CALCULATED -> WEIGHT_CALCULATED -> ALLOCATED -> CONFIRMED -> EXPORTED`。
- `SYS-004` 完整链路必须先有有效数据包、资源主体关系和已保存合同比例方案；缺合同比例方案时直接返回 `DVAS_CONTRACT_RATIO_REQUIRED`，不会先跑阶段计算。
- 合同分配规则页仍是独立页面 `/allocation/constraints`，但当前主流程维护的是项目合同比例方案：`total_revenue + data_provider_pool_ratio + NON_DATA_PARTY items`。保存后进入 `/projects/{project_id}/allocation/contract-ratio`。
- 当前能真实影响项目级合同比例收益分配的是已保存合同比例方案，执行接口为 `POST /projects/{project_id}/allocation/simulate`。该路径输出 `CONTRACT_RATIO` 与 `MD_DSHAP_WEIGHT` 两类 `amount_source`，不生成普通 `constraint_apply_trace`。
- 旧 `contract_constraint` 仍存在并可由 `/allocation/constraints` 或 `/contract-constraints` 兼容接口维护；它只影响旧的 `/allocation/simulation/run` 或 `allocation-scenarios` 路径，不进入合同比例主流程。
- MD-DShap 是数据源主体权重计算模块。后端拒绝把 `BASELINE_SHAPLEY` 作为最终算法模式；单数据源主体权重为 `1.000000`；非数据主体排除在参与方池外。
- 质量评估后端算法版本为 `DVAS_QUALITY_7P17S_V1`，运行时包含 7 个一级指标和 17 个二级指标，并生成包级和资源级质量结果；但 PostgreSQL DDL 当前没有 `quality_resource_assessment` / `quality_resource_score_detail` 表。
- 报告 P0 导出为 Markdown、CSV、JSON、JSONL；`ReportService` 每次创建新的 `report_id`、`export_file_id`、checksum 和报告快照。PDF 通过项目级 P1 路由本地生成，仍应标注 P1。
- 前端 `backendWorkspace` 与 `stateGuards` 明确禁止在后端不可用或接口缺失时用 mock 伪造成功；资源摘要导出、纯算法权重导出、复制分配方案、收益分配确认书为后端缺口/禁用说明。

## 2026-07-01 文档修订差异矩阵

| 编号 | 文档范围 | 漂移类型 | 修订动作 | 结果 |
|---|---|---|---|---|
| DOC-20260701-001 | `README.md`, `docs/current_project_baseline.md`, `docs/product_requirements.md` | DOC_OUTDATED | 将最高优先级源从 V1.3/V1.1/V1.0 更新为 V1.4/V1.2/V1.1；把收益分配主链路改为合同比例方案。 | 当前入口文档不再引导读者使用旧需求源或旧合同优先路径。 |
| DOC-20260701-002 | `docs/ui/**`, `docs/ui_route_field_action_matrix.md`, `docs/ui_schema_design.md`, `docs/ui_redesign_contract.md` | UI_DRIFT | 将 `/allocation/constraints` 从“合同约束管理”修订为“合同分配规则”；将模拟页改为读取已保存合同比例方案再执行。 | UI 合同与当前前端主链路一致。 |
| DOC-20260701-003 | `数据收益分配系统_数据库设计与ER关系图_V1.1_增加后端逐资源质量评估.md`, `docs/database_design_input.md` | DB_DRIFT | 将 `contract_ratio_plan/item` 和资源级质量对象标注为运行时 JSON 对象 / PostgreSQL 预留，避免写成已落 SQL 表。 | SQL DDL 与 runtime state 边界清晰。 |
| DOC-20260701-004 | `docs/ui_backend_api_contract_mapping.md`, `docs/frontend-rebuild/page-api-matrix.md` | API_DRIFT | 更新 81 action、项目级合同比例模拟、P1 PDF、P1 用户/RBAC、本地权限路由；`REP-006` 为算法审计导出主码，`REP-012` 仅作历史兼容。 | 不再保留“PDF/用户路由不存在”或算法审计权限错配的旧结论。 |
| DOC-20260701-005 | `docs/reporting_contract.md`, `docs/algorithm_scope.md`, `docs/allocation_logic_design.md` | BUSINESS_RULE_DRIFT | 将 priority/cap/constraint 公式修订为合同比例、数据源收益池、MD-DShap 权重和尾差处理。 | 报告与算法说明不再要求旧约束 trace 作为主流程输出。 |
| DOC-20260701-006 | `BACKEND_*` 根目录历史报告 | HISTORICAL_CONTEXT | 添加历史快照 / superseded 提示，不重写旧审计证据。 | 保留旧报告证据，同时避免被误当作当前事实。 |
| DOC-20260701-007 | `docs/P0_DATABASE_ACCEPTANCE.md`, `docs/frontend-rebuild/remove-frontend-calculation-list.md` | COMPATIBILITY_DRIFT | 将旧 SQL seed/前端自算清单里的“合同优先”改为合同比例说明或兼容注记。 | 当前主链路和历史验收材料边界明确。 |

## 三份中文设计文档差异表

| 编号 | 文档 | 章节/关键词 | 文档当前说法 | 代码真实情况 | 处理方式 | 是否已修改 |
|---|---|---|---|---|---|---|
| DRIFT-001 | 三份文档 | 导航与路由 | 文档以导航结构更新版为准，但部分段落仍按收益分配模拟先于合同分配规则、首页内部子页或候选页面描述。 | 前端当前主路由 14 个；首页只有 `/dashboard`，`dashboardSectionRouteMap={}`；侧边栏收益分配计算顺序是 MD-DShap、合同分配规则、收益分配模拟。 | 补充当前前端路由表，明确旧首页子页面只是未路由源码/兼容，不作为导航。 | 是 |
| DRIFT-002 | 三份文档 | API 与 DTO | 文档按服务建议或候选 REST 描述，部分未体现标准信封、字段级错误、HTTP token、别名路由。 | 后端统一返回 `success/code/message/trace_id/data/error/field_errors`；HTTP 业务路由需要 token；大量 `/api/v1` 别名和项目级合同比例接口已真实存在。 | 更新为当前 `app.py`、`contracts.py`、前端 `endpoints.ts` 真实接口与 DTO 口径。 | 是 |
| DRIFT-003 | 三份文档 | 状态机 | 文档使用中文状态和“已计算权重/已分配”等描述，缺少后端枚举和报告导出门槛。 | 后端枚举为 `DRAFT/INGESTED/ASSESSED/METERED/UTILITY_CALCULATED/WEIGHT_CALCULATED/ALLOCATED/CONFIRMED/EXPORTED`；报告导出要求 `ALLOCATED/CONFIRMED/EXPORTED`。 | 写入枚举、前置门槛和失败字段。 | 是 |
| DRIFT-004 | 数据库设计 | 数据库表与字段 | 文档把 `contract_ratio_plan`、`contract_ratio_item`、`quality_resource_assessment`、`quality_resource_score_detail` 写成数据库主表。 | `db/dvas_p0_01_schema.sql` 只有 38 张表，不含上述四张表；这些对象目前存在于 JSON runtime state。 | 改为“运行时 JSON 对象/待补 PostgreSQL 映射”，不再写成已落 PostgreSQL DDL。 | 是 |
| DRIFT-005 | 数据库设计 | DDL/枚举映射 | 文档直接使用运行时枚举如 `MARKDOWN`、`MD_DSHAP_WEIGHT_WITH_CONSTRAINTS`、`PRIORITY_ALLOCATION`、`ALGORITHM_AUDIT`。 | PostgreSQL schema 使用 `MD`、`MD_DSHAP_WEIGHT`、`PRIORITY_AMOUNT`，`snapshot_store` DDL 没有 `ALGORITHM_AUDIT`；`persistence_mapping.py` 做运行时到 SQL 映射。 | 增加 P0 runtime storage model、PostgreSQL acceptance schema、字段映射与差异说明。 | 是 |
| DRIFT-006 | 三份文档 | 收益分配模拟 | 文档仍有“配置总收益/优先分配/分配模式”均在模拟页可写且完整影响主流程的表述。 | 前端模拟页主要读取 allocation summary、执行项目级合同比例模拟、锁定和导出；总收益与非数据主体比例主入口在合同分配规则页；旧模拟 payload 路径兼容存在。 | 拆分“合同比例主流程”和“旧 simulation/run 兼容路径”。 | 是 |
| DRIFT-007 | 三份文档 | 合同约束/合同比例 | 文档有“合同页不配置旧约束”与后端仍有旧约束接口并存，容易误读为旧接口删除。 | 独立合同分配规则页面仍存在；主页面维护合同比例方案。旧 `contract_constraint` 接口仍存在，但不影响项目级合同比例模拟。 | 写清页面存在、主流程对象、旧约束兼容边界和是否影响 `allocation_result`。 | 是 |
| DRIFT-008 | 三份文档 | MD-DShap | 文档正确声明默认 MD-DShap，但部分按钮仍写“导出算法结果”或基线 Shapley 对比为 P0 结果。 | 后端拒绝 `BASELINE_SHAPLEY` 作为最终任务；`MDS-017` 纯算法结果导出被前端禁用，使用 `MDS-018`/`REP-006` 算法审计导出。 | 降级 `MDS-017` 为后端缺口/禁用；强调 MD-DShap 只输出权重。 | 是 |
| DRIFT-009 | 三份文档 | 质量评估 | 文档新增逐资源质量表，但落库口径与 `db/` 不一致。 | 后端运行时确有资源级质量结果与热力图，算法版本 `DVAS_QUALITY_7P17S_V1`；PostgreSQL DDL 未建资源级质量表。 | 需求/功能文档保留当前运行时能力；数据库文档标明 JSON runtime 对象和 PostgreSQL 预留映射。 | 是 |
| DRIFT-010 | 三份文档 | 数元计量/贡献效用 | 文档未完全体现当前服务前置状态和资源质量优先策略。 | 数元计量要求 `ASSESSED`；贡献/效用要求 `METERED`；计量使用 `RESOURCE_FIRST_PACKAGE_FALLBACK` 质量策略，效用来自贡献、质量、使用、场景信号。 | 补充服务边界、读写对象和状态推进。 | 是 |
| DRIFT-011 | 三份文档 | 报告导出 | 文档仍列 `allocation_confirmation_statement.md`、`assumptions.json` 等为 P0 文件。 | 当前 P0 真实导出为 `allocation_summary.md`、`source_level_allocation.csv`、`allocation_result.csv`、`quality_assessment_summary.csv`、`shuyuan_metering_detail.csv`、`md_dshap_weights.csv`、`allocation_result.json`、`audit_log.jsonl`、`md_dshap_audit_report.md/json` 等按上下文生成；确认书专用导出禁用。 | 删除/降级未实现文件，写真实文件与字段。 | 是 |
| DRIFT-012 | 三份文档 | 审计日志 | 文档未完全体现失败审计、按钮编号和 checksum。 | `AuditService` 保存 `module_code/menu_code/button_code/operation_type/object_type/object_id/operator_id/status/failure_reason/error_code/error_message/checksum`；登录失败、权限拒绝、计算失败均可写失败审计。 | 更新审计字段和按钮副作用。 | 是 |
| DRIFT-013 | 三份文档 | P0/P1 边界 | 文档写 P1 扩展，但未解释当前代码已有 P1 本地接口。 | 代码中已有开发账号、RBAC、CSV/XLSX 模板导入、异步 job、PDF、本地报告历史下载归档；这些是 P1/local extension，不是 P0 生产级能力。 | 明确“代码存在但 P1/本地扩展/非 P0 必须项”。 | 是 |
| DRIFT-014 | 需求规格/功能设计 | 前端按钮与后端副作用 | 文档把部分按钮写成已实现副作用。 | `stateGuards.ts` 禁用 `RES-007`、`MDS-017`、`ALLOC-014`、`REP-009`；P1 PDF/历史报告/用户管理走真实后端但标 P1。 | 对按钮逐项标注前置、接口、写入对象、失败提示、审计和是否影响后续计算。 | 是 |
| DRIFT-015 | 三份文档 | mock fallback/backend unavailable/storage mode | 文档没有系统性说明前端不能用 mock 成功兜底。 | `httpClient.ts` 识别 HTML/网络错误；`backendWorkspace.ts` 将网络问题标 `backend_unavailable`，业务校验错误保持 backend 模式并展示错误；测试禁止硬编码总收益 fallback。 | 增加后端不可用、storage mode 和 no mock success 说明。 | 是 |
| DRIFT-016 | 三份文档 | PostgreSQL 正式数据库 | 文档可能让读者以为 P0 runtime 已使用 PostgreSQL。 | 默认 runtime 是 JSON state；`db/` 是验收/参考 schema，`PostgresReadService` 只读查询。 | 在三份文档中统一写清 P0 runtime、PostgreSQL acceptance schema、映射和预留。 | 是 |
| DRIFT-017 | 需求规格/功能设计 | 验收用例 | 文档保留无法由当前代码通过的用例，如确认书导出、资源摘要导出、复制新版本、P0 PDF。 | 前端 guard 明确禁用这些能力；测试覆盖合同比例、SYS-004、P1 本地接口、资源级质量和 mock 禁止。 | 删除或改为 P1/禁用/后端缺口验收；新增合同比例主流程和 no mock 用例。 | 是 |
