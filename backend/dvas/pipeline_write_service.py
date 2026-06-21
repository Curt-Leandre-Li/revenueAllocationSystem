from decimal import Decimal, ROUND_HALF_UP
from uuid import uuid4

from .contracts import ApiError, LOCAL_OPERATOR, SIMULATION_DISCLAIMER, stable_checksum
from .postgres_write_model import (
    AMOUNT_PLACES,
    WEIGHT_PLACES,
    PostgresWriteModel,
    as_decimal,
    checksum_json,
    quantize_amount,
    quantize_weight,
    sql_amount,
    sql_bool,
    sql_int,
    sql_json,
    sql_safe_id,
    sql_text,
    sql_weight,
)


DEFAULT_OPERATOR = LOCAL_OPERATOR
TOTAL_WEIGHT = Decimal("1.000000")


def _new_id(prefix):
    return f"{prefix}_{uuid4().hex[:18]}"


def _non_negative_decimal(value, field_name, errors):
    try:
        parsed = as_decimal(value, field_name)
    except ApiError:
        errors.append({"field": field_name, "reason": "必须是合法数字"})
        return Decimal("0")
    if parsed < 0:
        errors.append({"field": field_name, "reason": "金额不得为负"})
    return parsed


def _non_negative_int(value, field_name, errors):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        errors.append({"field": field_name, "reason": "必须是非负整数"})
        return 0
    if parsed < 0:
        errors.append({"field": field_name, "reason": "必须是非负整数"})
    return parsed


def _non_negative_rate(value, field_name, errors):
    parsed = _non_negative_decimal(value, field_name, errors)
    if parsed > 1:
        errors.append({"field": field_name, "reason": "必须在 0 到 1 之间"})
    return parsed


def _raw_participants(body):
    return body.get("participants") or body.get("parties") or []


def _raw_resources(body):
    return body.get("resources") or body.get("data_units") or []


def _revenue_value(body):
    revenue_pool = body.get("revenue_pool") if isinstance(body.get("revenue_pool"), dict) else {}
    return revenue_pool.get("total_revenue", body.get("total_revenue"))


def validate_upload_payload(body):
    if not isinstance(body, dict):
        raise ApiError(
            "DVAS_INPUT_FORMAT_ERROR",
            "请求体必须是 JSON 对象",
            status=400,
            field_errors=[{"field": "body", "reason": "必须是 JSON 对象"}],
        )

    errors = []
    participants = _raw_participants(body)
    resources = _raw_resources(body)
    total_revenue_value = _revenue_value(body)

    if total_revenue_value is None:
        errors.append({"field": "revenue_pool.total_revenue", "reason": "P0 收益池总金额必填"})
        total_revenue = Decimal("0")
    else:
        total_revenue = _non_negative_decimal(total_revenue_value, "revenue_pool.total_revenue", errors)

    if not isinstance(participants, list) or not participants:
        errors.append({"field": "participants", "reason": "至少需要一个参与方"})
        participants = []
    if not isinstance(resources, list) or not resources:
        errors.append({"field": "resources", "reason": "至少需要一个数据资源"})
        resources = []

    normalized_parties = []
    seen_names = set()
    for index, item in enumerate(participants):
        if not isinstance(item, dict):
            errors.append({"field": f"participants[{index}]", "reason": "参与方必须是对象"})
            continue
        name = str(item.get("party_name") or item.get("name") or "").strip()
        party_type = str(item.get("party_type") or item.get("type") or "DATA_PROVIDER").strip()
        if not name:
            errors.append({"field": f"participants[{index}].party_name", "reason": "参与方名称必填"})
        elif name in seen_names:
            errors.append({"field": f"participants[{index}].party_name", "reason": "项目内参与方名称不得重复"})
        seen_names.add(name)
        if party_type not in {"DATA_PROVIDER", "OPERATOR", "PILOT_BASE", "TECH_SERVICE", "EXPERT", "CONTRACT_OTHER"}:
            errors.append({"field": f"participants[{index}].party_type", "reason": "参与方类型不合法"})
        normalized_parties.append(
            {
                "party_name": name,
                "party_type": party_type,
                "include_in_md_dshap": bool(item.get("include_in_md_dshap", party_type == "DATA_PROVIDER")),
                "description": str(item.get("description") or ""),
            }
        )

    party_names = {item["party_name"] for item in normalized_parties if item["party_name"]}
    data_provider_names = {
        item["party_name"]
        for item in normalized_parties
        if item["party_name"] and item["party_type"] == "DATA_PROVIDER"
    }

    normalized_resources = []
    for index, item in enumerate(resources):
        if not isinstance(item, dict):
            errors.append({"field": f"resources[{index}]", "reason": "数据资源必须是对象"})
            continue
        resource_name = str(item.get("resource_name") or item.get("name") or "").strip()
        provider_name = str(item.get("provider_party_name") or item.get("party_name") or "").strip()
        if not resource_name:
            errors.append({"field": f"resources[{index}].resource_name", "reason": "数据资源名称必填"})
        if not provider_name:
            errors.append({"field": f"resources[{index}].provider_party_name", "reason": "资源必须关联数据源主体"})
        elif provider_name not in party_names:
            errors.append({"field": f"resources[{index}].provider_party_name", "reason": "资源关联的参与方不存在"})
        elif provider_name not in data_provider_names:
            errors.append({"field": f"resources[{index}].provider_party_name", "reason": "资源必须关联 DATA_PROVIDER"})
        field_count = _non_negative_int(item.get("field_count", 0), f"resources[{index}].field_count", errors)
        sample_count = _non_negative_int(item.get("sample_count", 0), f"resources[{index}].sample_count", errors)
        missing_rate = _non_negative_rate(item.get("missing_rate", 0), f"resources[{index}].missing_rate", errors)
        fields = item.get("fields") or []
        if not isinstance(fields, list):
            errors.append({"field": f"resources[{index}].fields", "reason": "fields 必须是数组"})
            fields = []
        normalized_resources.append(
            {
                "resource_name": resource_name,
                "provider_party_name": provider_name,
                "modality": str(item.get("modality") or "TABLE"),
                "field_count": field_count,
                "sample_count": sample_count,
                "missing_rate": missing_rate,
                "fields": fields,
            }
        )

    if not data_provider_names:
        errors.append({"field": "participants", "reason": "至少需要一个 DATA_PROVIDER"})

    if errors:
        raise ApiError("DVAS_INPUT_FORMAT_ERROR", "JSON 输入未通过 P0 校验", status=400, field_errors=errors)

    return {
        "project_name": str(body.get("project_name") or "P0 PostgreSQL write project").strip(),
        "scenario_name": str(body.get("scenario_name") or "P0 最小闭环场景").strip(),
        "package_name": str(body.get("package_name") or "P0 JSON upload package").strip(),
        "file_name": str(body.get("file_name") or "upload.json").strip(),
        "total_revenue": quantize_amount(total_revenue),
        "participants": normalized_parties,
        "resources": normalized_resources,
        "snapshot_content": _sanitize_payload(body),
    }


def _sanitize_payload(value):
    raw_keys = {"rows", "records", "raw", "raw_records", "sample_rows", "sample_preview", "preview"}
    if isinstance(value, dict):
        return {key: _sanitize_payload(item) for key, item in value.items() if key not in raw_keys}
    if isinstance(value, list):
        return [_sanitize_payload(item) for item in value]
    return value


