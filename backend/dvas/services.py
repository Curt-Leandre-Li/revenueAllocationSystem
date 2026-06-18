import copy

from .contracts import (
    LOCAL_OPERATOR,
    SIMULATION_DISCLAIMER,
    ApiError,
    stable_checksum,
    table_page,
    utc_now,
)
from .demo_data import get_demo_case


def write_audit(
    repository,
    module_code,
    menu_code,
    operation_type,
    object_type,
    object_id,
    status,
    failure_reason=None,
    input_snapshot_id=None,
    parameter_snapshot_id=None,
    result_snapshot_id=None,
    before_value_json=None,
    after_value_json=None,
):
    audit_log = {
        "log_id": repository.next_id("audit"),
        "project_id": repository.get_project()["project_id"],
        "module_code": module_code,
        "menu_code": menu_code,
        "operation_type": operation_type,
        "object_type": object_type,
        "object_id": object_id,
        "operator_id": LOCAL_OPERATOR,
        "before_value_json": before_value_json,
        "after_value_json": after_value_json,
        "input_snapshot_id": input_snapshot_id,
        "parameter_snapshot_id": parameter_snapshot_id,
        "result_snapshot_id": result_snapshot_id,
        "status": status,
        "failure_reason": failure_reason,
        "created_at": utc_now(),
    }
    repository.put_audit_log(audit_log)
    return audit_log


class ProjectService:
    def __init__(self, repository):
        self.repository = repository

    def current_project(self):
        return self.repository.get_project()


class DashboardService:
    def __init__(self, repository):
        self.repository = repository

    def overview(self):
        project = self.repository.get_project()
        packages = self.repository.list_data_packages()
        resources = self.repository.list_data_resources()
        parties = self.repository.list_parties()
        preconditions = self.preconditions()
        return {
            **project,
            "metrics": {
                "data_package_count": len([item for item in packages if item["status"] == "VALIDATED"]),
                "resource_count": len(resources),
                "party_count": len(parties),
                "audit_log_count": len(self.repository.list_audit_logs()),
            },
            "risk_notices": [
                "系统结果仅为模拟参考，非法律结算 / 非法定结算结果。",
                "P0 本地演示禁止上传未经脱敏的真实敏感数据。",
                "MD-DShap 属于权重层输出，不代表付款指令。",
            ],
            "next_step": self._next_step(project["project_status"]),
            "preconditions": preconditions["preconditions"],
            "available_actions": preconditions["available_actions"],
            "disabled_actions": preconditions["disabled_actions"],
        }

    def preconditions(self):
        project = self.repository.get_project()
        has_valid_package = any(
            package["status"] == "VALIDATED" for package in self.repository.list_data_packages()
        )
        has_resource_party_relation = any(
            resource.get("party_id") for resource in self.repository.list_data_resources()
        )
        preconditions = [
            {
                "code": "HAS_VALID_DATA_PACKAGE",
                "passed": has_valid_package,
                "message": "已完成数据接入" if has_valid_package else "请先完成数据接入",
            },
            {
                "code": "HAS_RESOURCE_PARTY_RELATION",
                "passed": has_resource_party_relation,
                "message": "资源已关联数据源主体" if has_resource_party_relation else "请先关联数据源主体",
            },
        ]
        available_actions = ["SYS-002", "DATA-002", "DATA-003"]
        disabled_actions = []
        if has_valid_package and has_resource_party_relation:
            available_actions.append("QUAL-003")
        else:
            reason = "请先完成数据接入"
            if has_valid_package and not has_resource_party_relation:
                reason = "请先关联数据源主体"
            disabled_actions.append({"button_code": "QUAL-003", "reason": reason})
        return {
            "project_id": project["project_id"],
            "project_status": project["project_status"],
            "preconditions": preconditions,
            "available_actions": available_actions,
            "disabled_actions": disabled_actions,
        }

    def quick_run(self):
        preconditions = self.preconditions()
        failures = [item for item in preconditions["preconditions"] if not item["passed"]]
        if failures:
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                "一键计算前置条件未满足",
                field_errors=[
                    {"field": "data_package", "reason": "请先完成数据接入"}
                    for item in failures
                    if item["code"] == "HAS_VALID_DATA_PACKAGE"
                ]
                or [
                    {"field": "resource_party_relation", "reason": "请先关联数据源主体"}
                    for item in failures
                    if item["code"] == "HAS_RESOURCE_PARTY_RELATION"
                ],
            )
        return {
            "project_status": preconditions["project_status"],
            "pipeline_status": "READY",
            "message": "BE-01 已完成一键计算入口骨架；质量评估及后续计算属于 BE-04+。",
            "available_actions": preconditions["available_actions"],
        }

    def _next_step(self, project_status):
        if project_status == "DRAFT":
            return {"label": "选择演示数据或上传 JSON", "button_code": "SYS-002"}
        if project_status == "INGESTED":
            return {"label": "启动质量评估", "button_code": "QUAL-003"}
        return {"label": "查看当前状态", "button_code": "SYS-001"}


