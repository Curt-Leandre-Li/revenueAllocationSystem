# Backend API Inventory

Scope: backend routes in `backend/dvas/app.py` and `backend/openapi.yaml`.

Legend:

- Domain: conforms to current DVAS business domain.
- Alias: compatibility alias that maps to the same backend domain service.
- Refactor: should remain as business capability but needs schema/persistence/audit cleanup.
- Remove candidate: no removal was executed in this pass.

## Primary P0 API

| Method | Path | File/handler | Input schema | Output schema | Service | Domain | Frontend residue | Decision |
|---|---|---|---|---|---|---|---|---|
| GET | `/api/v1/projects/current` | `app.py:103` | query none | Standard envelope + project | `ProjectService.current_project` | Yes | No | Keep |
| GET | `/api/v1/projects/current/status` | `app.py:105` | query none | Standard envelope + status/flow | `ProjectService.status` | Yes | No | Keep |
| GET | `/api/v1/projects/{project_id}/status` | `app.py:107` | path project_id | Standard envelope + status/flow | `ProjectService.status` | Yes | No | Keep |
| GET | `/api/v1/projects/{project_id}/flow` | `app.py:109` | path project_id | Standard envelope + preconditions | `ProjectService.flow` | Yes | No | Keep |
| POST | `/api/v1/projects/{project_id}/pipeline/run` | `app.py:125` | JSON body | Standard envelope + pipeline result | `DashboardService.quick_run` | Yes | No | Keep, validate project_id use |
| GET | `/api/v1/navigation/menu-tree` | `app.py:111` | none | Standard envelope + menu tree | `NavigationService.menu_tree` | Yes | No | Keep |
| GET | `/api/v1/navigation/menus` | `app.py:113` | none | Standard envelope + menu tree | `NavigationService.menu_tree` | Alias | No | Keep as documented alias |
| GET | `/api/v1/navigation/button-permissions` | `app.py:115` | none | Standard envelope + permission rows | `NavigationService.button_permissions` | Yes | No | Keep |
| GET | `/api/v1/dashboard` | `app.py:117` | none | Standard envelope + overview | `DashboardService.overview` | Yes | No | Keep |
| GET | `/api/v1/sys/home` | `app.py:119` | query project_id ignored | Standard envelope + overview | `DashboardService.overview` | Alias | No | Keep/normalize project_id |
| GET | `/api/v1/dashboard/preconditions` | `app.py:121` | none | Standard envelope + preconditions | `DashboardService.preconditions` | Yes | No | Keep |
| POST | `/api/v1/dashboard/actions/quick-run` | `app.py:123` | JSON body | Standard envelope + pipeline result | `DashboardService.quick_run` | Yes | No | Keep |
| POST | `/api/v1/demo-cases/{demo_case_id}/initialize` | `app.py:132` | path demo_case_id | Standard envelope + ingestion | `DataIngestionService.initialize_demo_case` | Yes | No | Keep |
| POST | `/api/v1/demo-cases/{demo_case_id}/select` | `app.py:134` | path demo_case_id | Standard envelope + ingestion | `DataIngestionService.initialize_demo_case` | Alias | No | Keep |
| POST | `/api/v1/data-packages/upload` | `app.py:136` | `DataPackageUploadRequest` | Standard envelope + package/resources/parties | `DataIngestionService.upload_json` | Yes | No | Keep |
| POST | `/api/v1/data/packages/upload` | `app.py:138` | upload JSON | Standard envelope + package/resources/parties | `DataIngestionService.upload_json` | Alias | No | Keep |
| GET | `/api/v1/data-packages` | `app.py:140` | none | Standard envelope + table page | `DataIngestionService.list_packages` | Yes | No | Keep |
| GET | `/api/v1/data/packages` | `app.py:142` | none | Standard envelope + table page | `DataIngestionService.list_packages` | Alias | No | Keep |
| GET | `/api/v1/data-packages/{package_id}` | `app.py:144` | path package_id | Standard envelope + detail | `DataIngestionService.package_detail` | Yes | No | Keep |
| GET | `/api/v1/data/packages/{package_id}/preview` | `app.py:146` | path package_id | Standard envelope + detail | `DataIngestionService.package_detail` | Alias | No | Keep |
| GET | `/api/v1/data-packages/{package_id}/validation-result` | `app.py:148` | path package_id | Standard envelope + validation | `DataIngestionService.validation_result` | Yes | No | Keep |
| GET | `/api/v1/data-resources` | `app.py:155` | none | Standard envelope + table page | `DataIngestionService.list_resources` | Yes | No | Keep |
| GET | `/api/v1/data/resources` | `app.py:157` | none | Standard envelope + table page | `DataIngestionService.list_resources` | Alias | No | Keep |
| GET | `/api/v1/data-resources/{resource_id}` | `app.py:166` | path resource_id | Standard envelope + resource | `DataIngestionService.resource_detail` | Yes | No | Keep |
| PUT | `/api/v1/data-resources/{resource_id}/party-relations` | `app.py:159` | `ResourcePartyRelationRequest` | Standard envelope + resource | `ResourceService.bind_party_relations` | Yes | No | Keep |
| GET | `/api/v1/parties` | `app.py:168` | none | Standard envelope + table page | `DataIngestionService.list_parties` | Yes | No | Keep |
| GET | `/api/v1/data/parties` | `app.py:170` | none | Standard envelope + table page | `DataIngestionService.list_parties` | Alias | No | Keep |
| POST | `/api/v1/parties` | `app.py:172` | `PartyWriteRequest` | Standard envelope + party | `PartyService.create_party` | Yes | No | Keep |
| POST | `/api/v1/data/parties` | `app.py:174` | party JSON | Standard envelope + party | `PartyService.create_party` | Alias | No | Keep |
| PUT | `/api/v1/parties/{party_id}` | `app.py:176` | `PartyWriteRequest` | Standard envelope + party | `PartyService.update_party` | Yes | No | Keep |
| PATCH | `/api/v1/data/parties/{party_id}` | `app.py:178` | party JSON | Standard envelope + party | `PartyService.update_party` | Alias | No | Keep |
| PATCH | `/api/v1/parties/{party_id}/status` | `app.py:180` | `PartyStatusRequest` | Standard envelope + party | `PartyService.set_status` | Yes | No | Keep |
| PATCH | `/api/v1/data/parties/{party_id}/status` | `app.py:187` | status JSON | Standard envelope + party | `PartyService.set_status` | Alias | No | Keep |
| POST | `/api/v1/quality-assessments/run` | `app.py:189` | `QualityRunRequest` | Standard envelope + assessment | `QualityAssessmentService.run` | Yes | No | Keep |
| GET | `/api/v1/quality-assessments/latest` | `app.py:204` | none | Standard envelope + assessment | `QualityAssessmentService.latest` | Yes | No | Keep |
| GET | `/api/v1/quality-assessments/{assessment_id}/details` | `app.py:206` | path assessment_id | Standard envelope + details | `QualityAssessmentService.details` | Yes | No | Keep |
| POST | `/api/v1/shuyuan-meterings/run` | `app.py:213` | `ShuyuanMeteringRunRequest` | Standard envelope + metering | `ShuyuanMeteringService.run` | Yes | No | Keep |
| GET | `/api/v1/shuyuan-meterings/latest` | `app.py:221` | none | Standard envelope + metering | `ShuyuanMeteringService.latest` | Yes | No | Keep |
| GET | `/api/v1/shuyuan-meterings/{metering_id}/details` | `app.py:223` | path metering_id | Standard envelope + details | `ShuyuanMeteringService.details` | Yes | No | Keep |
| POST | `/api/v1/contributions/run` | `app.py:230` | `ContributionRunRequest` | Standard envelope + records | `ContributionService.run` | Yes | No | Keep |
| POST | `/api/v1/utilities/run` | `app.py:240` | `UtilityRunRequest` | Standard envelope + utility/trace | `UtilityService.run` | Yes | No | Keep |
| GET | `/api/v1/utilities/latest` | `app.py:242` | none | Standard envelope + utility | `UtilityService.latest` | Yes | No | Keep |
| GET | `/api/v1/utilities/{utility_id}/trace` | `app.py:244` | path utility_id | Standard envelope + trace | `UtilityService.trace` | Yes | No | Keep |
| POST | `/api/v1/md-dshap/tasks` | `app.py:251` | `MdDshapTaskRunRequest` | Standard envelope + task/results | `MdDshapService.run` | Yes | No | Keep, add algorithm_mode validation |
| GET | `/api/v1/md-dshap/tasks/{task_id}` | `app.py:267` | path task_id | Standard envelope + task | `MdDshapService.task` | Yes | No | Keep |
| GET | `/api/v1/md-dshap/tasks/{task_id}/results` | `app.py:271` | path task_id | Standard envelope + table page | `MdDshapService.results` | Yes | No | Keep |
| GET | `/api/v1/md-dshap/tasks/{task_id}/marginal-traces` | `app.py:286` | path task_id | Standard envelope + table page | `MdDshapService.marginal_traces` | Yes | No | Keep |
| GET | `/api/v1/allocation/md-dshap/participant-pool` | `app.py:263` | none | Standard envelope + included/excluded | `MdDshapService.participant_pool` | Yes | No | Keep |
| POST | `/api/v1/allocation/md-dshap/tasks` | `app.py:265` | MD-DShap JSON | Standard envelope + task/results | `MdDshapService.run` | Alias | No | Keep |
| GET | `/api/v1/allocation/md-dshap/tasks/{task_id}` | `app.py:269` | path task_id | Standard envelope + task | `MdDshapService.task` | Alias | No | Keep |
| GET | `/api/v1/allocation/md-dshap/tasks/{task_id}/results` | `app.py:278` | path task_id | Standard envelope + table page | `MdDshapService.results` | Alias | No | Keep |
| POST | `/api/v1/allocation/md-dshap/tasks/{task_id}/audit-export` | `app.py:280` | path task_id | Standard envelope + report/export | `ReportService.generate_md_dshap_audit` | Yes | No | Keep |
| GET | `/api/v1/contract-constraints` | `app.py:293` | none | Standard envelope + table page | `ContractConstraintService.list` | Yes | No | Keep |
| GET | `/api/v1/allocation/constraints` | `app.py:295` | none | Standard envelope + table page | `ContractConstraintService.list` | Alias | No | Keep |
| POST | `/api/v1/contract-constraints` | `app.py:297` | `ContractConstraintWriteRequest` | Standard envelope + constraint | `ContractConstraintService.create` | Yes | No | Keep |
| POST | `/api/v1/allocation/constraints` | `app.py:299` | constraint JSON | Standard envelope + constraint | `ContractConstraintService.create` | Alias | No | Keep |
| PUT | `/api/v1/contract-constraints/{constraint_id}` | `app.py:301` | constraint JSON | Standard envelope + constraint | `ContractConstraintService.update` | Yes | No | Keep |
| PATCH | `/api/v1/allocation/constraints/{constraint_id}` | `app.py:303` | constraint JSON | Standard envelope + constraint | `ContractConstraintService.update` | Alias | No | Keep |
| PATCH | `/api/v1/contract-constraints/{constraint_id}/status` | `app.py:305` | status JSON | Standard envelope + constraint | `ContractConstraintService.set_status` | Yes | No | Keep |
| PATCH | `/api/v1/allocation/constraints/{constraint_id}/status` | `app.py:312` | status JSON | Standard envelope + constraint | `ContractConstraintService.set_status` | Alias | No | Keep |
| POST | `/api/v1/allocation-scenarios` | `app.py:314` | `AllocationScenarioCreateRequest` | Standard envelope + scenario | `AllocationService.create` | Yes | No | Keep |
| POST | `/api/v1/allocation-scenarios/{allocation_id}/simulate` | `app.py:324` | path allocation_id | Standard envelope + allocation/results | `AllocationService.simulate` | Yes | No | Keep |
| POST | `/api/v1/allocation-scenarios/{allocation_id}/lock` | `app.py:331` | path allocation_id | Standard envelope + allocation | `AllocationService.lock` | Yes | No | Keep |
| POST | `/api/v1/allocation/simulation/run` | `app.py:322` | allocation JSON | Standard envelope + allocation/results | `AllocationService.run` | Alias | No | Keep |
| POST | `/api/v1/allocation/simulation/{allocation_id}/lock` | `app.py:338` | path allocation_id | Standard envelope + allocation | `AllocationService.lock` | Alias | No | Keep |
| POST | `/api/v1/allocation/simulation/{allocation_id}/export` | `app.py:340` | path allocation_id ignored | Standard envelope + JSON export | `ReportService.generate_json` | Yes | No | Refactor to use allocation_id |
| GET | `/api/v1/allocation-scenarios/{allocation_id}/results` | `app.py:342` | path allocation_id | Standard envelope + table page | `AllocationService.results` | Yes | No | Keep |
| GET | `/api/v1/reports` | `app.py:349` | none | Standard envelope + table page | `ReportService.list` | Yes | No | Keep |
| GET | `/api/v1/reports/preview` | `app.py:351` | none | Standard envelope + preview | `ReportService.preview` | Yes | No | Keep |
| POST | `/api/v1/reports/markdown` | `app.py:353` | none | Standard envelope + report/export | `ReportService.generate_markdown` | Yes | No | Keep, enforce confirm if required |
| POST | `/api/v1/reports/csv` | `app.py:355` | none | Standard envelope + report/export | `ReportService.generate_csv` | Yes | No | Keep, enforce confirm if required |
| POST | `/api/v1/reports/json` | `app.py:357` | none | Standard envelope + report/export | `ReportService.generate_json` | Yes | No | Keep, enforce confirm if required |
| POST | `/api/v1/reports/audit-log` | `app.py:359` | none | Standard envelope + JSONL export | `ReportService.export_audit_log` | Yes | No | Keep |
| POST | `/api/v1/reports/md-dshap-audit` | `app.py:361` | optional task context | Standard envelope + report/export | `ReportService.generate_md_dshap_audit` | Yes | No | Keep |
| GET | `/api/v1/system/parameters` | `app.py:363` | none | Standard envelope + table page | `SystemParameterService.list` | Yes | No | Keep |
| GET | `/api/v1/system/parameters/{parameter_code}` | `app.py:365` | path parameter_code | Standard envelope + parameter | `SystemParameterService.detail` | Yes | No | Keep |
| PUT | `/api/v1/system/parameters/{parameter_code}` | `app.py:367` | `SystemParameterUpdateRequest` | Standard envelope + parameter | `SystemParameterService.update` | Yes | No | Keep |
| POST | `/api/v1/system/parameters/{parameter_code}/restore-default` | `app.py:369` | path parameter_code | Standard envelope + parameter | `SystemParameterService.restore_default` | Yes | No | Keep |
| GET | `/api/v1/audit-logs` | `app.py:376` | filter query | Standard envelope + table page | `AuditLogService.list` | Yes | No | Keep |
| GET | `/api/v1/system/audit/logs` | `app.py:378` | filter query | Standard envelope + table page | `AuditLogService.list` | Alias | No | Keep |
| GET | `/api/v1/audit-logs/{log_id}` | `app.py:380` | path log_id | Standard envelope + detail/snapshots | `AuditLogService.detail` | Yes | No | Keep |
| GET | `/api/v1/system/audit/logs/{log_id}` | `app.py:382` | path log_id | Standard envelope + detail/snapshots | `AuditLogService.detail` | Alias | No | Keep |

