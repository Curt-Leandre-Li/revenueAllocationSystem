# UI Backend API Contract Mapping

Phase: 2C-prep

Status: contract mapping only. Do not use this document as evidence that frontend runtime integration has been implemented.

Scope boundary:

- This document maps the Phase 2B `ui_prototype` action/service surface to the current backend HTTP API, internal services, schemas, and tests.
- This document does not implement API adapters, DTO mappers, UI changes, backend changes, or production integration.
- `sources/` does not exist in this repository snapshot. The three source-of-truth documents are present at repository root and were used as source inputs:
  - `数据收益分配系统_V1.3_需求规格说明书_导航结构更新版.md`
  - `数据收益分配系统_系统详细功能设计_V1.1_导航结构更新版.md`
  - `数据收益分配系统_数据库设计与ER关系图_V1.0_导航结构更新版.md`

## Evidence Inputs

| Area | Files / commands checked | Notes |
| --- | --- | --- |
| Source of truth | Root PRD, detailed design, DB/ER docs | Defines navigation, button semantics, state machine, tables, P0/P1 boundaries. |
| Frontend actions | `ui_prototype/src/domain/actionRegistry.ts` | 68 action codes, handler names, permissions, mock side effects. |
| Frontend services | `ui_prototype/src/domain/services/*Service.ts`, `serviceTypes.ts`, `actionDispatcher.ts` | 14 exported service handlers. Most write through mock store; a few have dormant backend helper paths gated by `snapshot.backend.connected`. |
| Frontend fields/store | `fieldMap.ts`, `store.ts`, `apiClient.ts`, `backendAdapter.ts` | Current adapter only covers project/dashboard/data package/resource/party/quality subset. |
| Backend routing | `backend/dvas/app.py`, `backend/openapi.yaml` | 49 HTTP method/path combinations under `/api/v1`; app is standard-library HTTP adapter, not FastAPI. |
| Backend services | `backend/dvas/services.py`, `repository.py`, `contracts.py` | Dict DTOs; no pydantic/BaseModel schemas. OpenAPI component schemas define request DTOs. |
| Backend tests | `backend/tests/test_api_contract.py` | Uses `InMemoryRepository` and temporary dirs. Covers P0 chain and confirms PDF/login/RBAC/user routes are absent. |
| Existing docs | `docs/api_and_data_contract.md`, `docs/reporting_contract.md`, `docs/traceability/2026-06-18-be00-be02-runtime-scope.md` | Confirms stable IDs, P0 export formats, report/checksum rules, and P1 exclusions. |

## Summary Counts

| Metric | Count | Notes |
| --- | ---: | --- |
| Frontend action codes | 68 | Extracted from `ActionId` and `actionRegistry`. |
| Frontend exported service methods | 14 | One `handleAction` per frontend service module. Private backend helper functions exist for demo upload and quality only. |
| Backend HTTP endpoints | 49 | Counted from `backend/openapi.yaml`; all are `/api/v1` relative paths. |
| Backend route function surface | 1 dispatch function | `DvasApplication._dispatch` branches to backend services. |
| Existing P0 backend tests | 1 file | `backend/tests/test_api_contract.py` covers the complete P0 chain and route absence checks. |

Action mapping status counts:

| Status | Count |
| --- | ---: |
| EXISTING | 43 |
| PARTIAL | 12 |
| INTERNAL_ONLY | 0 |
| MISSING | 6 |
| MOCK_ONLY_P1 | 6 |
| OUT_OF_SCOPE | 1 |

## Backend API Inventory

All endpoints below are defined in `backend/openapi.yaml` and routed by `DvasApplication._dispatch` in `backend/dvas/app.py`. Tests are in `backend/tests/test_api_contract.py`; individual endpoint assertions vary, but the route surface and P0 chain are covered there.