class DataIngestionService:
    def __init__(self, repository):
        self.repository = repository

    def initialize_demo_case(self, demo_case_id):
        demo_case = get_demo_case(demo_case_id)
        if not demo_case:
            raise ApiError("DVAS_NOT_FOUND", "演示数据不存在", status=404)
        payload = copy.deepcopy(demo_case)
        package_name = payload["package_name"]
        return self._create_valid_ingestion(
            source_type="DEMO",
            package_name=package_name,
            raw_payload=payload,
            resources=payload["resources"],
            parties=payload["parties"],
            demo_case_id=demo_case_id,
            scenario_name=payload.get("scenario_name"),
        )

    def upload_json(self, payload):
        payload = payload or {}
        field_errors = self._validate_upload_payload(payload)
        if field_errors:
            package = self._create_invalid_package(payload, field_errors)
            validation_result = self.repository.get_validation_result(package["package_id"])
            raise ApiError(
                validation_result["code"],
                "上传 JSON 校验失败",
                field_errors=validation_result["field_errors"],
            )
        return self._create_valid_ingestion(
            source_type="UPLOAD",
            package_name=payload["package_name"],
            raw_payload=payload,
            resources=payload["resources"],
            parties=payload["parties"],
            file_name=payload.get("file_name", "uploaded.json"),
        )

    def list_packages(self):
        return table_page(self.repository.list_data_packages())

    def package_detail(self, package_id):
        package = self.repository.get_data_package(package_id)
        if not package:
            raise ApiError("DVAS_NOT_FOUND", "数据包不存在", status=404)
        return {
            "package": package,
            "input_snapshot": self.repository.get_input_snapshot(package.get("input_snapshot_id")),
            "validation_result": self.repository.get_validation_result(package_id),
            "resources": self.repository.list_data_resources(package_id),
        }

    def validation_result(self, package_id):
        validation = self.repository.get_validation_result(package_id)
        if not validation:
            raise ApiError("DVAS_NOT_FOUND", "数据包校验结果不存在", status=404)
        return validation

    def list_resources(self):
        return table_page(self.repository.list_data_resources())

    def resource_detail(self, resource_id):
        resource = self.repository.get_data_resource(resource_id)
        if not resource:
            raise ApiError("DVAS_NOT_FOUND", "数据资源不存在", status=404)
        return resource

    def list_parties(self):
        return table_page(self.repository.list_parties())

    def _validate_upload_payload(self, payload):
        errors = []
        if not payload.get("package_name"):
            return [{"field": "package_name", "reason": "package_name 为必填字段"}]
        if not isinstance(payload.get("resources"), list) or not payload["resources"]:
            errors.append({"field": "resources", "reason": "resources 必须为非空数组"})
        if not isinstance(payload.get("parties"), list) or not payload["parties"]:
            errors.append({"field": "parties", "reason": "parties 必须为非空数组"})
        for index, resource in enumerate(payload.get("resources", [])):
            if not resource.get("resource_name"):
                errors.append(
                    {
                        "field": f"resources[{index}].resource_name",
                        "reason": "resource_name 为必填字段",
                    }
                )
            if not resource.get("provider_party_name"):
                errors.append(
                    {
                        "field": f"resources[{index}].provider_party_name",
                        "reason": "provider_party_name 为必填字段",
                    }
                )
        for index, party in enumerate(payload.get("parties", [])):
            if not party.get("party_name"):
                errors.append(
                    {"field": f"parties[{index}].party_name", "reason": "party_name 为必填字段"}
                )
        return errors

    def _create_invalid_package(self, payload, field_errors):
        now = utc_now()
        package_id = self.repository.next_id("package")
        package = {
            "package_id": package_id,
            "project_id": self.repository.get_project()["project_id"],
            "package_name": payload.get("package_name") or "未命名上传数据包",
            "source_type": "UPLOAD",
            "file_name": payload.get("file_name", "uploaded.json"),
            "status": "INVALID",
            "input_snapshot_id": None,
            "checksum": stable_checksum(payload),
            "created_by": LOCAL_OPERATOR,
            "created_at": now,
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        }
        validation_result = {
            "validation_result_id": self.repository.next_id("validation"),
            "package_id": package_id,
            "project_id": package["project_id"],
            "status": "INVALID",
            "is_valid": False,
            "code": "DVAS_REQUIRED_FIELD_MISSING",
            "message": "上传 JSON 校验失败",
            "field_errors": field_errors,
            "detail_json": {"field_errors": field_errors},
            "created_at": now,
        }
        self.repository.put_data_package(package)
        self.repository.put_validation_result(validation_result)
        self._audit(
            module_code="DATA",
            menu_code="NAV_DATA_PACKAGE",
            operation_type="UPLOAD_JSON_VALIDATE",
            object_type="data_package",
            object_id=package_id,
            status="FAILED",
            failure_reason="上传 JSON 校验失败",
            after_value_json=validation_result,
        )
        return package

    def _create_valid_ingestion(
        self,
        source_type,
        package_name,
        raw_payload,
        resources,
        parties,
        demo_case_id=None,
        scenario_name=None,
        file_name=None,
    ):
        now = utc_now()
        project = self.repository.get_project()
        snapshot_id = self.repository.next_id("snapshot")
        snapshot = {
            "snapshot_id": snapshot_id,
            "project_id": project["project_id"],
            "snapshot_type": "INPUT",
            "content_json": copy.deepcopy(raw_payload),
            "checksum": stable_checksum(raw_payload),
            "created_by": LOCAL_OPERATOR,
            "created_at": now,
        }
        package_id = self.repository.next_id("package")
        package = {
            "package_id": package_id,
            "project_id": project["project_id"],
            "package_name": package_name,
            "source_type": source_type,
            "demo_case_id": demo_case_id,
            "file_name": file_name,
            "status": "VALIDATED",
            "input_snapshot_id": snapshot_id,
            "checksum": snapshot["checksum"],
            "created_by": LOCAL_OPERATOR,
            "created_at": now,
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        }
        validation_result = {
            "validation_result_id": self.repository.next_id("validation"),
            "package_id": package_id,
            "project_id": project["project_id"],
            "status": "VALIDATED",
            "is_valid": True,
            "code": "OK",
            "message": "数据包校验通过",
            "field_errors": [],
            "detail_json": {"resource_count": len(resources), "party_count": len(parties)},
            "created_at": now,
        }

        self.repository.put_input_snapshot(snapshot)
        self.repository.put_data_package(package)
        self.repository.put_validation_result(validation_result)
        created_parties = self._upsert_parties(parties, project["project_id"], now)
        party_by_name = {party["party_name"]: party for party in created_parties}
        created_resources = self._create_resources(resources, package_id, project["project_id"], party_by_name, now)
        updated_project = self.repository.update_project(
            project_status="INGESTED",
            current_package_id=package_id,
            current_input_snapshot_id=snapshot_id,
            scenario_name=scenario_name or project["scenario_name"],
        )
        self._audit(
            module_code="DATA",
            menu_code="NAV_DATA_PACKAGE",
            operation_type="INITIALIZE_DEMO" if source_type == "DEMO" else "UPLOAD_JSON",
            object_type="data_package",
            object_id=package_id,
            status="SUCCESS",
            input_snapshot_id=snapshot_id,
            after_value_json={"package": package, "resources": created_resources, "parties": created_parties},
        )
        return {
            "project_id": updated_project["project_id"],
            "project_status": updated_project["project_status"],
            "package": package,
            "input_snapshot": snapshot,
            "validation_result": validation_result,
            "resources": created_resources,
            "parties": created_parties,
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        }

    def _upsert_parties(self, parties, project_id, now):
        existing_by_name = {party["party_name"]: party for party in self.repository.list_parties()}
        created = []
        for party_payload in parties:
            party = existing_by_name.get(party_payload["party_name"])
            if not party:
                party = {
                    "party_id": self.repository.next_id("party"),
                    "project_id": project_id,
                    "party_name": party_payload["party_name"],
                    "party_type": party_payload.get("party_type", "DATA_PROVIDER"),
                    "include_in_md_dshap": bool(party_payload.get("include_in_md_dshap", True)),
                    "status": "ENABLED",
                    "created_at": now,
                    "updated_at": now,
                }
                self.repository.put_party(party)
            created.append(party)
        return created

    def _create_resources(self, resources, package_id, project_id, party_by_name, now):
        created = []
        for resource_payload in resources:
            party = party_by_name.get(resource_payload["provider_party_name"])
            resource = {
                "resource_id": self.repository.next_id("resource"),
                "project_id": project_id,
                "package_id": package_id,
                "resource_name": resource_payload["resource_name"],
                "modality": resource_payload.get("modality", "TABULAR"),
                "field_count": int(resource_payload.get("field_count", 0)),
                "sample_count": int(resource_payload.get("sample_count", 0)),
                "party_id": party["party_id"] if party else None,
                "provider_party_name": resource_payload["provider_party_name"],
                "status": "ACTIVE",
                "created_at": now,
                "updated_at": now,
            }
            self.repository.put_data_resource(resource)
            created.append(resource)
        return created

    def _audit(
        self,
        module_code,
        menu_code,
        operation_type,
        object_type,
        object_id,
        status,
        failure_reason=None,
        input_snapshot_id=None,
        after_value_json=None,
    ):
        return write_audit(
            self.repository,
            module_code=module_code,
            menu_code=menu_code,
            operation_type=operation_type,
            object_type=object_type,
            object_id=object_id,
            status=status,
            failure_reason=failure_reason,
            input_snapshot_id=input_snapshot_id,
            after_value_json=after_value_json,
        )


