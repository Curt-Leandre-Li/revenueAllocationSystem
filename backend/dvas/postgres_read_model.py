import json
import os
import re
import shutil
import subprocess
from urllib.parse import urlparse

from .contracts import ApiError, table_page


DEFAULT_DATABASE_URL = "postgresql://dvas_app:password@localhost:5432/dvas_p0"
SAFE_ID_RE = re.compile(r"^[A-Za-z0-9_:-]+$")


class PsqlJsonClient:
    def __init__(self, database_url=None):
        self.database_url = database_url or os.environ.get("DATABASE_URL") or DEFAULT_DATABASE_URL

    def query_json(self, sql):
        full_sql = f"SET search_path TO dvas, public;\n{sql.strip()}"
        try:
            completed = subprocess.run(
                self._psql_command(full_sql),
                capture_output=True,
                check=False,
                text=True,
            )
        except FileNotFoundError as exc:
            raise ApiError(
                "DVAS_DB_CLIENT_MISSING",
                "psql 或 docker 客户端不可用，无法连接 PostgreSQL",
                status=503,
            ) from exc

        if completed.returncode != 0:
            detail = (completed.stderr or completed.stdout or "").strip()
            raise ApiError(
                "DVAS_DB_QUERY_FAILED",
                f"PostgreSQL 查询失败：{detail}",
                status=503,
            )

        output = completed.stdout.strip()
        if not output:
            return None
        try:
            return json.loads(output)
        except json.JSONDecodeError as exc:
            raise ApiError(
                "DVAS_DB_RESPONSE_INVALID",
                f"PostgreSQL 返回结果不是合法 JSON：{output[:200]}",
                status=503,
            ) from exc

    def _psql_command(self, full_sql):
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
            return ["psql", *base_options, "-d", self.database_url, "-c", full_sql]
        if shutil.which("docker"):
            parsed_url = urlparse(self.database_url)
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
        raise FileNotFoundError("psql 或 docker 均不可用")


def sql_literal(value):
    if value is None:
        return "NULL"
    if not SAFE_ID_RE.match(value):
        raise ApiError("DVAS_INPUT_FORMAT_ERROR", "project_id 含有非法字符", status=400)
    return "'" + value.replace("'", "''") + "'"