| Method | Endpoint | Route function | Request DTO | Response DTO / data | Backend service | Data objects | Status / audit / snapshot / report side effects | Tested | Availability |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/projects/current` | `_dispatch` | query none | `AllocationProject` in standard envelope | `ProjectService.current_project` | allocation_project | read only | yes | P0 |
| GET | `/api/v1/dashboard` | `_dispatch` | query none | dashboard aggregate | `DashboardService.overview` | project, packages, resources, parties, audit_log | read only, returns available/disabled actions | yes | P0 |
| GET | `/api/v1/dashboard/preconditions` | `_dispatch` | query none | preconditions/action state | `DashboardService.preconditions` | project, all current result tables | read only, state gate calculation | yes | P0 |
| POST | `/api/v1/dashboard/actions/quick-run` | `_dispatch` | none | precondition result | `DashboardService.quick_run` | project/preconditions | action endpoint for `SYS-004`; not a page route | yes | P0 partial |
| POST | `/api/v1/demo-cases/{demo_case_id}/initialize` | `_dispatch` | path `demo_case_id` | package, input_snapshot, resources, parties, project_status | `DataIngestionService.initialize_demo_case` | data_package, input_snapshot, data_resource, party, audit_log | status `INGESTED`; writes input snapshot and audit log | yes | P0 |
| POST | `/api/v1/data-packages/upload` | `_dispatch` | `DataPackageUploadRequest` | package, validation_result, input_snapshot, resources, parties | `DataIngestionService.upload_json` | data_package, upload_validation_result, input_snapshot, data_resource, party | success writes valid package/snapshot; failure writes invalid package/validation result only | yes | P0 |
| GET | `/api/v1/data-packages` | `_dispatch` | query none | `TablePage<DataPackage>` | `DataIngestionService.list_packages` | data_package | read only | yes | P0 |
| GET | `/api/v1/data-packages/{package_id}` | `_dispatch` | path `package_id` | package, snapshot, validation, resources | `DataIngestionService.package_detail` | data_package, input_snapshot, validation_result, resources | read only | yes | P0 |
| GET | `/api/v1/data-packages/{package_id}/validation-result` | `_dispatch` | path `package_id` | upload validation result | `DataIngestionService.validation_result` | upload_validation_result | read only | yes | P0 |
| GET | `/api/v1/data-resources` | `_dispatch` | query optional package | `TablePage<DataResource>` | `DataIngestionService.list_resources` | data_resource | read only | yes | P0 |
| GET | `/api/v1/data-resources/{resource_id}` | `_dispatch` | path `resource_id` | data resource | `DataIngestionService.resource_detail` | data_resource | read only | yes | P0 |
| PUT | `/api/v1/data-resources/{resource_id}/party-relations` | `_dispatch` | `ResourcePartyRelationRequest` | updated data resource | `ResourceService.bind_party_relations` | data_resource_party_relation, data_resource, audit_log | writes relation and audit log | yes | P0 |
| GET | `/api/v1/parties` | `_dispatch` | query none | `TablePage<Party>` | `DataIngestionService.list_parties` | party | read only | yes | P0 |
| POST | `/api/v1/parties` | `_dispatch` | `PartyWriteRequest` | created party | `PartyService.create_party` | party, audit_log | writes party and audit log | yes | P0 |
| PUT | `/api/v1/parties/{party_id}` | `_dispatch` | `PartyWriteRequest` | updated party | `PartyService.update_party` | party, audit_log | versioned write and audit log | yes | P0 |
| PATCH | `/api/v1/parties/{party_id}/status` | `_dispatch` | `PartyStatusRequest` | updated party status | `PartyService.set_status` | party, audit_log | logical disable/enable; guards last data provider | yes | P0 |
| POST | `/api/v1/quality-assessments/run` | `_dispatch` | `QualityRunRequest` | project_status, assessment, details | `QualityAssessmentService.run` | quality_assessment, quality_score_detail, snapshot_store, audit_log | status `ASSESSED`; writes output snapshot and audit | yes | P0 |
| GET | `/api/v1/quality-assessments/latest` | `_dispatch` | query none | latest quality assessment | `QualityAssessmentService.latest` | quality_assessment | read only | yes | P0 |
| GET | `/api/v1/quality-assessments/{assessment_id}/details` | `_dispatch` | path `assessment_id` | assessment plus details | `QualityAssessmentService.details` | quality_score_detail | read only | yes | P0 |
| POST | `/api/v1/shuyuan-meterings/run` | `_dispatch` | `ShuyuanMeteringRunRequest` | project_status, metering, details | `ShuyuanMeteringService.run` | shuyuan_metering, shuyuan_metering_detail, snapshot_store, audit_log | status `METERED`; writes parameter/output snapshots and audit | yes | P0 |
| GET | `/api/v1/shuyuan-meterings/latest` | `_dispatch` | query none | latest shuyuan metering | `ShuyuanMeteringService.latest` | shuyuan_metering | read only | yes | P0 |
| GET | `/api/v1/shuyuan-meterings/{metering_id}/details` | `_dispatch` | path `metering_id` | metering plus details | `ShuyuanMeteringService.details` | shuyuan_metering_detail | read only | yes | P0 |
| POST | `/api/v1/contributions/run` | `_dispatch` | `ContributionRunRequest` | project_status, contribution records | `ContributionService.run` | contribution_record, snapshot_store, audit_log | writes records and parameter/result snapshots; status remains `METERED` | yes | P0 |
| POST | `/api/v1/utilities/run` | `_dispatch` | `UtilityRunRequest` | project_status, utility, trace | `UtilityService.run` | utility_record, utility_trace, snapshot_store, audit_log | status `UTILITY_CALCULATED`; writes trace and snapshots | yes | P0 |
| GET | `/api/v1/utilities/latest` | `_dispatch` | query none | latest utility record | `UtilityService.latest` | utility_record | read only | yes | P0 |
| GET | `/api/v1/utilities/{utility_id}/trace` | `_dispatch` | path `utility_id` | utility plus trace rows | `UtilityService.trace` | utility_trace | read only | yes | P0 |
| POST | `/api/v1/md-dshap/tasks` | `_dispatch` | `MdDshapTaskRunRequest` | project_status, task, results, traces summary | `MdDshapService.run` | md_dshap_task, md_dshap_result, md_dshap_marginal_trace, algorithm_audit_snapshot, audit_log | status `WEIGHT_CALCULATED`; writes task, results, traces, audit snapshot | yes | P0 |
| GET | `/api/v1/md-dshap/tasks/{task_id}` | `_dispatch` | path `task_id` | task metadata | `MdDshapService.task` | md_dshap_task | read only | yes | P0 |
| GET | `/api/v1/md-dshap/tasks/{task_id}/results` | `_dispatch` | path `task_id` | paged weight rows | `MdDshapService.results` | md_dshap_result | read only | yes | P0 |
| GET | `/api/v1/md-dshap/tasks/{task_id}/marginal-traces` | `_dispatch` | path `task_id` | paged marginal traces | `MdDshapService.marginal_traces` | md_dshap_marginal_trace | read only | yes | P0 |
| GET | `/api/v1/contract-constraints` | `_dispatch` | query none | `TablePage<ContractConstraint>` | `ContractConstraintService.list` | contract_constraint | read only | yes | P0 |
| POST | `/api/v1/contract-constraints` | `_dispatch` | `ContractConstraintWriteRequest` | created constraint | `ContractConstraintService.create` | contract_constraint, audit_log | writes constraint and audit | yes | P0 |
| PUT | `/api/v1/contract-constraints/{constraint_id}` | `_dispatch` | `ContractConstraintWriteRequest` | updated constraint | `ContractConstraintService.update` | contract_constraint, audit_log | versioned write and audit | yes | P0 |
| PATCH | `/api/v1/contract-constraints/{constraint_id}/status` | `_dispatch` | `ContractConstraintStatusRequest` | updated constraint status | `ContractConstraintService.set_status` | contract_constraint, audit_log | logical disable and audit | yes | P0 |
| POST | `/api/v1/allocation-scenarios` | `_dispatch` | `AllocationScenarioCreateRequest` | allocation scenario | `AllocationService.create` | allocation_scenario, audit_log | creates DRAFT scenario; validates weight/revenue preconditions | yes | P0 |
| POST | `/api/v1/allocation-scenarios/{allocation_id}/simulate` | `_dispatch` | path `allocation_id` | allocation, results, constraint traces, project_status | `AllocationService.simulate` | allocation_result, constraint_apply_trace, snapshot_store, audit_log | status `ALLOCATED`; writes results/traces/snapshot/audit | yes | P0 |
| POST | `/api/v1/allocation-scenarios/{allocation_id}/lock` | `_dispatch` | path `allocation_id` | locked allocation, project_status | `AllocationService.lock` | allocation_scenario, audit_log | status `CONFIRMED`; no payment instruction | yes | P0 |
| GET | `/api/v1/allocation-scenarios/{allocation_id}/results` | `_dispatch` | path `allocation_id` | paged allocation result rows | `AllocationService.results` | allocation_result | read only | yes | P0 |
| GET | `/api/v1/reports` | `_dispatch` | query none | `TablePage<ReportRecord>` | `ReportService.list` | report_record | read only | yes | P0 |
| POST | `/api/v1/reports/markdown` | `_dispatch` | none | report plus export_files | `ReportService.generate_markdown` | report_record, export_file, snapshot_store, audit_log | status `EXPORTED`; writes checksum/report/export/audit | yes | P0 |
| POST | `/api/v1/reports/csv` | `_dispatch` | none | report plus CSV export files | `ReportService.generate_csv` | report_record, export_file, snapshot_store, audit_log | status `EXPORTED`; writes checksum/report/export/audit | yes | P0 |
| POST | `/api/v1/reports/json` | `_dispatch` | none | report plus JSON export file | `ReportService.generate_json` | report_record, export_file, snapshot_store, audit_log | status `EXPORTED`; writes checksum/report/export/audit | yes | P0 |
| POST | `/api/v1/reports/audit-log` | `_dispatch` | none | report plus audit JSONL export | `ReportService.export_audit_log` | report_record, export_file, audit_log | status depends context; writes report/export/audit | yes | P0 |
| GET | `/api/v1/system/parameters` | `_dispatch` | query none | `TablePage<SystemParameter>` | `SystemParameterService.list` | system_parameter | read only | yes | P0 |
| GET | `/api/v1/system/parameters/{parameter_code}` | `_dispatch` | path `parameter_code` | system parameter | `SystemParameterService.detail` | system_parameter | read only | yes | P0 |
| PUT | `/api/v1/system/parameters/{parameter_code}` | `_dispatch` | `SystemParameterUpdateRequest` | updated parameter | `SystemParameterService.update` | system_parameter, parameter_version, snapshot_store, audit_log | writes parameter version and snapshot; no historical result mutation | yes | P0 |
| POST | `/api/v1/system/parameters/{parameter_code}/restore-default` | `_dispatch` | path `parameter_code` | restored parameter | `SystemParameterService.restore_default` | system_parameter, parameter_version, snapshot_store, audit_log | writes new parameter version | yes | P0 |
| GET | `/api/v1/audit-logs` | `_dispatch` | query filters | `TablePage<AuditLog>` | `AuditLogService.list` | audit_log | read only | yes | P0 |
| GET | `/api/v1/audit-logs/{log_id}` | `_dispatch` | path `log_id` | audit_log plus snapshot refs/content | `AuditLogService.detail` | audit_log, snapshot_store | read only | yes | P0 |

## Frontend Action to API Mapping

Legend:

- `Mock writes`: A = audit_log mock record, S = snapshot mock record, R/E = report_record/export_file mock record, State = project status or mock domain state update, UI = drawer/modal/read-only local behavior.
- `Status effect` describes intended backend project or object status effects, not current frontend integration.
- `Difficulty` is the frontend integration difficulty for Phase 2C.

| actionCode | label | page route | moduleCode | permission | handlerName / frontend service method | current mock behavior / store slice | proposed backend endpoint | backend endpoint status | request DTO | response DTO | status side effect | audit side effect | snapshot side effect | report/export side effect | difficulty | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SYS-002 | 选择演示数据 | `/dashboard` | SYS | CREATE | `DashboardService.handleAction` | State+A+S; `snapshot.status`, `mock.snapshots`, `mock.auditLogs` | `POST /api/v1/demo-cases/{demo_case_id}/initialize` | EXISTING | path demo_case_id | project_status, package, input_snapshot, resources, parties | `INGESTED` | yes; `SYS` + `NAV_SYS_HOME` | input snapshot | no | READY | System-home demo selection writes home audit context by default. |
| SYS-004 | 执行完整链路计算 | `/dashboard` | SYS | CALCULATE | `DashboardService.handleAction` | State+A+S; `mock.mdsTasks`, weights, snapshots | `POST /api/v1/dashboard/actions/quick-run` or orchestrated chain | PARTIAL | none today | precondition result | desired full chain to `WEIGHT_CALCULATED` or beyond | yes desired; `SYS` + `NAV_SYS_HOME` | multiple snapshots desired | no | NEEDS_BACKEND_ENDPOINT | Existing action endpoint is skeleton/precondition response, not full-chain executor. |
| SYS-005 | 查看风险边界 | `/dashboard` | SYS | VIEW | `DashboardService.handleAction` | A only through generic mock if clicked; UI risk content | `GET /api/v1/dashboard` plus `GET /api/v1/system/parameters/RISK_DISCLAIMER_TEXT` | EXISTING | none/path parameter | risk_notices / parameter | none | optional; `SYS` + `NAV_SYS_HOME` if recorded | no | no | NEEDS_DTO_MAPPER | View-only can hydrate from dashboard risk notices and parameter detail. |
| DATA-002 | 选择演示数据 | `/data/packages` | DATA | CREATE | `DataPackageService.handleAction` | A+S via generic mock or dormant backend helper | `POST /api/v1/demo-cases/{demo_case_id}/initialize` | EXISTING | path demo_case_id | package, input_snapshot, resources, parties | `INGESTED` | yes | input snapshot | no | READY | Current private helper already calls this when backend connected. |
| DATA-003 | 上传 JSON | `/dashboard`, `/data/packages` | DATA | CREATE | `DataPackageService.handleAction` | A+S generic mock or dormant `uploadDemoJson` helper | `POST /api/v1/data-packages/upload` | EXISTING | `DataPackageUploadRequest` | package, validation_result, input_snapshot, resources, parties | `INGESTED` on success | yes | input snapshot on success | no | NEEDS_DTO_MAPPER | Real upload must pass user JSON, not hardcoded demo payload. |
| DATA-007 | 预览安全摘要 | `/data/packages` | DATA | VIEW | `DataPackageService.handleAction` | A read mock; page drawer | `GET /api/v1/data-packages/{package_id}` | EXISTING | path package_id | package, input_snapshot, validation_result, resources | none | optional read audit only if required | no | no | NEEDS_DTO_MAPPER | Safe preview must suppress sensitive raw content. |
| DATA-008 | 查看失败详情 | `/data/packages` | DATA | VIEW | `DataPackageService.handleAction` | A read mock; failure drawer | `GET /api/v1/data-packages/{package_id}/validation-result` | EXISTING | path package_id | upload_validation_result | none | optional read audit | no | no | READY | Backend validation failure stores invalid package and validation result. |
| DATA-009 | 停用数据包 | `/data/packages` | DATA | DELETE_DISABLE | `DataPackageService.handleAction` | A only; no package state mutation | `PATCH /api/v1/data-packages/{package_id}/status` | MISSING | package_id, status, reason | updated data_package | data package disabled | yes | no | no | NEEDS_BACKEND_ENDPOINT | No backend disable/delete package endpoint. |
| RES-002 | 查看资源详情 | `/data/resources` | RES | VIEW | `ResourceService.handleAction` | A read mock; detail drawer | `GET /api/v1/data-resources/{resource_id}` | EXISTING | path resource_id | data_resource | none | optional read audit | no | no | NEEDS_DTO_MAPPER | Backend detail lacks resource field stats/desensitized preview depth used by UI. |
| RES-005 | 绑定数据源主体 | `/data/resources` | RES | UPDATE | `ResourceService.handleAction` | State+A; `mock.resources`, relation technical detail | `PUT /api/v1/data-resources/{resource_id}/party-relations` | PARTIAL | `ResourcePartyRelationRequest` | updated data_resource | relation updated | yes | no | no | NEEDS_DTO_MAPPER | Binding exists; include_in_calculation toggle has no backend field/endpoint. |
| RES-007 | 导出资源摘要 | `/data/resources` | RES | EXPORT | `ResourceService.handleAction` | A+R/E; `mock.exports`, `mock.reports` | `POST /api/v1/data-resources/export-summary` | MISSING | resource filter, field scope | report_record, export_file | `EXPORTED` optional | yes | report snapshot desired | yes | NEEDS_BACKEND_ENDPOINT | Current `/reports/csv` is full allocation export, not resource-summary export. |
| PARTY-002 | 新增参与方 | `/data/parties` | PARTY | CREATE | `PartyService.handleAction` | A generic mock | `POST /api/v1/parties` | EXISTING | `PartyWriteRequest` | party | party enabled | yes | no | no | NEEDS_DTO_MAPPER | Must map UI type labels to backend enum. |
| PARTY-003 | 编辑参与方 | `/data/parties` | PARTY | UPDATE | `PartyService.handleAction` | A generic mock | `PUT /api/v1/parties/{party_id}` | EXISTING | `PartyWriteRequest` | party | versioned update | yes | no | no | NEEDS_DTO_MAPPER | Backend prevents duplicate/invalid names. |
| PARTY-005 | 停用参与方 | `/data/parties` | PARTY | DELETE_DISABLE | `PartyService.handleAction` | A generic mock | `PATCH /api/v1/parties/{party_id}/status` | EXISTING | `PartyStatusRequest` | party | disabled/enabled | yes | no | no | READY | Backend guards disabling only enabled data provider. |
| PARTY-006 | 关联资源 | `/data/parties` | PARTY | UPDATE | `PartyService.handleAction` | A generic mock; form drawer | `PUT /api/v1/data-resources/{resource_id}/party-relations` | PARTIAL | `ResourcePartyRelationRequest` | updated data_resource | relation updated | yes | no | no | NEEDS_DTO_MAPPER | Backend is resource-centric; party page needs resource selection adapter. |
| PARTY-008 | 查看贡献摘要 | `/data/parties` | PARTY | VIEW | `PartyService.handleAction` | A read mock; contribution drawer | `GET /api/v1/utilities/latest`, `GET /api/v1/md-dshap/tasks/{task_id}/results` | PARTIAL | none/path task_id | utility/weights | none | optional read audit | no | no | NEEDS_BACKEND_ENDPOINT | No contribution_record list endpoint; summary requires joining utility and weights. |
| QUAL-002 | 配置质量指标权重 | `/measure/quality` | QUAL | UPDATE | `QualityService.handleAction` | A generic mock; form drawer | `PUT /api/v1/system/parameters/{parameter_code}` | PARTIAL | `SystemParameterUpdateRequest` | parameter/version | parameter version | yes | parameter snapshot | no | NEEDS_DTO_MAPPER | No dedicated quality_metric weight endpoint; generic parameters may cover limited cases. |
| QUAL-003 | 运行质量评估 | `/measure/quality` | QUAL | CALCULATE | `QualityService.handleAction` | A+S generic or dormant backend helper | `POST /api/v1/quality-assessments/run` | EXISTING | `QualityRunRequest` | project_status, assessment, details | `ASSESSED` | yes | output snapshot | no | READY | Current helper already calls this when backend connected. |
| QUAL-006 | 查看二级指标得分 | `/measure/quality` | QUAL | VIEW | `QualityService.handleAction` | A read mock; score drawer | `GET /api/v1/quality-assessments/{assessment_id}/details` | EXISTING | path assessment_id | assessment plus details | none | optional read audit | no | no | READY | Requires latest assessment id lookup. |
| QUAL-009 | 重新评估 | `/measure/quality` | QUAL | CALCULATE | `QualityService.handleAction` | A+S generic or helper | `POST /api/v1/quality-assessments/run` | EXISTING | `QualityRunRequest` | new assessment/details | `ASSESSED`; new version | yes | output snapshot | no | READY | Backend creates new assessment instead of overwriting. |
| DU-002 | 配置基准数元 | `/measure/shuyuan` | DU | UPDATE | `ShuyuanService.handleAction` | A generic mock | `PUT /api/v1/system/parameters/DEFAULT_SHUYUAN_BASE_PRICE` | PARTIAL | `SystemParameterUpdateRequest` | parameter/version | parameter version | yes | parameter snapshot | no | NEEDS_DTO_MAPPER | Coefficients are parameters, but page-specific save bundle endpoint is absent. |
| DU-003 | 录入调用量 | `/measure/shuyuan` | DU | UPDATE | `ShuyuanService.handleAction` | A generic mock | `POST /api/v1/shuyuan-meterings/run` with `call_count` | PARTIAL | `ShuyuanMeteringRunRequest` | metering/details | only when run executes | yes on run | parameter/output snapshots on run | no | NEEDS_BACKEND_SCHEMA_CHANGE | No draft call-count persistence endpoint. |
| DU-009 | 执行数元计量 | `/measure/shuyuan` | DU | CALCULATE | `ShuyuanService.handleAction` | A+S generic mock | `POST /api/v1/shuyuan-meterings/run` | EXISTING | `ShuyuanMeteringRunRequest` | project_status, metering, details | `METERED` | yes | parameter/output snapshots | no | READY | Amount precision is 2 decimals. |
| DU-010 | 查看计量明细 | `/measure/shuyuan` | DU | VIEW | `ShuyuanService.handleAction` | A read mock | `GET /api/v1/shuyuan-meterings/{metering_id}/details` | EXISTING | path metering_id | metering plus details | none | optional read audit | no | no | READY | Requires latest metering id lookup. |
| UTIL-001 | 配置贡献因子 | `/measure/utility` | UTIL | UPDATE | `UtilityService.handleAction` | A generic mock | `POST /api/v1/contributions/run` with weights | PARTIAL | `ContributionRunRequest` | contribution records | only when run executes | yes on run | snapshots on run | no | NEEDS_DTO_MAPPER | No independent saved factor version endpoint. |
| UTIL-006 | 计算贡献度 | `/measure/utility` | UTIL | CALCULATE | `UtilityService.handleAction` | A+S generic mock | `POST /api/v1/contributions/run` | EXISTING | `ContributionRunRequest` | project_status, records | remains `METERED` | yes | parameter/result snapshots | no | READY | Backend normalizes contribution to 1.000000. |
| UTIL-007 | 配置效用函数 | `/measure/utility` | UTIL | UPDATE | `UtilityService.handleAction` | A generic mock | `POST /api/v1/utilities/run` with factors | PARTIAL | `UtilityRunRequest` | utility/trace | only when run executes | yes on run | snapshots on run | no | NEEDS_BACKEND_SCHEMA_CHANGE | No utility_function_snapshot configuration endpoint before calculation. |
| UTIL-008 | 计算效用值 | `/measure/utility` | UTIL | CALCULATE | `UtilityService.handleAction` | A+S generic mock | `POST /api/v1/utilities/run` | EXISTING | `UtilityRunRequest` | project_status, utility, trace | `UTILITY_CALCULATED` | yes | output snapshots | no | READY | Utility precision is 6 decimals. |
| UTIL-009 | 查看效用轨迹 | `/measure/utility` | UTIL | VIEW | `UtilityService.handleAction` | A read mock; trace drawer | `GET /api/v1/utilities/{utility_id}/trace` | EXISTING | path utility_id | utility plus trace rows | none | optional read audit | no | no | READY | Requires latest utility id lookup. |
| PARAM-001 | 查看参数 | `/system/parameters` | PARAM | VIEW | `ParameterService.handleAction` | A read mock | `GET /api/v1/system/parameters` | EXISTING | none | parameter table page | none | optional read audit | no | no | READY | Supports list and detail. |
| PARAM-002 | 保存参数版本 | `/system/parameters` | PARAM | UPDATE | `ParameterService.handleAction` | A generic mock | `PUT /api/v1/system/parameters/{parameter_code}` | EXISTING | `SystemParameterUpdateRequest` | parameter/version | parameter version | yes | version snapshot | no | READY | Non-editable params rejected. |
| PARAM-004 | 配置 MD-DShap 默认值 | `/allocation/md-dshap`, `/system/parameters` | PARAM | UPDATE | `ParameterService.handleAction` | A generic mock | `PUT /api/v1/system/parameters/DEFAULT_MD_DSHAP_SAMPLE_ROUNDS` and related params | EXISTING | `SystemParameterUpdateRequest` | parameter/version | parameter version | yes | version snapshot | no | NEEDS_DTO_MAPPER | Multiple backend parameter codes needed for one UI form. |
| PARAM-008 | 保存风险提示文案 | `/system/parameters` | PARAM | UPDATE | `ParameterService.handleAction` | A generic mock | `PUT /api/v1/system/parameters/RISK_DISCLAIMER_TEXT` | EXISTING | `SystemParameterUpdateRequest` | parameter/version | parameter version | yes | version snapshot | no | READY | Must keep simulation-reference copy. |
| MDS-011 | 启动 MD-DShap | `/allocation/md-dshap` | MDS | CALCULATE | `MDDShapService.handleAction` | State+A+S; `mock.mdsTasks`, weights, traces | `POST /api/v1/md-dshap/tasks` | EXISTING | `MdDshapTaskRunRequest` | project_status, task, results | `WEIGHT_CALCULATED` | yes | input/parameter/output/audit snapshots | no | READY | Backend supports single-provider simplification and multi-provider normalized weights. |
| MDS-012 | 查看计算进度 | `/allocation/md-dshap` | MDS | VIEW | `MDDShapService.handleAction` | A read mock; progress drawer | `GET /api/v1/md-dshap/tasks/{task_id}` | EXISTING | path task_id | task metadata | none | optional read audit | no | no | READY | P0 backend is synchronous; progress is terminal metadata. |
| MDS-013 | 查看边际贡献明细 | `/allocation/md-dshap` | MDS | VIEW | `MDDShapService.handleAction` | A read mock; trace drawer | `GET /api/v1/md-dshap/tasks/{task_id}/marginal-traces` | EXISTING | path task_id | trace table page | none | optional read audit | no | no | READY | Trace columns map coalition/v_before/v_after/marginal_contribution. |
| MDS-014 | 查看参与方权重 | `/allocation/md-dshap` | MDS | VIEW | `MDDShapService.handleAction` | A read mock; weights table | `GET /api/v1/md-dshap/tasks/{task_id}/results` | EXISTING | path task_id | result table page | none | optional read audit | no | no | READY | Backend tests assert normalized sum 1.000000. |
| MDS-015 | 查看复杂度优化说明 | `/allocation/md-dshap` | MDS | VIEW | `MDDShapService.handleAction` | UI modal plus A read mock | none | OUT_OF_SCOPE | none | static explanation | none | optional read audit | no | no | READY | Static product explanation; no backend endpoint required unless audit requires read log. |
| MDS-016 | 重新计算 | `/allocation/md-dshap` | MDS | CALCULATE | `MDDShapService.handleAction` | State+A+S; new mock task version | `POST /api/v1/md-dshap/tasks` | EXISTING | `MdDshapTaskRunRequest` | new task/results | `WEIGHT_CALCULATED`; new task id | yes | new snapshots | no | READY | Backend tests verify rerun preserves previous results. |
| MDS-017 | 导出算法结果 | `/allocation/md-dshap` | MDS | EXPORT | `MDDShapService.handleAction` | A+R/E; algorithm result export | `POST /api/v1/reports/csv` or new algorithm export | PARTIAL | none today | report/export files | `EXPORTED` if using reports | yes | report snapshot | yes | NEEDS_BACKEND_ENDPOINT | `/reports/csv` includes `md_dshap_weights.csv`, but no standalone algorithm export. |
| MDS-018 | 生成算法审计说明 | `/allocation/md-dshap` | MDS | EXPORT | `MDDShapService.handleAction` | A+R; audit report record only | `POST /api/v1/reports/md-dshap-audit` | MISSING | task_id/field scope | report_record/export_file | optional `EXPORTED` | yes | report snapshot | yes | NEEDS_BACKEND_ENDPOINT | Required by UI; backend only has full report/audit-log exports. |
| ALLOC-003 | 配置总收益 | `/allocation/simulation` | ALLOC | UPDATE | `AllocationService.handleAction` | A generic mock | `POST /api/v1/allocation-scenarios` | EXISTING | `AllocationScenarioCreateRequest` | allocation_scenario | creates DRAFT scenario | yes | no | no | NEEDS_DTO_MAPPER | UI may stage form locally, then create scenario with total_revenue. |
| ALLOC-005 | 配置合同优先分配 | `/allocation/simulation` | ALLOC | UPDATE | `AllocationService.handleAction` | A generic mock | `POST /api/v1/allocation-scenarios` | EXISTING | `AllocationScenarioCreateRequest` | allocation_scenario | DRAFT scenario / revenue pool | yes | no | no | NEEDS_DTO_MAPPER | Backend validates priority amount <= total revenue. |
| ALLOC-007 | 选择分配模式 | `/allocation/simulation` | ALLOC | UPDATE | `AllocationService.handleAction` | A generic mock | `POST /api/v1/allocation-scenarios` | EXISTING | `AllocationScenarioCreateRequest` | allocation_scenario | DRAFT scenario | yes | no | no | NEEDS_DTO_MAPPER | Backend default `MD_DSHAP_WEIGHT_WITH_CONSTRAINTS`. |
| ALLOC-011 | 执行收益分配模拟 | `/allocation/simulation` | ALLOC | CALCULATE | `AllocationService.handleAction` | A+S generic mock | `POST /api/v1/allocation-scenarios/{allocation_id}/simulate` | EXISTING | path allocation_id | allocation, results, traces | `ALLOCATED` | yes | result snapshot | no | READY | Writes constraint_apply_trace rows. |
| ALLOC-013 | 查看分配方案对比 | `/allocation/simulation` | ALLOC | VIEW | `AllocationService.handleAction` | A read mock | `GET /api/v1/allocation-scenarios/{allocation_id}/results` | EXISTING | path allocation_id | allocation_result table page | none | optional read audit | no | no | READY | Compare requires grouping versions on frontend. |
| ALLOC-014 | 复制新版本 | `/allocation/simulation` | ALLOC | CREATE | `AllocationService.handleAction` | A generic mock | `POST /api/v1/allocation-scenarios/{allocation_id}/copy` | MISSING | allocation_id, overrides | allocation_scenario | new DRAFT version | yes | optional parameter snapshot | no | NEEDS_BACKEND_ENDPOINT | Backend can create fresh scenario but has no copy-from-existing endpoint. |
| ALLOC-015 | 锁定分配方案 | `/allocation/simulation` | ALLOC | CONFIRM | `AllocationService.handleAction` | A generic mock | `POST /api/v1/allocation-scenarios/{allocation_id}/lock` | EXISTING | path allocation_id | locked allocation | `CONFIRMED` | yes | no | no | READY | Backend states no legal settlement/payment instruction. |
| ALLOC-016 | 导出分配结果 | `/allocation/simulation` | ALLOC | EXPORT | `AllocationService.handleAction` | A+R/E generic mock | `POST /api/v1/reports/csv` or `POST /api/v1/reports/json` | EXISTING | none | report/export files | `EXPORTED` | yes | report snapshot | yes | READY | CSV includes source-level allocation; JSON includes allocation_result. |
| CONS-002 | 新增合同约束 | `/allocation/constraints` | CONS | CREATE | `ConstraintService.handleAction` | A generic mock | `POST /api/v1/contract-constraints` | EXISTING | `ContractConstraintWriteRequest` | contract_constraint | constraint active/disabled | yes | no | no | READY | Validates amount/ratio/type. |
| CONS-003 | 编辑约束 | `/allocation/constraints` | CONS | UPDATE | `ConstraintService.handleAction` | A generic mock | `PUT /api/v1/contract-constraints/{constraint_id}` | EXISTING | `ContractConstraintWriteRequest` | contract_constraint | increments version | yes | no | no | READY | |
| CONS-004 | 删除/停用合同约束 | `/allocation/constraints` | CONS | DELETE_DISABLE | `ConstraintService.handleAction` | A generic mock | `PATCH /api/v1/contract-constraints/{constraint_id}/status` | EXISTING | `ContractConstraintStatusRequest` | contract_constraint | disabled/enabled | yes | no | no | READY | Physical delete remains out of P0 boundary. |
| CONS-011 | 查看约束检查结果 | `/allocation/constraints` | CONS | VIEW | `ConstraintService.handleAction` | A read mock; trace drawer | `POST /api/v1/allocation-scenarios/{allocation_id}/simulate` then read returned traces | PARTIAL | allocation_id | constraint_traces in simulation response | none for pure check desired | yes if simulation | result snapshot if simulation | no | NEEDS_BACKEND_ENDPOINT | No pre-simulation check-only endpoint; results are produced during simulate. |
| REP-001 | 预览报告 | `/dashboard`, `/reports` | REP | VIEW | `ReportService.handleAction` | A read mock | `GET /api/v1/reports` plus report context endpoints | EXISTING | none | report records | none | optional read audit | no | no | NEEDS_DTO_MAPPER | Existing list lacks full preview body; preview can assemble from records/results. |
| REP-002 | 导出 Markdown | `/reports` | REP | EXPORT | `ReportService.handleAction` | A+S+R/E generic mock | `POST /api/v1/reports/markdown` | EXISTING | none | report/export files | `EXPORTED` | yes | report snapshot | yes | READY | P0 Markdown report implemented. |
| REP-003 | 生成 PDF 报告 | `/reports` | REP | EXPORT | `ReportService.handleAction` | disabled P1 UI only | none | MOCK_ONLY_P1 | none | none | none | no | no | no | KEEP_MOCK_FOR_P1 | Tests assert PDF routes absent. |
| REP-004 | 导出 CSV 明细 | `/reports` | REP | EXPORT | `ReportService.handleAction` | A+S+R/E generic mock | `POST /api/v1/reports/csv` | EXISTING | none | report/export files | `EXPORTED` | yes | report snapshot | yes | READY | Backend formats amounts 2 decimals and weights 6 decimals. |
| REP-005 | 导出 JSON 结果 | `/reports` | REP | EXPORT | `ReportService.handleAction` | A+S+R/E generic mock | `POST /api/v1/reports/json` | EXISTING | none | report/export file | `EXPORTED` | yes | report snapshot | yes | READY | JSON includes snapshot refs/results/disclaimer. |
| REP-006 | 导出算法审计说明 | `/reports` | REP | EXPORT | `ReportService.handleAction` | A+S+R/E generic mock | `POST /api/v1/reports/md-dshap-audit` | MISSING | task_id | report/export file | `EXPORTED` optional | yes | report snapshot | yes | NEEDS_BACKEND_ENDPOINT | Existing `/reports/audit-log` is JSONL audit export, not algorithm audit narrative. |
| REP-009 | 导出收益分配确认书 | `/reports` | REP | EXPORT | `ReportService.handleAction` | A+S+R/E generic mock | `POST /api/v1/reports/allocation-confirmation` | MISSING | allocation_id | report/export file | `EXPORTED` optional | yes | report snapshot | yes | NEEDS_BACKEND_ENDPOINT | Required by reporting contract but not implemented as endpoint. |
| USER-001 | 新增用户 | `/system/users` | USER | CREATE | `UserService.handleAction` | P1 mock only | none | MOCK_ONLY_P1 | none | none | none | no | no | no | KEEP_MOCK_FOR_P1 | Login/RBAC/users are P1 and tests assert routes absent. |
| USER-002 | 编辑用户 | `/system/users` | USER | UPDATE | `UserService.handleAction` | P1 mock only | none | MOCK_ONLY_P1 | none | none | none | no | no | no | KEEP_MOCK_FOR_P1 | |
| USER-007 | 配置角色 | `/system/users` | USER | UPDATE | `UserService.handleAction` | P1 mock only | none | MOCK_ONLY_P1 | none | none | none | no | no | no | KEEP_MOCK_FOR_P1 | |
| USER-008 | 查看权限矩阵 | `/system/users` | USER | VIEW | `UserService.handleAction` | P1 read-only page | none | MOCK_ONLY_P1 | none | none | none | no | no | no | KEEP_MOCK_FOR_P1 | |
| USER-009 | 重置密码 | `/system/users` | USER | UPDATE | `UserService.handleAction` | P1 mock only | none | MOCK_ONLY_P1 | none | none | none | no | no | no | KEEP_MOCK_FOR_P1 | |
| AUD-002 | 查询审计日志 | `/system/audit` | AUD | VIEW | `AuditService.handleAction` | A read mock | `GET /api/v1/audit-logs` | EXISTING | query filters | audit_log table page | none | no for read | no | no | READY | Query is read-only; supports filters/limit. |
| AUD-006 | 查看快照详情 | `/system/audit` | AUD | VIEW | `AuditService.handleAction` | A read mock; trace drawer | `GET /api/v1/audit-logs/{log_id}` | PARTIAL | path log_id | audit_log plus snapshots | none | no for read | no | no | NEEDS_BACKEND_ENDPOINT | Backend exposes snapshots through audit log detail, not direct `snapshot/{id}` lookup. |
| AUD-007 | 导出审计日志 | `/system/audit` | AUD | EXPORT | `AuditService.handleAction` | A+R/E generic mock | `POST /api/v1/reports/audit-log` | EXISTING | none | report/export file | `EXPORTED` when context exists | yes | report snapshot if context | yes | READY | Produces audit JSONL with audit/report/export records. |

## Service to API Mapping

| Frontend service file | Frontend method | Backend route/service | Request field mapping | Response field mapping | snake_case/camelCase | Enum conversion | Decimal/amount rule | Error handling rule | Fallback to mock allowed? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DashboardService.ts` | `handleAction` | `GET /dashboard`, `GET /dashboard/preconditions`, `POST /demo-cases/{id}/initialize`, `POST /dashboard/actions/quick-run` | `demoCaseId`, no current full-chain DTO | project status, metrics, risk notices, action gates | yes | project statuses to Chinese | counts integer | map `field_errors` to problem/location/repair | yes until quick-run complete |
| `DataPackageService.ts` | `handleAction` | `POST /demo-cases/{id}/initialize`, `POST /data-packages/upload`, `GET /data-packages*` | UI file/JSON to `DataPackageUploadRequest` | package/resources/parties/validation | yes | source/status/modality labels | sizes/counts numeric | upload errors must show field and repair | yes for manual demo |
| `ResourceService.ts` | `handleAction` | `GET /data-resources*`, `PUT /data-resources/{id}/party-relations` | `providerName` must map to `party_id`; split ratio percent to 0..1 | resource party relations to UI provider/split | yes | modality/status labels | split ratio precision 0..1 backend, percent in UI | invalid ratio field maps to binding form | yes for resource export/toggle |
| `PartyService.ts` | `handleAction` | `GET/POST/PUT/PATCH /parties*`; relation via resource endpoint | UI type labels to backend `party_type`; include flag | party rows and status | yes | `DATA_PROVIDER`, `OPERATOR`, `TECH_SERVICE`, etc. | none | duplicate/last-provider errors show modal | yes for contribution summary |
| `QualityService.ts` | `handleAction` | `POST /quality-assessments/run`, `GET /quality-assessments/latest`, `GET /quality-assessments/{id}/details`, parameters | package id optional; weight config currently parameterized | assessment/detail rows | yes | quality level/status labels | scores 0..100, factor 6 decimals | precondition errors block run button | yes for weight config |
| `ShuyuanService.ts` | `handleAction` | `POST /shuyuan-meterings/run`, `GET /shuyuan-meterings/latest/details`, parameters | coefficients/call_count | metering/detail rows | yes | status labels | amounts 2 decimals | missing quality -> blocker | yes for draft config |
| `UtilityService.ts` | `handleAction` | `POST /contributions/run`, `POST /utilities/run`, `GET /utilities/latest/trace` | weights/factors | contribution records, utility, trace | yes | status labels | weights/utilities 6 decimals | missing metering/contribution -> blocker | yes for function config |
| `MDDShapService.ts` | `handleAction` | `POST /md-dshap/tasks`, `GET /md-dshap/tasks/{id}/*` | seed, sample_rounds, epsilon, save_marginal_detail | task, result rows, marginal traces | yes | `MD_DSHAP`, `COMPLETED` to Chinese | normalized weights 6 decimals; sum 1 | utility/participant precondition to panel | yes for standalone exports |
| `AllocationService.ts` | `handleAction` | `POST /allocation-scenarios`, `POST /simulate`, `POST /lock`, `GET /results` | total, priority, mode, weight_task_id | scenario/results/traces | yes | allocation status/mode labels | amounts 2 decimals; weights 6 decimals | revenue/priority errors attach to fields | no after scenario DTO mapper ready |
| `ConstraintService.ts` | `handleAction` | `GET/POST/PUT/PATCH /contract-constraints*`; traces from allocation simulate | party id, constraint type/value/status | constraints and returned traces | yes | constraint types/status | amount 2 decimals; ratio 0..1 | validation errors attach to form rows | yes for check-only action |
| `ReportService.ts` | `handleAction` | `GET /reports`, `POST /reports/markdown/csv/json/audit-log` | mostly no body today; future field scope | report_record/export_files | yes | report type/file format labels | checksums string; amount/weight as file rule | precondition errors show missing allocation | yes for P1 PDF/extra report types |
| `ParameterService.ts` | `handleAction` | `GET/PUT/POST /system/parameters*` | parameter_code/current_value | parameter/version rows | yes | parameter type/scope labels | numeric params positive; precision by parameter | non-editable errors show reason | no for P0 editable params |
| `UserService.ts` | `handleAction` | none | P1 only | P1 only | yes later | role/status enums later | n/a | keep disabled P1 copy | yes, keep mock |
| `AuditService.ts` | `handleAction` | `GET /audit-logs`, `GET /audit-logs/{id}`, `POST /reports/audit-log` | filters/limit/log_id | audit rows, snapshot refs, export file | yes | module/status labels | n/a | not-found and filter validation | yes for direct snapshot until endpoint exists |