class ResourceService:
    def __init__(self, repository):
        self.repository = repository

    def bind_party_relations(self, resource_id, payload):
        resource = self.repository.get_data_resource(resource_id)
        if not resource:
            raise ApiError("DVAS_NOT_FOUND", "数据资源不存在", status=404)
        relations = payload.get("relations") or []
        if not relations:
            raise ApiError(
                "DVAS_REQUIRED_FIELD_MISSING",
                "资源主体关系不能为空",
                field_errors=[{"field": "relations", "reason": "至少需要一个数据源主体关系"}],
            )

        normalized_relations = []
        for index, relation in enumerate(relations):
            party_id = relation.get("party_id")
            party = self.repository.get_party(party_id) if party_id else None
            if not party:
                raise ApiError(
                    "DVAS_NOT_FOUND",
                    "参与方不存在",
                    status=404,
                    field_errors=[{"field": f"relations[{index}].party_id", "reason": "参与方不存在"}],
                )
            try:
                split_ratio = float(relation.get("split_ratio", 1))
            except (TypeError, ValueError) as exc:
                raise ApiError(
                    "DVAS_FACTOR_INVALID",
                    "资源主体拆分比例不合法",
                    field_errors=[
                        {
                            "field": f"relations[{index}].split_ratio",
                            "reason": "split_ratio 必须是 0 到 1 之间的数字",
                        }
                    ],
                ) from exc
            if split_ratio < 0 or split_ratio > 1:
                raise ApiError(
                    "DVAS_FACTOR_INVALID",
                    "资源主体拆分比例不合法",
                    field_errors=[
                        {"field": f"relations[{index}].split_ratio", "reason": "split_ratio 必须在 0 到 1 之间"}
                    ],
                )
            normalized_relations.append(
                {
                    "party_id": party_id,
                    "split_ratio": split_ratio,
                    "is_primary_provider": bool(relation.get("is_primary_provider", index == 0)),
                }
            )

        primary_relation = next(
            (relation for relation in normalized_relations if relation["is_primary_provider"]),
            normalized_relations[0],
        )
        primary_party = self.repository.get_party(primary_relation["party_id"])
        updated = {
            **resource,
            "party_id": primary_party["party_id"],
            "provider_party_name": primary_party["party_name"],
            "party_relations": normalized_relations,
            "updated_at": utc_now(),
        }
        self.repository.put_data_resource(updated)
        write_audit(
            self.repository,
            module_code="RES",
            menu_code="NAV_DATA_RESOURCE",
            operation_type="BIND_PARTY_RELATIONS",
            object_type="data_resource",
            object_id=resource_id,
            status="SUCCESS",
            before_value_json=resource,
            after_value_json=updated,
        )
        return updated


