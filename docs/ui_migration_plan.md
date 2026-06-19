# UI Schema Migration Plan

This migration plan is frozen for a future implementation phase. Current phase
is documentation-only; no runtime files are modified here.

## 1. Current UI Inventory

Current implementation surfaces:

| Area | Current Path | Current State |
|---|---|---|
| Prototype app shell | `ui_prototype/src/App.tsx` | React monolith with hardcoded route/page/action behavior. |
| Prototype metadata | `ui_prototype/src/dvasData.json` | 14 pages and 66 button records; not a full schema. |
| Prototype styles | `ui_prototype/src/styles.css` | CSS classes encode layout/component variants outside a token registry. |
| UI docs | `docs/ui/*.md` | Useful inventory and button matrix; not a formal schema contract. |
| Screenshot checker | `scripts/check_ui_deliverables.py` | Artifact checker; currently fails because PNG assets are absent. |

## 2. Page Mapping

| Current Prototype ID | Target Schema `page_id` | Route | Action |
|---|---|---|---|
| `system_home` | `SYS_OVERVIEW` | `/dashboard` | Rename in schema; preserve current ID as migration alias. |
| `data_ingestion` | `DATA_INGESTION` | `/data/ingestion` | Migrate page-specific workbench into schema components. |
| `data_resources` | `RES_MANAGEMENT` | `/data/resources` | Migrate resource workbench into schema table/drawers/forms. |
| `data_parties` | `PARTY_MANAGEMENT` | `/data/parties` | Generate from schema table/action set. |
| `measure_quality` | `QUAL_ASSESSMENT` | `/metering/quality` | Generate from workflow schema. |
| `measure_shuyuan` | `DU_METERING` | `/metering/shuyuan` | Generate from workflow schema. |
| `measure_utility` | `UTIL_CALCULATION` | `/metering/utility` | Generate from workflow schema. |
| `allocation_md_dshap` | `MDS_CALCULATION` | `/allocation/md-dshap` | Generate from workflow schema and trace drawers. |
| `allocation_simulation` | `ALLOC_SIMULATION` | `/allocation/simulation` | Generate from allocation workflow schema. |
| `allocation_constraints` | `CONS_MANAGEMENT` | `/allocation/constraints` | Generate from table/form/confirm schema. |
| `reports_export` | `REP_EXPORT` | `/reports` | Generate from report/export schema. |
| `system_parameters` | `PARAM_CONFIG` | `/system/parameters` | Generate from parameter form schema. |
| `system_users_p1` | `USER_PERMISSION_P1` | `/system/users` | Generate P1 planning/read-only schema in P0. |
| `system_audit` | `AUD_LOG` | `/system/audit` | Generate from audit table/detail schema. |

## 3. Route Alias Mapping

Canonical routes:

```text
/dashboard
/data/ingestion
/data/resources
/data/parties
/metering/quality
/metering/shuyuan
/metering/utility
/allocation/md-dshap
/allocation/simulation
/allocation/constraints
/reports
/system/parameters
/system/users
/system/audit
```

Compatibility aliases:

```text
/dashboard remains the only current system-home route
/quality -> /metering/quality
/shuyuan -> /metering/shuyuan
/utility -> /metering/utility
/md-dshap -> /allocation/md-dshap
/allocation -> /allocation/simulation
/constraints -> /allocation/constraints
/audit -> /system/audit
/parameters -> /system/parameters
/users -> /system/users
```

System-home deprecated split aliases:

```text
The former system-home split routes and menu codes are废止 in the current
baseline. Project overview, process entry, risk notice, and one-click
calculation are internal sections under NAV_SYS_HOME only.
```

`NAV_SYS_HOME` is canonical for the current baseline.

## 4. Component Migration

| Current Pattern | Target Registry Component |
|---|---|
| `Sidebar`, grouped nav in `App.tsx` | `SchemaApp` shell navigation |
| `Header`, `PageHero`, disclaimer panel | `SchemaLayout` page header + risk panel |
| `StatusRail` | `SchemaStepper` or page status rail variant |
| `HomeDashboard` metric cards and flow nodes | `card`, `timeline`, `action_bar`, `risk_panel` |
| `DataIngestionWorkbench` | `table`, `upload_zone`, `form`, `modal`, `drawer`, `audit_panel` |
| `ResourceWorkbench` | `table`, `form`, `drawer`, `modal`, `chart`, `audit_panel` |
| `ActionMatrix` | `SchemaActionBar` |
| `ModuleActionDialog` | schema modal/drawer selected by `overlay_type` |
| `MDDShapRunDialog` | `progress_modal` plus state-machine transition |
| `ResourceExportDialog` and generic export modals | `export_confirm_modal` |

## 5. Action Migration

Current:

- `dvasData.json` stores button metadata.
- `App.tsx` decides special overlays in a hardcoded `ActionOverlay` switch.
- Many high-risk/export actions fall through to a generic modal.

Target:

- Every action moves to `action.registry`.
- `action_type` is normalized to the approved enum.
- `risk_level`, `phase`, `enabled_in_p0`, `confirmation_required`, and
  `overlay_component_id` are explicit.
- `SYS-004` is restored to full-pipeline semantics.
- `USER-008` is added.

Migration steps:

1. Extract all current button rows from `docs/ui/button_interaction_matrix.md`
   and `dvasData.json`.
2. Add missing `USER-008`.
3. Normalize `kind=highRisk` to `action_type=DELETE_DISABLE`, `CALCULATE`,
   `UPDATE`, or `CONFIRM` plus `risk_level=high`.
4. Normalize `kind=p1` to real action type plus `phase=P1` and
   `enabled_in_p0=false`.
5. Attach overlay schemas for every action that opens a modal/drawer.
6. Attach state-machine transitions for every calculate/confirm/export action.
7. Attach audit payload rules for all write, calculate, confirm, and export
   actions.

## 6. State Logic Migration

Current:

- UI state is partly hardcoded as `已计算效用`.
- Local page state controls upload/resource workflow.
- Action disabled behavior is not globally enforced.

Target:

- Global state machine owns project state.
- Component-local state is limited to UI affordances such as open drawer,
  selected row, filter, and temporary form draft.
- `can_execute` determines action enablement.
- `ASSESSABLE` is represented as a derived state when not persisted.

Migration steps:

1. Define state machine enum and labels.
2. Define transition guards.
3. Define derived `ASSESSABLE` rule.
4. Replace page-local business state mutation with action dispatch results.
5. Add locked/exported disabled rule.
6. Add P1 disabled/planning rule.

## 7. Modal And Drawer Migration

Current overlays to migrate first:

- Audit details drawer
- Data preview drawer
- Upload failure modal/drawer
- Package detail drawer
- Demo confirm modal
- Delete package confirm modal
- Resource detail drawer
- Resource link drawer
- Resource compute confirm modal
- Resource export modal
- MD-DShap run modal
- Demo data modal
- Upload JSON drawer
- Report preview drawer
- Risk drawer
- Audit log drawer
- Generic module action modal

Target overlay schema:

```text
component_id, type, variant, title, open_by_action, size,
content_components, form_schema/detail_schema, confirm_action,
cancel_action, success_ui, failure_ui, audit_log_required,
disclaimer_required
```

## 8. Data Binding Migration

Current:

- Prototype uses local JSON and local component state.
- No formal binding registry exists.

Target:

- Page read models use `data.binding.registry`.
- Action write models use `action.registry`.
- Mock bindings may exist for prototype mode but must use the same binding IDs
  as future API mode.

Initial binding IDs are frozen in `docs/ui_schema_design.md`.

## 9. Files To Deprecate Or Preserve

Future implementation should preserve:

- business source docs
- acceptance docs
- report/export/audit boundary docs
- any backend/algorithm logic
- generated report/export/audit rules

Future implementation may deprecate after schema renderer is verified:

- page-specific business layout sections in `ui_prototype/src/App.tsx`
- hardcoded `ActionOverlay`
- generic `ModuleActionDialog`
- prototype-specific lower snake page IDs
- screenshot docs that cannot be regenerated from schema

No deletion is approved in this phase.

## 10. Migration Sequence

1. Freeze schema in docs.
2. Create runtime schema types.
3. Create `system.ui.schema.json`.
4. Create component registry.
5. Create action registry.
6. Create state machine.
7. Create data binding registry.
8. Create schema validator.
9. Create renderer shell.
10. Migrate `SYS_OVERVIEW`.
11. Migrate data management pages.
12. Migrate metering pages.
13. Migrate allocation pages.
14. Migrate report/audit/system pages.
15. Replace route entrypoints with schema route shell.
16. Add renderer tests.
17. Run schema validation.
18. Run UI renderer tests.
19. Run prototype build.
20. Regenerate screenshots.
21. Run deliverable checker.
22. Mark old hardcoded paths deprecated.
23. Produce final migration report.

## 11. Validation Plan

Docs-only validation for this phase:

```bash
git diff --check
git status --short
rg -n "基础 Shapley|Basic Shapley|Shapley 为主|默认 Shapley|MD-Shapley|MD-DShap|MD_DSHAP" .
rg -n "PDF|RBAC|登录|异步|P0|P1" docs AGENTS.md agents
rg -n "MAR|真实结算|法律结算|付款|银行|税务|电子签章|生产级" docs AGENTS.md agents
rg -n "端到端|AI 化|医疗数据数元计量|肺癌|肺癌早筛" docs AGENTS.md agents
rg -n "系统首页|数据管理|数元贡献度计量|收益分配计算|报告生成与导出|系统管理" docs AGENTS.md agents
rg -n "模拟参考|非法律结算|非法定结算|审计|trace|snapshot|checksum|report_id" docs AGENTS.md agents
```

Future writable validation:

```bash
npm run build
npm run validate:ui-schema
npm run test:ui-renderer
npm run screenshots
python3 scripts/check_ui_deliverables.py
npm audit --audit-level=high
```

