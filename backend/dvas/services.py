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
        metering_count = len(self.repository.list_shuyuan_meterings())
        utility_count = len(self.repository.list_utility_records())
        preconditions = self.preconditions()
        return {
            **project,
            "metrics": {
                "data_package_count": len([item for item in packages if item["status"] == "VALIDATED"]),
                "resource_count": len(resources),
                "party_count": len(parties),
                "metering_count": metering_count,
                "utility_count": utility_count,
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
        has_quality_assessment = bool(self.repository.list_quality_assessments())
        has_shuyuan_metering = bool(self.repository.list_shuyuan_meterings())
        contribution_records = self.repository.list_contribution_records()
        has_contribution_records = bool(contribution_records)
        has_utility_result = bool(self.repository.list_utility_records())
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
            {
                "code": "HAS_QUALITY_ASSESSMENT",
                "passed": has_quality_assessment,
                "message": "已完成质量评估" if has_quality_assessment else "请先完成质量评估",
            },
            {
                "code": "HAS_SHUYUAN_METERING",
                "passed": has_shuyuan_metering,
                "message": "已完成数元计量" if has_shuyuan_metering else "请先完成数元计量",
            },
            {
                "code": "HAS_CONTRIBUTION_RECORDS",
                "passed": has_contribution_records,
                "message": "已完成贡献度计算" if has_contribution_records else "请先完成贡献度计算",
            },
            {
                "code": "HAS_UTILITY_RESULT",
                "passed": has_utility_result,
                "message": "已完成效用计算" if has_utility_result else "请先完成效用计算",
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
        self._gate_action(
            available_actions,
            disabled_actions,
            "DU-009",
            has_quality_assessment,
            "请先完成质量评估",
        )
        self._gate_action(
            available_actions,
            disabled_actions,
            "UTIL-006",
            has_shuyuan_metering,
            "请先完成数元计量",
        )
        self._gate_action(
            available_actions,
            disabled_actions,
            "UTIL-008",
            has_contribution_records,
            "请先完成贡献度计算",
        )
        self._gate_action(
            available_actions,
            disabled_actions,
            "MDS-011",
            project["project_status"] == "UTILITY_CALCULATED" and has_utility_result,
            "请先完成效用计算",
        )
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
        if project_status == "ASSESSED":
            return {"label": "执行数元计量", "button_code": "DU-003"}
        if project_status == "METERED":
            return {"label": "计算贡献度与效用", "button_code": "UTIL-006"}
        if project_status == "UTILITY_CALCULATED":
            return {"label": "进入 MD-DShap 权重计算", "button_code": "MDS-011"}
        return {"label": "查看当前状态", "button_code": "SYS-001"}

    def _gate_action(self, available_actions, disabled_actions, button_code, passed, reason):
        if passed:
            available_actions.append(button_code)
        else:
            disabled_actions.append({"button_code": button_code, "reason": reason})


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


class ShuyuanMeteringService:
    def __init__(self, repository):
        self.repository = repository

    def run(self, payload):
        quality = self._latest_quality()
        package = self.repository.get_data_package(quality["package_id"])
        resources = self.repository.list_data_resources(quality["package_id"])
        if not resources:
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                "当前数据包无有效数据资源",
                field_errors=[{"field": "resources", "reason": "当前数据包无有效数据资源"}],
            )

        now = utc_now()
        version_no = len(self.repository.list_shuyuan_meterings()) + 1
        call_count = int(payload.get("call_count", sum(item.get("sample_count", 0) for item in resources)))
        parameters = {
            "base_price": self._number(payload, "base_price", 2.0),
            "scenario_coefficient": self._number(payload, "scenario_coefficient", 1.1),
            "quality_coefficient": self._number(payload, "quality_coefficient", quality["quality_factor"]),
            "technology_coefficient": self._number(payload, "technology_coefficient", 1.05),
            "expert_coefficient": self._number(payload, "expert_coefficient", 1.0),
            "development_coefficient": self._number(payload, "development_coefficient", 0.98),
            "call_count": call_count,
        }
        raw_total = self._metering_amount(parameters, call_count)
        total_amount = round(raw_total, 2)
        details = self._details(resources, parameters, total_amount)
        parameter_snapshot_id = self.repository.next_id("snapshot")
        result_snapshot_id = self.repository.next_id("snapshot")
        parameter_snapshot = self._snapshot(
            parameter_snapshot_id,
            "PARAMETER",
            {
                "formula": "base_price × scenario_coefficient × quality_coefficient × technology_coefficient × expert_coefficient × development_coefficient × call_count",
                "parameters": parameters,
            },
            now,
        )
        result_payload = {
            "metering_amount": total_amount,
            "details": details,
            "quality_assessment_id": quality["assessment_id"],
        }
        result_snapshot = self._snapshot(result_snapshot_id, "RESULT", result_payload, now)
        metering = {
            "metering_id": self.repository.next_id("metering"),
            "project_id": self.repository.get_project()["project_id"],
            "package_id": quality["package_id"],
            "assessment_id": quality["assessment_id"],
            "version_no": version_no,
            "base_shuyuan_price": parameters["base_price"],
            "scenario_coefficient": parameters["scenario_coefficient"],
            "quality_coefficient": parameters["quality_coefficient"],
            "technology_coefficient": parameters["technology_coefficient"],
            "expert_coefficient": parameters["expert_coefficient"],
            "development_coefficient": parameters["development_coefficient"],
            "call_count": call_count,
            "metering_amount": total_amount,
            "formula_text": parameter_snapshot["content_json"]["formula"],
            "parameter_snapshot_json": parameters,
            "input_snapshot_id": package.get("input_snapshot_id") if package else None,
            "parameter_snapshot_id": parameter_snapshot_id,
            "output_snapshot_id": result_snapshot_id,
            "algorithm_version": "DVAS_SHUYUAN_METERING_SKELETON_V0",
            "created_by": LOCAL_OPERATOR,
            "created_at": now,
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        }

        self.repository.put_snapshot(parameter_snapshot)
        self.repository.put_snapshot(result_snapshot)
        self.repository.put_shuyuan_metering(metering, details)
        updated_project = self.repository.update_project(project_status="METERED")
        write_audit(
            self.repository,
            module_code="DU",
            menu_code="NAV_MEASURE_SHUYUAN",
            operation_type="RUN_SHUYUAN_METERING",
            object_type="shuyuan_metering",
            object_id=metering["metering_id"],
            status="SUCCESS",
            input_snapshot_id=metering["input_snapshot_id"],
            parameter_snapshot_id=parameter_snapshot_id,
            result_snapshot_id=result_snapshot_id,
            after_value_json={"metering": metering, "details": details},
        )
        return {
            "project_id": updated_project["project_id"],
            "project_status": updated_project["project_status"],
            "metering": metering,
            "details": details,
        }

    def latest(self):
        meterings = self.repository.list_shuyuan_meterings()
        if not meterings:
            raise ApiError("DVAS_NOT_FOUND", "数元计量结果不存在", status=404)
        return meterings[-1]

    def details(self, metering_id):
        metering = self.repository.get_shuyuan_metering(metering_id)
        if not metering:
            raise ApiError("DVAS_NOT_FOUND", "数元计量结果不存在", status=404)
        return {
            "metering_id": metering_id,
            "metering": metering,
            "details": self.repository.get_shuyuan_metering_details(metering_id),
        }

    def _latest_quality(self):
        assessments = self.repository.list_quality_assessments()
        if not assessments:
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                "请先完成质量评估",
                field_errors=[{"field": "quality_assessment", "reason": "请先完成质量评估"}],
            )
        return assessments[-1]

    def _number(self, payload, field, default):
        try:
            value = float(payload.get(field, default))
        except (TypeError, ValueError) as exc:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "计量参数不合法",
                field_errors=[{"field": field, "reason": f"{field} 必须是数字"}],
            ) from exc
        if value < 0:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "计量参数不合法",
                field_errors=[{"field": field, "reason": f"{field} 必须大于等于 0"}],
            )
        return round(value, 6)

    def _metering_amount(self, parameters, call_count):
        return (
            parameters["base_price"]
            * parameters["scenario_coefficient"]
            * parameters["quality_coefficient"]
            * parameters["technology_coefficient"]
            * parameters["expert_coefficient"]
            * parameters["development_coefficient"]
            * call_count
        )

    def _details(self, resources, parameters, total_amount):
        total_units = sum(item.get("sample_count", 0) for item in resources) or 1
        details = []
        running_amount = 0.0
        for index, resource in enumerate(resources):
            valid_units = int(resource.get("sample_count", 0))
            if index == len(resources) - 1:
                amount = round(total_amount - running_amount, 2)
            else:
                amount = round(total_amount * valid_units / total_units, 2)
                running_amount = round(running_amount + amount, 2)
            party = self.repository.get_party(resource.get("party_id")) if resource.get("party_id") else None
            details.append(
                {
                    "detail_id": self.repository.next_id("metering_detail"),
                    "resource_id": resource["resource_id"],
                    "resource_name": resource["resource_name"],
                    "party_id": resource.get("party_id"),
                    "party_name": party["party_name"] if party else resource.get("provider_party_name"),
                    "valid_units": valid_units,
                    "base_shuyuan_price": parameters["base_price"],
                    "scenario_coefficient": parameters["scenario_coefficient"],
                    "quality_coefficient": parameters["quality_coefficient"],
                    "technology_coefficient": parameters["technology_coefficient"],
                    "expert_coefficient": parameters["expert_coefficient"],
                    "development_coefficient": parameters["development_coefficient"],
                    "call_count": valid_units,
                    "metering_amount": amount,
                    "evidence": "BE-05 数元计量骨架按资源有效样本数分摊总数元值。",
                }
            )
        return details

    def _snapshot(self, snapshot_id, snapshot_type, content, now):
        return {
            "snapshot_id": snapshot_id,
            "project_id": self.repository.get_project()["project_id"],
            "snapshot_type": snapshot_type,
            "content_json": copy.deepcopy(content),
            "checksum": stable_checksum(content),
            "created_by": LOCAL_OPERATOR,
            "created_at": now,
        }