## Backend Gap List

| gap id | module | missing endpoint | required by actionCode | required backend table/service | expected request | expected response | priority | blocker level |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GAP-API-001 | SYS | Full-chain `POST /api/v1/dashboard/actions/quick-run` implementation | SYS-004 | DashboardService orchestration over data/quality/shuyuan/contribution/utility/mds/allocation | run_mode, demo_case_id, optional allocation inputs | chain status, completed stages, failure stage, snapshots | P0 | BLOCKS_FULL_CHAIN |
| GAP-API-002 | DATA | `PATCH /api/v1/data-packages/{package_id}/status` | DATA-009 | data_package, audit_log | status, reason | updated package | P0 | BLOCKS_PAGE_ACTION |
| GAP-API-003 | RES | Resource summary export endpoint | RES-007 | data_resource, report_record, export_file | filters, field scope, format | report_record, export_files | P0 | BLOCKS_PAGE_ACTION |
| GAP-API-004 | RES | include_in_calculation update endpoint/field | RES-005 | data_resource | include_in_calculation | updated resource plus blocker reason | P0 | BLOCKS_PAGE_ACTION |
| GAP-API-005 | PARTY | party-centric resource relation endpoint or adapter contract | PARTY-006 | data_resource_party_relation | party_id, resource relations | updated relations | P0 | BLOCKS_PAGE_ACTION |
| GAP-API-006 | PARTY | contribution summary/list endpoint | PARTY-008 | contribution_record, utility_record, md_dshap_result | party_id/project_id | contribution, utility, weight summary | P0 | BLOCKS_PAGE_ACTION |
| GAP-API-007 | QUAL | quality metric weight save endpoint | QUAL-002 | quality_metric_template, parameter_version | metric weights | parameter/version snapshot | P0 | BLOCKS_PAGE_ACTION |
| GAP-API-008 | DU | call count draft/save endpoint | DU-003 | shuyuan_metering input staging or parameter_version | resource/party call counts | saved draft/version | P0 | BLOCKS_PAGE_ACTION |
| GAP-API-009 | UTIL | utility function snapshot configuration endpoint | UTIL-007 | utility_function_snapshot | formula, factors, disclosure text | snapshot/version | P0 | BLOCKS_PAGE_ACTION |
| GAP-API-010 | MDS | standalone algorithm result export | MDS-017 | md_dshap_result, report_record, export_file | task_id, format | report/export files | P0 | BLOCKS_PAGE_ACTION |
| GAP-API-011 | MDS/REP | MD-DShap audit narrative export | MDS-018, REP-006 | algorithm_audit_snapshot, report_record, export_file | task_id, field scope | markdown/json report file | P0 | BLOCKS_PAGE_ACTION |
| GAP-API-012 | ALLOC | copy allocation scenario endpoint | ALLOC-014 | allocation_scenario | source allocation_id, overrides | new DRAFT scenario | P0 | BLOCKS_PAGE_ACTION |
| GAP-API-013 | CONS | constraint check-only endpoint | CONS-011 | contract_constraint, constraint_apply_trace | allocation_id or candidate constraints | check result without simulation side effect | P0 | NICE_TO_HAVE |
| GAP-API-014 | REP | allocation confirmation statement export | REP-009 | allocation_scenario, allocation_result, report_record | allocation_id | confirmation markdown/json | P0 | BLOCKS_PAGE_ACTION |
| GAP-API-015 | AUD | direct snapshot detail endpoint | AUD-006 | snapshot_store | snapshot_id | snapshot metadata/content | P0 | BLOCKS_PAGE_ACTION |
| GAP-API-016 | USER | user/role/permission APIs | USER-001/002/007/008/009 | user_account, role, permission, user_role, role_permission | P1 user/RBAC DTOs | P1 user/RBAC responses | P1 | P1_ONLY |
| GAP-API-017 | REP | PDF report endpoints | REP-003 | report renderer P1 | report_id/template | PDF file metadata | P1 | P1_ONLY |

