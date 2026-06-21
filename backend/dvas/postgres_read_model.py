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
                'upload_validation_latest', (
                    SELECT jsonb_build_object(
                        'validation_result_id', uvr.validation_result_id,
                        'package_id', uvr.package_id,
                        'is_valid', uvr.is_valid,
                        'error_field', uvr.error_field,
                        'error_type', uvr.error_type,
                        'error_message', uvr.error_message,
                        'detail_json', uvr.detail_json,
                        'created_at', uvr.created_at
                    )
                    FROM dvas.upload_validation_result uvr
                    WHERE uvr.project_id = p.project_id
                    ORDER BY uvr.created_at DESC, uvr.validation_result_id DESC
                    LIMIT 1
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

    def resources(self, project_id):
        project_id_sql = sql_literal(project_id)
        self._require_project(project_id_sql)
        items = self.client.query_json(
            f"""
            SELECT COALESCE(jsonb_agg(to_jsonb(resource_rows) ORDER BY resource_rows.created_at, resource_rows.resource_id), '[]'::jsonb)::text
            FROM (
                SELECT
                    dr.resource_id,
                    dr.project_id,
                    dr.package_id,
                    dr.resource_name,
                    dr.modality,
                    dr.field_count,
                    dr.sample_count,
                    dr.missing_rate::text AS missing_rate,
                    dr.include_in_calculation,
                    dr.status,
                    dr.created_at,
                    dr.updated_at,
                    (
                        SELECT COUNT(*)
                        FROM dvas.data_resource_field drf
                        WHERE drf.resource_id = dr.resource_id
                    ) AS actual_field_count,
                    (
                        SELECT COUNT(*)
                        FROM dvas.data_resource_field drf
                        WHERE drf.resource_id = dr.resource_id AND drf.is_sensitive
                    ) AS sensitive_field_count,
                    COALESCE(
                        (
                            SELECT jsonb_agg(
                                jsonb_build_object(
                                    'field_id', drf.field_id,
                                    'field_name', drf.field_name,
                                    'field_type', drf.field_type,
                                    'is_sensitive', drf.is_sensitive,
                                    'missing_rate', drf.missing_rate::text,
                                    'distinct_count', drf.distinct_count
                                )
                                ORDER BY drf.created_at, drf.field_id
                            )
                            FROM dvas.data_resource_field drf
                            WHERE drf.resource_id = dr.resource_id
                        ),
                        '[]'::jsonb
                    ) AS fields,
                    COALESCE(
                        (
                            SELECT jsonb_agg(
                                jsonb_build_object(
                                    'relation_id', rel.relation_id,
                                    'party_id', pt.party_id,
                                    'party_name', pt.party_name,
                                    'party_type', pt.party_type,
                                    'split_ratio', rel.split_ratio::text,
                                    'is_primary_provider', rel.is_primary_provider,
                                    'include_in_md_dshap', rel.include_in_md_dshap,
                                    'status', rel.status
                                )
                                ORDER BY rel.is_primary_provider DESC, pt.party_id
                            )
                            FROM dvas.data_resource_party_relation rel
                            JOIN dvas.party pt ON pt.party_id = rel.party_id
                            WHERE rel.resource_id = dr.resource_id
                        ),
                        '[]'::jsonb
                    ) AS provider_parties
                FROM dvas.data_resource dr
                WHERE dr.project_id = {project_id_sql}
                ORDER BY dr.created_at, dr.resource_id
            ) AS resource_rows;
            """
        )
        return table_page(items or [])

    def parties(self, project_id):
        project_id_sql = sql_literal(project_id)
        self._require_project(project_id_sql)
        items = self.client.query_json(
            f"""
            SELECT COALESCE(jsonb_agg(to_jsonb(party_rows) ORDER BY party_rows.created_at, party_rows.party_id), '[]'::jsonb)::text
            FROM (
                SELECT
                    pt.party_id,
                    pt.project_id,
                    pt.party_name,
                    pt.party_type,
                    pt.include_in_md_dshap,
                    pt.status,
                    pt.created_at,
                    pt.updated_at,
                    (
                        SELECT COUNT(*)
                        FROM dvas.data_resource_party_relation rel
                        WHERE rel.party_id = pt.party_id AND rel.project_id = pt.project_id
                    ) AS linked_resource_count,
                    (
                        SELECT COALESCE(SUM(rel.split_ratio), 0)::text
                        FROM dvas.data_resource_party_relation rel
                        WHERE rel.party_id = pt.party_id AND rel.project_id = pt.project_id
                    ) AS linked_split_ratio_sum,
                    (
                        SELECT jsonb_build_object(
                            'raw_weight', ar.raw_weight::text,
                            'pre_constraint_amount', ar.pre_constraint_amount::text,
                            'post_constraint_amount', ar.post_constraint_amount::text,
                            'adjustment_amount', ar.adjustment_amount::text,
                            'constraint_adjustment_reason', ar.constraint_adjustment_reason
                        )
                        FROM dvas.allocation_result ar
                        JOIN dvas.allocation_project ap ON ap.current_allocation_id = ar.allocation_id
                        WHERE ar.project_id = pt.project_id
                          AND ar.party_id = pt.party_id
                          AND ap.project_id = pt.project_id
                        LIMIT 1
                    ) AS allocation_result,
                    (
                        SELECT jsonb_build_object(
                            'participant_weight', mr.participant_weight::text,
                            'normalized_weight', mr.normalized_weight::text,
                            'baseline_weight', mr.baseline_weight::text,
                            'weight_diff', mr.weight_diff::text
                        )
                        FROM dvas.md_dshap_result mr
                        JOIN dvas.allocation_project ap ON ap.current_algorithm_task_id = mr.task_id
                        WHERE mr.project_id = pt.project_id
                          AND mr.party_id = pt.party_id
                          AND ap.project_id = pt.project_id
                        LIMIT 1
                    ) AS md_dshap_weight
                FROM dvas.party pt
                WHERE pt.project_id = {project_id_sql}
                ORDER BY pt.created_at, pt.party_id
            ) AS party_rows;
            """
        )
        return table_page(items or [])

    def quality_summary(self, project_id):
        project_id_sql = sql_literal(project_id)
        data = self.client.query_json(
            f"""
            WITH project AS (
                SELECT project_id FROM dvas.allocation_project WHERE project_id = {project_id_sql}
            ),
            selected_assessment AS (
                SELECT qa.*
                FROM dvas.quality_assessment qa
                WHERE qa.project_id = {project_id_sql}
                ORDER BY qa.assessment_version_no DESC, qa.generated_at DESC, qa.assessment_id DESC
                LIMIT 1
            )
            SELECT jsonb_build_object(
                'project_id', p.project_id,
                'status', CASE WHEN qa.assessment_id IS NULL THEN 'NOT_READY' ELSE qa.status END,
                'assessment', CASE
                    WHEN qa.assessment_id IS NULL THEN NULL
                    ELSE jsonb_build_object(
                        'assessment_id', qa.assessment_id,
                        'package_id', qa.package_id,
                        'assessment_version_no', qa.assessment_version_no,
                        'quality_score', qa.quality_score::text,
                        'quality_level', qa.quality_level,
                        'quality_factor', qa.quality_factor::text,
                        'dimension_scores', qa.dimension_scores,
                        'evidence_summary', qa.evidence_summary,
                        'status', qa.status,
                        'generated_at', qa.generated_at
                    )
                END,
                'details', COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'detail_id', qsd.detail_id,
                                'metric_code', qsd.metric_code,
                                'dimension_code', qsd.dimension_code,
                                'metric_name', qsd.metric_name,
                                'weight', qsd.weight::text,
                                'score', qsd.score::text,
                                'weighted_score', qsd.weighted_score::text,
                                'evidence_json', qsd.evidence_json,
                                'created_at', qsd.created_at
                            )
                            ORDER BY qsd.created_at, qsd.detail_id
                        )
                        FROM dvas.quality_score_detail qsd
                        WHERE qsd.assessment_id = qa.assessment_id
                    ),
                    '[]'::jsonb
                )
            )::text
            FROM project p
            LEFT JOIN selected_assessment qa ON true;
            """
        )
        if not data:
            raise ApiError("DVAS_NOT_FOUND", "项目不存在", status=404)
        return data

    def shuyuan_summary(self, project_id):
        project_id_sql = sql_literal(project_id)
        data = self.client.query_json(
            f"""
            WITH project AS (
                SELECT project_id FROM dvas.allocation_project WHERE project_id = {project_id_sql}
            ),
            selected_metering AS (
                SELECT sm.*
                FROM dvas.shuyuan_metering sm
                WHERE sm.project_id = {project_id_sql}
                ORDER BY sm.metering_version_no DESC, sm.generated_at DESC, sm.metering_id DESC
                LIMIT 1
            )
            SELECT jsonb_build_object(
                'project_id', p.project_id,
                'status', CASE WHEN sm.metering_id IS NULL THEN 'NOT_READY' ELSE sm.status END,
                'metering', CASE
                    WHEN sm.metering_id IS NULL THEN NULL
                    ELSE jsonb_build_object(
                        'metering_id', sm.metering_id,
                        'assessment_id', sm.assessment_id,
                        'metering_version_no', sm.metering_version_no,
                        'base_shuyuan_price', sm.base_shuyuan_price::text,
                        'scenario_coefficient', sm.scenario_coefficient::text,
                        'quality_coefficient', sm.quality_coefficient::text,
                        'technology_coefficient', sm.technology_coefficient::text,
                        'expert_coefficient', sm.expert_coefficient::text,
                        'development_coefficient', sm.development_coefficient::text,
                        'call_count_total', sm.call_count_total,
                        'total_amount', sm.total_amount::text,
                        'status', sm.status,
                        'generated_at', sm.generated_at
                    )
                END,
                'details', COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'detail_id', smd.detail_id,
                                'resource_id', smd.resource_id,
                                'resource_name', dr.resource_name,
                                'party_id', smd.party_id,
                                'party_name', pt.party_name,
                                'party_type', pt.party_type,
                                'call_count', smd.call_count,
                                'effective_units', smd.effective_units::text,
                                'metering_amount', smd.metering_amount::text,
                                'formula_json', smd.formula_json,
                                'created_at', smd.created_at
                            )
                            ORDER BY smd.created_at, smd.detail_id
                        )
                        FROM dvas.shuyuan_metering_detail smd
                        JOIN dvas.data_resource dr ON dr.resource_id = smd.resource_id
                        JOIN dvas.party pt ON pt.party_id = smd.party_id
                        WHERE smd.metering_id = sm.metering_id
                    ),
                    '[]'::jsonb
                )
            )::text
            FROM project p
            LEFT JOIN selected_metering sm ON true;
            """
        )
        if not data:
            raise ApiError("DVAS_NOT_FOUND", "项目不存在", status=404)
        return data

    def utility_summary(self, project_id):
        project_id_sql = sql_literal(project_id)
        data = self.client.query_json(
            f"""
            WITH project AS (
                SELECT project_id FROM dvas.allocation_project WHERE project_id = {project_id_sql}
            ),
            latest_utility_snapshot AS (
                SELECT ufs.*
                FROM dvas.utility_function_snapshot ufs
                WHERE ufs.project_id = {project_id_sql}
                ORDER BY ufs.version_no DESC, ufs.created_at DESC, ufs.snapshot_id DESC
                LIMIT 1
            )
            SELECT jsonb_build_object(
                'project_id', p.project_id,
                'status', CASE
                    WHEN EXISTS (SELECT 1 FROM dvas.utility_record ur WHERE ur.project_id = p.project_id) THEN 'SUCCESS'
                    ELSE 'NOT_READY'
                END,
                'utility_function', (
                    SELECT jsonb_build_object(
                        'snapshot_id', lus.snapshot_id,
                        'utility_source', lus.utility_source,
                        'formula_text', lus.formula_text,
                        'version_no', lus.version_no,
                        'created_at', lus.created_at
                    )
                    FROM latest_utility_snapshot lus
                ),
                'records', COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'party_id', pt.party_id,
                                'party_name', pt.party_name,
                                'party_type', pt.party_type,
                                'contribution_id', cr.contribution_id,
                                'valid_units', cr.valid_units::text,
                                'usage_weight', cr.usage_weight::text,
                                'coverage_weight', cr.coverage_weight::text,
                                'scarcity_weight', cr.scarcity_weight::text,
                                'contribution_score', cr.contribution_score::text,
                                'normalized_contribution', COALESCE(ur.normalized_contribution, cr.normalized_contribution)::text,
                                'utility_id', ur.utility_id,
                                'task_key', ur.task_key,
                                'quality_factor', ur.quality_factor::text,
                                'usage_factor', ur.usage_factor::text,
                                'scenario_factor', ur.scenario_factor::text,
                                'utility_value', ur.utility_value::text,
                                'trace_count', (
                                    SELECT COUNT(*)
                                    FROM dvas.utility_trace ut
                                    WHERE ut.utility_id = ur.utility_id
                                ),
                                'created_at', COALESCE(ur.created_at, cr.created_at)
                            )
                            ORDER BY COALESCE(ur.created_at, cr.created_at), pt.party_id
                        )
                        FROM dvas.contribution_record cr
                        JOIN dvas.party pt ON pt.party_id = cr.party_id
                        LEFT JOIN dvas.utility_record ur ON ur.contribution_id = cr.contribution_id
                        WHERE cr.project_id = p.project_id
                    ),
                    '[]'::jsonb
                ),
                'traces', COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'trace_id', ut.trace_id,
                                'utility_id', ut.utility_id,
                                'party_id', ur.party_id,
                                'party_name', pt.party_name,
                                'task_key', ur.task_key,
                                'formula_text', ut.formula_text,
                                'input_summary', jsonb_build_object(
                                    'normalized_contribution', ur.normalized_contribution::text,
                                    'quality_factor', ur.quality_factor::text,
                                    'usage_factor', ur.usage_factor::text,
                                    'scenario_factor', ur.scenario_factor::text
                                ),
                                'output_summary', jsonb_build_object(
                                    'utility_value', ur.utility_value::text
                                ),
                                'created_at', ut.created_at
                            )
                            ORDER BY ut.created_at, ut.trace_id
                        )
                        FROM dvas.utility_trace ut
                        JOIN dvas.utility_record ur ON ur.utility_id = ut.utility_id
                        JOIN dvas.party pt ON pt.party_id = ur.party_id
                        WHERE ur.project_id = p.project_id
                    ),
                    '[]'::jsonb
                )
            )::text
            FROM project p;
            """
        )
        if not data:
            raise ApiError("DVAS_NOT_FOUND", "项目不存在", status=404)
        return data

    def constraints_summary(self, project_id):
        project_id_sql = sql_literal(project_id)
        data = self.client.query_json(
            f"""
            WITH project AS (
                SELECT *
                FROM dvas.allocation_project
                WHERE project_id = {project_id_sql}
            ),
            selected_allocation AS (
                SELECT als.*
                FROM dvas.allocation_scenario als
                JOIN project p ON p.project_id = als.project_id
                ORDER BY
                    CASE WHEN als.allocation_id = p.current_allocation_id THEN 0 ELSE 1 END,
                    als.created_at DESC,
                    als.allocation_id DESC
                LIMIT 1
            )
            SELECT jsonb_build_object(
                'project_id', p.project_id,
                'status', CASE WHEN sa.allocation_id IS NULL THEN 'NOT_READY' ELSE sa.status END,
                'allocation', CASE
                    WHEN sa.allocation_id IS NULL THEN NULL
                    ELSE jsonb_build_object(
                        'allocation_id', sa.allocation_id,
                        'scenario_name', sa.scenario_name,
                        'total_revenue', sa.total_revenue::text,
                        'priority_allocation_amount', sa.priority_allocation_amount::text,
                        'data_revenue_pool', sa.data_provider_revenue_pool::text,
                        'allocation_mode', sa.allocation_mode,
                        'status', sa.status,
                        'created_at', sa.created_at,
                        'updated_at', sa.updated_at
                    )
                END,
                'priority_items', COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'item_id', api.item_id,
                                'party_id', api.party_id,
                                'party_name', pt.party_name,
                                'party_type', pt.party_type,
                                'priority_amount', api.priority_amount::text,
                                'priority_ratio', api.priority_ratio::text,
                                'basis_text', api.basis_text,
                                'priority_order', api.priority_order,
                                'status', api.status,
                                'created_at', api.created_at
                            )
                            ORDER BY api.priority_order, api.item_id
                        )
                        FROM dvas.allocation_priority_item api
                        JOIN dvas.party pt ON pt.party_id = api.party_id
                        WHERE api.allocation_id = sa.allocation_id
                    ),
                    '[]'::jsonb
                ),
                'constraints', COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'constraint_id', cc.constraint_id,
                                'party_id', cc.party_id,
                                'party_name', pt.party_name,
                                'party_type', pt.party_type,
                                'constraint_type', cc.constraint_type,
                                'constraint_value', cc.constraint_value::text,
                                'priority', cc.priority,
                                'basis_text', cc.basis_text,
                                'status', cc.status,
                                'created_at', cc.created_at,
                                'updated_at', cc.updated_at
                            )
                            ORDER BY cc.priority, cc.created_at, cc.constraint_id
                        )
                        FROM dvas.contract_constraint cc
                        JOIN dvas.party pt ON pt.party_id = cc.party_id
                        WHERE cc.project_id = p.project_id
                    ),
                    '[]'::jsonb
                ),
                'traces', COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'trace_id', cat.trace_id,
                                'constraint_id', cat.constraint_id,
                                'party_id', cat.party_id,
                                'party_name', pt.party_name,
                                'party_type', pt.party_type,
                                'constraint_type', cc.constraint_type,
                                'before_amount', cat.before_amount::text,
                                'after_amount', cat.after_amount::text,
                                'adjustment_amount', cat.adjustment_amount::text,
                                'reason', cat.reason,
                                'step_no', cat.step_no,
                                'created_at', cat.created_at
                            )
                            ORDER BY cat.step_no, cat.created_at, cat.trace_id
                        )
                        FROM dvas.constraint_apply_trace cat
                        JOIN dvas.party pt ON pt.party_id = cat.party_id
                        LEFT JOIN dvas.contract_constraint cc ON cc.constraint_id = cat.constraint_id
                        WHERE cat.allocation_id = sa.allocation_id
                    ),
                    '[]'::jsonb
                ),
                'allocation_results', COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'result_id', ar.result_id,
                                'party_id', ar.party_id,
                                'party_name', pt.party_name,
                                'party_type', pt.party_type,
                                'raw_weight', ar.raw_weight::text,
                                'normalized_weight', ar.normalized_weight::text,
                                'pre_constraint_amount', ar.pre_constraint_amount::text,
                                'post_constraint_amount', ar.post_constraint_amount::text,
                                'adjustment_amount', ar.adjustment_amount::text,
                                'constraint_adjustment_reason', ar.constraint_adjustment_reason
                            )
                            ORDER BY ar.created_at, ar.result_id
                        )
                        FROM dvas.allocation_result ar
                        JOIN dvas.party pt ON pt.party_id = ar.party_id
                        WHERE ar.allocation_id = sa.allocation_id
                    ),
                    '[]'::jsonb
                )
            )::text
            FROM project p
            LEFT JOIN selected_allocation sa ON true;
            """
        )
        if not data:
            raise ApiError("DVAS_NOT_FOUND", "项目不存在", status=404)
        return data

    def export_files(self, project_id):
        project_id_sql = sql_literal(project_id)
        self._require_project(project_id_sql)
        items = self.client.query_json(
            f"""
            SELECT COALESCE(jsonb_agg(to_jsonb(file_rows) ORDER BY file_rows.created_at, file_rows.file_id), '[]'::jsonb)::text
            FROM (
                SELECT
                    ef.file_id,
                    ef.report_id,
                    rr.report_type,
                    ef.project_id,
                    ef.file_name,
                    ef.file_type,
                    ef.file_format,
                    ef.file_path,
                    ef.field_scope_json,
                    ef.checksum,
                    ef.created_by,
                    ef.created_at
                FROM dvas.export_file ef
                JOIN dvas.report_record rr ON rr.report_id = ef.report_id
                WHERE ef.project_id = {project_id_sql}
                ORDER BY ef.created_at, ef.file_id
            ) AS file_rows;
            """
        )
        return table_page(items or [])

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
                    object_type,
                    object_id,
                    operator_id,
                    status,
                    failure_reason,
                    input_snapshot_id,
                    parameter_snapshot_id,
                    result_snapshot_id,
                    checksum,
                    created_at
                FROM dvas.audit_log
                {where_clause}
                ORDER BY created_at DESC, log_id DESC
                LIMIT {limit_value}
            ) AS log_rows;
            """
        )
        return table_page(items or [])

    def _require_project(self, project_id_sql):
        exists = self.client.query_json(
            f"""
            SELECT EXISTS (
                SELECT 1 FROM dvas.allocation_project WHERE project_id = {project_id_sql}
            )::text;
            """
        )
        if exists is not True:
            raise ApiError("DVAS_NOT_FOUND", "项目不存在", status=404)

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
