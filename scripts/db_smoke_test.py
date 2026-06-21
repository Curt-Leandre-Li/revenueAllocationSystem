#!/usr/bin/env python3
import os
import shutil
import subprocess
import sys
from decimal import Decimal
from urllib.parse import urlparse


DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://dvas_app:password@localhost:5432/dvas_p0",
)
PROJECT_ID = "PRJ_DEMO_001"


def run_scalar(sql):
    full_sql = f"SET search_path TO dvas, public;\n{sql.strip()}"
    completed = subprocess.run(
        psql_command(full_sql),
        capture_output=True,
        check=False,
        text=True,
    )
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout).strip()
        raise RuntimeError(detail)
    return completed.stdout.strip()


def psql_command(full_sql):
    base_options = [
        "-X",
        "-q",
        "-t",
        "-A",
        "--no-psqlrc",
        "-v",
        "ON_ERROR_STOP=1",
    ]
    if shutil.which("psql"):
        return ["psql", *base_options, "-d", DATABASE_URL, "-c", full_sql]
    if shutil.which("docker"):
        parsed_url = urlparse(DATABASE_URL)
        db_name = parsed_url.path.lstrip("/") or "dvas_p0"
        db_user = parsed_url.username or "dvas_app"
        db_password = parsed_url.password or "password"
        service = os.environ.get("DVAS_POSTGRES_SERVICE", "postgres")
        return [
            "docker",
            "compose",
            "exec",
            "-T",
            "-e",
            f"PGPASSWORD={db_password}",
            service,
            "psql",
            *base_options,
            "-h",
            "127.0.0.1",
            "-U",
            db_user,
            "-d",
            db_name,
            "-c",
            full_sql,
        ]
    raise RuntimeError("psql 或 docker 客户端不可用")


def count(sql_from):
    return int(run_scalar(f"SELECT COUNT(*) FROM {sql_from};"))


def decimal_value(sql):
    value = run_scalar(sql)
    return Decimal(value or "0")


def status(label, ok, actual, expected):
    state = "PASS" if ok else "FAIL"
    print(f"{state}\t{label}\tactual={actual}\texpected={expected}")
    return ok


def main():
    print("DVAS P0 PostgreSQL smoke test")
    print(f"DATABASE_URL={DATABASE_URL.replace(':password@', ':***@')}")

    checks = []
    checks.append(
        status(
            "schema dvas exists",
            run_scalar("SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name='dvas');") == "t",
            run_scalar("SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='dvas';"),
            "1",
        )
    )
    table_count = count("information_schema.tables WHERE table_schema='dvas' AND table_type='BASE TABLE'")
    checks.append(status("core tables", table_count >= 38, table_count, ">=38"))
    first_nav = count(
        "nav_menu WHERE parent_id IS NULL AND menu_name IN ('系统首页','数据管理','数元贡献度计量','收益分配计算','报告生成与导出','系统管理')"
    )
    checks.append(status("six first-level navigation nodes", first_nav == 6, first_nav, "6"))
    second_nav = count("nav_menu WHERE parent_id IS NOT NULL")
    checks.append(status("second-level navigation pages", second_nav >= 12, second_nav, ">=12"))
    permission_count = count("permission WHERE button_code IS NOT NULL AND button_code <> ''")
    checks.append(status("button/action permissions", permission_count >= 1, permission_count, ">=1"))
    local_operator = count("user_account WHERE username='local_operator' AND operator_code='local_operator'")
    checks.append(status("local_operator user", local_operator == 1, local_operator, "1"))
    project_status = run_scalar(f"SELECT COALESCE(MAX(status), 'missing') FROM allocation_project WHERE project_id='{PROJECT_ID}';")
    checks.append(status("demo project exported", project_status == "EXPORTED", project_status, "EXPORTED"))

    for table_name in [
        "input_snapshot",
        "data_package",
        "data_resource",
        "party",
        "quality_assessment",
        "shuyuan_metering",
        "contribution_record",
        "utility_record",
        "allocation_scenario",
        "allocation_result",
        "report_record",
        "export_file",
        "audit_log",
        "snapshot_store",
        "algorithm_audit_snapshot",
    ]:
        table_rows = count(f"{table_name} WHERE project_id='{PROJECT_ID}'")
        checks.append(status(table_name, table_rows >= 1, table_rows, ">=1"))

    md_tasks = count(f"md_dshap_task WHERE project_id='{PROJECT_ID}' AND algorithm_mode='MD_DSHAP'")
    checks.append(status("md_dshap_task algorithm_mode", md_tasks >= 1, md_tasks, ">=1 MD_DSHAP"))
    weight_sum = decimal_value("SELECT COALESCE(SUM(normalized_weight), 0) FROM md_dshap_result WHERE task_id='MDS_TASK_DEMO_001';")
    checks.append(status("MD-DShap weight sum", abs(weight_sum - Decimal("1.000000")) <= Decimal("0.000001"), weight_sum, "1 +/- 0.000001"))
    total_revenue = decimal_value("SELECT COALESCE(total_revenue, 0) FROM allocation_scenario WHERE allocation_id='ALLOC_DEMO_001';")
    allocation_sum = decimal_value("SELECT COALESCE(SUM(post_constraint_amount), 0) FROM allocation_result WHERE allocation_id='ALLOC_DEMO_001';")
    checks.append(status("allocation amount sum", abs(allocation_sum - total_revenue) <= Decimal("0.01"), allocation_sum, f"{total_revenue} +/- 0.01"))
    export_checksum = count("export_file WHERE project_id='PRJ_DEMO_001' AND checksum IS NOT NULL AND checksum <> ''")
    export_total = count("export_file WHERE project_id='PRJ_DEMO_001'")
    checks.append(status("export checksum", export_total >= 1 and export_checksum == export_total, f"{export_checksum}/{export_total}", "all non-empty"))

    if not all(checks):
        print("DVAS P0 PostgreSQL smoke test FAILED")
        return 1

    print("DVAS P0 PostgreSQL smoke test PASS")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"FAIL\tdatabase smoke test error\t{exc}", file=sys.stderr)
        sys.exit(2)
