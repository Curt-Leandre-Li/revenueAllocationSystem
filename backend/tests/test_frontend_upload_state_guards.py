import re
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_SOURCE_ROOT = REPO_ROOT / ("ui_" + "prototype") / "src"
BACKEND_WORKSPACE = FRONTEND_SOURCE_ROOT / "domain" / "services" / "backendWorkspace.ts"
DATA_PACKAGES_PAGE = FRONTEND_SOURCE_ROOT / "pages" / "data" / "DataPackagesPage.tsx"
DASHBOARD_PAGE = FRONTEND_SOURCE_ROOT / "pages" / "dashboard" / "OverviewPage.tsx"
CONSTRAINTS_PAGE = FRONTEND_SOURCE_ROOT / "pages" / "allocation" / "ConstraintsPage.tsx"
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