class PartyService:
    DATA_PROVIDER_TYPES = {"DATA_PROVIDER"}

    def __init__(self, repository):
        self.repository = repository

    def create_party(self, payload):
        party_name = payload.get("party_name")
        if not party_name:
            raise ApiError(
                "DVAS_REQUIRED_FIELD_MISSING",
                "参与方名称不能为空",
                field_errors=[{"field": "party_name", "reason": "party_name 为必填字段"}],
            )
        self._ensure_unique_name(party_name)
        now = utc_now()
        party_type = payload.get("party_type", "DATA_PROVIDER")
        party = {
            "party_id": self.repository.next_id("party"),
            "project_id": self.repository.get_project()["project_id"],
            "party_name": party_name,
            "party_type": party_type,
            "include_in_md_dshap": self._default_include(payload, party_type),
            "status": "ENABLED",
            "credit_code": payload.get("credit_code"),
            "contact_name": payload.get("contact_name"),
            "description": payload.get("description"),
            "created_at": now,
            "updated_at": now,
        }
        self.repository.put_party(party)
        write_audit(
            self.repository,
            module_code="PARTY",
            menu_code="NAV_DATA_PARTY",
            operation_type="CREATE_PARTY",
            object_type="party",
            object_id=party["party_id"],
            status="SUCCESS",
            after_value_json=party,
        )
        return party

    def update_party(self, party_id, payload):
        party = self.repository.get_party(party_id)
        if not party:
            raise ApiError("DVAS_NOT_FOUND", "参与方不存在", status=404)
        new_name = payload.get("party_name", party["party_name"])
        self._ensure_unique_name(new_name, exclude_party_id=party_id)
        party_type = payload.get("party_type", party["party_type"])
        updated = {
            **party,
            "party_name": new_name,
            "party_type": party_type,
            "include_in_md_dshap": self._default_include(payload, party_type, party),
            "credit_code": payload.get("credit_code", party.get("credit_code")),
            "contact_name": payload.get("contact_name", party.get("contact_name")),
            "description": payload.get("description", party.get("description")),
            "updated_at": utc_now(),
        }
        self.repository.put_party(updated)
        write_audit(
            self.repository,
            module_code="PARTY",
            menu_code="NAV_DATA_PARTY",
            operation_type="UPDATE_PARTY",
            object_type="party",
            object_id=party_id,
            status="SUCCESS",
            before_value_json=party,
            after_value_json=updated,
        )
        return updated

    def set_status(self, party_id, payload):
        party = self.repository.get_party(party_id)
        if not party:
            raise ApiError("DVAS_NOT_FOUND", "参与方不存在", status=404)
        status = payload.get("status")
        if status not in {"ENABLED", "DISABLED"}:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "参与方状态不合法",
                field_errors=[{"field": "status", "reason": "status 必须为 ENABLED 或 DISABLED"}],
            )
        if status == "DISABLED" and party["party_type"] == "DATA_PROVIDER":
            enabled_data_providers = [
                item
                for item in self.repository.list_parties()
                if item["party_type"] == "DATA_PROVIDER"
                and item["status"] == "ENABLED"
                and item["party_id"] != party_id
            ]
            if not enabled_data_providers:
                raise ApiError(
                    "DVAS_PRECONDITION_NOT_MET",
                    "至少需要保留一个有效数据源主体",
                    field_errors=[{"field": "party_id", "reason": "不能停用唯一有效数据源主体"}],
                )
        updated = {
            **party,
            "status": status,
            "status_reason": payload.get("reason"),
            "updated_at": utc_now(),
        }
        self.repository.put_party(updated)
        write_audit(
            self.repository,
            module_code="PARTY",
            menu_code="NAV_DATA_PARTY",
            operation_type="SET_PARTY_STATUS",
            object_type="party",
            object_id=party_id,
            status="SUCCESS",
            before_value_json=party,
            after_value_json=updated,
        )
        return updated

    def _default_include(self, payload, party_type, existing=None):
        if "include_in_md_dshap" in payload:
            return bool(payload["include_in_md_dshap"])
        if existing is not None and "include_in_md_dshap" in existing:
            return bool(existing["include_in_md_dshap"])
        return party_type in self.DATA_PROVIDER_TYPES

    def _ensure_unique_name(self, party_name, exclude_party_id=None):
        for party in self.repository.list_parties():
            if party["party_name"] == party_name and party["party_id"] != exclude_party_id:
                raise ApiError(
                    "DVAS_FACTOR_INVALID",
                    "参与方名称重复",
                    field_errors=[{"field": "party_name", "reason": "同一项目参与方名称必须唯一"}],
                )