## Draft Endpoints Needing Refactor

These are business-domain routes, but their current implementation returns payload echoes without persistence, snapshots, or audit:

| Method | Path | Evidence | Decision |
|---|---|---|---|
| GET/PUT | `/api/v1/metering/quality/weights` | `app.py:191-201` | Move to quality template/system parameter service. |
| PUT | `/api/v1/metering/shuyuan/parameters` | `app.py:215-216` | Persist parameter version or remove draft endpoint. |
| PUT | `/api/v1/metering/shuyuan/call-counts` | `app.py:217-218` | Persist as metering draft or remove. |
| PUT | `/api/v1/metering/utility/contribution-factors` | `app.py:232-233` | Persist parameter snapshot/version or remove. |
| PUT | `/api/v1/metering/utility/function` | `app.py:236-237` | Persist utility function snapshot. |
| GET/PUT | `/api/v1/allocation/md-dshap/config` | `app.py:253-262` | Read/write through system parameter service. |
| PUT | `/api/v1/allocation/simulation/revenue-pool` | `app.py:316-317` | Persist allocation scenario draft or remove. |
| PUT | `/api/v1/allocation/simulation/priority-items` | `app.py:318-319` | Persist `allocation_priority_item` or remove. |
| PUT | `/api/v1/allocation/simulation/mode` | `app.py:320-321` | Persist allocation scenario mode or remove. |

## Forbidden/Old Frontend API Check

No backend route was found for `/mock`, `/demo-ui`, `/frontend`, `/pages`, `/legacy`, `/old-dashboard`, `/fake`, or `/temp`.

No backend import from React, Vue, Vite, Next, Element, Ant Design, `ui_prototype`, or `ui_rebuild` was found.

No API payload names such as `cardList`, `tableColumns`, `sidebarTree`, or `mockChartData` were found in backend source. `button-permissions` and `available_actions/disabled_actions` are business permission/precondition objects, not page-component payloads.

