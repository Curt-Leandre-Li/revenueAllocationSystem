import json
import os
import re
import shutil
import subprocess
from urllib.parse import urlparse

from .contracts import ApiError, table_page


SAFE_ID_RE = re.compile(r"^[A-Za-z0-9_:-]+$")


class PsqlJsonClient:
    def __init__(self, database_url=None):
        self.database_url = database_url if database_url is not None else os.environ.get("DATABASE_URL")

    def query_json(self, sql):
        if not self.database_url:
            raise ApiError(
                "DVAS_DB_URL_MISSING",
                "DATABASE_URL 未配置，无法连接 PostgreSQL",
                status=503,
            )

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
            detail = self._sanitize_detail((completed.stderr or completed.stdout or "").strip())
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

    def _sanitize_detail(self, detail):
        if not detail or not self.database_url:
            return detail
        sanitized = detail.replace(self.database_url, self._masked_database_url())
        parsed_url = urlparse(self.database_url)
        if parsed_url.password:
            sanitized = sanitized.replace(parsed_url.password, "***")
        return sanitized

    def _masked_database_url(self):
        parsed_url = urlparse(self.database_url)
        if not parsed_url.password:
            return self.database_url
        return self.database_url.replace(f":{parsed_url.password}@", ":***@")


def sql_literal(value):
    if value is None:
        return "NULL"
    if not SAFE_ID_RE.match(value):
        raise ApiError("DVAS_INPUT_FORMAT_ERROR", "project_id 含有非法字符", status=400)
    return "'" + value.replace("'", "''") + "'"


def sql_limit(value, default=50, maximum=500):
    if value in (None, ""):
        return default
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ApiError("DVAS_INPUT_FORMAT_ERROR", "limit 必须为整数", status=400) from exc
    if parsed < 1 or parsed > maximum:
        raise ApiError("DVAS_INPUT_FORMAT_ERROR", f"limit 必须在 1 到 {maximum} 之间", status=400)
    return parsed