BLOCKS_FULL_CHAIN gaps:

- `GAP-API-001`: `SYS-004` needs a full-chain backend quick-run implementation if Phase 2C expects one button to execute the complete chain through one API. The backend currently exposes the individual chain endpoints, but `/dashboard/actions/quick-run` is still a skeleton/precondition response.

## Integration Order

### 1. Project / Dashboard 状态

- Directly connectable actions: `SYS-002`, `SYS-005`, `PARAM-001` for parameter-backed risk text.
- Backend to supplement: `SYS-004` quick-run full implementation.
- DTO mappers: project status, dashboard metrics, preconditions, available/disabled action IDs.
- Acceptance path: `/dashboard`.
- Fallback: keep `SYS-004` mock orchestration until `GAP-API-001` closes.

### 2. DataPackage / Resource / Party

- Directly connectable actions: `DATA-002`, `DATA-003`, `DATA-007`, `DATA-008`, `RES-002`, `PARTY-002`, `PARTY-003`, `PARTY-005`.
- Needs backend or mapper: `DATA-009`, `RES-005` calculation toggle, `RES-007`, `PARTY-006`, `PARTY-008`.
- DTO mappers: upload JSON, resource relation split ratio, party type/status enum, snake_case to camelCase.
- Acceptance path: `/data/packages`, `/data/resources`, `/data/parties`.
- Fallback: keep UI-only resource export and contribution summary mock until gaps close.