class PostgresReadService:
    def __init__(self, client=None):
        self.client = client or PsqlJsonClient()

    def health(self):
        data = self.client.query_json(
            """
            SELECT jsonb_build_object(
                'status', 'PASS',
                'database', current_database(),
                'current_user', current_user,
                'schema', 'dvas',
                'schema_exists', EXISTS (
                    SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dvas'
                ),
                'core_table_count', (
                    SELECT COUNT(*)
                    FROM information_schema.tables
                    WHERE table_schema = 'dvas' AND table_type = 'BASE TABLE'
                )
            )::text;
            """
        )
        if not data or not data.get("schema_exists"):
            raise ApiError("DVAS_DB_SCHEMA_MISSING", "PostgreSQL 可连接但 dvas schema 不存在", status=503)
        return data

    def projects(self):
        items = self.client.query_json(
            """
            SELECT COALESCE(jsonb_agg(to_jsonb(project_rows) ORDER BY project_rows.created_at, project_rows.project_id), '[]'::jsonb)::text
            FROM (
                SELECT
                    project_id,
                    project_name,
                    scenario_name,
                    status,
                    current_package_id,
                    current_algorithm_task_id,
                    current_allocation_id,
                    total_revenue_amount,
                    version_no,
                    created_by,
                    created_at,
                    updated_at
                FROM allocation_project
                ORDER BY created_at, project_id
            ) AS project_rows;
            """
        )
        return table_page(items or [])

    def project_status(self, project_id):
        project_id_sql = sql_literal(project_id)
        data = self.client.query_json(
            f"""
            SELECT jsonb_build_object(
                'project', to_jsonb(p),
                'current_package', (
                    SELECT to_jsonb(dp)
                    FROM data_package dp
                    WHERE dp.package_id = p.current_package_id
                ),
                'current_algorithm_task', (
                    SELECT to_jsonb(mt)
                    FROM md_dshap_task mt
                    WHERE mt.task_id = p.current_algorithm_task_id
                ),
                'current_allocation', (
                    SELECT to_jsonb(als)
                    FROM allocation_scenario als
                    WHERE als.allocation_id = p.current_allocation_id
                ),
                'counts', jsonb_build_object(
                    'input_snapshot', (SELECT COUNT(*) FROM input_snapshot WHERE project_id = p.project_id),
                    'data_package', (SELECT COUNT(*) FROM data_package WHERE project_id = p.project_id),
                    'data_resource', (SELECT COUNT(*) FROM data_resource WHERE project_id = p.project_id),
                    'party', (SELECT COUNT(*) FROM party WHERE project_id = p.project_id),
                    'md_dshap_task', (SELECT COUNT(*) FROM md_dshap_task WHERE project_id = p.project_id),
                    'allocation_result', (SELECT COUNT(*) FROM allocation_result WHERE project_id = p.project_id),
                    'report_record', (SELECT COUNT(*) FROM report_record WHERE project_id = p.project_id),
                    'export_file', (SELECT COUNT(*) FROM export_file WHERE project_id = p.project_id),
                    'audit_log', (SELECT COUNT(*) FROM audit_log WHERE project_id = p.project_id)
                )
            )::text
            FROM allocation_project p
            WHERE p.project_id = {project_id_sql};
            """
        )
        if not data:
            raise ApiError("DVAS_NOT_FOUND", "项目不存在", status=404)
        return data

    def audit_logs(self, project_id=None):
        where_clause = f"WHERE project_id = {sql_literal(project_id)}" if project_id else ""
        items = self.client.query_json(
            f"""
            SELECT COALESCE(jsonb_agg(to_jsonb(log_rows) ORDER BY log_rows.created_at, log_rows.log_id), '[]'::jsonb)::text
            FROM (
                SELECT
                    log_id,
                    project_id,
                    module_code,
                    menu_code,
                    operation_type,
                    object_type,
                    object_id,
                    operator_id,
                    role_code,
                    status,
                    failure_reason,
                    checksum,
                    created_at
                FROM audit_log
                {where_clause}
                ORDER BY created_at, log_id
            ) AS log_rows;
            """
        )
        return table_page(items or [])

    def reports(self, project_id=None):
        where_clause = f"WHERE r.project_id = {sql_literal(project_id)}" if project_id else ""
        items = self.client.query_json(
            f"""
            SELECT COALESCE(jsonb_agg(to_jsonb(report_rows) ORDER BY report_rows.created_at, report_rows.report_id), '[]'::jsonb)::text
            FROM (
                SELECT
                    r.report_id,
                    r.project_id,
                    r.source_snapshot_id,
                    r.report_type,
                    r.report_version_no,
                    r.file_name,
                    r.file_format,
                    r.file_path,
                    r.checksum,
                    r.status,
                    r.created_by,
                    r.created_at,
                    COALESCE(
                        (
                            SELECT jsonb_agg(to_jsonb(file_rows) ORDER BY file_rows.created_at, file_rows.file_id)
                            FROM (
                                SELECT
                                    file_id,
                                    report_id,
                                    project_id,
                                    file_name,
                                    file_type,
                                    file_format,
                                    file_path,
                                    field_scope_json,
                                    checksum,
                                    created_by,
                                    created_at
                                FROM export_file
                                WHERE report_id = r.report_id
                                ORDER BY created_at, file_id
                            ) AS file_rows
                        ),
                        '[]'::jsonb
                    ) AS export_files
                FROM report_record r
                {where_clause}
                ORDER BY r.created_at, r.report_id
            ) AS report_rows;
            """
        )
        return table_page(items or [])
