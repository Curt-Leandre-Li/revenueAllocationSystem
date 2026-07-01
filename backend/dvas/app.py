import json
from email import policy
from email.parser import BytesParser
from urllib.parse import parse_qs, urlparse

from .audit import AuditService
from .contracts import API_PREFIX, LOCAL_OPERATOR, ApiError, error_response, ok_response
from .postgres_read_model import PostgresReadService
from .repository import JsonFileRepository
from .services import (
    AllocationService,
    AsyncJobService,
    AuditLogService,
    AuthService,
    ContributionService,
    ContractConstraintService,
    ContractRatioService,
    DashboardService,
    DataIngestionService,
    DraftConfigurationService,
    ImportTemplateService,
    MdDshapService,
    MyContentService,
    NavigationService,
    PartyService,
    ProjectService,
    QualityAssessmentService,
    ReportService,
    ResourceService,
    ShuyuanMeteringService,
    SystemParameterService,
    UserAccessService,
    UtilityService,
    redact_sensitive,
)


class DvasApplication:
    def __init__(self, repository=None):
        self.repository = repository or JsonFileRepository()
        self.postgres_read_service = PostgresReadService()
        self.project_service = ProjectService(self.repository)
        self.auth_service = AuthService(self.repository)
        self.navigation_service = NavigationService()
        self.dashboard_service = DashboardService(self.repository)
        self.ingestion_service = DataIngestionService(self.repository)
        self.import_template_service = ImportTemplateService(
            self.repository,
            self.ingestion_service,
            self.auth_service,
        )
        self.resource_service = ResourceService(self.repository)
        self.party_service = PartyService(self.repository)
        self.quality_service = QualityAssessmentService(self.repository)
        self.shuyuan_service = ShuyuanMeteringService(self.repository)
        self.contribution_service = ContributionService(self.repository)
        self.utility_service = UtilityService(self.repository)
        self.md_dshap_service = MdDshapService(self.repository)
        self.constraint_service = ContractConstraintService(self.repository)
        self.contract_ratio_service = ContractRatioService(self.repository)
        self.allocation_service = AllocationService(self.repository)
        self.report_service = ReportService(self.repository)
        self.system_parameter_service = SystemParameterService(self.repository)
        self.draft_configuration_service = DraftConfigurationService(self.repository)
        self.audit_log_service = AuditLogService(self.repository)
        self.user_access_service = UserAccessService(self.repository, self.auth_service)
        self.async_job_service = AsyncJobService(self.repository, self.auth_service)
        self.my_content_service = MyContentService(self.repository, self.auth_service)

    def handle(self, method, path, body=None):
        trace_id = None
        method = method.upper()
        payload = body or {}
        try:
            if method == "GET":
                payload = {**self._query_params(path), **payload}
            self._bind_request_user(payload)
            data = self._dispatch(method, self._normalize_path(path), payload)
            return ok_response(data, trace_id=trace_id)
        except ApiError as error:
            self._record_failure_audit(method, path, payload, error)
            return error_response(error, trace_id=trace_id)

    def handle_http(self, method, path, raw_body, headers=None):
        if method.upper() == "OPTIONS":
            return 204, self._json_headers(), b""
        try:
            content_type = self._header_value(headers, "Content-Type")
            if content_type.lower().startswith("multipart/form-data"):
                body = self._parse_multipart_body(raw_body, content_type)
            else:
                body = json.loads(raw_body.decode("utf-8")) if raw_body else {}
            token = self._auth_token(headers)
            if isinstance(body, dict):
                body["_auth_token"] = token
                body["_http_request"] = True
        except json.JSONDecodeError as exc:
            response = error_response(
                ApiError(
                    "DVAS_INPUT_FORMAT_ERROR",
                    "请求体不是合法 JSON",
                    field_errors=[{"field": "body", "reason": str(exc)}],
                )
            )
            return 400, self._json_headers(), self._encode(response)
        except ApiError as error:
            response = error_response(error)
            return self._status_for_error(response["code"]), self._json_headers(), self._encode(response)
        response = self.handle(method, path, body)
        status = 200 if response["success"] else self._status_for_error(response["code"])
        return status, self._json_headers(), self._encode(response)

    def _bind_request_user(self, payload):
        token = (payload or {}).get("_auth_token")
        session = self.repository.get_session(token) if token else None
        if session and session.get("status") == "ACTIVE":
            self.repository.current_user_id = session["user_id"]
        else:
            self.repository.current_user_id = LOCAL_OPERATOR

    def _ensure_report_visible(self, payload, report_id):
        if not (payload or {}).get("_auth_token"):
            return
        visible_report_ids = {
            item["report_id"]
            for item in self.my_content_service.reports(payload).get("items", [])
        }
        if report_id not in visible_report_ids:
            raise ApiError("DVAS_PERMISSION_DENIED", "当前用户无此报告权限", status=403)

    def _dispatch(self, method, path, body):
        if method == "GET" and path == "/health/db":
            return self.postgres_read_service.health()

        plain_api = path.startswith("/api/") and not path.startswith(API_PREFIX)
        if path.startswith(API_PREFIX):
            segments = [segment for segment in path.removeprefix(API_PREFIX).split("/") if segment]
        else:
            segments = [segment for segment in path.removeprefix("/api").split("/") if segment]

        if self._http_auth_required(method, segments, body):
            raise ApiError("DVAS_AUTH_REQUIRED", "请先登录", status=401)
        self._enforce_authenticated_action_permission(method, segments, body)

        if plain_api and method == "GET" and segments == ["projects"]:
            return self.postgres_read_service.projects()
        if (
            plain_api
            and method == "GET"
            and len(segments) == 3
            and segments[0] == "projects"
            and segments[2] == "status"
        ):
            return self.postgres_read_service.project_status(segments[1])
        if plain_api and method == "GET" and segments == ["audit", "logs"]:
            return self.postgres_read_service.audit_logs(body.get("project_id"))
        if plain_api and method == "GET" and segments == ["reports"]:
            return self.postgres_read_service.reports(body.get("project_id"))

        if method == "POST" and segments == ["auth", "login"]:
            return self.auth_service.login(body)
        if method == "POST" and segments == ["auth", "logout"]:
            return self.auth_service.logout(body)
        if method == "GET" and segments == ["auth", "me"]:
            return self.auth_service.me(body)
        if method == "GET" and segments == ["auth", "permissions"]:
            user = self.auth_service.current_user(body, require_login=True)
            return self.auth_service.permission_summary(user["user_id"])

        if method == "GET" and segments == ["my", "projects"]:
            return self.my_content_service.projects(body)
        if method == "GET" and segments == ["my", "uploads"]:
            return self.my_content_service.uploads(body)
        if method == "GET" and segments == ["my", "jobs"]:
            return self.my_content_service.jobs(body)
        if method == "GET" and segments == ["my", "reports"]:
            return self.my_content_service.reports(body)
        if method == "GET" and segments == ["my", "workbench"]:
            return self.my_content_service.workbench(body)

        if method == "GET" and segments in (["system", "users"], ["users"]):
            self.auth_service.current_user(body, require_login=True)
            return self.user_access_service.list_users(body)
        if method == "POST" and segments in (["system", "users"], ["users"]):
            self.auth_service.current_user(body, require_login=True)
            return self.user_access_service.create_user(body)
        if method == "GET" and segments in (["system", "users", "me"], ["users", "me"]):
            return self.user_access_service.me(body)
        if method == "PUT" and segments in (["system", "users", "me", "password"], ["users", "me", "password"]):
            return self.user_access_service.change_own_password(body)
        if method == "GET" and len(segments) == 3 and segments[:2] == ["system", "users"]:
            self.auth_service.current_user(body, require_login=True)
            return self.user_access_service.get_user(segments[2], body)
        if method == "GET" and len(segments) == 2 and segments[0] == "users" and segments[1] != "me":
            self.auth_service.current_user(body, require_login=True)
            return self.user_access_service.get_user(segments[1], body)
        if method == "PATCH" and len(segments) == 3 and segments[:2] == ["system", "users"]:
            self.auth_service.current_user(body, require_login=True)
            return self.user_access_service.update_user(segments[2], body)
        if method == "PATCH" and len(segments) == 2 and segments[0] == "users" and segments[1] != "me":
            self.auth_service.current_user(body, require_login=True)
            return self.user_access_service.update_user(segments[1], body)
        if method in {"POST", "PATCH"} and len(segments) == 4 and segments[:2] == ["system", "users"] and segments[3] == "disable":
            self.auth_service.current_user(body, require_login=True)
            return self.user_access_service.disable_user(segments[2], body)
        if method in {"POST", "PATCH"} and len(segments) == 3 and segments[0] == "users" and segments[2] == "disable":
            self.auth_service.current_user(body, require_login=True)
            return self.user_access_service.disable_user(segments[1], body)
        if method == "POST" and len(segments) == 4 and segments[:2] == ["system", "users"] and segments[3] == "reset-password":
            self.auth_service.current_user(body, require_login=True)
            return self.user_access_service.reset_password(segments[2], body)
        if method == "POST" and len(segments) == 3 and segments[0] == "users" and segments[2] == "reset-password":
            self.auth_service.current_user(body, require_login=True)
            return self.user_access_service.reset_password(segments[1], body)
        if method == "GET" and segments == ["system", "roles"]:
            self.auth_service.current_user(body, require_login=True)
            return self.user_access_service.list_roles(body)
        if method == "GET" and segments == ["system", "permissions"]:
            self.auth_service.current_user(body, require_login=True)
            return self.user_access_service.list_permissions(body)
        if method == "PUT" and len(segments) == 4 and segments[:2] == ["system", "roles"] and segments[3] == "permissions":
            self.auth_service.current_user(body, require_login=True)
            return self.user_access_service.update_role_permissions(segments[2], body)

        if method == "GET" and segments == ["import-templates", "csv"]:
            return self.import_template_service.csv_template(body)
        if method == "GET" and segments == ["import-templates", "xlsx"]:
            return self.import_template_service.xlsx_template(body)
        if (
            method == "POST"
            and len(segments) == 5
            and segments[0] == "projects"
            and segments[2:4] == ["data-packages", "import"]
            and segments[4] == "csv"
        ):
            return self.import_template_service.import_csv(body)
        if (
            method == "POST"
            and len(segments) == 5
            and segments[0] == "projects"
            and segments[2:4] == ["data-packages", "import"]
            and segments[4] == "xlsx"
        ):
            return self.import_template_service.import_xlsx(body)

        if method == "POST" and len(segments) == 3 and segments[0] == "projects" and segments[2] == "jobs":
            return self.async_job_service.run_pipeline(body, lambda: self.dashboard_service.quick_run(body))
        if method == "GET" and len(segments) == 3 and segments[0] == "projects" and segments[2] == "jobs":
            return self.async_job_service.list_jobs({**body, "project_id": segments[1]})
        if method == "GET" and len(segments) == 2 and segments[0] == "jobs":
            return self.async_job_service.detail(body, segments[1])
        if method == "POST" and len(segments) == 3 and segments[0] == "jobs" and segments[2] == "cancel":
            return self.async_job_service.cancel(body, segments[1])
        if method == "POST" and len(segments) == 4 and segments[:2] == ["projects", segments[1]] and segments[2:] == ["md-dshap", "tasks"]:
            return self.async_job_service.run_md_dshap(body, lambda: self.md_dshap_service.run(body))
        if (
            method == "GET"
            and len(segments) == 6
            and segments[0] == "projects"
            and segments[2:4] == ["md-dshap", "tasks"]
            and segments[5] == "progress"
        ):
            return self.async_job_service.md_dshap_progress(body, segments[4])

        if method == "POST" and len(segments) == 4 and segments[0] == "projects" and segments[2:] == ["reports", "pdf"]:
            self.auth_service.require_button(body, "REP-003")
            return self.report_service.generate_pdf()
        if method == "GET" and len(segments) == 3 and segments[0] == "projects" and segments[2] == "reports":
            self.auth_service.require_button(body, "REP-010")
            return self.report_service.list()
        if (
            method == "GET"
            and len(segments) == 2
            and segments[0] == "reports"
            and segments[1] not in {"preview"}
        ):
            self._ensure_report_visible(body, segments[1])
            return self.report_service.detail(segments[1])
        if method == "GET" and len(segments) == 3 and segments[0] == "reports" and segments[2] == "files":
            self._ensure_report_visible(body, segments[1])
            return self.report_service.files(segments[1])
        if method == "GET" and len(segments) == 3 and segments[0] == "reports" and segments[2] == "manifest":
            self._ensure_report_visible(body, segments[1])
            return self.report_service.manifest(segments[1])
        if method == "GET" and len(segments) == 3 and segments[0] == "reports" and segments[2] == "download":
            self.auth_service.require_button(body, "REP-011")
            self._ensure_report_visible(body, segments[1])
            return self.report_service.download(segments[1], body.get("file_id"))
        if method == "PATCH" and len(segments) == 3 and segments[0] == "reports" and segments[2] == "archive":
            self.auth_service.require_button(body, "REP-012")
            return self.report_service.archive(segments[1], body)

        if method == "GET" and segments == ["audit", "logs"]:
            self.auth_service.require_menu(body, "NAV_SYSTEM_AUDIT")
            return self.audit_log_service.list(body)
        if method == "GET" and len(segments) == 3 and segments[:2] == ["audit", "logs"]:
            self.auth_service.require_menu(body, "NAV_SYSTEM_AUDIT")
            return self.audit_log_service.detail(segments[2])
        if method == "GET" and len(segments) == 3 and segments[:2] == ["audit", "snapshots"]:
            self.auth_service.require_menu(body, "NAV_SYSTEM_AUDIT")
            snapshot = self.repository.get_snapshot(segments[2])
            if not snapshot:
                raise ApiError("DVAS_NOT_FOUND", "快照不存在", status=404)
            return snapshot
        if method == "POST" and segments == ["audit", "export"]:
            self.auth_service.require_button(body, "AUD-007")
            return self.report_service.export_audit_log()

        if method == "GET" and segments == ["projects", "current"]:
            return self.project_service.current_project()
        if method == "GET" and segments == ["projects", "current", "status"]:
            return self.project_service.status()
        if method == "GET" and len(segments) == 3 and segments[0] == "projects" and segments[2] == "status":
            return self.project_service.status(segments[1])
        if method == "GET" and len(segments) == 3 and segments[0] == "projects" and segments[2] == "flow":
            return self.project_service.flow(segments[1])
        if method == "GET" and segments == ["navigation", "menu-tree"]:
            return self.navigation_service.menu_tree()
        if method == "GET" and segments == ["navigation", "menus"]:
            return self.navigation_service.menu_tree()
        if method == "GET" and segments == ["navigation", "button-permissions"]:
            return self.navigation_service.button_permissions()
        if method == "GET" and segments == ["dashboard"]:
            return self.dashboard_service.overview()
        if method == "GET" and segments == ["sys", "home"]:
            return self.dashboard_service.overview()
        if method == "GET" and segments == ["dashboard", "preconditions"]:
            return self.dashboard_service.preconditions()
        if method == "POST" and segments == ["dashboard", "actions", "quick-run"]:
            return self.dashboard_service.quick_run(body)
        if (
            method == "POST"
            and len(segments) == 4
            and segments[0] == "projects"
            and segments[2:] == ["pipeline", "run"]
        ):
            return self.dashboard_service.quick_run(body)
        if method == "POST" and len(segments) == 3 and segments[:1] == ["demo-cases"] and segments[2] == "initialize":
            return self.ingestion_service.initialize_demo_case(segments[1])
        if method == "POST" and len(segments) == 3 and segments[:1] == ["demo-cases"] and segments[2] == "select":
            return self.ingestion_service.initialize_demo_case(segments[1])
        if method == "POST" and segments == ["data-packages", "upload"]:
            return self._handle_upload(body)
        if method == "POST" and segments == ["data", "packages", "upload"]:
            return self._handle_upload(body)
        if method == "GET" and segments == ["data-packages"]:
            return self.ingestion_service.list_packages(body)
        if method == "GET" and segments == ["data", "packages"]:
            return self.ingestion_service.list_packages(body)
        if method == "DELETE" and len(segments) == 2 and segments[0] == "data-packages":
            return self.ingestion_service.delete_package(segments[1])
        if method == "DELETE" and len(segments) == 3 and segments[:2] == ["data", "packages"]:
            return self.ingestion_service.delete_package(segments[2])
        if method == "GET" and len(segments) == 2 and segments[0] == "data-packages":
            return self.ingestion_service.package_detail(segments[1])
        if method == "GET" and len(segments) == 4 and segments[:2] == ["data", "packages"] and segments[3] == "preview":
            return self.ingestion_service.package_detail(segments[2])
        if (
            method == "GET"
            and len(segments) == 3
            and segments[0] == "data-packages"
            and segments[2] == "validation-result"
        ):
            return self.ingestion_service.validation_result(segments[1])
        if method == "GET" and segments == ["data-resources"]:
            return self.ingestion_service.list_resources()
        if method == "GET" and segments == ["data", "resources"]:
            return self.ingestion_service.list_resources()
        if (
            method == "PUT"
            and len(segments) == 3
            and segments[0] == "data-resources"
            and segments[2] == "party-relations"
        ):
            return self.resource_service.bind_party_relations(segments[1], body)
        if method == "GET" and len(segments) == 2 and segments[0] == "data-resources":
            return self.ingestion_service.resource_detail(segments[1])
        if method == "GET" and segments == ["parties"]:
            return self.ingestion_service.list_parties()
        if method == "GET" and segments == ["data", "parties"]:
            return self.ingestion_service.list_parties()
        if method == "POST" and segments == ["parties"]:
            return self.party_service.create_party(body)
        if method == "POST" and segments == ["data", "parties"]:
            return self.party_service.create_party(body)
        if method == "PUT" and len(segments) == 2 and segments[0] == "parties":
            return self.party_service.update_party(segments[1], body)
        if method == "PATCH" and len(segments) == 3 and segments[:2] == ["data", "parties"]:
            return self.party_service.update_party(segments[2], body)
        if (
            method == "PATCH"
            and len(segments) == 3
            and segments[0] == "parties"
            and segments[2] == "status"
        ):
            return self.party_service.set_status(segments[1], body)
        if method == "PATCH" and len(segments) == 4 and segments[:2] == ["data", "parties"] and segments[3] == "status":
            return self.party_service.set_status(segments[2], body)
        if method == "POST" and segments == ["quality-assessments", "run"]:
            return self.quality_service.run(body)
        if method == "GET" and segments == ["metering", "quality", "weights"]:
            return self.system_parameter_service.quality_weights()
        if method == "PUT" and segments == ["metering", "quality", "weights"]:
            return self.system_parameter_service.update_quality_weights(body)
        if method == "POST" and segments == ["metering", "quality", "evaluate"]:
            return self.quality_service.run(body)
        if method == "GET" and segments == ["quality-assessments", "latest"]:
            return self.quality_service.latest()
        if method == "GET" and segments == ["metering", "quality", "resource-results"]:
            return self.quality_service.resource_results(body)
        if (
            method == "GET"
            and len(segments) == 4
            and segments[:3] == ["metering", "quality", "resource-results"]
        ):
            return self.quality_service.resource_result_detail(segments[3], body)
        if (
            method == "GET"
            and len(segments) == 3
            and segments[0] == "quality-assessments"
            and segments[2] == "details"
        ):
            return self.quality_service.details(segments[1])
        if (
            method == "GET"
            and len(segments) == 3
            and segments[0] == "quality-assessments"
            and segments[2] == "resource-results"
        ):
            return self.quality_service.resource_results(
                {**body, "assessment_id": segments[1]}
            )
        if method == "POST" and segments == ["shuyuan-meterings", "run"]:
            return self.shuyuan_service.run(body)
        if method == "GET" and segments == ["metering", "shuyuan", "parameters"]:
            return self.system_parameter_service.shuyuan_parameters()
        if method == "PUT" and segments == ["metering", "shuyuan", "parameters"]:
            return self.system_parameter_service.update_shuyuan_parameters(body)
        if method == "PUT" and segments == ["metering", "shuyuan", "call-counts"]:
            return self.draft_configuration_service.save_shuyuan_call_counts(body)
        if method == "POST" and segments == ["metering", "shuyuan", "calculate"]:
            return self.shuyuan_service.run(body)
        if method == "GET" and segments == ["shuyuan-meterings", "latest"]:
            return self.shuyuan_service.latest()
        if (
            method == "GET"
            and len(segments) == 3
            and segments[0] == "shuyuan-meterings"
            and segments[2] == "details"
        ):
            return self.shuyuan_service.details(segments[1])
        if method == "POST" and segments == ["contributions", "run"]:
            return self.contribution_service.run(body)
        if method == "PUT" and segments == ["metering", "utility", "contribution-factors"]:
            return self.system_parameter_service.update_contribution_factors(body)
        if method == "POST" and segments == ["metering", "utility", "contribution", "calculate"]:
            return self.contribution_service.run(body)
        if method == "PUT" and segments == ["metering", "utility", "function"]:
            return self.draft_configuration_service.save_utility_function(body)
        if method == "GET" and segments == ["metering", "utility", "function"]:
            return self.draft_configuration_service.utility_function()
        if method == "POST" and segments == ["metering", "utility", "calculate"]:
            return self.utility_service.run(body)
        if method == "POST" and segments == ["utilities", "run"]:
            return self.utility_service.run(body)
        if method == "GET" and segments == ["utilities", "latest"]:
            return self.utility_service.latest()
        if (
            method == "GET"
            and len(segments) == 3
            and segments[0] == "utilities"
            and segments[2] == "trace"
        ):
            return self.utility_service.trace(segments[1])
        if method == "POST" and segments == ["md-dshap", "tasks"]:
            return self.md_dshap_service.run(body)
        if method == "GET" and segments == ["md-dshap", "tasks"]:
            return self.md_dshap_service.list_tasks(body)
        if method == "GET" and segments == ["allocation", "md-dshap", "config"]:
            return self.system_parameter_service.md_dshap_config()
        if method == "PUT" and segments == ["allocation", "md-dshap", "config"]:
            return self.system_parameter_service.update_md_dshap_config(body)
        if method == "GET" and segments == ["allocation", "md-dshap", "participant-pool"]:
            return self.md_dshap_service.participant_pool()
        if method == "POST" and segments == ["allocation", "md-dshap", "tasks"]:
            return self.md_dshap_service.run(body)
        if method == "GET" and segments == ["allocation", "md-dshap", "tasks"]:
            return self.md_dshap_service.list_tasks(body)
        if method == "GET" and len(segments) == 3 and segments[:2] == ["md-dshap", "tasks"]:
            return self.md_dshap_service.task(segments[2])
        if method == "GET" and len(segments) == 4 and segments[:3] == ["allocation", "md-dshap", "tasks"]:
            return self.md_dshap_service.task(segments[3])
        if (
            method == "GET"
            and len(segments) == 4
            and segments[:2] == ["md-dshap", "tasks"]
            and segments[3] == "results"
        ):
            return self.md_dshap_service.results(segments[2])
        if method == "GET" and len(segments) == 5 and segments[:3] == ["allocation", "md-dshap", "tasks"] and segments[4] == "results":
            return self.md_dshap_service.results(segments[3])
        if method == "POST" and len(segments) == 5 and segments[:3] == ["allocation", "md-dshap", "tasks"] and segments[4] == "audit-export":
            return self.report_service.generate_md_dshap_audit(
                segments[3],
                audit_module_code="MDS",
                audit_menu_code="NAV_ALLOC_MDS",
            )
        if (
            method == "GET"
            and len(segments) == 4
            and segments[:2] == ["md-dshap", "tasks"]
            and segments[3] == "marginal-traces"
        ):
            return self.md_dshap_service.marginal_traces(segments[2])
        if method == "GET" and segments == ["contract-constraints"]:
            return self.constraint_service.list()
        if method == "GET" and segments == ["allocation", "constraints"]:
            return self.constraint_service.list()
        if (
            len(segments) == 4
            and segments[0] == "projects"
            and segments[2:] == ["allocation", "summary"]
            and method == "GET"
        ):
            return self.contract_ratio_service.summary(segments[1])
        if (
            len(segments) == 4
            and segments[0] == "projects"
            and segments[2:] == ["allocation", "simulate"]
            and method == "POST"
        ):
            return self.allocation_service.simulate_contract_ratio(segments[1])
        if (
            len(segments) == 4
            and segments[0] == "projects"
            and segments[2:] == ["allocation", "contract-ratio"]
            and method == "GET"
        ):
            return self.contract_ratio_service.get(segments[1])
        if (
            len(segments) == 4
            and segments[0] == "projects"
            and segments[2:] == ["allocation", "contract-ratio"]
            and method == "PUT"
        ):
            return self.contract_ratio_service.save(segments[1], body)
        if (
            len(segments) == 4
            and segments[0] == "projects"
            and segments[2:] == ["allocation", "contract-ratio"]
            and method == "DELETE"
        ):
            return self.contract_ratio_service.delete(segments[1])
        if method == "POST" and segments == ["contract-constraints"]:
            return self.constraint_service.create(body)
        if method == "POST" and segments == ["allocation", "constraints"]:
            return self.constraint_service.create(body)
        if method == "PUT" and len(segments) == 2 and segments[0] == "contract-constraints":
            return self.constraint_service.update(segments[1], body)
        if method == "PATCH" and len(segments) == 3 and segments[:2] == ["allocation", "constraints"]:
            return self.constraint_service.update(segments[2], body)
        if (
            method == "PATCH"
            and len(segments) == 3
            and segments[0] == "contract-constraints"
            and segments[2] == "status"
        ):
            return self.constraint_service.set_status(segments[1], body)
        if method == "PATCH" and len(segments) == 4 and segments[:2] == ["allocation", "constraints"] and segments[3] == "status":
            return self.constraint_service.set_status(segments[2], body)
        if method == "POST" and segments == ["allocation-scenarios"]:
            return self.allocation_service.create(body)
        if method == "PUT" and segments == ["allocation", "simulation", "revenue-pool"]:
            return self.draft_configuration_service.save_revenue_pool(body)
        if method == "PUT" and segments == ["allocation", "simulation", "priority-items"]:
            return self.draft_configuration_service.save_priority_items(body)
        if method == "PUT" and segments == ["allocation", "simulation", "mode"]:
            return self.draft_configuration_service.save_allocation_mode(body)
        if method == "POST" and segments == ["allocation", "simulation", "run"]:
            return self.allocation_service.run(body)
        if (
            method == "POST"
            and len(segments) == 3
            and segments[0] == "allocation-scenarios"
            and segments[2] == "simulate"
        ):
            return self.allocation_service.simulate(segments[1])
        if (
            method == "POST"
            and len(segments) == 3
            and segments[0] == "allocation-scenarios"
            and segments[2] == "lock"
        ):
            return self.allocation_service.lock(segments[1])
        if method == "POST" and len(segments) == 4 and segments[:2] == ["allocation", "simulation"] and segments[3] == "lock":
            return self.allocation_service.lock(segments[2])
        if method == "POST" and len(segments) == 4 and segments[:2] == ["allocation", "simulation"] and segments[3] == "export":
            return self.report_service.generate_json()
        if (
            method == "GET"
            and len(segments) == 3
            and segments[0] == "allocation-scenarios"
            and segments[2] == "results"
        ):
            return self.allocation_service.results(segments[1])
        if method == "GET" and segments == ["reports"]:
            if body.get("_auth_token"):
                return self.my_content_service.reports(body)
            return self.report_service.list()
        if method == "GET" and segments == ["reports", "preview"]:
            self.auth_service.require_button(body, "REP-001")
            return self.report_service.preview()
        if method == "POST" and segments == ["reports", "markdown"]:
            self.auth_service.require_button(body, "REP-002")
            return self.report_service.generate_markdown()
        if method == "POST" and segments == ["reports", "csv"]:
            self.auth_service.require_button(body, "REP-004")
            return self.report_service.generate_csv()
        if method == "POST" and segments == ["reports", "json"]:
            self.auth_service.require_button(body, "REP-005")
            return self.report_service.generate_json()
        if method == "POST" and segments == ["reports", "audit-log"]:
            self.auth_service.require_button(body, "AUD-007")
            return self.report_service.export_audit_log()
        if method == "POST" and segments == ["reports", "md-dshap-audit"]:
            self.auth_service.require_button(body, "REP-006", aliases=("REP-012",))
            return self.report_service.generate_md_dshap_audit()
        if method == "GET" and segments == ["system", "parameters"]:
            self.auth_service.require_menu(body, "NAV_SYSTEM_PARAMETER")
            return self.system_parameter_service.list()
        if method == "GET" and len(segments) == 3 and segments[:2] == ["system", "parameters"]:
            self.auth_service.require_menu(body, "NAV_SYSTEM_PARAMETER")
            return self.system_parameter_service.detail(segments[2])
        if method == "PUT" and len(segments) == 3 and segments[:2] == ["system", "parameters"]:
            self.auth_service.require_menu(body, "NAV_SYSTEM_PARAMETER")
            return self.system_parameter_service.update(segments[2], body)
        if (
            method == "POST"
            and len(segments) == 4
            and segments[:2] == ["system", "parameters"]
            and segments[3] == "restore-default"
        ):
            self.auth_service.require_menu(body, "NAV_SYSTEM_PARAMETER")
            return self.system_parameter_service.restore_default(segments[2])
        if method == "GET" and segments == ["audit-logs"]:
            self.auth_service.require_menu(body, "NAV_SYSTEM_AUDIT")
            return self.audit_log_service.list(body)
        if method == "GET" and segments == ["system", "audit", "logs"]:
            self.auth_service.require_menu(body, "NAV_SYSTEM_AUDIT")
            return self.audit_log_service.list(body)
        if method == "GET" and len(segments) == 2 and segments[0] == "audit-logs":
            self.auth_service.require_menu(body, "NAV_SYSTEM_AUDIT")
            return self.audit_log_service.detail(segments[1])
        if method == "GET" and len(segments) == 4 and segments[:3] == ["system", "audit", "logs"]:
            self.auth_service.require_menu(body, "NAV_SYSTEM_AUDIT")
            return self.audit_log_service.detail(segments[3])
        raise ApiError("DVAS_NOT_FOUND", "接口不存在", status=404)

    def _normalize_path(self, path):
        parsed = urlparse(path)
        normalized = parsed.path.rstrip("/") or "/"
        if normalized == "/health/db":
            return normalized
        if not (normalized.startswith(API_PREFIX) or normalized.startswith("/api/")):
            raise ApiError("DVAS_NOT_FOUND", "接口不存在", status=404)
        return normalized

    def _query_params(self, path):
        parsed = urlparse(path)
        params = parse_qs(parsed.query, keep_blank_values=True)
        return {key: values[-1] if values else "" for key, values in params.items()}

    def _handle_upload(self, body):
        if isinstance(body, dict) and "_multipart_files" in body:
            return self.ingestion_service.upload_multipart(body)
        return self.ingestion_service.upload_json(body)

    def _parse_multipart_body(self, raw_body, content_type):
        message = BytesParser(policy=policy.default).parsebytes(
            b"Content-Type: "
            + content_type.encode("utf-8")
            + b"\r\nMIME-Version: 1.0\r\n\r\n"
            + raw_body
        )
        if not message.is_multipart():
            raise ApiError(
                "DVAS_INPUT_FORMAT_ERROR",
                "multipart/form-data 请求体无法解析",
                field_errors=[{"field": "body", "reason": "缺少有效 multipart boundary"}],
            )
        fields = {}
        files = {}
        for part in message.iter_parts():
            if part.get_content_disposition() != "form-data":
                continue
            name = part.get_param("name", header="content-disposition")
            if not name:
                continue
            content = part.get_payload(decode=True) or b""
            filename = part.get_filename()
            if filename:
                files[name] = {
                    "filename": filename,
                    "content": content,
                    "content_type": part.get_content_type(),
                }
            else:
                charset = part.get_content_charset() or "utf-8"
                fields[name] = content.decode(charset)
        fields["_multipart_files"] = files
        return fields

    def _header_value(self, headers, name):
        if headers is None:
            return ""
        if hasattr(headers, "get"):
            return headers.get(name, "") or headers.get(name.lower(), "") or ""
        for key, value in headers:
            if key.lower() == name.lower():
                return value
        return ""

    def _json_headers(self):
        return {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }

    def _auth_token(self, headers):
        authorization = self._header_value(headers, "Authorization")
        if authorization.lower().startswith("bearer "):
            return authorization.split(" ", 1)[1].strip()
        return ""

    def _encode(self, response):
        return json.dumps(response, ensure_ascii=False, sort_keys=True).encode("utf-8")

    def _status_for_error(self, code):
        if code == "DVAS_NOT_FOUND":
            return 404
        if code == "DVAS_INPUT_FORMAT_ERROR":
            return 400
        if code in {"DVAS_AUTH_REQUIRED", "DVAS_AUTH_FAILED"}:
            return 401
        if code == "DVAS_PERMISSION_DENIED":
            return 403
        if code == "DVAS_REQUIRED_FIELD_MISSING":
            return 422
        if code == "DVAS_PRECONDITION_NOT_MET":
            return 409
        if code in {
            "DVAS_CONTRACT_PRIORITY_EXCEEDS_TOTAL_REVENUE",
            "DVAS_DATA_PROVIDER_REVENUE_POOL_NEGATIVE",
            "DVAS_NO_DATA_PROVIDER_WEIGHT_RESULT",
        }:
            return 409
        if code == "DVAS_CONTRACT_CAP_INVALID":
            return 422
        if code == "DVAS_FACTOR_INVALID":
            return 422
        if code == "DVAS_UNMAPPED_ENUM_VALUE":
            return 500
        if code == "DVAS_P1_CAPABILITY_NOT_ENABLED":
            return 501
        if code.startswith("DVAS_DB_"):
            return 503
        return 400

    def _record_failure_audit(self, method, path, payload, error):
        if error.audit_recorded:
            return
        context = self._failure_audit_context(method, path, payload)
        if not context:
            return
        try:
            AuditService(self.repository).record_failure(
                module_code=context["module_code"],
                menu_code=context["menu_code"],
                operation_type=context["operation_type"],
                object_type=context["object_type"],
                object_id=context.get("object_id"),
                error_code=error.code,
                error_message=error.message,
                before_value_json={"request": self._safe_audit_payload(payload or {})},
            )
        except Exception:
            return

    def _safe_audit_payload(self, payload):
        if not isinstance(payload, dict):
            return payload
        redacted = {}
        for key, value in payload.items():
            if key in {
                "password",
                "password_hash",
                "initial_password",
                "temporary_password",
                "one_time_initial_password",
                "one_time_temporary_password",
                "current_password",
                "new_password",
                "confirm_password",
                "token",
                "_auth_token",
            } or key.endswith("_password"):
                redacted[key] = "***REDACTED***"
            elif key == "_multipart_files":
                redacted[key] = {
                    name: {
                        "filename": part.get("filename"),
                        "content_type": part.get("content_type"),
                        "content_length": len(part.get("content") or b""),
                    }
                    for name, part in (value or {}).items()
                }
            else:
                redacted[key] = redact_sensitive(value)
        return redacted

    def _http_auth_required(self, method, segments, body):
        if not (body or {}).get("_http_request"):
            return False
        if (body or {}).get("_auth_token"):
            return False
        public_routes = {
            ("POST", ("auth", "login")),
            ("POST", ("auth", "logout")),
        }
        return (method, tuple(segments)) not in public_routes

    def _enforce_authenticated_action_permission(self, method, segments, body):
        if not (body or {}).get("_auth_token"):
            return
        button_code = self._button_permission_for_route(method, segments)
        if button_code:
            self.auth_service.require_button(body, button_code)

    def _button_permission_for_route(self, method, segments):
        route = tuple(segments)
        if method == "POST" and route in {
            ("data-packages", "upload"),
            ("data", "packages", "upload"),
        }:
            return "DATA-003"
        if method == "DELETE" and route[:1] in {("data-packages",), ("data",)}:
            return "DATA-009"
        if method == "POST" and len(route) == 3 and route[0] == "demo-cases" and route[2] in {"initialize", "select"}:
            return "SYS-002"
        if method == "POST" and route == ("dashboard", "actions", "quick-run"):
            return "SYS-004"
        if method == "POST" and len(route) == 4 and route[0] == "projects" and route[2:] == ("pipeline", "run"):
            return "SYS-004"
        if method == "POST" and route in {
            ("quality-assessments", "run"),
            ("metering", "quality", "evaluate"),
        }:
            return "QUAL-003"
        if method == "PUT" and route == ("metering", "quality", "weights"):
            return "PARAM-002"
        if method == "PUT" and route == ("metering", "shuyuan", "parameters"):
            return "PARAM-002"
        if method == "PUT" and route == ("metering", "utility", "contribution-factors"):
            return "PARAM-002"
        if method == "PUT" and route == ("allocation", "md-dshap", "config"):
            return "PARAM-004"
        if method == "PUT" and len(route) == 3 and route[:2] == ("system", "parameters"):
            return "PARAM-002"
        if method == "POST" and len(route) == 4 and route[:2] == ("system", "parameters") and route[3] == "restore-default":
            return "PARAM-008"
        if method == "POST" and route in {
            ("shuyuan-meterings", "run"),
            ("metering", "shuyuan", "calculate"),
        }:
            return "DU-009"
        if method == "POST" and route in {
            ("contributions", "run"),
            ("metering", "utility", "contribution", "calculate"),
            ("utilities", "run"),
            ("metering", "utility", "calculate"),
        }:
            return "UTIL-006"
        if method == "POST" and route in {
            ("md-dshap", "tasks"),
            ("allocation", "md-dshap", "tasks"),
        }:
            return "MDS-011"
        if method == "POST" and route in {
            ("allocation-scenarios",),
            ("allocation", "simulation", "run"),
        }:
            return "ALLOC-011"
        if method == "POST" and len(route) == 3 and route[0] == "allocation-scenarios" and route[2] == "simulate":
            return "ALLOC-011"
        if method == "POST" and len(route) == 3 and route[0] == "allocation-scenarios" and route[2] == "lock":
            return "ALLOC-015"
        if method == "POST" and route in {("contract-constraints",), ("allocation", "constraints")}:
            return "CONS-002"
        if method in {"PUT", "DELETE"} and len(route) == 4 and route[0] == "projects" and route[2:] == ("allocation", "contract-ratio"):
            return "CONS-003"
        if method == "POST" and len(route) == 4 and route[0] == "projects" and route[2:] == ("allocation", "simulate"):
            return "ALLOC-011"
        if method in {"PUT", "PATCH"} and route[:1] in {("contract-constraints",), ("allocation",)} and "constraints" in route:
            return "CONS-003"
        return None

    def _failure_audit_context(self, method, path, payload):
        try:
            normalized_path = self._normalize_path(path)
        except ApiError:
            return None
        if normalized_path.startswith(API_PREFIX):
            segments = [
                segment
                for segment in normalized_path.removeprefix(API_PREFIX).split("/")
                if segment
            ]
        else:
            segments = [
                segment
                for segment in normalized_path.removeprefix("/api").split("/")
                if segment
            ]
        if method == "POST" and segments == ["auth", "login"]:
            return self._audit_context("USER", "NAV_SYSTEM_USER", "LOGIN", "user_account")
        if method == "POST" and segments == ["auth", "logout"]:
            return self._audit_context("USER", "NAV_SYSTEM_USER", "LOGOUT", "user_session")
        if segments[:2] == ["system", "users"] or segments[:1] == ["users"]:
            object_id = segments[2] if segments[:2] == ["system", "users"] and len(segments) > 2 else segments[1] if segments[:1] == ["users"] and len(segments) > 1 else None
            return self._audit_context("USER", "NAV_SYSTEM_USER", f"{method}_SYSTEM_USER", "user_account", object_id)
        if segments[:2] == ["system", "roles"]:
            return self._audit_context("USER", "NAV_SYSTEM_USER", f"{method}_SYSTEM_ROLE", "role", segments[2] if len(segments) > 2 else None)
        if segments == ["system", "permissions"]:
            return self._audit_context("USER", "NAV_SYSTEM_USER", "GET_SYSTEM_PERMISSION", "permission")
        if segments[:2] == ["system", "parameters"]:
            return self._audit_context("SYS", "NAV_SYSTEM_PARAMETER", f"{method}_SYSTEM_PARAMETER", "system_parameter", segments[2] if len(segments) > 2 else None)
        if segments in (["audit", "logs"], ["audit-logs"], ["system", "audit", "logs"]):
            return self._audit_context("AUD", "NAV_SYSTEM_AUDIT", "GET_AUDIT_LOG", "audit_log")
        if method == "POST" and segments in (
            ["data-packages", "upload"],
            ["data", "packages", "upload"],
        ):
            return self._audit_context("DATA", "NAV_DATA_PACKAGE", "UPLOAD_JSON", "data_package")
        if method == "POST" and segments in (
            ["quality-assessments", "run"],
            ["metering", "quality", "evaluate"],
        ):
            return self._audit_context("QUAL", "NAV_MEASURE_QUALITY", "RUN_QUALITY_ASSESSMENT", "quality_assessment")
        if method == "POST" and segments in (
            ["shuyuan-meterings", "run"],
            ["metering", "shuyuan", "calculate"],
        ):
            return self._audit_context("DU", "NAV_MEASURE_SHUYUAN", "RUN_SHUYUAN_METERING", "shuyuan_metering")
        if method == "POST" and segments in (
            ["contributions", "run"],
            ["metering", "utility", "contribution", "calculate"],
        ):
            return self._audit_context("UTIL", "NAV_MEASURE_UTILITY", "RUN_CONTRIBUTION", "contribution_run")
        if method == "POST" and segments in (
            ["utilities", "run"],
            ["metering", "utility", "calculate"],
        ):
            return self._audit_context("UTIL", "NAV_MEASURE_UTILITY", "RUN_UTILITY", "utility")
        if method == "POST" and segments in (
            ["md-dshap", "tasks"],
            ["allocation", "md-dshap", "tasks"],
        ):
            return self._audit_context("MDS", "NAV_ALLOC_MDS", "RUN_MD_DSHAP", "md_dshap_task")
        if method == "POST" and segments == ["allocation-scenarios"]:
            return self._audit_context("ALLOC", "NAV_ALLOC_SIMULATION", "CREATE_ALLOCATION_SCENARIO", "allocation_scenario")
        if method == "POST" and segments == ["allocation", "simulation", "run"]:
            return self._audit_context(
                "ALLOC",
                "NAV_ALLOC_SIMULATION",
                "SIMULATE_ALLOCATION",
                "allocation_scenario",
                payload.get("allocation_id"),
            )
        if (
            method == "POST"
            and len(segments) == 3
            and segments[0] == "allocation-scenarios"
            and segments[2] == "simulate"
        ):
            return self._audit_context("ALLOC", "NAV_ALLOC_SIMULATION", "SIMULATE_ALLOCATION", "allocation_scenario", segments[1])
        if (
            method == "POST"
            and len(segments) == 3
            and segments[0] == "allocation-scenarios"
            and segments[2] == "lock"
        ):
            return self._audit_context("ALLOC", "NAV_ALLOC_SIMULATION", "LOCK_ALLOCATION", "allocation_scenario", segments[1])
        if method == "POST" and segments in (
            ["reports", "markdown"],
            ["reports", "csv"],
            ["reports", "json"],
            ["reports", "audit-log"],
            ["reports", "md-dshap-audit"],
        ):
            operation_by_path = {
                "markdown": "GENERATE_MARKDOWN_REPORT",
                "csv": "GENERATE_CSV_EXPORT",
                "json": "GENERATE_JSON_EXPORT",
                "audit-log": "EXPORT_AUDIT_LOG",
                "md-dshap-audit": "EXPORT_MD_DSHAP_AUDIT",
            }
            return self._audit_context("REP", "NAV_REPORT_EXPORT", operation_by_path[segments[1]], "report_record")
        if method == "POST" and len(segments) == 5 and segments[:3] == ["allocation", "md-dshap", "tasks"] and segments[4] == "audit-export":
            return self._audit_context("MDS", "NAV_ALLOC_MDS", "EXPORT_MD_DSHAP_AUDIT", "report_record", segments[3])
        if method == "PUT" and segments == ["metering", "quality", "weights"]:
            return self._audit_context("QUAL", "NAV_MEASURE_QUALITY", "UPDATE_QUALITY_WEIGHTS", "system_parameter")
        if method == "PUT" and segments == ["metering", "shuyuan", "parameters"]:
            return self._audit_context("DU", "NAV_MEASURE_SHUYUAN", "UPDATE_SHUYUAN_PARAMETERS", "system_parameter")
        if method == "PUT" and segments == ["metering", "utility", "contribution-factors"]:
            return self._audit_context("UTIL", "NAV_MEASURE_UTILITY", "UPDATE_CONTRIBUTION_FACTORS", "system_parameter")
        draft_routes = {
            ("metering", "shuyuan", "call-counts"): ("DU", "NAV_MEASURE_SHUYUAN", "SAVE_SHUYUAN_CALL_COUNTS_DRAFT"),
            ("metering", "utility", "function"): ("UTIL", "NAV_MEASURE_UTILITY", "SAVE_UTILITY_FUNCTION_DRAFT"),
            ("allocation", "simulation", "revenue-pool"): ("ALLOC", "NAV_ALLOC_SIMULATION", "SAVE_REVENUE_POOL_DRAFT"),
            ("allocation", "simulation", "priority-items"): ("ALLOC", "NAV_ALLOC_SIMULATION", "SAVE_PRIORITY_ITEMS_DRAFT"),
            ("allocation", "simulation", "mode"): ("ALLOC", "NAV_ALLOC_SIMULATION", "SAVE_ALLOCATION_MODE_DRAFT"),
            ("allocation", "md-dshap", "config"): ("MDS", "NAV_ALLOC_MDS", "UPDATE_MD_DSHAP_CONFIG"),
        }
        key = tuple(segments)
        if method == "PUT" and key in draft_routes:
            module_code, menu_code, operation_type = draft_routes[key]
            object_type = "system_parameter" if operation_type == "UPDATE_MD_DSHAP_CONFIG" else "business_draft"
            return self._audit_context(module_code, menu_code, operation_type, object_type)
        return None

    def _audit_context(self, module_code, menu_code, operation_type, object_type, object_id=None):
        return {
            "module_code": module_code,
            "menu_code": menu_code,
            "operation_type": operation_type,
            "object_type": object_type,
            "object_id": object_id,
        }