Some of these commands are not currently available or currently fail. Missing
or failing checks must be reported, not hidden.

## 12. Acceptance Criteria

The migration is accepted only when:

- all UI pages render from schema
- all 14 target page IDs exist
- all required actions exist, including `USER-008`
- all actions have normalized action type, preconditions, state transition,
  audit rule, success/failure UI, and confirmation/export rules where relevant
- all modal/drawer/table/form definitions are schema-driven
- all disabled/locked/exported/P1 states are centrally enforced
- `SYS-004` keeps full-pipeline semantics
- `ASSESSABLE` is present as persisted or derived state
- MD-DShap remains a weight layer only
- report/export surfaces include `report_id`, `checksum`, field scope, and
  simulation-reference disclaimer
- screenshots and deliverable reports are regenerated from the schema-rendered
  UI, not stale artifact claims

## 13. Rollback

If schema renderer implementation regresses behavior:

1. Keep old prototype page under a clearly marked compatibility route.
2. Disable schema route for the affected page only.
3. Keep data/action/state schema unchanged for audit review.
4. Record the failed page, action, guard, and validation command.
5. Re-enable only after schema validator and renderer tests pass.

Rollback must not revert unrelated user changes or delete existing working-tree
artifacts without explicit approval.

## 14. Phase 2 Runtime Foundation Execution

Date: 2026-06-17

Scope executed: runtime UI schema / renderer foundation. No algorithm,
database, report-core, dependency-version, lockfile, screenshot, or Vite audit
work was performed.

Implemented runtime foundations:

- `ui_prototype/src/ui-schema/ui.schema.types.ts`: shared schema contract,
  allowed component types, action fields, state transition fields, export
  confirmation fields, and validation result types.
- `ui_prototype/src/ui-schema/state.machine.ts`: runtime state machine with
  `ASSESSABLE` and the derived rule `INGESTED + 已完成有效数据源主体关联 =>
  ASSESSABLE`.
- `ui_prototype/src/routes/schemaRoutes.ts`: canonical route and alias registry.
  `/metering/*` is canonical, `/measure/*` is compatibility-only, and
  `/dashboard` is the only current system-home route.
- `ui_prototype/src/ui-schema/action.registry.ts`: normalized runtime action
  registry, including `USER-008 = 角色管理`, `SYS-004 = 启动完整计算`, high-risk
  confirmation rules, export confirmation rules, success/failure UI, handlers,
  audit flags, and state transitions.
- `ui_prototype/src/ui-schema/component.registry.ts`: schema modal/drawer
  registry with required overlays and `open_by_action` mappings.
- `ui_prototype/src/ui-schema/system.ui.schema.ts`: 14 page schemas with
  `page_id`, route, menu_code, module_code, layout, components, bindings,
  state_flow, actions, empty/error states, risk notice, audit requirements, main
  objects, and permission actions.
- `ui_prototype/src/ui-schema/validateUiSchema.ts`: validator for required
  pages, actions, `SYS-004`, `USER-008`, `ASSESSABLE`, component types,
  overlay/action linkage, export confirmation, high-risk confirmation,
  MD-DShap defaults, Basic Shapley baseline-only usage, and disclaimer coverage.
- `ui_prototype/src/ui-renderer/*`: schema app shell, page renderer, layout,
  action bar, component renderer, modal host, and drawer host.
- `ui_prototype/src/App.tsx`: switched to `<SchemaApp schema={systemUiSchema}
  />`.
- `ui_prototype/package.json`: added local `validate:ui-schema` script only; no
  dependency change.

Phase 2 drift handling:

| Item | Runtime foundation result |
|---|---|
| `SYS-004` | Restored to full calculation: quality assessment, shuyuan metering, contribution/utility, MD-DShap, allocation. |
| `USER-008` | Added to schema, action registry, USER page actions, validation, and role-management drawer placeholder handler. |
| `ASSESSABLE` | Added to state machine as derived UI state when backend persistence is not available. |
| Route aliases | `/dashboard` is the canonical system-home route; former system-home split routes and menu-code lineage are retired. `/metering/*` is canonical and `/measure/*` is alias. |
| Modal/drawer schema | Required overlays are schema records and open through `SchemaModalHost` / `SchemaDrawerHost`. |
| Export confirmation | Required export actions carry report/checksum/disclaimer/field-scope/audit schema. |
| App shell | `App.tsx` no longer contains hardcoded page layout as the main rendering path. |

Validation run:

```bash
cd ui_prototype && ./node_modules/.bin/tsc --noEmit
cd ui_prototype && npm run validate:ui-schema
```

Both commands passed.

Remaining migration work:

1. Replace foundation-level generic widgets with richer schema-bound table,
   form, upload, chart, and trace renderers.
2. Add browser visual QA and screenshots after screenshot scope is reopened.
3. Add renderer tests only after test scope is reopened.
4. Keep Vite/esbuild audit remediation separate from UI schema migration.
