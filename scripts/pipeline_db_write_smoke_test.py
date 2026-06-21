#!/usr/bin/env python3
import os
import sys
from decimal import Decimal
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from backend.dvas.app import DvasApplication  # noqa: E402
from backend.dvas.postgres_read_model import PsqlJsonClient  # noqa: E402
from backend.dvas.postgres_write_model import sql_safe_id  # noqa: E402


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def request(app, method, path, body=None):
    response = app.handle(method, path, body or {})
    if not response.get("success"):
        raise RuntimeError(f"{method} {path} failed: {response.get('code')} {response.get('message')}")
    return response["data"]


def main():
    require(os.environ.get("DATABASE_URL"), "DATABASE_URL is required for Phase 2B pipeline smoke")
    app = DvasApplication()

    health = request(app, "GET", "/health/db")
    require(health["status"] == "ok", "database health status must be ok")

    loaded = request(app, "POST", "/api/demo-cases/load", {})
    project_id = loaded["project_id"]
    require(loaded["project_status"] == "INGESTED", "demo load must create INGESTED project")

    pipeline = request(app, "POST", f"/api/projects/{project_id}/pipeline/run", {})
    require(pipeline["project_status"] == "ALLOCATED", "pipeline must finish as ALLOCATED")
    require(pipeline["algorithm_mode"] == "MD_DSHAP", "pipeline must use MD_DSHAP")
    require(pipeline["status_flow"] == [
        "INGESTED",
        "ASSESSED",
        "METERED",
        "UTILITY_CALCULATED",
        "WEIGHT_CALCULATED",
        "ALLOCATED",
    ], "pipeline status flow mismatch")

    confirmed = request(app, "POST", f"/api/projects/{project_id}/allocation/confirm", {})
    require(confirmed["project_status"] == "CONFIRMED", "allocation confirm must finish as CONFIRMED")

    report = request(app, "POST", f"/api/projects/{project_id}/reports/generate", {})
    require(report["project_status"] == "EXPORTED", "report generation must finish as EXPORTED")
    require(report["checksum"], "report checksum must be present")
    require(set(report["file_formats"]) == {"MD", "CSV", "JSON", "JSONL"}, "P0 export formats mismatch")

    projects = request(app, "GET", "/api/projects")
    require(any(item["project_id"] == project_id for item in projects["items"]), "written project missing from read API")

    status = request(app, "GET", f"/api/projects/{project_id}/status")
    require(status["project"]["status"] == "EXPORTED", "read status must show EXPORTED")
    require(status["counts"]["quality_assessment"] >= 1, "quality_assessment count missing")
    require(status["counts"]["shuyuan_metering"] >= 1, "shuyuan_metering count missing")
    require(status["counts"]["audit_log"] >= 1, "audit_log count missing")

    reports = request(app, "GET", f"/api/reports?project_id={project_id}")
    require(reports["total"] >= 1, "read reports must include generated report")
    require(reports["items"][0]["checksum"], "read report checksum missing")
    require(reports["items"][0]["export_files"], "read export files missing")
    require(all(item["checksum"] for item in reports["items"][0]["export_files"]), "export file checksum missing")

    logs = request(app, "GET", f"/api/audit/logs?project_id={project_id}&limit=50")
    require(logs["total"] >= 1, "audit logs must not be empty")

    allocation = request(app, "GET", f"/api/projects/{project_id}/allocation-summary")
    require(allocation["allocation_id"] == pipeline["allocation_id"], "allocation summary id mismatch")
    require(
        abs(Decimal(allocation["post_constraint_amount_sum"]) - Decimal(allocation["total_revenue"])) <= Decimal("0.01"),
        "allocation amount sum must equal total revenue",
    )

    md_dshap = request(app, "GET", f"/api/projects/{project_id}/md-dshap-summary")
    require(md_dshap["algorithm_mode"] == "MD_DSHAP", "read md-dshap mode mismatch")
    require(abs(Decimal(md_dshap["weight_sum"]) - Decimal("1.000000")) <= Decimal("0.000001"), "weight sum mismatch")
    require(md_dshap["audit_snapshot_exists"] is True, "algorithm audit snapshot must exist")

    resources = request(app, "GET", f"/api/projects/{project_id}/resources")
    require(resources["total"] >= 1, "read resource details must not be empty")
    require(resources["items"][0]["provider_parties"], "resource provider relation missing")

    parties = request(app, "GET", f"/api/projects/{project_id}/parties")
    require(parties["total"] >= 1, "read party list must not be empty")
    require(any(item["include_in_md_dshap"] for item in parties["items"]), "md-dshap party flag missing")

    quality = request(app, "GET", f"/api/projects/{project_id}/quality-summary")
    require(quality["assessment"], "quality summary missing")
    require(len(quality["details"]) >= 1, "quality details missing")

    shuyuan = request(app, "GET", f"/api/projects/{project_id}/shuyuan-summary")
    require(shuyuan["metering"], "shuyuan summary missing")
    require(len(shuyuan["details"]) >= 1, "shuyuan details missing")

    utility = request(app, "GET", f"/api/projects/{project_id}/utility-summary")
    require(len(utility["records"]) >= 1, "utility records missing")
    require(len(utility["traces"]) >= 1, "utility traces missing")

    constraints = request(app, "GET", f"/api/projects/{project_id}/constraints-summary")
    require(constraints["allocation"], "constraint allocation summary missing")
    require(len(constraints["priority_items"]) >= 1, "priority allocation items missing")
    require(len(constraints["constraints"]) >= 1, "contract constraints missing")
    require(len(constraints["traces"]) >= 1, "constraint traces missing")

    export_files = request(app, "GET", f"/api/projects/{project_id}/export-files")
    require(export_files["total"] >= 4, "export files missing")
    require(all(item["checksum"] for item in export_files["items"]), "export checksums missing")

    sql_project_id = sql_safe_id(project_id, "project_id")
    db_checks = PsqlJsonClient().query_json(
        f"""
        SELECT jsonb_build_object(
            'project_status', (SELECT status FROM dvas.allocation_project WHERE project_id = {sql_project_id}),
            'quality_assessment', (SELECT COUNT(*) FROM dvas.quality_assessment WHERE project_id = {sql_project_id}),
            'shuyuan_metering', (SELECT COUNT(*) FROM dvas.shuyuan_metering WHERE project_id = {sql_project_id}),
            'contribution_record', (SELECT COUNT(*) FROM dvas.contribution_record WHERE project_id = {sql_project_id}),
            'utility_record', (SELECT COUNT(*) FROM dvas.utility_record WHERE project_id = {sql_project_id}),
            'md_dshap_algorithm_mode', (
                SELECT algorithm_mode
                FROM dvas.md_dshap_task
                WHERE project_id = {sql_project_id}
                ORDER BY created_at DESC
                LIMIT 1
            ),
            'md_dshap_weight_sum', (
                SELECT COALESCE(SUM(normalized_weight), 0)::text
                FROM dvas.md_dshap_result
                WHERE project_id = {sql_project_id}
            ),
            'allocation_total_revenue', (
                SELECT total_revenue::text
                FROM dvas.allocation_scenario
                WHERE allocation_id = (SELECT current_allocation_id FROM dvas.allocation_project WHERE project_id = {sql_project_id})
            ),
            'allocation_post_sum', (
                SELECT COALESCE(SUM(post_constraint_amount), 0)::text
                FROM dvas.allocation_result
                WHERE allocation_id = (SELECT current_allocation_id FROM dvas.allocation_project WHERE project_id = {sql_project_id})
            ),
            'report_record', (SELECT COUNT(*) FROM dvas.report_record WHERE project_id = {sql_project_id}),
            'export_file_checksum_count', (
                SELECT COUNT(*) FROM dvas.export_file
                WHERE project_id = {sql_project_id} AND checksum IS NOT NULL AND checksum <> ''
            ),
            'snapshot_store', (SELECT COUNT(*) FROM dvas.snapshot_store WHERE project_id = {sql_project_id}),
            'audit_log', (SELECT COUNT(*) FROM dvas.audit_log WHERE project_id = {sql_project_id})
        )::text;
        """
    )
    require(db_checks["project_status"] == "EXPORTED", "database project status must be EXPORTED")
    for table_name in [
        "quality_assessment",
        "shuyuan_metering",
        "contribution_record",
        "utility_record",
        "report_record",
        "snapshot_store",
        "audit_log",
    ]:
        require(db_checks[table_name] >= 1, f"{table_name} must have rows")
    require(db_checks["md_dshap_algorithm_mode"] == "MD_DSHAP", "database algorithm mode must be MD_DSHAP")
    require(abs(Decimal(db_checks["md_dshap_weight_sum"]) - Decimal("1.000000")) <= Decimal("0.000001"), "database weight sum mismatch")
    require(
        abs(Decimal(db_checks["allocation_post_sum"]) - Decimal(db_checks["allocation_total_revenue"])) <= Decimal("0.01"),
        "database allocation amount sum mismatch",
    )
    require(db_checks["export_file_checksum_count"] >= 4, "all export files must have checksums")

    print(f"DVAS Phase 2B PostgreSQL pipeline write smoke PASS project_id={project_id}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"FAIL\tpipeline db write smoke test error\t{exc}", file=sys.stderr)
        sys.exit(2)