class ContributionService:
    def __init__(self, repository):
        self.repository = repository

    def run(self, payload):
        metering = self._latest_metering()
        details = self.repository.get_shuyuan_metering_details(metering["metering_id"])
        now = utc_now()
        contribution_run_id = self.repository.next_id("contribution_run")
        parameter_snapshot_id = self.repository.next_id("snapshot")
        result_snapshot_id = self.repository.next_id("snapshot")
        parameters = {
            "usage_weight": self._number(payload, "usage_weight", 1.0),
            "coverage_weight": self._number(payload, "coverage_weight", 1.0),
            "scarcity_weight": self._number(payload, "scarcity_weight", 1.0),
        }
        records = self._records(details, parameters, contribution_run_id, now)
        result_payload = {"contribution_run_id": contribution_run_id, "records": records}
        self.repository.put_snapshot(self._snapshot(parameter_snapshot_id, "PARAMETER", parameters, now))
        self.repository.put_snapshot(self._snapshot(result_snapshot_id, "RESULT", result_payload, now))
        for record in records:
            record["parameter_snapshot_id"] = parameter_snapshot_id
            record["output_snapshot_id"] = result_snapshot_id
        self.repository.put_contribution_records(records)
        project = self.repository.get_project()
        write_audit(
            self.repository,
            module_code="UTIL",
            menu_code="NAV_MEASURE_UTILITY",
            operation_type="RUN_CONTRIBUTION",
            object_type="contribution_run",
            object_id=contribution_run_id,
            status="SUCCESS",
            parameter_snapshot_id=parameter_snapshot_id,
            result_snapshot_id=result_snapshot_id,
            after_value_json=result_payload,
        )
        return {
            "project_id": project["project_id"],
            "project_status": project["project_status"],
            "contribution_run_id": contribution_run_id,
            "records": records,
            "parameter_snapshot_id": parameter_snapshot_id,
            "output_snapshot_id": result_snapshot_id,
        }

    def _latest_metering(self):
        meterings = self.repository.list_shuyuan_meterings()
        if not meterings:
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                "请先完成数元计量",
                field_errors=[{"field": "shuyuan_metering", "reason": "请先完成数元计量"}],
            )
        return meterings[-1]

    def _records(self, details, parameters, contribution_run_id, now):
        grouped = {}
        for detail in details:
            party_id = detail.get("party_id") or "unknown_party"
            grouped.setdefault(
                party_id,
                {
                    "party_id": party_id,
                    "party_name": detail.get("party_name") or "未绑定主体",
                    "valid_units": 0,
                },
            )
            grouped[party_id]["valid_units"] += int(detail.get("valid_units", 0))
        scored = []
        for item in grouped.values():
            score = round(
                item["valid_units"]
                * parameters["usage_weight"]
                * parameters["coverage_weight"]
                * parameters["scarcity_weight"],
                6,
            )
            scored.append({**item, "contribution_score": score})
        total_score = sum(item["contribution_score"] for item in scored) or 1.0
        records = []
        for item in sorted(scored, key=lambda value: value["party_id"]):
            records.append(
                {
                    "contribution_id": self.repository.next_id("contribution"),
                    "contribution_run_id": contribution_run_id,
                    "project_id": self.repository.get_project()["project_id"],
                    "party_id": item["party_id"],
                    "party_name": item["party_name"],
                    "valid_units": item["valid_units"],
                    "usage_weight": parameters["usage_weight"],
                    "coverage_weight": parameters["coverage_weight"],
                    "scarcity_weight": parameters["scarcity_weight"],
                    "contribution_score": item["contribution_score"],
                    "normalized_contribution": round(item["contribution_score"] / total_score, 6),
                    "formula_text": "valid_units × usage_weight × coverage_weight × scarcity_weight",
                    "created_by": LOCAL_OPERATOR,
                    "created_at": now,
                    "simulation_disclaimer": SIMULATION_DISCLAIMER,
                }
            )
        return records

    def _number(self, payload, field, default):
        try:
            value = float(payload.get(field, default))
        except (TypeError, ValueError) as exc:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "贡献参数不合法",
                field_errors=[{"field": field, "reason": f"{field} 必须是数字"}],
            ) from exc
        if value < 0:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "贡献参数不合法",
                field_errors=[{"field": field, "reason": f"{field} 必须大于等于 0"}],
            )
        return round(value, 6)

    def _snapshot(self, snapshot_id, snapshot_type, content, now):
        return {
            "snapshot_id": snapshot_id,
            "project_id": self.repository.get_project()["project_id"],
            "snapshot_type": snapshot_type,
            "content_json": copy.deepcopy(content),
            "checksum": stable_checksum(content),
            "created_by": LOCAL_OPERATOR,
            "created_at": now,
        }


