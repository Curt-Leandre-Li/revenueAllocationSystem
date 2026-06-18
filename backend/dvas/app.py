import json
from urllib.parse import urlparse

from .contracts import API_PREFIX, ApiError, error_response, ok_response
from .repository import JsonFileRepository
from .services import DashboardService, DataIngestionService, ProjectService


class DvasApplication:
    def __init__(self, repository=None):
        self.repository = repository or JsonFileRepository()
        self.project_service = ProjectService(self.repository)
        self.dashboard_service = DashboardService(self.repository)
        self.ingestion_service = DataIngestionService(self.repository)

    def handle(self, method, path, body=None):
        trace_id = None
        try:
            data = self._dispatch(method.upper(), self._normalize_path(path), body or {})
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
        segments = [segment for segment in path.removeprefix(API_PREFIX).split("/") if segment]
        if method == "GET" and segments == ["projects", "current"]:
            return self.project_service.current_project()
        if method == "GET" and segments == ["dashboard", "overview"]:
            return self.dashboard_service.overview()
        if method == "GET" and segments == ["dashboard", "preconditions"]:
            return self.dashboard_service.preconditions()
        if method == "POST" and segments == ["dashboard", "quick-run"]:
            return self.dashboard_service.quick_run()
        if method == "POST" and len(segments) == 3 and segments[:1] == ["demo-cases"] and segments[2] == "initialize":
            return self.ingestion_service.initialize_demo_case(segments[1])
        if method == "POST" and segments == ["data-packages", "upload"]:
            return self.ingestion_service.upload_json(body)
        if method == "GET" and segments == ["data-packages"]:
            return self.ingestion_service.list_packages()
        if method == "GET" and len(segments) == 2 and segments[0] == "data-packages":
            return self.ingestion_service.package_detail(segments[1])
        if (
            method == "GET"
            and len(segments) == 3
            and segments[0] == "data-packages"
            and segments[2] == "validation-result"
        ):
            return self.ingestion_service.validation_result(segments[1])
        if method == "GET" and segments == ["data-resources"]:
            return self.ingestion_service.list_resources()
        if method == "GET" and len(segments) == 2 and segments[0] == "data-resources":
            return self.ingestion_service.resource_detail(segments[1])
        if method == "GET" and segments == ["parties"]:
            return self.ingestion_service.list_parties()
        raise ApiError("DVAS_NOT_FOUND", "接口不存在", status=404)

    def _normalize_path(self, path):
        parsed = urlparse(path)
        normalized = parsed.path.rstrip("/") or "/"
        if not normalized.startswith(API_PREFIX):
            raise ApiError("DVAS_NOT_FOUND", "接口不存在", status=404)
        return normalized

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
        return 400
