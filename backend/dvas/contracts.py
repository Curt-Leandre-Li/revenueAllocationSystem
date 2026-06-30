import hashlib
import json
from datetime import datetime, timezone
from uuid import uuid4

from .constants import P0_CONFIG, ProjectStatus

API_PREFIX = "/api/v1"
LOCAL_OPERATOR = P0_CONFIG.local_operator
SIMULATION_DISCLAIMER = P0_CONFIG.simulation_disclaimer

PROJECT_STATUSES = ProjectStatus.values()


class ApiError(Exception):
    def __init__(
        self,
        code,
        message,
        status=400,
        field_errors=None,
        audit_recorded=False,
        detail_json=None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.field_errors = field_errors or []
        self.audit_recorded = audit_recorded
        self.detail_json = detail_json


def utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def new_trace_id():
    return f"trace_{uuid4().hex[:12]}"


def stable_checksum(value):
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def ok_response(data=None, message="操作成功", trace_id=None):
    data = data or {}
    response = {
        "success": True,
        "code": "OK",
        "message": message,
        "trace_id": trace_id or new_trace_id(),
        "data": data,
    }
    if isinstance(data, dict) and data.get("project_status"):
        response["project_status"] = data["project_status"]
    return response


def error_response(error, trace_id=None):
    trace_id = trace_id or new_trace_id()
    field_error = error.field_errors[0] if error.field_errors else {}
    error_field = field_error.get("field")
    error_message = field_error.get("reason") or error.message
    detail_json = error.detail_json or {"field_errors": error.field_errors}
    return {
        "success": False,
        "code": error.code,
        "message": error.message,
        "trace_id": trace_id,
        "field_errors": error.field_errors,
        "error_code": error.code,
        "error_field": error_field,
        "error_message": error_message,
        "detail_json": detail_json,
        "error": {
            "code": error.code,
            "field": error_field,
            "message": error_message,
            "detail": detail_json,
        },
    }


def table_page(items):
    return {
        "items": items,
        "total": len(items),
        "page": 1,
        "page_size": len(items),
    }
