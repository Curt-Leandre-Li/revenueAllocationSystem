import json
from urllib.parse import parse_qs, urlparse

from .contracts import API_PREFIX, ApiError, error_response, ok_response
from .postgres_read_model import PostgresReadService
from .repository import JsonFileRepository
from .services import (
    AllocationService,
    AuditLogService,
    ContributionService,
    ContractConstraintService,
    DashboardService,
    DataIngestionService,
    MdDshapService,
    NavigationService,
    PartyService,
    ProjectService,
    QualityAssessmentService,
    ReportService,
    ResourceService,
    ShuyuanMeteringService,
    SystemParameterService,
    UtilityService,
)


class DvasApplication:
    def __init__(self, repository=None):
        self.repository = repository or JsonFileRepository()
        self.postgres_read_service = PostgresReadService()
        self.project_service = ProjectService(self.repository)
        self.navigation_service = NavigationService()
        self.dashboard_service = DashboardService(self.repository)
        self.ingestion_service = DataIngestionService(self.repository)
        self.resource_service = ResourceService(self.repository)
        self.party_service = PartyService(self.repository)
        self.quality_service = QualityAssessmentService(self.repository)
        self.shuyuan_service = ShuyuanMeteringService(self.repository)
        self.contribution_service = ContributionService(self.repository)
        self.utility_service = UtilityService(self.repository)
        self.md_dshap_service = MdDshapService(self.repository)
        self.constraint_service = ContractConstraintService(self.repository)
        self.allocation_service = AllocationService(self.repository)
        self.report_service = ReportService(self.repository)
        self.system_parameter_service = SystemParameterService(self.repository)
        self.audit_log_service = AuditLogService(self.repository)

    def handle(self, method, path, body=None):
        trace_id = None
        try:
            method = method.upper()
            payload = body or {}
            if method == "GET":
                payload = {**self._query_params(path), **payload}
            data = self._dispatch(method, self._normalize_path(path), payload)
            return ok_response(data, trace_id=trace_id)
        except ApiError as error:
            return error_response(error, trace_id=trace_id)

    def handle_http(self, method, path, raw_body):
        if method.upper() == "OPTIONS":
            return 204, self._json_headers(), b""
        try:
            body = json.loads(raw_body.decode("utf-8")) if raw_body else {}
        except json.JSONDecodeError as exc:
            response = error_response(
                ApiError(
                    "DVAS_INPUT_FORMAT_ERROR",
                    "请求体不是合法 JSON",
                    field_errors=[{"field": "body", "reason": str(exc)}],
                )
            )
            return 400, self._json_headers(), self._encode(response)
        response = self.handle(method, path, body)
        status = 200 if response["success"] else self._status_for_error(response["code"])
        return status, self._json_headers(), self._encode(response)

    def _dispatch(self, method, path, body):
        if method == "GET" and path == "/health/db":
            return self.postgres_read_service.health()

        plain_api = path.startswith("/api/") and not path.startswith(API_PREFIX)
        if path.startswith(API_PREFIX):
            segments = [segment for segment in path.removeprefix(API_PREFIX).split("/") if segment]
        else:
            segments = [segment for segment in path.removeprefix("/api").split("/") if segment]

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
            return self.ingestion_service.upload_json(body)
        if method == "POST" and segments == ["data", "packages", "upload"]:
            return self.ingestion_service.upload_json(body)
        if method == "GET" and segments == ["data-packages"]:
            return self.ingestion_service.list_packages()
        if method == "GET" and segments == ["data", "packages"]:
            return self.ingestion_service.list_packages()
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
            return {
                "project_status": self.repository.get_project()["project_status"],
                "items": [
                    {"dimension_code": "completeness", "weight": 0.35},
                    {"dimension_code": "consistency", "weight": 0.30},
                    {"dimension_code": "usability", "weight": 0.35},
                ],
            }
        if method == "PUT" and segments == ["metering", "quality", "weights"]:
            return {"project_status": self.repository.get_project()["project_status"], "items": body.get("items", [])}
        if method == "POST" and segments == ["metering", "quality", "evaluate"]:
            return self.quality_service.run(body)
        if method == "GET" and segments == ["quality-assessments", "latest"]:
            return self.quality_service.latest()
        if (
            method == "GET"
            and len(segments) == 3
            and segments[0] == "quality-assessments"
            and segments[2] == "details"
        ):
            return self.quality_service.details(segments[1])
        if method == "POST" and segments == ["shuyuan-meterings", "run"]:
            return self.shuyuan_service.run(body)
        if method == "PUT" and segments == ["metering", "shuyuan", "parameters"]:
            return {"project_status": self.repository.get_project()["project_status"], "parameters": body}
        if method == "PUT" and segments == ["metering", "shuyuan", "call-counts"]:
            return {"project_status": self.repository.get_project()["project_status"], "call_counts": body}
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
            return {"project_status": self.repository.get_project()["project_status"], "contribution_factors": body}
        if method == "POST" and segments == ["metering", "utility", "contribution", "calculate"]:
            return self.contribution_service.run(body)
        if method == "PUT" and segments == ["metering", "utility", "function"]:
            return {"project_status": self.repository.get_project()["project_status"], "utility_function": body}
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
        if method == "GET" and segments == ["allocation", "md-dshap", "config"]:
            return {
                "project_status": self.repository.get_project()["project_status"],
                "algorithm_mode": "MD_DSHAP",
                "seed": 42,
                "sample_rounds": 64,
                "epsilon": 0.000001,
            }
        if method == "PUT" and segments == ["allocation", "md-dshap", "config"]:
            return {"project_status": self.repository.get_project()["project_status"], "config": body}
        if method == "GET" and segments == ["allocation", "md-dshap", "participant-pool"]:
            return self.md_dshap_service.participant_pool()
        if method == "POST" and segments == ["allocation", "md-dshap", "tasks"]:
            return self.md_dshap_service.run(body)
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
            return {"project_status": self.repository.get_project()["project_status"], "revenue_pool": body}
        if method == "PUT" and segments == ["allocation", "simulation", "priority-items"]:
            return {"project_status": self.repository.get_project()["project_status"], "priority_items": body}
        if method == "PUT" and segments == ["allocation", "simulation", "mode"]:
            return {"project_status": self.repository.get_project()["project_status"], "mode": body}
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
            return self.report_service.list()
        if method == "GET" and segments == ["reports", "preview"]:
            return self.report_service.preview()
        if method == "POST" and segments == ["reports", "markdown"]:
            return self.report_service.generate_markdown()
        if method == "POST" and segments == ["reports", "csv"]:
            return self.report_service.generate_csv()
        if method == "POST" and segments == ["reports", "json"]:
            return self.report_service.generate_json()
        if method == "POST" and segments == ["reports", "audit-log"]:
            return self.report_service.export_audit_log()
        if method == "POST" and segments == ["reports", "md-dshap-audit"]:
            return self.report_service.generate_md_dshap_audit()
        if method == "GET" and segments == ["system", "parameters"]:
            return self.system_parameter_service.list()
        if method == "GET" and len(segments) == 3 and segments[:2] == ["system", "parameters"]:
            return self.system_parameter_service.detail(segments[2])
        if method == "PUT" and len(segments) == 3 and segments[:2] == ["system", "parameters"]:
            return self.system_parameter_service.update(segments[2], body)
        if (
            method == "POST"
            and len(segments) == 4
            and segments[:2] == ["system", "parameters"]
            and segments[3] == "restore-default"
        ):
            return self.system_parameter_service.restore_default(segments[2])
        if method == "GET" and segments == ["audit-logs"]:
            return self.audit_log_service.list(body)
        if method == "GET" and segments == ["system", "audit", "logs"]:
            return self.audit_log_service.list(body)
        if method == "GET" and len(segments) == 2 and segments[0] == "audit-logs":
            return self.audit_log_service.detail(segments[1])
        if method == "GET" and len(segments) == 4 and segments[:3] == ["system", "audit", "logs"]:
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

    def _json_headers(self):
        return {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        }

    def _encode(self, response):
        return json.dumps(response, ensure_ascii=False, sort_keys=True).encode("utf-8")

    def _status_for_error(self, code):
        if code == "DVAS_NOT_FOUND":
            return 404
        if code == "DVAS_INPUT_FORMAT_ERROR":
            return 400
        if code == "DVAS_REQUIRED_FIELD_MISSING":
            return 422
        if code == "DVAS_PRECONDITION_NOT_MET":
            return 409
        if code == "DVAS_FACTOR_INVALID":
            return 422
        if code.startswith("DVAS_DB_"):
            return 503
        return 400