class QualityAssessmentService:
    def __init__(self, repository):
        self.repository = repository

    def run(self, payload):
        project = self.repository.get_project()
        package_id = payload.get("package_id") or project.get("current_package_id")
        package = self.repository.get_data_package(package_id) if package_id else None
        if not package or package.get("status") != "VALIDATED":
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                "请先完成数据接入",
                field_errors=[{"field": "package_id", "reason": "请先完成数据接入"}],
            )
        resources = self.repository.list_data_resources(package_id)
        if not resources:
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                "当前数据包无有效数据资源",
                field_errors=[{"field": "resources", "reason": "当前数据包无有效数据资源"}],
            )

        now = utc_now()
        version_no = len(self.repository.list_quality_assessments()) + 1
        quality_score = min(98.0, 78.0 + len(resources) * 3.5)
        quality_level = "A" if quality_score >= 85 else "B"
        details = [
            self._detail("完整性", "completeness", 0.35, quality_score + 1.0),
            self._detail("一致性", "consistency", 0.30, quality_score - 2.0),
            self._detail("可用性", "usability", 0.35, quality_score),
        ]
        snapshot_id = self.repository.next_id("snapshot")
        output_snapshot = {
            "snapshot_id": snapshot_id,
            "project_id": project["project_id"],
            "snapshot_type": "RESULT",
            "content_json": {"details": details, "quality_score": round(quality_score, 2)},
            "checksum": stable_checksum({"details": details, "quality_score": round(quality_score, 2)}),
            "created_by": LOCAL_OPERATOR,
            "created_at": now,
        }
        assessment = {
            "assessment_id": self.repository.next_id("assessment"),
            "project_id": project["project_id"],
            "package_id": package_id,
            "version_no": version_no,
            "quality_score": round(quality_score, 2),
            "quality_level": quality_level,
            "quality_factor": round(quality_score / 100, 4),
            "dimension_scores": {detail["dimension_code"]: detail["score"] for detail in details},
            "evidence_summary": "BE-04 质量评估骨架基于资源数量和字段统计生成演示评分。",
            "algorithm_version": "DVAS_QUALITY_SKELETON_V0",
            "input_snapshot_id": package.get("input_snapshot_id"),
            "parameter_snapshot_id": None,
            "output_snapshot_id": snapshot_id,
            "created_by": LOCAL_OPERATOR,
            "created_at": now,
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        }
        self.repository.put_snapshot(output_snapshot)
        self.repository.put_quality_assessment(assessment, details)
        updated_project = self.repository.update_project(project_status="ASSESSED")
        write_audit(
            self.repository,
            module_code="QUAL",
            menu_code="NAV_MEASURE_QUALITY",
            operation_type="RUN_QUALITY_ASSESSMENT",
            object_type="quality_assessment",
            object_id=assessment["assessment_id"],
            status="SUCCESS",
            input_snapshot_id=assessment["input_snapshot_id"],
            result_snapshot_id=snapshot_id,
            after_value_json={"assessment": assessment, "details": details},
        )
        return {
            "project_id": updated_project["project_id"],
            "project_status": updated_project["project_status"],
            "assessment": assessment,
            "details": details,
        }

    def latest(self):
        assessments = self.repository.list_quality_assessments()
        if not assessments:
            raise ApiError("DVAS_NOT_FOUND", "质量评估结果不存在", status=404)
        return assessments[-1]

    def details(self, assessment_id):
        assessment = self.repository.get_quality_assessment(assessment_id)
        if not assessment:
            raise ApiError("DVAS_NOT_FOUND", "质量评估结果不存在", status=404)
        return {"assessment_id": assessment_id, "assessment": assessment, "details": self.repository.get_quality_details(assessment_id)}

    def _detail(self, dimension_name, dimension_code, weight, score):
        return {
            "detail_id": self.repository.next_id("quality_detail"),
            "dimension_name": dimension_name,
            "dimension_code": dimension_code,
            "weight": weight,
            "score": round(score, 2),
            "evidence": f"{dimension_name}演示评分由 BE-04 骨架生成。",
        }
