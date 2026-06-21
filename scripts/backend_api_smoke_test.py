#!/usr/bin/env python3
import os
import sys
from decimal import Decimal
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from backend.dvas.app import DvasApplication  # noqa: E402


DEFAULT_PROJECT_ID = "PRJ_DEMO_001"


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def request(app, path):
    response = app.handle("GET", path)
    if not response.get("success"):
        raise RuntimeError(f"{path} failed: {response.get('code')} {response.get('message')}")
    return response["data"]


def choose_project_id(projects):
    requested = os.environ.get("DVAS_SMOKE_PROJECT_ID")
    if requested:
        return requested
    if any(item["project_id"] == DEFAULT_PROJECT_ID for item in projects["items"]):
        return DEFAULT_PROJECT_ID
    sorted_items = sorted(
        projects["items"],
        key=lambda item: str(item.get("updated_at") or item.get("created_at") or ""),
        reverse=True,
    )
    require(sorted_items, "project list must include at least one project")
    return sorted_items[0]["project_id"]


def main():
    database_url = os.environ.get("DATABASE_URL")
    require(database_url, "DATABASE_URL is required for backend PostgreSQL API smoke test")

    app = DvasApplication()
    health = request(app, "/health/db")
    require(health["status"] == "ok", "database health status must be ok")
    require(health["schema_exists"] is True, "dvas schema must exist")

    projects = request(app, "/api/projects")
    require(projects["total"] >= 1, "project list must not be empty")
    project_id = choose_project_id(projects)
    require(any(item["project_id"] == project_id for item in projects["items"]), f"{project_id} missing")

    status = request(app, f"/api/projects/{project_id}/status")
    require(status["project"]["project_id"] == project_id, "project status project_id mismatch")
    require(status["current_package_id"], "current package missing")
    require(status["md_dshap_task"]["algorithm_mode"] == "MD_DSHAP", "algorithm mode mismatch")
    require(status["counts"]["report_record"] >= 1, "report count missing")
    require(status["counts"]["audit_log"] >= 1, "audit count missing")

    reports = request(app, f"/api/reports?project_id={project_id}")
    require(reports["total"] >= 1, "reports must not be empty")
    require(reports["items"][0]["checksum"], "report checksum missing")
    require(reports["items"][0]["export_files"], "report export_files missing")
    require(reports["items"][0]["export_files"][0]["checksum"], "export checksum missing")

    logs = request(app, f"/api/audit/logs?project_id={project_id}&limit=5")
    require(1 <= logs["total"] <= 5, "audit log limit not applied")
    require(logs["items"][0]["project_id"] == project_id, "audit project_id mismatch")

    allocation = request(app, f"/api/projects/{project_id}/allocation-summary")
    require(allocation["allocation_id"], "allocation id missing")
    require(len(allocation["allocations"]) >= 1, "allocation detail rows missing")
    require(
        abs(Decimal(allocation["post_constraint_amount_sum"]) - Decimal(allocation["total_revenue"])) <= Decimal("0.01"),
        "allocation sum mismatch",
    )

    md_dshap = request(app, f"/api/projects/{project_id}/md-dshap-summary")
    require(md_dshap["algorithm_mode"] == "MD_DSHAP", "md-dshap algorithm mode mismatch")
    require(abs(Decimal(md_dshap["weight_sum"]) - Decimal("1.000000")) <= Decimal("0.000001"), "md-dshap weight sum mismatch")
    require(md_dshap["audit_snapshot_exists"] is True, "algorithm audit snapshot missing")

    print(f"DVAS backend PostgreSQL read API smoke test PASS project_id={project_id}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"FAIL\tbackend api smoke test error\t{exc}", file=sys.stderr)
        sys.exit(2)