### 3. Quality / Shuyuan / Utility

- Directly connectable actions: `QUAL-003`, `QUAL-006`, `QUAL-009`, `DU-009`, `DU-010`, `UTIL-006`, `UTIL-008`, `UTIL-009`.
- Needs backend or mapper: `QUAL-002`, `DU-002`, `DU-003`, `UTIL-001`, `UTIL-007`.
- DTO mappers: quality details, coefficients, call_count, contribution/utility factors.
- Acceptance path: `/measure/quality`, `/measure/shuyuan`, `/measure/utility`.
- Fallback: keep parameter/config drawers local until backend has save/version endpoints.

### 4. MD-DShap

- Directly connectable actions: `MDS-011`, `MDS-012`, `MDS-013`, `MDS-014`, `MDS-016`.
- Needs backend or mapper: `MDS-017`, `MDS-018`; `MDS-015` stays static/out-of-scope.
- DTO mappers: task metadata, participant set, task set, marginal traces, normalized weights.
- Acceptance path: `/allocation/md-dshap`.
- Fallback: keep standalone algorithm export/audit report mock until dedicated report endpoints exist.

### 5. Allocation / Constraint

- Directly connectable actions: `ALLOC-003`, `ALLOC-005`, `ALLOC-007`, `ALLOC-011`, `ALLOC-013`, `ALLOC-015`, `ALLOC-016`, `CONS-002`, `CONS-003`, `CONS-004`.
- Needs backend or mapper: `ALLOC-014`, `CONS-011`.
- DTO mappers: allocation scenario create, amount precision, constraint enum/status, result version grouping.
- Acceptance path: `/allocation/simulation`, `/allocation/constraints`.
- Fallback: keep copy-new-version and check-only constraint traces in mock until endpoint gaps close.