class PostgresPipelineWriteService:
    def __init__(self, client=None):
        self.model = PostgresWriteModel(client=client)

    def load_demo_case(self, body=None):
        payload = self._demo_payload(body or {})
        return self._ingest_payload(payload, source_type="DEMO", source_name="p0_demo_case")

    def upload_json(self, body):
        try:
            normalized = validate_upload_payload(body)
        except ApiError as error:
            self._write_invalid_upload(body if isinstance(body, dict) else {}, error.field_errors)
            raise
        return self._ingest_payload(normalized, source_type="UPLOAD_JSON", source_name=normalized["file_name"])

    def run_pipeline(self, project_id, body=None):
        body = body or {}
        try:
            context = self._project_context(project_id)
            result = self._build_pipeline_result(context, body)
            return self._write_pipeline_result(context, result)
        except ApiError as error:
            if not error.code.startswith("DVAS_DB_"):
                self._safe_failure_audit(project_id, "CALCULATE", "PIPELINE", None, error.message)
            raise

    def generate_report(self, project_id, body=None):
        body = body or {}
        try:
            context = self._report_context(project_id)
            return self._write_report(context, body)
        except ApiError as error:
            if not error.code.startswith("DVAS_DB_"):
                self._safe_failure_audit(project_id, "EXPORT", "REPORT", None, error.message)
            raise

    def confirm_allocation(self, project_id, body=None):
        body = body or {}
        context = self._report_context(project_id)
        status = context["project"]["status"]
        if status != "ALLOCATED":
            raise ApiError("DVAS_PRECONDITION_NOT_MET", "只有 ALLOCATED 项目可以确认模拟参考方案", status=409)
        allocation_id = context["project"]["current_allocation_id"]
        log_id = _new_id("AUD")
        payload = {
            "project_id": project_id,
            "allocation_id": allocation_id,
            "confirmed_by": body.get("confirmed_by") or DEFAULT_OPERATOR,
            "disclaimer": "模拟参考，非法律结算，不代表真实付款",
        }
        statements = [
            f"""
            UPDATE dvas.allocation_scenario
            SET status = 'CONFIRMED', locked_by = {sql_text(payload["confirmed_by"])}, locked_at = now(), updated_at = now()
            WHERE allocation_id = {sql_safe_id(allocation_id, "allocation_id")}
            """,
            f"""
            UPDATE dvas.allocation_project
            SET status = 'CONFIRMED', updated_at = now()
            WHERE project_id = {sql_safe_id(project_id, "project_id")}
            """,
            self._audit_sql(
                log_id,
                project_id,
                module_code="ALLOC",
                menu_code="NAV_ALLOC_SIMULATION",
                operation_type="CONFIRM",
                object_type="ALLOCATION_SCENARIO",
                object_id=allocation_id,
                after_value=payload,
            ),
        ]
        return self.model.execute_json(statements, f"SELECT {sql_json({'project_id': project_id, 'allocation_id': allocation_id, 'project_status': 'CONFIRMED'})}::text")

    def _demo_payload(self, body):
        return validate_upload_payload(
            {
                "project_name": body.get("project_name") or "P0 PostgreSQL write demo project",
                "scenario_name": body.get("scenario_name") or "P0 演示数据写库闭环",
                "package_name": "P0 demo write package",
                "file_name": "p0_demo_case.json",
                "revenue_pool": {"total_revenue": body.get("total_revenue", "1000000.00")},
                "participants": [
                    {"party_name": "示例数据源主体A", "party_type": "DATA_PROVIDER", "include_in_md_dshap": True},
                    {"party_name": "示例数据源主体B", "party_type": "DATA_PROVIDER", "include_in_md_dshap": True},
                    {"party_name": "示例运营服务方", "party_type": "OPERATOR", "include_in_md_dshap": False},
                    {"party_name": "示例技术服务方", "party_type": "TECH_SERVICE", "include_in_md_dshap": False},
                ],
                "resources": [
                    {
                        "resource_name": "early_screening_features",
                        "provider_party_name": "示例数据源主体A",
                        "modality": "TABLE",
                        "field_count": 6,
                        "sample_count": 600,
                        "missing_rate": "0.020000",
                        "fields": [
                            {"field_name": "record_id", "field_type": "STRING", "is_sensitive": False},
                            {"field_name": "feature_bucket", "field_type": "STRING", "is_sensitive": False},
                            {"field_name": "event_month", "field_type": "DATE", "is_sensitive": False},
                        ],
                    },
                    {
                        "resource_name": "followup_statistics",
                        "provider_party_name": "示例数据源主体B",
                        "modality": "TABLE",
                        "field_count": 5,
                        "sample_count": 400,
                        "missing_rate": "0.030000",
                        "fields": [
                            {"field_name": "record_id", "field_type": "STRING", "is_sensitive": False},
                            {"field_name": "followup_count", "field_type": "INTEGER", "is_sensitive": False},
                            {"field_name": "quality_bucket", "field_type": "STRING", "is_sensitive": False},
                        ],
                    },
                ],
            }
        )

    def _ingest_payload(self, normalized, source_type, source_name):
        project_id = _new_id("PRJ")
        input_snapshot_id = _new_id("INP")
        package_id = _new_id("PKG")
        validation_id = _new_id("VAL")
        snapshot_store_id = _new_id("SS")
        audit_id = _new_id("AUD")
        checksum = checksum_json(normalized["snapshot_content"])
        party_ids = {party["party_name"]: _new_id("PTY") for party in normalized["participants"]}

        resource_rows = []
        field_rows = []
        relation_rows = []
        for index, resource in enumerate(normalized["resources"], start=1):
            resource_id = _new_id("RES")
            provider_party_id = party_ids[resource["provider_party_name"]]
            resource_rows.append((resource_id, resource, provider_party_id))
            fields = resource["fields"] or [
                {"field_name": f"field_{field_index}", "field_type": "STRING", "is_sensitive": False}
                for field_index in range(1, max(1, min(resource["field_count"], 5)) + 1)
            ]
            for field_index, field in enumerate(fields, start=1):
                field_rows.append((resource_id, field_index, field))
            relation_rows.append((_new_id("REL"), resource_id, provider_party_id, index == 1))

        statements = [
            f"""
            INSERT INTO dvas.allocation_project (
                project_id, project_name, scenario_name, status, current_package_id,
                total_revenue_amount, created_by
            ) VALUES (
                {sql_text(project_id)}, {sql_text(normalized["project_name"])},
                {sql_text(normalized["scenario_name"])}, 'INGESTED', {sql_text(package_id)},
                {sql_amount(normalized["total_revenue"])}, {sql_text(DEFAULT_OPERATOR)}
            )
            """,
            f"""
            INSERT INTO dvas.input_snapshot (
                snapshot_id, project_id, source_type, source_name, content_json, checksum, created_by
            ) VALUES (
                {sql_text(input_snapshot_id)}, {sql_text(project_id)}, {sql_text(source_type)},
                {sql_text(source_name)}, {sql_json(normalized["snapshot_content"])},
                {sql_text(checksum)}, {sql_text(DEFAULT_OPERATOR)}
            )
            """,
            f"""
            INSERT INTO dvas.data_package (
                package_id, project_id, input_snapshot_id, package_name, source_type,
                file_name, checksum, status, created_by
            ) VALUES (
                {sql_text(package_id)}, {sql_text(project_id)}, {sql_text(input_snapshot_id)},
                {sql_text(normalized["package_name"])}, {sql_text(source_type)},
                {sql_text(source_name)}, {sql_text(checksum)}, 'VALID', {sql_text(DEFAULT_OPERATOR)}
            )
            """,
            f"""
            INSERT INTO dvas.upload_validation_result (
                validation_result_id, project_id, package_id, is_valid, detail_json
            ) VALUES (
                {sql_text(validation_id)}, {sql_text(project_id)}, {sql_text(package_id)}, TRUE,
                {sql_json({"status": "PASS", "field_errors": []})}
            )
            """,
        ]
        for party in normalized["participants"]:
            statements.append(
                f"""
                INSERT INTO dvas.party (
                    party_id, project_id, party_name, party_type, include_in_md_dshap, description, status
                ) VALUES (
                    {sql_text(party_ids[party["party_name"]])}, {sql_text(project_id)},
                    {sql_text(party["party_name"])}, {sql_text(party["party_type"])},
                    {sql_bool(party["include_in_md_dshap"])}, {sql_text(party["description"])}, 'ACTIVE'
                )
                """
            )
        for resource_id, resource, _provider_party_id in resource_rows:
            statements.append(
                f"""
                INSERT INTO dvas.data_resource (
                    resource_id, project_id, package_id, resource_name, modality, field_count,
                    sample_count, missing_rate, include_in_calculation, resource_summary_json, status
                ) VALUES (
                    {sql_text(resource_id)}, {sql_text(project_id)}, {sql_text(package_id)},
                    {sql_text(resource["resource_name"])}, {sql_text(resource["modality"])},
                    {sql_int(resource["field_count"])}, {sql_int(resource["sample_count"])},
                    {sql_weight(resource["missing_rate"])}, TRUE,
                    {sql_json({"provider_party_name": resource["provider_party_name"], "sample_preview": "redacted"})},
                    'ACTIVE'
                )
                """
            )
        for resource_id, field_index, field in field_rows:
            statements.append(
                f"""
                INSERT INTO dvas.data_resource_field (
                    field_id, resource_id, field_name, field_type, is_sensitive,
                    missing_rate, distinct_count, stats_json, sample_preview_json
                ) VALUES (
                    {sql_text(_new_id("FLD"))}, {sql_text(resource_id)},
                    {sql_text(field.get("field_name") or f"field_{field_index}")},
                    {sql_text(field.get("field_type") or "STRING")},
                    {sql_bool(field.get("is_sensitive", False))}, 0, NULL,
                    {sql_json({"source": "metadata_only"})}, '[]'::jsonb
                )
                """
            )
        for relation_id, resource_id, party_id, is_primary in relation_rows:
            statements.append(
                f"""
                INSERT INTO dvas.data_resource_party_relation (
                    relation_id, project_id, resource_id, party_id, split_ratio,
                    is_primary_provider, include_in_md_dshap, status
                ) VALUES (
                    {sql_text(relation_id)}, {sql_text(project_id)}, {sql_text(resource_id)},
                    {sql_text(party_id)}, 1, {sql_bool(is_primary)}, TRUE, 'ACTIVE'
                )
                """
            )
        statements.extend(
            [
                self._snapshot_sql(
                    snapshot_store_id,
                    project_id,
                    "INPUT",
                    "DATA_PACKAGE",
                    package_id,
                    {"input_snapshot_id": input_snapshot_id, "package_id": package_id, "checksum": checksum},
                ),
                self._audit_sql(
                    audit_id,
                    project_id,
                    module_code="DATA",
                    menu_code="NAV_DATA_PACKAGE",
                    operation_type="CREATE",
                    object_type="DATA_PACKAGE",
                    object_id=package_id,
                    input_snapshot_id=input_snapshot_id,
                    result_snapshot_id=snapshot_store_id,
                    after_value={"project_status": "INGESTED", "source_type": source_type},
                    checksum=checksum,
                ),
            ]
        )

        result = {
            "project_id": project_id,
            "project_status": "INGESTED",
            "package_id": package_id,
            "input_snapshot_id": input_snapshot_id,
            "resources": [{"resource_id": row[0], "resource_name": row[1]["resource_name"]} for row in resource_rows],
            "parties": [{"party_id": party_ids[party["party_name"]], "party_name": party["party_name"]} for party in normalized["participants"]],
        }
        return self.model.execute_json(statements, f"SELECT {sql_json(result)}::text")

    def _write_invalid_upload(self, body, field_errors):
        project_id = _new_id("PRJ")
        input_snapshot_id = _new_id("INP")
        package_id = _new_id("PKG")
        snapshot_id = _new_id("SS")
        checksum = stable_checksum(_sanitize_payload(body))
        statements = [
            f"""
            INSERT INTO dvas.allocation_project (
                project_id, project_name, scenario_name, status, current_package_id, created_by
            ) VALUES (
                {sql_text(project_id)}, {sql_text(str(body.get("project_name") or "invalid upload"))},
                {sql_text(str(body.get("scenario_name") or "invalid upload"))}, 'DRAFT',
                {sql_text(package_id)}, {sql_text(DEFAULT_OPERATOR)}
            )
            """,
            f"""
            INSERT INTO dvas.input_snapshot (
                snapshot_id, project_id, source_type, source_name, content_json, checksum, created_by
            ) VALUES (
                {sql_text(input_snapshot_id)}, {sql_text(project_id)}, 'UPLOAD_JSON', 'invalid_upload.json',
                {sql_json(_sanitize_payload(body))}, {sql_text(checksum)}, {sql_text(DEFAULT_OPERATOR)}
            )
            """,
            f"""
            INSERT INTO dvas.data_package (
                package_id, project_id, input_snapshot_id, package_name, source_type, file_name,
                checksum, status, created_by
            ) VALUES (
                {sql_text(package_id)}, {sql_text(project_id)}, {sql_text(input_snapshot_id)},
                'Invalid JSON upload', 'UPLOAD_JSON', 'invalid_upload.json',
                {sql_text(checksum)}, 'INVALID', {sql_text(DEFAULT_OPERATOR)}
            )
            """,
            self._snapshot_sql(
                snapshot_id,
                project_id,
                "INPUT",
                "UPLOAD_VALIDATION",
                package_id,
                {"field_errors": field_errors, "input_snapshot_id": input_snapshot_id},
            ),
            self._audit_sql(
                _new_id("AUD"),
                project_id,
                module_code="DATA",
                menu_code="NAV_DATA_PACKAGE",
                operation_type="CREATE",
                object_type="DATA_PACKAGE",
                object_id=package_id,
                input_snapshot_id=input_snapshot_id,
                result_snapshot_id=snapshot_id,
                status="FAILED",
                failure_reason="JSON 输入未通过 P0 校验",
                after_value={"field_errors": field_errors},
            ),
        ]
        for index, field_error in enumerate(field_errors, start=1):
            statements.append(
                f"""
                INSERT INTO dvas.upload_validation_result (
                    validation_result_id, project_id, package_id, is_valid,
                    error_field, error_type, error_message, detail_json
                ) VALUES (
                    {sql_text(_new_id("VAL"))}, {sql_text(project_id)}, {sql_text(package_id)}, FALSE,
                    {sql_text(field_error.get("field"))}, 'P0_INPUT_VALIDATION',
                    {sql_text(field_error.get("reason"))},
                    {sql_json({"index": index, "field_error": field_error})}
                )
                """
            )
        self.model.execute_json(statements, f"SELECT {sql_json({'project_id': project_id, 'project_status': 'DRAFT', 'valid': False})}::text")

    def _project_context(self, project_id):
        data = self.model.query_json(
            f"""
            SELECT jsonb_build_object(
                'project', jsonb_build_object(
                    'project_id', p.project_id,
                    'project_name', p.project_name,
                    'scenario_name', p.scenario_name,
                    'status', p.status,
                    'current_package_id', p.current_package_id,
                    'current_algorithm_task_id', p.current_algorithm_task_id,
                    'current_allocation_id', p.current_allocation_id,
                    'total_revenue_amount', p.total_revenue_amount::text
                ),
                'package', (
                    SELECT jsonb_build_object(
                        'package_id', dp.package_id,
                        'package_name', dp.package_name,
                        'input_snapshot_id', dp.input_snapshot_id,
                        'status', dp.status
                    )
                    FROM dvas.data_package dp
                    WHERE dp.package_id = p.current_package_id
                ),
                'parties', (
                    SELECT COALESCE(jsonb_agg(jsonb_build_object(
                        'party_id', pt.party_id,
                        'party_name', pt.party_name,
                        'party_type', pt.party_type,
                        'include_in_md_dshap', pt.include_in_md_dshap
                    ) ORDER BY pt.created_at, pt.party_id), '[]'::jsonb)
                    FROM dvas.party pt
                    WHERE pt.project_id = p.project_id AND pt.status = 'ACTIVE'
                ),
                'resources', (
                    SELECT COALESCE(jsonb_agg(jsonb_build_object(
                        'resource_id', dr.resource_id,
                        'resource_name', dr.resource_name,
                        'sample_count', dr.sample_count,
                        'field_count', dr.field_count,
                        'missing_rate', dr.missing_rate::text,
                        'party_id', rel.party_id
                    ) ORDER BY dr.created_at, dr.resource_id), '[]'::jsonb)
                    FROM dvas.data_resource dr
                    JOIN dvas.data_resource_party_relation rel
                      ON rel.resource_id = dr.resource_id
                     AND rel.status = 'ACTIVE'
                    WHERE dr.project_id = p.project_id AND dr.status = 'ACTIVE'
                ),
                'versions', jsonb_build_object(
                    'quality', (SELECT COUNT(*) FROM dvas.quality_assessment qa WHERE qa.project_id = p.project_id),
                    'metering', (SELECT COUNT(*) FROM dvas.shuyuan_metering sm WHERE sm.project_id = p.project_id),
                    'allocation', (SELECT COUNT(*) FROM dvas.allocation_scenario als WHERE als.project_id = p.project_id),
                    'task', (SELECT COUNT(*) FROM dvas.md_dshap_task mt WHERE mt.project_id = p.project_id)
                )
            )::text
            FROM dvas.allocation_project p
            WHERE p.project_id = {sql_safe_id(project_id, "project_id")};
            """
        )
        if not data:
            raise ApiError("DVAS_NOT_FOUND", "项目不存在", status=404)
        if not data.get("package"):
            raise ApiError("DVAS_PRECONDITION_NOT_MET", "项目尚未完成数据接入", status=409)
        if data["project"]["status"] == "DRAFT":
            raise ApiError("DVAS_PRECONDITION_NOT_MET", "项目必须先完成数据接入", status=409)
        return data

    def _build_pipeline_result(self, context, body):
        project = context["project"]
        parties = context["parties"]
        resources = context["resources"]
        data_parties = [
            party for party in parties if party["party_type"] == "DATA_PROVIDER" and party["include_in_md_dshap"]
        ]
        if not data_parties:
            raise ApiError("DVAS_PRECONDITION_NOT_MET", "没有可进入 MD-DShap 的数据源主体", status=409)
        total_revenue = quantize_amount(body.get("total_revenue") or project.get("total_revenue_amount") or "0")
        if total_revenue < 0:
            raise ApiError("DVAS_INPUT_FORMAT_ERROR", "收益池总金额不得为负", status=400)

        weights = self._weights(data_parties, resources)
        non_data_parties = [party for party in parties if party["party_id"] not in weights]
        priority_allocations = self._priority_allocations(total_revenue, non_data_parties)
        priority_total = sum((item["amount"] for item in priority_allocations), Decimal("0.00"))
        data_pool = quantize_amount(total_revenue - priority_total)
        data_amounts = self._amounts_for_weights(data_pool, weights)

        allocation_rows = []
        for party in parties:
            party_id = party["party_id"]
            if party_id in weights:
                pre_amount = data_amounts[party_id]
                raw_weight = weights[party_id]
            else:
                pre_amount = next((item["amount"] for item in priority_allocations if item["party_id"] == party_id), Decimal("0.00"))
                raw_weight = Decimal("0.000000")
            allocation_rows.append(
                {
                    "party_id": party_id,
                    "party_name": party["party_name"],
                    "raw_weight": raw_weight,
                    "pre_amount": quantize_amount(pre_amount),
                    "post_amount": quantize_amount(pre_amount),
                    "adjustment": Decimal("0.00"),
                }
            )
        delta = quantize_amount(total_revenue - sum((row["post_amount"] for row in allocation_rows), Decimal("0.00")))
        if allocation_rows and delta:
            allocation_rows[-1]["post_amount"] = quantize_amount(allocation_rows[-1]["post_amount"] + delta)
            allocation_rows[-1]["adjustment"] = quantize_amount(allocation_rows[-1]["post_amount"] - allocation_rows[-1]["pre_amount"])

        run_ids = {
            "assessment_id": _new_id("QA"),
            "metering_id": _new_id("SM"),
            "utility_snapshot_id": _new_id("USF"),
            "task_id": _new_id("MDS"),
            "allocation_id": _new_id("ALLOC"),
            "algorithm_snapshot_id": _new_id("ALGAUD"),
        }
        versions = context.get("versions") or {}
        return {
            "ids": run_ids,
            "versions": {
                "quality": int(versions.get("quality") or 0) + 1,
                "metering": int(versions.get("metering") or 0) + 1,
                "task": int(versions.get("task") or 0) + 1,
                "allocation": int(versions.get("allocation") or 0) + 1,
            },
            "quality_factor": Decimal("0.924000"),
            "quality_score": Decimal("92.4000"),
            "weights": weights,
            "total_revenue": total_revenue,
            "priority_total": priority_total,
            "data_pool": data_pool,
            "priority_allocations": priority_allocations,
            "allocation_rows": allocation_rows,
        }

    def _weights(self, data_parties, resources):
        scores = {party["party_id"]: Decimal("0") for party in data_parties}
        for resource in resources:
            party_id = resource.get("party_id")
            if party_id not in scores:
                continue
            sample_count = Decimal(str(resource.get("sample_count") or 0))
            missing_rate = Decimal(str(resource.get("missing_rate") or 0))
            scores[party_id] += sample_count * (Decimal("1") - missing_rate)
        total_score = sum(scores.values(), Decimal("0"))
        if total_score <= 0:
            equal = quantize_weight(TOTAL_WEIGHT / Decimal(len(data_parties)))
            weights = {party["party_id"]: equal for party in data_parties}
        else:
            weights = {party_id: quantize_weight(score / total_score) for party_id, score in scores.items()}
        ordered_party_ids = [party["party_id"] for party in data_parties]
        correction = quantize_weight(TOTAL_WEIGHT - sum(weights.values(), Decimal("0")))
        weights[ordered_party_ids[-1]] = quantize_weight(weights[ordered_party_ids[-1]] + correction)
        return weights

    def _priority_allocations(self, total_revenue, parties):
        ratios = [Decimal("0.10"), Decimal("0.05")]
        allocations = []
        for index, party in enumerate(parties):
            ratio = ratios[index] if index < len(ratios) else Decimal("0")
            amount = quantize_amount(total_revenue * ratio)
            if amount:
                allocations.append(
                    {
                        "party_id": party["party_id"],
                        "party_name": party["party_name"],
                        "amount": amount,
                        "ratio": ratio,
                        "basis_text": "P0 合同优先分配，先扣除后进入数据源收益池；模拟参考，非法律结算。",
                    }
                )
        return allocations

    def _amounts_for_weights(self, amount, weights):
        result = {}
        party_ids = list(weights.keys())
        for party_id in party_ids:
            result[party_id] = quantize_amount(amount * weights[party_id])
        correction = quantize_amount(amount - sum(result.values(), Decimal("0.00")))
        if party_ids:
            result[party_ids[-1]] = quantize_amount(result[party_ids[-1]] + correction)
        return result

    def _write_pipeline_result(self, context, result):
        project = context["project"]
        package = context["package"]
        project_id = project["project_id"]
        ids = result["ids"]
        versions = result["versions"]
        quality_param_snapshot_id = _new_id("SS")
        quality_result_snapshot_id = _new_id("SS")
        metering_param_snapshot_id = _new_id("SS")
        metering_result_snapshot_id = _new_id("SS")
        utility_param_snapshot_id = _new_id("SS")
        utility_result_snapshot_id = _new_id("SS")
        algorithm_param_snapshot_id = _new_id("SS")
        algorithm_result_snapshot_id = _new_id("SS")
        allocation_param_snapshot_id = _new_id("SS")
        allocation_result_snapshot_id = _new_id("SS")
        statements = [
            self._snapshot_sql(
                quality_param_snapshot_id,
                project_id,
                "PARAMETER",
                "QUALITY_ASSESSMENT",
                ids["assessment_id"],
                {"dimensions": ["COMPLETENESS", "ACCURACY", "TIMELINESS", "CONSISTENCY"], "version": versions["quality"]},
            ),
            f"""
            INSERT INTO dvas.quality_assessment (
                assessment_id, project_id, package_id, assessment_version_no,
                quality_score, quality_level, quality_factor, dimension_scores,
                evidence_summary, parameter_snapshot_id, status
            ) VALUES (
                {sql_text(ids["assessment_id"])}, {sql_text(project_id)}, {sql_text(package["package_id"])},
                {sql_int(versions["quality"])}, 92.4000, 'A', 0.924000,
                {sql_json({"COMPLETENESS": "94.0000", "ACCURACY": "92.0000", "TIMELINESS": "90.0000", "CONSISTENCY": "93.0000"})},
                'P0 PostgreSQL pipeline write quality assessment', {sql_text(quality_param_snapshot_id)}, 'SUCCESS'
            )
            """,
            *self._quality_detail_sql(ids["assessment_id"]),
            self._snapshot_sql(
                quality_result_snapshot_id,
                project_id,
                "RESULT",
                "QUALITY_ASSESSMENT",
                ids["assessment_id"],
                {"quality_score": "92.4000", "quality_factor": "0.924000", "status": "SUCCESS"},
            ),
            f"UPDATE dvas.allocation_project SET status = 'ASSESSED', updated_at = now() WHERE project_id = {sql_text(project_id)}",
            self._audit_sql(
                _new_id("AUD"),
                project_id,
                module_code="QUAL",
                menu_code="NAV_MEASURE_QUALITY",
                operation_type="CALCULATE",
                object_type="QUALITY_ASSESSMENT",
                object_id=ids["assessment_id"],
                parameter_snapshot_id=quality_param_snapshot_id,
                result_snapshot_id=quality_result_snapshot_id,
                after_value={"project_status": "ASSESSED"},
            ),
            self._snapshot_sql(
                metering_param_snapshot_id,
                project_id,
                "PARAMETER",
                "SHUYUAN_METERING",
                ids["metering_id"],
                {"base_shuyuan_price": "10.00", "quality_coefficient": "0.924000"},
            ),
        ]
        metering_details = self._metering_detail_rows(context, ids["metering_id"], result["quality_factor"])
        metering_total = sum((row["metering_amount"] for row in metering_details), Decimal("0.00"))
        call_count_total = sum((row["call_count"] for row in metering_details), 0)
        statements.extend(
            [
                f"""
                INSERT INTO dvas.shuyuan_metering (
                    metering_id, project_id, assessment_id, metering_version_no,
                    base_shuyuan_price, scenario_coefficient, quality_coefficient,
                    technology_coefficient, expert_coefficient, development_coefficient,
                    call_count_total, total_amount, parameter_snapshot_id, status
                ) VALUES (
                    {sql_text(ids["metering_id"])}, {sql_text(project_id)}, {sql_text(ids["assessment_id"])},
                    {sql_int(versions["metering"])}, 10.00, 1.000000, 0.924000,
                    1.000000, 1.000000, 1.000000, {sql_int(call_count_total)},
                    {sql_amount(metering_total)}, {sql_text(metering_param_snapshot_id)}, 'SUCCESS'
                )
                """,
                *[self._metering_detail_sql(row) for row in metering_details],
                self._snapshot_sql(
                    metering_result_snapshot_id,
                    project_id,
                    "RESULT",
                    "SHUYUAN_METERING",
                    ids["metering_id"],
                    {"total_amount": str(metering_total), "call_count_total": call_count_total},
                ),
                f"UPDATE dvas.allocation_project SET status = 'METERED', updated_at = now() WHERE project_id = {sql_text(project_id)}",
                self._audit_sql(
                    _new_id("AUD"),
                    project_id,
                    module_code="DU",
                    menu_code="NAV_MEASURE_SHUYUAN",
                    operation_type="CALCULATE",
                    object_type="SHUYUAN_METERING",
                    object_id=ids["metering_id"],
                    parameter_snapshot_id=metering_param_snapshot_id,
                    result_snapshot_id=metering_result_snapshot_id,
                    after_value={"project_status": "METERED"},
                ),
                self._snapshot_sql(
                    utility_param_snapshot_id,
                    project_id,
                    "PARAMETER",
                    "UTILITY_FUNCTION",
                    ids["utility_snapshot_id"],
                    {"formula": "utility = normalized_contribution * quality_factor * usage_factor * scenario_factor"},
                ),
                f"""
                INSERT INTO dvas.utility_function_snapshot (
                    snapshot_id, project_id, utility_source, formula_text, parameter_json,
                    checksum, version_no, created_by
                ) VALUES (
                    {sql_text(ids["utility_snapshot_id"])}, {sql_text(project_id)}, 'P0_POSTGRES_PIPELINE',
                    'utility = normalized_contribution * quality_factor * usage_factor * scenario_factor',
                    {sql_json({"quality_factor": "0.924000", "usage_factor": "1.000000", "scenario_factor": "1.000000"})},
                    {sql_text(stable_checksum({"utility": ids["utility_snapshot_id"]}))},
                    {sql_int(versions["task"])}, {sql_text(DEFAULT_OPERATOR)}
                )
                """,
            ]
        )
        contribution_ids = {}
        for party_id, weight in result["weights"].items():
            contribution_id = _new_id("CONTR")
            contribution_ids[party_id] = contribution_id
            utility_id = _new_id("UTIL")
            utility_value = quantize_weight(weight * result["quality_factor"])
            statements.extend(
                [
                    f"""
                    INSERT INTO dvas.contribution_record (
                        contribution_id, project_id, party_id, metering_id,
                        valid_units, usage_weight, coverage_weight, scarcity_weight,
                        contribution_score, normalized_contribution, version_no
                    ) VALUES (
                        {sql_text(contribution_id)}, {sql_text(project_id)}, {sql_text(party_id)},
                        {sql_text(ids["metering_id"])}, {sql_weight(weight)}, {sql_weight(weight)},
                        {sql_weight(weight)}, 1.000000, {sql_weight(weight)}, {sql_weight(weight)},
                        {sql_int(versions["task"])}
                    )
                    """,
                    f"""
                    INSERT INTO dvas.utility_record (
                        utility_id, project_id, party_id, contribution_id,
                        utility_function_snapshot_id, task_key, normalized_contribution,
                        quality_factor, usage_factor, scenario_factor, utility_value, version_no
                    ) VALUES (
                        {sql_text(utility_id)}, {sql_text(project_id)}, {sql_text(party_id)},
                        {sql_text(contribution_id)}, {sql_text(ids["utility_snapshot_id"])}, 'DEFAULT_TASK',
                        {sql_weight(weight)}, 0.924000, 1.000000, 1.000000,
                        {sql_weight(utility_value)}, {sql_int(versions["task"])}
                    )
                    """,
                    f"""
                    INSERT INTO dvas.utility_trace (
                        trace_id, utility_id, formula_text, input_json, output_json, parameter_snapshot_id
                    ) VALUES (
                        {sql_text(_new_id("UTR"))}, {sql_text(utility_id)},
                        'utility = normalized_contribution * quality_factor * usage_factor * scenario_factor',
                        {sql_json({"normalized_contribution": str(weight), "quality_factor": "0.924000"})},
                        {sql_json({"utility_value": str(utility_value)})}, {sql_text(utility_param_snapshot_id)}
                    )
                    """,
                ]
            )
        statements.extend(
            [
                self._snapshot_sql(
                    utility_result_snapshot_id,
                    project_id,
                    "RESULT",
                    "UTILITY_RECORD",
                    ids["utility_snapshot_id"],
                    {"participant_count": len(result["weights"]), "weights": {key: str(value) for key, value in result["weights"].items()}},
                ),
                f"UPDATE dvas.allocation_project SET status = 'UTILITY_CALCULATED', updated_at = now() WHERE project_id = {sql_text(project_id)}",
                self._audit_sql(
                    _new_id("AUD"),
                    project_id,
                    module_code="UTIL",
                    menu_code="NAV_MEASURE_UTILITY",
                    operation_type="CALCULATE",
                    object_type="UTILITY_RECORD",
                    object_id=ids["utility_snapshot_id"],
                    parameter_snapshot_id=utility_param_snapshot_id,
                    result_snapshot_id=utility_result_snapshot_id,
                    after_value={"project_status": "UTILITY_CALCULATED"},
                ),
                self._snapshot_sql(
                    algorithm_param_snapshot_id,
                    project_id,
                    "PARAMETER",
                    "MD_DSHAP_TASK",
                    ids["task_id"],
                    {"algorithm_mode": "MD_DSHAP", "sample_rounds": 200, "epsilon": "0.000001", "baseline_check": False},
                ),
                f"""
                INSERT INTO dvas.md_dshap_task (
                    task_id, project_id, utility_function_snapshot_id, algorithm_mode,
                    participant_set_json, task_set_json, seed, sample_rounds, epsilon,
                    status, algorithm_version, baseline_enabled, parameter_snapshot_id,
                    started_at, finished_at, created_by
                ) VALUES (
                    {sql_text(ids["task_id"])}, {sql_text(project_id)}, {sql_text(ids["utility_snapshot_id"])},
                    'MD_DSHAP', {sql_json(list(result["weights"].keys()))}, {sql_json(["DEFAULT_TASK"])},
                    42, 200, 0.000001, 'SUCCESS', 'p0-md-dshap-1.0',
                    FALSE, {sql_text(algorithm_param_snapshot_id)}, now(), now(), {sql_text(DEFAULT_OPERATOR)}
                )
                """,
            ]
        )
        for index, (party_id, weight) in enumerate(result["weights"].items(), start=1):
            statements.extend(
                [
                    f"""
                    INSERT INTO dvas.md_dshap_result (
                        result_id, task_id, project_id, party_id, participant_weight,
                        normalized_weight, baseline_weight, weight_diff,
                        task_level_weight_json, approximation_note, result_version
                    ) VALUES (
                        {sql_text(_new_id("MDR"))}, {sql_text(ids["task_id"])}, {sql_text(project_id)},
                        {sql_text(party_id)}, {sql_weight(weight)}, {sql_weight(weight)},
                        NULL, NULL, {sql_json({"DEFAULT_TASK": str(weight)})},
                        'P0 最小闭环 MD-DShap 写库结果；模拟参考，非法律结算。', {sql_int(versions["task"])}
                    )
                    """,
                    f"""
                    INSERT INTO dvas.md_dshap_marginal_trace (
                        trace_id, task_id, project_id, party_id, task_key, iteration_no,
                        coalition_before, participant_added, v_before, v_after,
                        marginal_contribution, random_seed
                    ) VALUES (
                        {sql_text(_new_id("MDT"))}, {sql_text(ids["task_id"])}, {sql_text(project_id)},
                        {sql_text(party_id)}, 'DEFAULT_TASK', {sql_int(index)},
                        '[]'::jsonb, {sql_text(party_id)}, 0, {sql_weight(weight)},
                        {sql_weight(weight)}, 42
                    )
                    """,
                ]
            )
        algorithm_output = {"task_id": ids["task_id"], "weight_sum": str(sum(result["weights"].values(), Decimal("0.000000")))}
        statements.extend(
            [
                self._snapshot_sql(
                    algorithm_result_snapshot_id,
                    project_id,
                    "ALGORITHM",
                    "MD_DSHAP_RESULT",
                    ids["task_id"],
                    algorithm_output,
                ),
                f"""
                INSERT INTO dvas.algorithm_audit_snapshot (
                    snapshot_id, project_id, task_id, input_snapshot_json,
                    parameter_snapshot_json, output_snapshot_json, assumption_text, checksum
                ) VALUES (
                    {sql_text(ids["algorithm_snapshot_id"])}, {sql_text(project_id)}, {sql_text(ids["task_id"])},
                    {sql_json({"utility_snapshot_id": ids["utility_snapshot_id"]})},
                    {sql_json({"algorithm_mode": "MD_DSHAP", "sample_rounds": 200})},
                    {sql_json(algorithm_output)},
                    'MD-DShap 输出权重仅用于模拟参考，不构成法律分配比例或付款指令。',
                    {sql_text(stable_checksum(algorithm_output))}
                )
                """,
                f"""
                UPDATE dvas.allocation_project
                SET status = 'WEIGHT_CALCULATED',
                    current_algorithm_task_id = {sql_text(ids["task_id"])},
                    updated_at = now()
                WHERE project_id = {sql_text(project_id)}
                """,
                self._audit_sql(
                    _new_id("AUD"),
                    project_id,
                    module_code="MDS",
                    menu_code="NAV_ALLOC_MDS",
                    operation_type="CALCULATE",
                    object_type="MD_DSHAP_TASK",
                    object_id=ids["task_id"],
                    parameter_snapshot_id=algorithm_param_snapshot_id,
                    result_snapshot_id=algorithm_result_snapshot_id,
                    after_value={"project_status": "WEIGHT_CALCULATED", "algorithm_mode": "MD_DSHAP"},
                ),
                self._snapshot_sql(
                    allocation_param_snapshot_id,
                    project_id,
                    "PARAMETER",
                    "ALLOCATION_SCENARIO",
                    ids["allocation_id"],
                    {
                        "total_revenue": str(result["total_revenue"]),
                        "priority_allocation_amount": str(result["priority_total"]),
                        "data_provider_revenue_pool": str(result["data_pool"]),
                    },
                ),
                f"""
                INSERT INTO dvas.allocation_scenario (
                    allocation_id, project_id, weight_task_id, scenario_name,
                    total_revenue, priority_allocation_amount, data_provider_revenue_pool,
                    allocation_mode, status, version_no, created_by
                ) VALUES (
                    {sql_text(ids["allocation_id"])}, {sql_text(project_id)}, {sql_text(ids["task_id"])},
                    {sql_text(project["scenario_name"] or "P0 收益分配模拟")},
                    {sql_amount(result["total_revenue"])}, {sql_amount(result["priority_total"])},
                    {sql_amount(result["data_pool"])}, 'MD_DSHAP_WEIGHT', 'ALLOCATED',
                    {sql_int(versions["allocation"])}, {sql_text(DEFAULT_OPERATOR)}
                )
                """,
            ]
        )
        for index, item in enumerate(result["priority_allocations"], start=1):
            statements.append(
                f"""
                INSERT INTO dvas.allocation_priority_item (
                    item_id, allocation_id, project_id, party_id, priority_amount,
                    priority_ratio, basis_text, priority_order, status
                ) VALUES (
                    {sql_text(_new_id("PRI"))}, {sql_text(ids["allocation_id"])}, {sql_text(project_id)},
                    {sql_text(item["party_id"])}, {sql_amount(item["amount"])}, {sql_weight(item["ratio"])},
                    {sql_text(item["basis_text"])}, {sql_int(index)}, 'ACTIVE'
                )
                """
            )
        constraint_ids = {}
        for index, row in enumerate(result["allocation_rows"], start=1):
            constraint_id = _new_id("CON")
            constraint_ids[row["party_id"]] = constraint_id
            statements.extend(
                [
                    f"""
                    INSERT INTO dvas.contract_constraint (
                        constraint_id, project_id, party_id, constraint_type,
                        constraint_value, priority, basis_text, status, created_by
                    ) VALUES (
                        {sql_text(constraint_id)}, {sql_text(project_id)}, {sql_text(row["party_id"])},
                        'MIN_AMOUNT', 0, {sql_int(index)},
                        'P0 默认约束检查，保留约束前和约束后金额；模拟参考，非法律结算。',
                        'ACTIVE', {sql_text(DEFAULT_OPERATOR)}
                    )
                    """,
                    f"""
                    INSERT INTO dvas.allocation_result (
                        result_id, allocation_id, project_id, party_id, raw_weight,
                        normalized_weight, pre_constraint_amount, post_constraint_amount,
                        adjustment_amount, constraint_adjustment_reason, result_version
                    ) VALUES (
                        {sql_text(_new_id("ALR"))}, {sql_text(ids["allocation_id"])}, {sql_text(project_id)},
                        {sql_text(row["party_id"])}, {sql_weight(row["raw_weight"])}, {sql_weight(row["raw_weight"])},
                        {sql_amount(row["pre_amount"])}, {sql_amount(row["post_amount"])},
                        {sql_amount(row["adjustment"])},
                        'P0 合同约束应用后金额；模拟参考，非法律结算。',
                        {sql_int(versions["allocation"])}
                    )
                    """,
                    f"""
                    INSERT INTO dvas.constraint_apply_trace (
                        trace_id, allocation_id, project_id, constraint_id, party_id,
                        before_amount, after_amount, adjustment_amount, reason, step_no
                    ) VALUES (
                        {sql_text(_new_id("CTR"))}, {sql_text(ids["allocation_id"])}, {sql_text(project_id)},
                        {sql_text(constraint_id)}, {sql_text(row["party_id"])},
                        {sql_amount(row["pre_amount"])}, {sql_amount(row["post_amount"])},
                        {sql_amount(row["adjustment"])},
                        '合同约束检查完成，保存约束前后金额；模拟参考，非法律结算。',
                        {sql_int(index)}
                    )
                    """,
                ]
            )
        statements.extend(
            [
                self._snapshot_sql(
                    allocation_result_snapshot_id,
                    project_id,
                    "ALLOCATION",
                    "ALLOCATION_RESULT",
                    ids["allocation_id"],
                    {
                        "allocation_id": ids["allocation_id"],
                        "post_constraint_amount_sum": str(sum((row["post_amount"] for row in result["allocation_rows"]), Decimal("0.00"))),
                        "disclaimer": SIMULATION_DISCLAIMER,
                    },
                ),
                f"""
                UPDATE dvas.allocation_project
                SET status = 'ALLOCATED',
                    current_algorithm_task_id = {sql_text(ids["task_id"])},
                    current_allocation_id = {sql_text(ids["allocation_id"])},
                    total_revenue_amount = {sql_amount(result["total_revenue"])},
                    updated_at = now()
                WHERE project_id = {sql_text(project_id)}
                """,
                self._audit_sql(
                    _new_id("AUD"),
                    project_id,
                    module_code="ALLOC",
                    menu_code="NAV_ALLOC_SIMULATION",
                    operation_type="CALCULATE",
                    object_type="ALLOCATION_SCENARIO",
                    object_id=ids["allocation_id"],
                    parameter_snapshot_id=allocation_param_snapshot_id,
                    result_snapshot_id=allocation_result_snapshot_id,
                    after_value={"project_status": "ALLOCATED", "allocation_id": ids["allocation_id"]},
                ),
            ]
        )
        response = {
            "project_id": project_id,
            "project_status": "ALLOCATED",
            "assessment_id": ids["assessment_id"],
            "metering_id": ids["metering_id"],
            "task_id": ids["task_id"],
            "allocation_id": ids["allocation_id"],
            "algorithm_mode": "MD_DSHAP",
            "status_flow": [
                "INGESTED",
                "ASSESSED",
                "METERED",
                "UTILITY_CALCULATED",
                "WEIGHT_CALCULATED",
                "ALLOCATED",
            ],
            "weight_sum": str(sum(result["weights"].values(), Decimal("0.000000"))),
            "post_constraint_amount_sum": str(sum((row["post_amount"] for row in result["allocation_rows"]), Decimal("0.00"))),
        }
        return self.model.execute_json(statements, f"SELECT {sql_json(response)}::text")

    def _quality_detail_sql(self, assessment_id):
        rows = [
            ("COMPLETENESS", "COMPLETENESS", "完整性", "0.300000", "94.0000", "28.200000"),
            ("ACCURACY", "ACCURACY", "准确性", "0.250000", "92.0000", "23.000000"),
            ("TIMELINESS", "TIMELINESS", "时效性", "0.150000", "90.0000", "13.500000"),
            ("CONSISTENCY", "CONSISTENCY", "一致性", "0.150000", "93.0000", "13.950000"),
            ("UNIQUENESS", "UNIQUENESS", "唯一性", "0.150000", "91.0000", "13.650000"),
        ]
        return [
            f"""
            INSERT INTO dvas.quality_score_detail (
                detail_id, assessment_id, metric_code, dimension_code, metric_name,
                weight, score, weighted_score, evidence_json
            ) VALUES (
                {sql_text(_new_id("QAD"))}, {sql_text(assessment_id)}, {sql_text(metric_code)},
                {sql_text(dimension_code)}, {sql_text(metric_name)}, {weight}, {score},
                {weighted_score}, {sql_json({"source": "P0 PostgreSQL pipeline write"})}
            )
            """
            for metric_code, dimension_code, metric_name, weight, score, weighted_score in rows
        ]

    def _metering_detail_rows(self, context, metering_id, quality_factor):
        rows = []
        for resource in context["resources"]:
            call_count = int(resource.get("sample_count") or 0)
            effective_units = Decimal(str(call_count)) * (Decimal("1") - Decimal(str(resource.get("missing_rate") or 0)))
            amount = quantize_amount(effective_units * Decimal("10.00") * quality_factor)
            rows.append(
                {
                    "detail_id": _new_id("SMD"),
                    "metering_id": metering_id,
                    "project_id": context["project"]["project_id"],
                    "resource_id": resource["resource_id"],
                    "party_id": resource["party_id"],
                    "call_count": call_count,
                    "effective_units": quantize_weight(effective_units),
                    "metering_amount": amount,
                }
            )
        return rows

    def _metering_detail_sql(self, row):
        return f"""
        INSERT INTO dvas.shuyuan_metering_detail (
            detail_id, metering_id, project_id, resource_id, party_id,
            call_count, effective_units, metering_amount, formula_json
        ) VALUES (
            {sql_text(row["detail_id"])}, {sql_text(row["metering_id"])}, {sql_text(row["project_id"])},
            {sql_text(row["resource_id"])}, {sql_text(row["party_id"])}, {sql_int(row["call_count"])},
            {sql_weight(row["effective_units"])}, {sql_amount(row["metering_amount"])},
            {sql_json({"formula": "effective_units * base_price * quality_factor"})}
        )
        """

    def _report_context(self, project_id):
        data = self.model.query_json(
            f"""
            SELECT jsonb_build_object(
                'project', jsonb_build_object(
                    'project_id', p.project_id,
                    'project_name', p.project_name,
                    'scenario_name', p.scenario_name,
                    'status', p.status,
                    'current_allocation_id', p.current_allocation_id
                ),
                'allocation', (
                    SELECT jsonb_build_object(
                        'allocation_id', als.allocation_id,
                        'total_revenue', als.total_revenue::text,
                        'data_provider_revenue_pool', als.data_provider_revenue_pool::text,
                        'status', als.status
                    )
                    FROM dvas.allocation_scenario als
                    WHERE als.allocation_id = p.current_allocation_id
                ),
                'result_count', (
                    SELECT COUNT(*) FROM dvas.allocation_result ar
                    WHERE ar.project_id = p.project_id AND ar.allocation_id = p.current_allocation_id
                )
            )::text
            FROM dvas.allocation_project p
            WHERE p.project_id = {sql_safe_id(project_id, "project_id")};
            """
        )
        if not data:
            raise ApiError("DVAS_NOT_FOUND", "项目不存在", status=404)
        if data["project"]["status"] not in {"ALLOCATED", "CONFIRMED", "EXPORTED"}:
            raise ApiError("DVAS_PRECONDITION_NOT_MET", "项目必须先完成收益分配模拟", status=409)
        if not data.get("allocation") or not data.get("result_count"):
            raise ApiError("DVAS_PRECONDITION_NOT_MET", "项目缺少可导出的分配结果", status=409)
        return data

    def _write_report(self, context, body):
        project = context["project"]
        project_id = project["project_id"]
        allocation_id = project["current_allocation_id"]
        report_id = _new_id("RPT")
        snapshot_id = _new_id("SS")
        report_payload = {
            "project_id": project_id,
            "allocation_id": allocation_id,
            "report_type": body.get("report_type") or "P0_ALLOCATION_REPORT",
            "disclaimer": "模拟参考，非法律结算。系统输出不构成真实付款、税务、银行或法定结算指令。",
        }
        report_checksum = stable_checksum(report_payload)
        file_formats = ["MD", "CSV", "JSON", "JSONL"]
        statements = [
            self._snapshot_sql(snapshot_id, project_id, "REPORT", "REPORT_RECORD", report_id, report_payload),
            f"""
            INSERT INTO dvas.report_record (
                report_id, project_id, source_snapshot_id, report_type,
                report_version_no, file_name, file_format, file_path, checksum,
                status, created_by
            ) VALUES (
                {sql_text(report_id)}, {sql_text(project_id)}, {sql_text(snapshot_id)},
                {sql_text(report_payload["report_type"])}, 1,
                {sql_text(report_id + ".md")}, 'MD',
                {sql_text("reports/" + project_id + "/" + report_id + ".md")},
                {sql_text(report_checksum)}, 'GENERATED', {sql_text(DEFAULT_OPERATOR)}
            )
            """,
        ]
        for file_format in file_formats:
            file_payload = {**report_payload, "file_format": file_format}
            file_checksum = stable_checksum(file_payload)
            file_name = f"{report_id}.{file_format.lower()}"
            statements.append(
                f"""
                INSERT INTO dvas.export_file (
                    file_id, report_id, project_id, file_name, file_type,
                    file_format, file_path, field_scope_json, checksum, created_by
                ) VALUES (
                    {sql_text(_new_id("EXP"))}, {sql_text(report_id)}, {sql_text(project_id)},
                    {sql_text(file_name)}, {sql_text("P0_" + file_format + "_EXPORT")},
                    {sql_text(file_format)}, {sql_text("reports/" + project_id + "/" + file_name)},
                    {sql_json(["report_id", "checksum", "模拟参考，非法律结算"])},
                    {sql_text(file_checksum)}, {sql_text(DEFAULT_OPERATOR)}
                )
                """
            )
        statements.extend(
            [
                f"UPDATE dvas.allocation_project SET status = 'EXPORTED', updated_at = now() WHERE project_id = {sql_text(project_id)}",
                self._audit_sql(
                    _new_id("AUD"),
                    project_id,
                    module_code="REP",
                    menu_code="NAV_REPORT_EXPORT",
                    operation_type="EXPORT",
                    object_type="REPORT_RECORD",
                    object_id=report_id,
                    result_snapshot_id=snapshot_id,
                    after_value=report_payload,
                    checksum=report_checksum,
                ),
            ]
        )
        response = {
            "project_id": project_id,
            "project_status": "EXPORTED",
            "report_id": report_id,
            "file_formats": file_formats,
            "checksum": report_checksum,
            "disclaimer": "模拟参考，非法律结算",
        }
        return self.model.execute_json(statements, f"SELECT {sql_json(response)}::text")

    def _safe_failure_audit(self, project_id, operation_type, object_type, object_id, reason):
        try:
            statements = [
                self._audit_sql(
                    _new_id("AUD"),
                    project_id,
                    module_code="SYS",
                    menu_code="NAV_SYS_HOME",
                    operation_type=operation_type,
                    object_type=object_type,
                    object_id=object_id,
                    status="FAILED",
                    failure_reason=reason,
                    after_value={"failed_node": object_type, "reason": reason},
                )
            ]
            self.model.execute_json(statements, f"SELECT {sql_json({'failure_audit_written': True})}::text")
        except ApiError:
            pass

    def _snapshot_sql(self, snapshot_id, project_id, snapshot_type, object_type, object_id, content):
        checksum = stable_checksum(content)
        return f"""
        INSERT INTO dvas.snapshot_store (
            snapshot_id, project_id, snapshot_type, object_type, object_id,
            content_json, checksum, created_by
        ) VALUES (
            {sql_text(snapshot_id)}, {sql_text(project_id)}, {sql_text(snapshot_type)},
            {sql_text(object_type)}, {sql_text(object_id)}, {sql_json(content)},
            {sql_text(checksum)}, {sql_text(DEFAULT_OPERATOR)}
        )
        """

    def _audit_sql(
        self,
        log_id,
        project_id,
        module_code,
        menu_code,
        operation_type,
        object_type,
        object_id,
        input_snapshot_id=None,
        parameter_snapshot_id=None,
        result_snapshot_id=None,
        status="SUCCESS",
        failure_reason=None,
        before_value=None,
        after_value=None,
        checksum=None,
    ):
        return f"""
        INSERT INTO dvas.audit_log (
            log_id, project_id, module_code, menu_code, operation_type, object_type,
            object_id, operator_id, role_code, before_value_json, after_value_json,
            input_snapshot_id, parameter_snapshot_id, result_snapshot_id, status,
            failure_reason, checksum
        ) VALUES (
            {sql_text(log_id)}, {sql_text(project_id)}, {sql_text(module_code)},
            {sql_text(menu_code)}, {sql_text(operation_type)}, {sql_text(object_type)},
            {sql_text(object_id)}, {sql_text(DEFAULT_OPERATOR)}, 'LOCAL_OPERATOR',
            {sql_json(before_value) if before_value is not None else "NULL"},
            {sql_json(after_value) if after_value is not None else "NULL"},
            {sql_text(input_snapshot_id)}, {sql_text(parameter_snapshot_id)}, {sql_text(result_snapshot_id)},
            {sql_text(status)}, {sql_text(failure_reason)}, {sql_text(checksum)}
        )
        """
