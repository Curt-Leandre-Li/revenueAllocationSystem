import re
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_SOURCE_ROOT = REPO_ROOT / ("ui_" + "prototype") / "src"
APP_SHELL = FRONTEND_SOURCE_ROOT / "app" / "AppShell.tsx"
MENU_CONFIG = FRONTEND_SOURCE_ROOT / "app" / "menu.ts"
BACKEND_WORKSPACE = FRONTEND_SOURCE_ROOT / "domain" / "services" / "backendWorkspace.ts"
ACTION_DISPATCHER = FRONTEND_SOURCE_ROOT / "domain" / "services" / "actionDispatcher.ts"
DATA_PACKAGES_PAGE = FRONTEND_SOURCE_ROOT / "pages" / "data" / "DataPackagesPage.tsx"
DASHBOARD_PAGE = FRONTEND_SOURCE_ROOT / "pages" / "dashboard" / "OverviewPage.tsx"
CONSTRAINTS_PAGE = FRONTEND_SOURCE_ROOT / "pages" / "allocation" / "ConstraintsPage.tsx"
SIMULATION_PAGE = FRONTEND_SOURCE_ROOT / "pages" / "allocation" / "SimulationPage.tsx"
ALLOCATION_CONTEXT = FRONTEND_SOURCE_ROOT / "pages" / "allocation" / "allocationContext.ts"
REPORTS_PAGE = FRONTEND_SOURCE_ROOT / "pages" / "reports" / "ReportsPage.tsx"
USERS_PAGE = FRONTEND_SOURCE_ROOT / "pages" / "system" / "UsersP1Page.tsx"
STATUS_HELPERS = FRONTEND_SOURCE_ROOT / "domain" / "status.ts"
STATE_GUARDS = FRONTEND_SOURCE_ROOT / "domain" / "stateGuards.ts"
STYLESHEET = FRONTEND_SOURCE_ROOT / "styles.css"