class UtilityService:
    def __init__(self, repository):
        self.repository = repository

    def run(self, payload):
        contribution_records = self._latest_contribution_records()
        quality = self._latest_quality()
        now = utc_now()
        version_no = len(self.repository.list_utility_records()) + 1
        parameters = {
            "quality_factor": self._number(payload, "quality_factor", quality["quality_factor"]),
            "usage_factor": self._number(payload, "usage_factor", 1.0),
            "scenario_factor": self._number(payload, "scenario_factor", 1.0),
        }
        utility_id = self.repository.next_id("utility")
        parameter_snapshot_id = self.repository.next_id("snapshot")
        result_snapshot_id = self.repository.next_id("snapshot")
        trace = self._trace(utility_id, contribution_records, parameters, now)
        utility_value = round(sum(item["utility_value"] for item in trace), 6)
        utility = {
            "utility_id": utility_id,
            "project_id": self.repository.get_project()["project_id"],
            "contribution_run_id": contribution_records[0]["contribution_run_id"],
            "version_no": version_no,
            "utility_value": utility_value,
            "quality_factor": parameters["quality_factor"],
            "usage_factor": parameters["usage_factor"],
            "scenario_factor": parameters["scenario_factor"],
            "formula_text": "normalized_contribution × quality_factor × usage_factor × scenario_factor",
            "parameter_snapshot_json": parameters,
            "parameter_snapshot_id": parameter_snapshot_id,
            "output_snapshot_id": result_snapshot_id,
            "algorithm_version": "DVAS_UTILITY_SKELETON_V0",
            "created_by": LOCAL_OPERATOR,
            "created_at": now,
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        }
        self.repository.put_snapshot(self._snapshot(parameter_snapshot_id, "PARAMETER", parameters, now))
        self.repository.put_snapshot(
            self._snapshot(result_snapshot_id, "RESULT", {"utility": utility, "trace": trace}, now)
        )
        self.repository.put_utility_record(utility, trace)
        updated_project = self.repository.update_project(project_status="UTILITY_CALCULATED")
        write_audit(
            self.repository,
            module_code="UTIL",
            menu_code="NAV_MEASURE_UTILITY",
            operation_type="RUN_UTILITY",
            object_type="utility",
            object_id=utility_id,
            status="SUCCESS",
            parameter_snapshot_id=parameter_snapshot_id,
            result_snapshot_id=result_snapshot_id,
            after_value_json={"utility": utility, "trace": trace},
        )
        return {
            "project_id": updated_project["project_id"],
            "project_status": updated_project["project_status"],
            "utility": utility,
            "trace": trace,
        }

    def latest(self):
        utilities = self.repository.list_utility_records()
        if not utilities:
            raise ApiError("DVAS_NOT_FOUND", "效用计算结果不存在", status=404)
        return utilities[-1]

    def trace(self, utility_id):
        utility = self.repository.get_utility_record(utility_id)
        if not utility:
            raise ApiError("DVAS_NOT_FOUND", "效用计算结果不存在", status=404)
        return {
            "utility_id": utility_id,
            "utility": utility,
            "trace": self.repository.get_utility_traces(utility_id),
        }

    def _latest_contribution_records(self):
        records = self.repository.list_contribution_records()
        if not records:
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                "请先完成贡献度计算",
                field_errors=[{"field": "contribution_records", "reason": "请先完成贡献度计算"}],
            )
        latest_run_id = records[-1]["contribution_run_id"]
        return [item for item in records if item["contribution_run_id"] == latest_run_id]

    def _latest_quality(self):
        assessments = self.repository.list_quality_assessments()
        if not assessments:
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                "请先完成质量评估",
                field_errors=[{"field": "quality_assessment", "reason": "请先完成质量评估"}],
            )
        return assessments[-1]

    def _trace(self, utility_id, contribution_records, parameters, now):
        trace = []
        for record in contribution_records:
            utility_value = round(
                record["normalized_contribution"]
                * parameters["quality_factor"]
                * parameters["usage_factor"]
                * parameters["scenario_factor"],
                6,
            )
            trace.append(
                {
                    "trace_id": self.repository.next_id("utility_trace"),
                    "utility_id": utility_id,
                    "contribution_id": record["contribution_id"],
                    "party_id": record["party_id"],
                    "party_name": record["party_name"],
                    "normalized_contribution": record["normalized_contribution"],
                    "quality_factor": parameters["quality_factor"],
                    "usage_factor": parameters["usage_factor"],
                    "scenario_factor": parameters["scenario_factor"],
                    "utility_value": utility_value,
                    "formula_text": "normalized_contribution × quality_factor × usage_factor × scenario_factor",
                    "created_at": now,
                }
            )
        return trace

    def _number(self, payload, field, default):
        try:
            value = float(payload.get(field, default))
        except (TypeError, ValueError) as exc:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "效用参数不合法",
                field_errors=[{"field": field, "reason": f"{field} 必须是数字"}],
            ) from exc
        if value < 0:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "效用参数不合法",
                field_errors=[{"field": field, "reason": f"{field} 必须大于等于 0"}],
            )
        return round(value, 6)

    def _snapshot(self, snapshot_id, snapshot_type, content, now):
        return {
            "snapshot_id": snapshot_id,
            "project_id": self.repository.get_project()["project_id"],
            "snapshot_type": snapshot_type,
            "content_json": copy.deepcopy(content),
            "checksum": stable_checksum(content),
            "created_by": LOCAL_OPERATOR,
            "created_at": now,
        }
