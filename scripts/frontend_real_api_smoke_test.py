#!/usr/bin/env python3
import json
import os
import sys
from decimal import Decimal
from pathlib import Path
from urllib.request import Request, urlopen


REPO_ROOT = Path(__file__).resolve().parents[1]
API_BASE_URL = os.environ.get("VITE_API_BASE_URL", "http://127.0.0.1:8000").rstrip("/")


REQUIRED_ENDPOINTS = [
    "/health/db",
    "/api/projects",
    "/api/projects/:projectId/status",
    "/api/audit/logs?project_id=",
    "/api/reports?project_id=",
    "/api/projects/:projectId/allocation-summary",
    "/api/projects/:projectId/md-dshap-summary",
    "/api/demo-cases/load",
    "/api/data/upload-json",
    "/api/projects/:projectId/pipeline/run",
    "/api/projects/:projectId/allocation/confirm",
    "/api/projects/:projectId/reports/generate",
]


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def read_json(path):
    request = Request(f"{API_BASE_URL}{path}", headers={"Accept": "application/json"})
    with urlopen(request, timeout=10) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if not payload.get("success"):
        raise RuntimeError(f"GET {path} failed: {payload.get('code')} {payload.get('message')}")
    return payload["data"]


def assert_client_source_contract():
    api_source = (REPO_ROOT / "ui_prototype/src/lib/api.ts").read_text(encoding="utf-8")
    env_example = (REPO_ROOT / "ui_prototype/.env.example").read_text(encoding="utf-8")
    require("VITE_API_BASE_URL" in api_source, "frontend API client must use VITE_API_BASE_URL")
    require("VITE_API_BASE_URL=http://localhost:8000" in env_example, ".env.example must document VITE_API_BASE_URL")
    require("/api/v1" not in api_source, "Phase 2C API client must not target /api/v1")
    for endpoint in REQUIRED_ENDPOINTS:
        literal = endpoint.replace(":projectId", "${encodeURIComponent(projectId)}")
        require(endpoint in api_source or literal in api_source, f"frontend API client missing {endpoint}")


def choose_project(projects):
    requested = os.environ.get("DVAS_SMOKE_PROJECT_ID")
    if requested:
        return requested
    sorted_items = sorted(
        projects["items"],
        key=lambda item: str(item.get("updated_at") or item.get("created_at") or ""),
        reverse=True,
    )
    require(sorted_items, "project list must not be empty")
    return sorted_items[0]["project_id"]


def main():
    assert_client_source_contract()
    health = read_json("/health/db")
    require(health["status"] == "ok", "database health must be ok")

    projects = read_json("/api/projects")
    project_id = choose_project(projects)

    status = read_json(f"/api/projects/{project_id}/status")
    require(status["project"]["project_id"] == project_id, "status project mismatch")
    require(status["project"]["status"] in {"ALLOCATED", "CONFIRMED", "EXPORTED"}, "project must have run pipeline")

    reports = read_json(f"/api/reports?project_id={project_id}")
    require(reports["items"], "reports must not be empty")
    require(reports["items"][0]["checksum"], "report checksum missing")
    require(reports["items"][0]["export_files"], "export files missing")
    require(all(item["checksum"] for item in reports["items"][0]["export_files"]), "export file checksum missing")

    logs = read_json(f"/api/audit/logs?project_id={project_id}&limit=10")
    require(logs["items"], "audit logs must not be empty")

    allocation = read_json(f"/api/projects/{project_id}/allocation-summary")
    require(allocation["allocations"], "allocation rows missing")
    require(
        abs(Decimal(allocation["post_constraint_amount_sum"]) - Decimal(allocation["total_revenue"])) <= Decimal("0.01"),
        "allocation amount sum mismatch",
    )

    md_dshap = read_json(f"/api/projects/{project_id}/md-dshap-summary")
    require(md_dshap["algorithm_mode"] == "MD_DSHAP", "algorithm mode must be MD_DSHAP")
    require(abs(Decimal(md_dshap["weight_sum"]) - Decimal("1.000000")) <= Decimal("0.000001"), "weight sum mismatch")

    print(f"DVAS Phase 2C frontend real API smoke PASS project_id={project_id}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"FAIL\tfrontend real API smoke test error\t{exc}", file=sys.stderr)
        sys.exit(2)