class PostgresReadService:
    def __init__(self, client=None):
        self.client = client or PsqlJsonClient()

    def health(self):
        data = self.client.query_json(
            """
            SELECT jsonb_build_object(
                'status', 'ok',
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
                    created_at,
                    updated_at
                FROM dvas.allocation_project
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
                'project', jsonb_build_object(
                    'project_id', p.project_id,
                    'project_name', p.project_name,
                    'scenario_name', p.scenario_name,
                    'status', p.status,
                    'created_at', p.created_at,
                    'updated_at', p.updated_at
                ),
                'current_package_id', p.current_package_id,
                'current_algorithm_task_id', p.current_algorithm_task_id,
                'current_allocation_id', p.current_allocation_id,
                'data_package', (
                    SELECT jsonb_build_object(
                        'package_id', dp.package_id,
                        'package_name', dp.package_name,
                        'status', dp.status,
                        'source_type', dp.source_type,
                        'version_no', dp.version_no,
                        'created_at', dp.created_at,
                        'updated_at', dp.updated_at
                    )
                    FROM dvas.data_package dp
                    WHERE dp.package_id = p.current_package_id
                ),
                'quality_assessment_latest', (
                    SELECT jsonb_build_object(
                        'assessment_id', qa.assessment_id,
                        'package_id', qa.package_id,
                        'assessment_version_no', qa.assessment_version_no,
                        'quality_score', qa.quality_score::text,
                        'quality_level', qa.quality_level,
                        'quality_factor', qa.quality_factor::text,
                        'status', qa.status,
                        'generated_at', qa.generated_at
                    )
                    FROM dvas.quality_assessment qa
                    WHERE qa.project_id = p.project_id
                    ORDER BY qa.assessment_version_no DESC, qa.generated_at DESC, qa.assessment_id DESC
                    LIMIT 1
                ),
                'shuyuan_metering_latest', (
                    SELECT jsonb_build_object(
                        'metering_id', sm.metering_id,
                        'assessment_id', sm.assessment_id,
                        'metering_version_no', sm.metering_version_no,
                        'call_count_total', sm.call_count_total,
                        'total_amount', sm.total_amount::text,
                        'status', sm.status,
                        'generated_at', sm.generated_at
                    )
                    FROM dvas.shuyuan_metering sm
                    WHERE sm.project_id = p.project_id
                    ORDER BY sm.metering_version_no DESC, sm.generated_at DESC, sm.metering_id DESC
                    LIMIT 1
                ),
                'utility_record_count', (
                    SELECT COUNT(*) FROM dvas.utility_record ur WHERE ur.project_id = p.project_id
                ),
                'md_dshap_task', (
                    SELECT jsonb_build_object(
                        'task_id', mt.task_id,
                        'algorithm_mode', mt.algorithm_mode,
                        'status', mt.status,
                        'algorithm_version', mt.algorithm_version,
                        'sample_rounds', mt.sample_rounds,
                        'epsilon', mt.epsilon::text,
                        'started_at', mt.started_at,
                        'finished_at', mt.finished_at,
                        'created_at', mt.created_at
                    )
                    FROM dvas.md_dshap_task mt
                    WHERE mt.project_id = p.project_id
                    ORDER BY
                        CASE WHEN mt.task_id = p.current_algorithm_task_id THEN 0 ELSE 1 END,
                        mt.created_at DESC,
                        mt.task_id DESC
                    LIMIT 1
                ),
                'md_dshap_result', jsonb_build_object(
                    'weight_sum', COALESCE(
                        (
                            SELECT SUM(mr.normalized_weight)::text
                            FROM dvas.md_dshap_result mr
                            WHERE mr.project_id = p.project_id
                              AND mr.task_id = p.current_algorithm_task_id
                        ),
                        '0'
                    ),
                    'result_count', (
                        SELECT COUNT(*)
                        FROM dvas.md_dshap_result mr
                        WHERE mr.project_id = p.project_id
                          AND mr.task_id = p.current_algorithm_task_id
                    )
                ),
                'allocation_scenario', (
                    SELECT jsonb_build_object(
                        'allocation_id', als.allocation_id,
                        'scenario_name', als.scenario_name,
                        'total_revenue', als.total_revenue::text,
                        'data_revenue_pool', als.data_provider_revenue_pool::text,
                        'status', als.status,
                        'created_at', als.created_at,
                        'updated_at', als.updated_at
                    )
                    FROM dvas.allocation_scenario als
                    WHERE als.project_id = p.project_id
                    ORDER BY
                        CASE WHEN als.allocation_id = p.current_allocation_id THEN 0 ELSE 1 END,
                        als.created_at DESC,
                        als.allocation_id DESC
                    LIMIT 1
                ),
                'allocation_result', jsonb_build_object(
                    'post_constraint_amount_sum', COALESCE(
                        (
                            SELECT SUM(ar.post_constraint_amount)::text
                            FROM dvas.allocation_result ar
                            WHERE ar.project_id = p.project_id
                              AND ar.allocation_id = p.current_allocation_id
                        ),
                        '0'
                    ),
                    'result_count', (
                        SELECT COUNT(*)
                        FROM dvas.allocation_result ar
                        WHERE ar.project_id = p.project_id
                          AND ar.allocation_id = p.current_allocation_id
                    )
                ),
                'counts', jsonb_build_object(
                    'input_snapshot', (SELECT COUNT(*) FROM dvas.input_snapshot WHERE project_id = p.project_id),
                    'data_package', (SELECT COUNT(*) FROM dvas.data_package WHERE project_id = p.project_id),
                    'data_resource', (SELECT COUNT(*) FROM dvas.data_resource WHERE project_id = p.project_id),
                    'party', (SELECT COUNT(*) FROM dvas.party WHERE project_id = p.project_id),
                    'quality_assessment', (SELECT COUNT(*) FROM dvas.quality_assessment WHERE project_id = p.project_id),
                    'shuyuan_metering', (SELECT COUNT(*) FROM dvas.shuyuan_metering WHERE project_id = p.project_id),
                    'contribution_record', (SELECT COUNT(*) FROM dvas.contribution_record WHERE project_id = p.project_id),
                    'utility_record', (SELECT COUNT(*) FROM dvas.utility_record WHERE project_id = p.project_id),
                    'md_dshap_task', (SELECT COUNT(*) FROM dvas.md_dshap_task WHERE project_id = p.project_id),
                    'allocation_result', (SELECT COUNT(*) FROM dvas.allocation_result WHERE project_id = p.project_id),
                    'report_record', (SELECT COUNT(*) FROM dvas.report_record WHERE project_id = p.project_id),
                    'export_file', (SELECT COUNT(*) FROM dvas.export_file WHERE project_id = p.project_id),
                    'audit_log', (SELECT COUNT(*) FROM dvas.audit_log WHERE project_id = p.project_id),
                    'snapshot_store', (SELECT COUNT(*) FROM dvas.snapshot_store WHERE project_id = p.project_id)
                )
            )::text
            FROM dvas.allocation_project p
            WHERE p.project_id = {project_id_sql};
            """
        )
        if not data:
            raise ApiError("DVAS_NOT_FOUND", "项目不存在", status=404)
        return data

    def audit_logs(self, project_id=None, limit=None):
        where_clause = f"WHERE project_id = {sql_literal(project_id)}" if project_id else ""
        limit_value = sql_limit(limit)
        items = self.client.query_json(
            f"""
            SELECT COALESCE(jsonb_agg(to_jsonb(log_rows) ORDER BY log_rows.created_at DESC, log_rows.log_id DESC), '[]'::jsonb)::text
            FROM (
                SELECT
                    log_id,
                    project_id,
                    module_code,
                    menu_code,
                    operation_type,
                    object_id,
                    status,
                    created_at
                FROM dvas.audit_log
                {where_clause}
                ORDER BY created_at DESC, log_id DESC
                LIMIT {limit_value}
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
                    r.report_type,
                    r.file_path,
                    r.checksum,
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
                                    checksum,
                                    created_at
                                FROM dvas.export_file
                                WHERE report_id = r.report_id
                                ORDER BY created_at, file_id
                            ) AS file_rows
                        ),
                        '[]'::jsonb
                    ) AS export_files
                FROM dvas.report_record r
                {where_clause}
                ORDER BY r.created_at, r.report_id
            ) AS report_rows;
            """
        )
        return table_page(items or [])

    def allocation_summary(self, project_id):
        project_id_sql = sql_literal(project_id)
        data = self.client.query_json(
            f"""
            WITH selected_allocation AS (
                SELECT als.*
                FROM dvas.allocation_scenario als
                JOIN dvas.allocation_project p ON p.project_id = als.project_id
                WHERE als.project_id = {project_id_sql}
                ORDER BY
                    CASE WHEN als.allocation_id = p.current_allocation_id THEN 0 ELSE 1 END,
                    als.created_at DESC,
                    als.allocation_id DESC
                LIMIT 1
            )
            SELECT jsonb_build_object(
                'project_id', sa.project_id,
                'allocation_id', sa.allocation_id,
                'scenario_name', sa.scenario_name,
                'status', sa.status,
                'total_revenue', sa.total_revenue::text,
                'data_revenue_pool', sa.data_provider_revenue_pool::text,
                'post_constraint_amount_sum', COALESCE(SUM(ar.post_constraint_amount)::text, '0'),
                'allocations', COALESCE(
                    jsonb_agg(
                        jsonb_build_object(
                            'party_id', pt.party_id,
                            'party_name', pt.party_name,
                            'party_type', pt.party_type,
                            'raw_weight', ar.raw_weight::text,
                            'pre_constraint_amount', ar.pre_constraint_amount::text,
                            'post_constraint_amount', ar.post_constraint_amount::text
                        )
                        ORDER BY ar.created_at, ar.result_id
                    ) FILTER (WHERE ar.result_id IS NOT NULL),
                    '[]'::jsonb
                )
            )::text
            FROM selected_allocation sa
            LEFT JOIN dvas.allocation_result ar ON ar.allocation_id = sa.allocation_id
            LEFT JOIN dvas.party pt ON pt.party_id = ar.party_id
            GROUP BY
                sa.project_id,
                sa.allocation_id,
                sa.scenario_name,
                sa.status,
                sa.total_revenue,
                sa.data_provider_revenue_pool;
            """
        )
        if not data:
            raise ApiError("DVAS_NOT_FOUND", "项目收益分配结果不存在", status=404)
        return data

    def md_dshap_summary(self, project_id):
        project_id_sql = sql_literal(project_id)
        data = self.client.query_json(
            f"""
            WITH selected_task AS (
                SELECT mt.*
                FROM dvas.md_dshap_task mt
                JOIN dvas.allocation_project p ON p.project_id = mt.project_id
                WHERE mt.project_id = {project_id_sql}
                ORDER BY
                    CASE WHEN mt.task_id = p.current_algorithm_task_id THEN 0 ELSE 1 END,
                    mt.created_at DESC,
                    mt.task_id DESC
                LIMIT 1
            )
            SELECT jsonb_build_object(
                'project_id', st.project_id,
                'task_id', st.task_id,
                'algorithm_mode', st.algorithm_mode,
                'status', st.status,
                'algorithm_version', st.algorithm_version,
                'sample_rounds', st.sample_rounds,
                'epsilon', st.epsilon::text,
                'weight_sum', COALESCE(SUM(mr.normalized_weight)::text, '0'),
                'audit_snapshot_exists', EXISTS (
                    SELECT 1
                    FROM dvas.algorithm_audit_snapshot aas
                    WHERE aas.task_id = st.task_id
                ),
                'participant_weight', COALESCE(
                    jsonb_agg(
                        jsonb_build_object(
                            'party_id', pt.party_id,
                            'party_name', pt.party_name,
                            'party_type', pt.party_type,
                            'participant_weight', mr.participant_weight::text,
                            'normalized_weight', mr.normalized_weight::text,
                            'baseline_weight', mr.baseline_weight::text,
                            'weight_diff', mr.weight_diff::text
                        )
                        ORDER BY pt.party_id
                    ) FILTER (WHERE mr.result_id IS NOT NULL),
                    '[]'::jsonb
                )
            )::text
            FROM selected_task st
            LEFT JOIN dvas.md_dshap_result mr ON mr.task_id = st.task_id
            LEFT JOIN dvas.party pt ON pt.party_id = mr.party_id
            GROUP BY
                st.project_id,
                st.task_id,
                st.algorithm_mode,
                st.status,
                st.algorithm_version,
                st.sample_rounds,
                st.epsilon;
            """
        )
        if not data:
            raise ApiError("DVAS_NOT_FOUND", "项目 MD-DShap 任务不存在", status=404)
        return data
