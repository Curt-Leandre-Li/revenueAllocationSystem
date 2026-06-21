#!/usr/bin/env python3
import os
import sys

from backend.dvas.app import DvasApplication


PROJECT_ID = "PRJ_DEMO_001"


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def request(app, path):
    response = app.handle("GET", path)
    if not response.get("success"):
        raise RuntimeError(f"{path} failed: {response.get('code')} {response.get('message')}")
    return response["data"]


def main():
    database_url = os.environ.get("DATABASE_URL")
    require(database_url, "DATABASE_URL is required for backend PostgreSQL API smoke test")

    app = DvasApplication()
    health = request(app, "/health/db")
    require(health["status"] == "ok", "database health status must be ok")
    require(health["schema_exists"] is True, "dvas schema must exist")

    projects = request(app, "/api/projects")
    require(projects["total"] >= 1, "project list must include demo project")
    require(any(item["project_id"] == PROJECT_ID for item in projects["items"]), "PRJ_DEMO_001 missing")

    status = request(app, f"/api/projects/{PROJECT_ID}/status")
    require(status["project"]["project_id"] == PROJECT_ID, "project status project_id mismatch")
    require(status["current_package_id"] == "PKG_DEMO_001", "current package mismatch")
    require(status["md_dshap_task"]["algorithm_mode"] == "MD_DSHAP", "algorithm mode mismatch")
    require(status["counts"]["report_record"] >= 1, "report count missing")
    require(status["counts"]["audit_log"] >= 1, "audit count missing")

    reports = request(app, f"/api/reports?project_id={PROJECT_ID}")
    require(reports["total"] >= 1, "reports must not be empty")
    require(reports["items"][0]["checksum"], "report checksum missing")
    require(reports["items"][0]["export_files"], "report export_files missing")
    require(reports["items"][0]["export_files"][0]["checksum"], "export checksum missing")

    logs = request(app, f"/api/audit/logs?project_id={PROJECT_ID}&limit=5")
    require(1 <= logs["total"] <= 5, "audit log limit not applied")
    require(logs["items"][0]["project_id"] == PROJECT_ID, "audit project_id mismatch")

    allocation = request(app, f"/api/projects/{PROJECT_ID}/allocation-summary")
    require(allocation["allocation_id"] == "ALLOC_DEMO_001", "allocation id mismatch")
    require(allocation["post_constraint_amount_sum"] == "1000000.00", "allocation sum mismatch")
    require(len(allocation["allocations"]) >= 4, "allocation detail rows missing")

    md_dshap = request(app, f"/api/projects/{PROJECT_ID}/md-dshap-summary")
    require(md_dshap["algorithm_mode"] == "MD_DSHAP", "md-dshap algorithm mode mismatch")
    require(md_dshap["weight_sum"] == "1.000000", "md-dshap weight sum mismatch")
    require(md_dshap["audit_snapshot_exists"] is True, "algorithm audit snapshot missing")

    print("DVAS backend PostgreSQL read API smoke test PASS")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"FAIL\tbackend api smoke test error\t{exc}", file=sys.stderr)
        sys.exit(2)