### 6. Reports / Audit

- Directly connectable actions: `REP-001`, `REP-002`, `REP-004`, `REP-005`, `AUD-002`, `AUD-007`.
- Needs backend: `REP-006`, `REP-009`, `AUD-006` direct snapshot detail.
- P1: `REP-003` PDF remains disabled/mock.
- DTO mappers: report records, export files, audit log query/detail, checksum and file metadata.
- Acceptance path: `/reports`, `/system/audit`.
- Fallback: keep report preview, algorithm audit narrative, allocation confirmation, direct snapshot mock.

### 7. Parameters

- Directly connectable actions: `PARAM-001`, `PARAM-002`, `PARAM-004`, `PARAM-008`.
- Needs backend: no P0 blocking endpoint gap, but multi-parameter form mapper is needed.
- DTO mappers: parameter_code groups, current_value oneOf typing, editable status, version metadata.
- Acceptance path: `/system/parameters`.
- Fallback: do not fallback for editable P0 params after mapper is ready; show backend validation errors.

### 8. Users P1 Placeholder

- Directly connectable actions: none.
- Needs backend: all `USER-*` endpoints are P1 and intentionally absent.
- DTO mappers: future user/role/permission mappers.
- Acceptance path: `/system/users`.
- Fallback: keep P1 placeholder read-only/mock.