class FrontendUploadStateGuardsTest(unittest.TestCase):
    def test_allocation_optional_reads_do_not_block_workspace_sync(self):
        source = BACKEND_WORKSPACE.read_text(encoding="utf-8")

        self.assertRegex(
            source,
            re.compile(
                r"optionalBackendCall\(\s*"
                r"\"contract ratio\",\s*"
                r"\(\)\s*=>\s*dvasApi\.getContractRatio\(projectDto\.project_id\),\s*"
                r"\{\}\s*"
                r",\s*optionalReadIssues\s*"
                r"\)",
                re.MULTILINE,
            ),
        )
        self.assertRegex(
            source,
            re.compile(
                r"optionalBackendCall\(\s*"
                r"\"allocation summary\",\s*"
                r"\(\)\s*=>\s*dvasApi\.getAllocationSummary\(projectDto\.project_id\),\s*"
                r"\{\}\s*"
                r",\s*optionalReadIssues\s*"
                r"\)",
                re.MULTILINE,
            ),
        )
        self.assertIn("optionalReadIssues", source)

    def test_latest_empty_results_do_not_surface_as_optional_read_failures(self):
        source = BACKEND_WORKSPACE.read_text(encoding="utf-8")

        for label in (
            "latest quality assessment",
            "latest shuyuan metering",
            "latest utility",
        ):
            body = self._source_between(source, f'optionalBackendCall("{label}"', "}),")
            self.assertIn('suppressIssueCodes: ["DVAS_NOT_FOUND"]', body)
            self.assertNotRegex(
                body,
                r"DVAS_(SCHEMA_MISMATCH|INTERNAL_ERROR|DATABASE_UNAVAILABLE|PERMISSION_DENIED)",
            )

        self.assertNotIn("DVAS_SCHEMA_MISMATCH", source)
        self.assertNotIn("DVAS_INTERNAL_ERROR", source)
        self.assertNotIn("DVAS_DATABASE_UNAVAILABLE", source)
        self.assertNotIn("DVAS_PERMISSION_DENIED", source)

    def test_json_upload_clears_pending_when_action_returns(self):
        body = self._function_body("handleFile", "handleTemplateFile")

        self.assertLess(
            body.index("if (!snapshot.backend?.connected)"),
            body.index("setPendingUploadFileName(file.name)"),
        )
        action_index = body.index('await onAction(actionRegistry["DATA-003"]')
        self.assertGreater(
            body.find('setPendingUploadFileName("");', action_index),
            action_index,
        )

    def test_template_upload_clears_pending_when_action_returns(self):
        body = self._function_body("handleTemplateFile", "return (")

        self.assertLess(
            body.index("if (!snapshot.backend?.connected)"),
            body.index("setPendingUploadFileName(file.name)"),
        )
        action_index = body.index('await onAction(actionRegistry["DATA-012"]')
        self.assertGreater(
            body.find('setPendingUploadFileName("");', action_index),
            action_index,
        )

    def test_data_package_page_keeps_mutation_feedback_visible(self):
        source = DATA_PACKAGES_PAGE.read_text(encoding="utf-8")
        stylesheet = STYLESHEET.read_text(encoding="utf-8")

        self.assertIn("dataPackagesPage", source)
        lean_hide_index = stylesheet.index(".workspace.leanWorkspace > .operationMessage")
        feedback_override_index = stylesheet.index(
            ".workspace:has(.dataPackagesPage) > .operationMessage"
        )
        self.assertGreater(feedback_override_index, lean_hide_index)

    def test_dashboard_exposes_sys004_backend_action_and_feedback(self):
        source = DASHBOARD_PAGE.read_text(encoding="utf-8")
        stylesheet = STYLESHEET.read_text(encoding="utf-8")

        self.assertIn('actionRegistry["SYS-004"]', source)
        self.assertIn("onClick={(action) => onAction(action)}", source)
        self.assertNotIn(".workspace:has(.dashboardResultsPage) > .operationMessage", stylesheet)
        self.assertNotIn(".workspace:has(.dashboardResultsPage) > .backendUnavailable", stylesheet)

    def test_demo_selection_remains_available_from_locked_demo_state(self):
        source = STATE_GUARDS.read_text(encoding="utf-8")
        bypass_list = self._source_between(
            source,
            "const lockedStatusBypassActionIds",
            "export function getReadOnlyDisabledReason",
        )
        read_only_guard = self._source_between(
            source,
            "export function getReadOnlyDisabledReason",
            "isLockedStatus(projectStatus)",
        )

        self.assertIn('"SYS-002"', bypass_list)
        self.assertIn('"DATA-002"', bypass_list)
        self.assertIn("lockedStatusBypassActionIds.includes(action.id)", read_only_guard)
        self.assertIn('return "";', read_only_guard)

    def test_data_package_delete_reaches_backend_action_from_locked_state(self):
        package_page_source = DATA_PACKAGES_PAGE.read_text(encoding="utf-8")
        guard_source = STATE_GUARDS.read_text(encoding="utf-8")
        service_source = (
            FRONTEND_SOURCE_ROOT
            / "domain"
            / "services"
            / "DataPackageService.ts"
        ).read_text(encoding="utf-8")

        self.assertIn('onAction(actionRegistry["DATA-009"]', package_page_source)
        self.assertIn('kind: "data-package-delete"', package_page_source)
        self.assertIn('"DATA-009"', guard_source)
        self.assertRegex(
            guard_source,
            re.compile(
                r"lockedStatusBypassActionIds[^=]*=\s*\[[^\]]*\"DATA-009\"",
                re.MULTILINE,
            ),
        )
        self.assertIn("dvasApi.deleteDataPackage(payload.packageId)", service_source)

    def test_contract_ratio_total_revenue_uses_real_backend_fields_only(self):
        workspace_source = BACKEND_WORKSPACE.read_text(encoding="utf-8")
        constraints_source = CONSTRAINTS_PAGE.read_text(encoding="utf-8")
        body = self._source_between(
            workspace_source,
            "function buildConstraintsPage",
            "function buildReportsPage",
        )

        self.assertIn("const totalRevenueValue", body)
        self.assertIn("contractRatio.total_revenue", body)
        self.assertIn("summary.total_revenue", body)
        self.assertIn("data.overview.metrics.currentRevenuePool", body)
        self.assertIn('errors.push("后端未返回 total_revenue，不能保存方案");', constraints_source)
        self.assertNotRegex(body, re.compile(r"totalRevenueValue[^;]*(?:1000|1200000)", re.MULTILINE))

    def test_contract_ratio_draft_blockers_are_visible_before_save(self):
        source = CONSTRAINTS_PAGE.read_text(encoding="utf-8")

        self.assertIn("const displayRows = dirty ? draftRowsFromDraft", source)
        self.assertIn("保存前需补齐", source)
        self.assertIn("{displayRows.length ? (", source)
        self.assertIn("保存后由后端计算", source)
        self.assertIn('if (!raw.trim())', source)

    def test_contract_ratio_status_values_are_user_facing(self):
        status_source = STATUS_HELPERS.read_text(encoding="utf-8")
        workspace_source = BACKEND_WORKSPACE.read_text(encoding="utf-8")
        constraints_source = CONSTRAINTS_PAGE.read_text(encoding="utf-8")

        self.assertIn('case "SAVED":', status_source)
        self.assertIn('return "已保存";', status_source)
        self.assertIn('case "UNSAVED":', status_source)
        self.assertIn('return "未保存";', status_source)
        self.assertIn("contractRatioStatusLabel(contractStatus)", workspace_source)
        self.assertIn("contractRatioStatusLabel(contractStatus)", constraints_source)

    def test_contract_ratio_table_header_stays_clean(self):
        constraints_source = CONSTRAINTS_PAGE.read_text(encoding="utf-8")

        self.assertNotIn("正式金额由后端 contract-ratio response 返回", constraints_source)
        self.assertNotIn('<span>{dirty ? "未保存" : contractRatioStatusLabel(contractStatus)}</span>', constraints_source)

    def test_report_export_chart_counts_exported_files(self):
        reports_source = REPORTS_PAGE.read_text(encoding="utf-8")
        workspace_source = BACKEND_WORKSPACE.read_text(encoding="utf-8")

        self.assertIn("export_files_json", workspace_source)
        self.assertIn("export_file_id", workspace_source)
        self.assertIn("buildExportedFilePoints(visibleReportRows)", reports_source)
        self.assertIn('title="导出文件统计"', reports_source)
        self.assertNotIn('title="导出文件类型"', reports_source)
        self.assertNotIn("fileTypePoints", reports_source)
        self.assertIn('cellText(row, "report_name")', reports_source)

    def test_reports_page_uses_type_filter_for_batch_download(self):
        reports_source = REPORTS_PAGE.read_text(encoding="utf-8")

        for removed_label in (
            "全部有权限报告",
            "我生成的报告",
            "REP-001",
            "REP-002",
            "REP-003",
            "REP-004",
            "REP-005",
            "REP-006",
            "REP-009",
            "REP-010",
        ):
            self.assertNotIn(removed_label, reports_source)
        self.assertIn("selectedDownloadTypes", reports_source)
        self.assertIn("buildReportFileRows(reportRows)", reports_source)
        self.assertIn("buildDownloadTypes(reportFileRows)", reports_source)
        self.assertIn("const visibleReportRows = reportRows", reports_source)
        self.assertIn("const visibleDownloadFiles = useMemo(", reports_source)
        self.assertIn(
            "reportFileRows.filter((file) => selectedDownloadTypes.has(file.type))",
            reports_source,
        )
        self.assertIn("const downloadTargets = visibleDownloadFiles", reports_source)
        self.assertIn(".filter((file) => selectedFileKeys.has(file.key))", reports_source)
        self.assertIn(
            ".map((file) => ({ reportId: file.reportId, exportFileId: file.exportFileId }))",
            reports_source,
        )
        self.assertIn("downloadSelectedTypes", reports_source)
        self.assertIn("dvasApi.downloadReport(target.reportId, target.exportFileId || undefined)", reports_source)
        self.assertIn("createZipBlob(files)", reports_source)
        self.assertIn('downloadBlob(downloadName("dvas_selected_reports", "zip")', reports_source)
        self.assertNotIn("rowHasSelectedType", reports_source)
        self.assertNotIn("reportRows.filter", reports_source)
        self.assertIn("全选", reports_source)
        self.assertIn("下载", reports_source)

    def test_user_permission_navigation_does_not_show_p1_badge(self):
        menu_source = MENU_CONFIG.read_text(encoding="utf-8")
        app_shell_source = APP_SHELL.read_text(encoding="utf-8")
        menu_body = self._source_between(
            menu_source,
            'menuCode: "NAV_SYSTEM_USER"',
            'menuCode: "NAV_SYSTEM_AUDIT"',
        )

        self.assertIn('label: "用户与权限管理"', menu_body)
        self.assertNotIn("用户与权限管理（P1）", menu_body)
        self.assertNotIn("p1Only: true", menu_body)
        self.assertIn(
            'const p1Only = menuCode === "NAV_SYSTEM_USER" ? false : Boolean(item.p1_only);',
            app_shell_source,
        )
        self.assertIn("stripUserMenuP1Suffix(menuCode, String(item.menu_name))", app_shell_source)
        self.assertIn('menuCode !== "NAV_SYSTEM_USER"', app_shell_source)

    def test_user_permission_page_hides_success_read_message(self):
        users_source = USERS_PAGE.read_text(encoding="utf-8")

        self.assertNotIn("用户、角色和权限数据已从后端读取。", users_source)
        self.assertIn('const [message, setMessage] = useState("");', users_source)
        self.assertIn('{message ? <p className="operationMessage">{message}</p> : null}', users_source)

    def test_profile_avatar_stays_in_page_header_not_sticky(self):
        stylesheet = STYLESHEET.read_text(encoding="utf-8")
        chrome_block = self._source_between(
            stylesheet,
            ".workspaceChrome {",
            ".workspaceChrome > *",
        )

        self.assertIn("position: relative;", chrome_block)
        self.assertNotIn("position: sticky;", chrome_block)
        self.assertNotIn("position: fixed;", chrome_block)
        self.assertNotIn("top:", chrome_block)

    def test_removed_upload_warning_and_report_confirm_toast(self):
        package_page_source = DATA_PACKAGES_PAGE.read_text(encoding="utf-8")
        dispatcher_source = ACTION_DISPATCHER.read_text(encoding="utf-8")
        app_shell_source = APP_SHELL.read_text(encoding="utf-8")

        self.assertNotIn("仅支持 UTF-8 JSON，禁止上传真实敏感数据。", package_page_source)
        self.assertIn('const silentDisabledActionIds = new Set(["REP-009"]);', dispatcher_source)
        self.assertIn("silentDisabledActionIds.has(action.id)", dispatcher_source)
        self.assertIn('lastMessage: ""', dispatcher_source)
        self.assertIn("{showOperationMessage ? (", app_shell_source)
        self.assertIn('className="operationMessage"', app_shell_source)
        self.assertIn("lastMessage: `${action.label} 未执行：${disabledReason}`", dispatcher_source)

    def test_simulation_page_removes_gray_helper_text_and_precheck_gap(self):
        simulation_source = SIMULATION_PAGE.read_text(encoding="utf-8")
        allocation_context_source = ALLOCATION_CONTEXT.read_text(encoding="utf-8")
        stylesheet = STYLESHEET.read_text(encoding="utf-8")
        simulation_grid_block = self._source_between(
            stylesheet,
            ".contractSimulationGrid {",
            ".simulationFlowStack {",
        )
        simulation_flow_stack_block = self._source_between(
            stylesheet,
            ".simulationFlowStack {",
            ".contractFlowBlocks {",
        )
        constraint_evidence_block = self._source_between(
            stylesheet,
            ".constraintEvidenceBody {",
            ".constraintEvidenceBody p",
        )
        constraint_head_block = self._source_between(
            stylesheet,
            ".constraintEvidence .allocationPanelHead {",
            ".constraintEvidenceBody div:first-child {",
        )
        constraint_first_row_block = self._source_between(
            stylesheet,
            ".constraintEvidenceBody div:first-child {",
            ".constraintEvidenceBody dt {",
        )

        self.assertNotIn(
            "金额闭合、尾差和每个主体的 amount_source 均来自后端模拟结果。",
            simulation_source,
        )
        self.assertNotIn("allocation.constraintCheck.detailText", simulation_source)
        self.assertNotIn(
            "当前结果按已保存合同比例方案与 MD-DShap 权重生成；合同分配路径不生成普通约束命中/未命中 trace。",
            allocation_context_source,
        )
        self.assertIn("align-items: stretch;", simulation_grid_block)
        self.assertNotIn("align-items: start;", simulation_grid_block)
        self.assertIn("align-content: stretch;", simulation_flow_stack_block)
        self.assertIn("grid-template-rows: auto minmax(0, 1fr);", simulation_flow_stack_block)
        self.assertIn("height: 100%;", simulation_flow_stack_block)
        self.assertNotIn("align-content: start;", simulation_flow_stack_block)
        self.assertIn("gap: 0;", constraint_evidence_block)
        self.assertIn("margin-bottom: 6px;", constraint_head_block)
        self.assertIn("border-top: 0;", constraint_first_row_block)
        self.assertIn("padding-top: 0;", constraint_first_row_block)

    def test_business_mutation_errors_keep_backend_connection_state(self):
        source = BACKEND_WORKSPACE.read_text(encoding="utf-8")
        body = self._source_between(
            source,
            "export async function mutateBackendAndRefresh",
            "export function backendUnavailableStore",
        )

        self.assertIn("if (!normalized.retryable)", body)
        self.assertIn('mode: "backend"', body)
        self.assertIn('mode: "backend_unavailable"', body)
        self.assertLess(body.index('mode: "backend"'), body.index('mode: "backend_unavailable"'))

    def _function_body(self, start_marker, end_marker):
        source = DATA_PACKAGES_PAGE.read_text(encoding="utf-8")
        start = source.index(f"async function {start_marker}")
        end = source.index(end_marker, start + 1)
        return source[start:end]

    def _source_between(self, source, start_marker, end_marker):
        start = source.index(start_marker)
        end = source.index(end_marker, start + 1)
        return source[start:end]


if __name__ == "__main__":
    unittest.main()