## DTO Mapper Plan

Do not implement this structure in Phase 2C-prep. Proposed future frontend API adapter structure:

```text
ui_prototype/src/domain/api/httpClient.ts
ui_prototype/src/domain/api/endpoints.ts
ui_prototype/src/domain/api/dtoMappers.ts
ui_prototype/src/domain/api/errors.ts
```

Mapper responsibilities:

| Mapper | Responsibility |
| --- | --- |
| `projectStatusMapper` | Map backend `DRAFT/INGESTED/...` to Chinese labels, status step index, disabled action reasons. |
| `dataPackageMapper` | Map upload request/validation response; preserve invalid package failure details without creating a valid DataPackage UI state. |
| `dataResourceMapper` | Map resource snake_case fields, modality enum labels, split ratio 0..1 to UI percent, sensitive/technical fields hiding. |
| `partyMapper` | Map party_type enum to Chinese labels; map include flags and status; guard non-data party algorithm boundary. |
| `qualityMapper` | Map assessment/details, score precision, quality level, evidence and version metadata. |
| `shuyuanMapper` | Map coefficient/call_count request; amount display to 2 decimals; detail rows by resource/party. |
| `utilityMapper` | Map contribution and utility records, factor precision, trace rows and utility function disclosure. |
| `mdDshapMapper` | Map task parameters, participant/task sets, marginal traces, normalized weights to 6 decimals and sum validation. |
| `allocationMapper` | Map total/priority/mode, scenario status, allocation result versions, constraint trace adjustment reasons. |
| `reportExportMapper` | Map report_record/export_file, file list, checksum, field scope, disclaimer and no-overwrite behavior. |
| `auditMapper` | Map audit log filters/detail, snapshot refs/content, module_code/menu_code labels. |

Cross-cutting rules:

- snake_case to camelCase conversion is required for all backend DTOs unless the page consumes table rows as-is.
- Enum conversion is required for project status, party type/status, resource modality/status, algorithm mode/status, constraint type/status, report file format.
- Amount precision: display currency/amounts with 2 decimals; never recompute backend totals in UI.
- Weight/score precision: normalized weights and utility/contribution signals display with 6 decimals where used for algorithm/audit.
- Engineering identifiers (`project_id`, `snapshot_id`, `checksum`, etc.) stay in technical details only.

## API Error Contract

Current backend error envelope:

```json
{
  "success": false,
  "code": "DVAS_PRECONDITION_NOT_MET",
  "message": "错误说明",
  "trace_id": "trace_xxx",
  "field_errors": [{ "field": "package_id", "reason": "请先完成数据接入" }]
}
```

Frontend normalized error shape required for Phase 2C:

| Field | Source | Rule |
| --- | --- | --- |
| `errorCode` | backend `code` | Preserve exact backend code. |
| `errorMessage` | backend `message` | User-facing problem summary. |
| `errorField` | first `field_errors[].field` or empty | Display as location. |
| `detail` | full envelope / all `field_errors` | Preserve for technical details drawer only. |
| `repairSuggestion` | first `field_errors[].reason`, or fallback from code map | Must be shown as repair instruction. |
| `raw` | original envelope | Technical diagnostics only. |
| `retryable` | code/status mapping | false for validation/precondition until user fixes input; true for network/5xx only. |

UI error rendering rule:

- Every blocking error must show three business fields: `问题`, `位置`, `修复建议`.
- Upload validation errors must not be summarized as only "上传失败"; the field path and repair suggestion must be visible.
- Backend `DVAS_NOT_FOUND` should show a route/object not found problem and offer a return/reload path.
- Backend `DVAS_PRECONDITION_NOT_MET` should map to a precondition panel item and disable the relevant calculation/export button.
- Backend `DVAS_FACTOR_INVALID` and `DVAS_REQUIRED_FIELD_MISSING` should attach to the form field row when possible.

## Directly Connectable First Batch

The safest first integration batch is read-heavy plus already-tested creation/calculation endpoints:

1. `GET /api/v1/projects/current`
2. `GET /api/v1/dashboard`
3. `GET /api/v1/dashboard/preconditions`
4. `POST /api/v1/demo-cases/{demo_case_id}/initialize` for `SYS-002` / `DATA-002`
5. `POST /api/v1/data-packages/upload` for `DATA-003`
6. `GET /api/v1/data-packages`, `GET /api/v1/data-resources`, `GET /api/v1/parties`
7. `POST /api/v1/quality-assessments/run` and quality detail reads
8. `POST /api/v1/shuyuan-meterings/run`, `POST /api/v1/contributions/run`, `POST /api/v1/utilities/run`
9. `POST /api/v1/md-dshap/tasks` and MDS result/trace reads
10. `POST /api/v1/allocation-scenarios`, simulate, lock, results
11. `POST /api/v1/reports/markdown`, `csv`, `json`, `audit-log`
12. `GET /api/v1/audit-logs`

## Backend Interfaces To Add Before Full UI Parity

Required for Phase 2B UI parity:

- `PATCH /api/v1/data-packages/{package_id}/status`
- Resource `include_in_calculation` update endpoint/field.
- Resource summary export endpoint.
- Party contribution summary/list endpoint.
- Quality metric weight save endpoint.
- Shuyuan call-count draft/save endpoint.
- Utility function snapshot configuration endpoint.
- Standalone algorithm result export.
- MD-DShap audit narrative report/export.
- Allocation copy scenario endpoint.
- Allocation confirmation statement export.
- Direct snapshot detail endpoint.

Keep P1:

- PDF export.
- Login/RBAC/user/role/permission mutation endpoints.
- Async task queue/progress endpoints beyond synchronous P0 task metadata.

## DTO Mapper Risk Points

| Risk | Impact | Mitigation |
| --- | --- | --- |
| snake_case backend DTOs vs existing camelCase UI mock types | Silent field loss or debug field leakage | Centralize mappers; forbid direct page consumption of backend rows. |
| enum differences | Raw enums displayed in Chinese B-end UI | Centralize enum label maps and status maps. |
| amount/weight precision | Rounding mismatch in reports/audit | Treat backend as source of truth; UI only formats. |
| generic parameter endpoint vs page-specific forms | Incorrect parameter_code grouping | Define parameter group mapper before wiring PARAM/QUAL/DU/MDS forms. |
| P0 synchronous backend vs UI progress drawers | Fake progress risk | Show terminal progress metadata unless async endpoint exists. |
| report/export endpoints are broader than some page exports | Wrong file generated for resource/algorithm-specific export | Keep page-specific export buttons mocked until dedicated endpoints exist. |
| snapshot/audit engineering fields | Main UI leakage | TechnicalDetails only; never table-visible. |
| error envelope lacks explicit repairSuggestion field | Poor form feedback | Normalize `field_errors[].reason` into repairSuggestion. |

## Validation Evidence

Commands used or recommended for this mapping stage:

```bash
git status --short
find backend -type f
rg "FastAPI|APIRouter|@app|@router|route|endpoint|POST|GET|PUT|DELETE" backend
rg "class .*Schema|BaseModel|pydantic|dataclass" backend src
rg "audit|snapshot|report|export|md_dshap|allocation|quality|shuyuan" backend src tests
rg "ActionId|handlerName|moduleCode" ui_prototype/src/domain
rg "export const .*Service|class .*Service|function .*Service" ui_prototype/src/domain/services
```

Backend validation commands are safe because tests use `InMemoryRepository` and temporary directories:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m py_compile backend/dvas/*.py
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest backend.tests.test_api_contract
```

## Phase 2C Recommendation

Proceed to Phase 2C only as incremental adapter integration, not broad page refactoring:

1. Add a frontend API adapter/mappers behind a feature flag or `backend=1`.
2. Connect dashboard/data package/quality first because current `apiClient.ts` already partially covers them.
3. Add DTO mappers before page wiring.
4. Keep P1, resource-summary export, algorithm-audit narrative, allocation confirmation, direct snapshot detail, and full quick-run on mock until backend gaps close.
5. Never connect PDF/user/RBAC routes in P0; tests currently assert they are absent.
