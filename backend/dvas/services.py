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
            disabled_actions.append({"button_code": "QUAL-003", "reason": "请先完成数据接入"})
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
        audit_log = {
            "log_id": self.repository.next_id("audit"),
            "project_id": self.repository.get_project()["project_id"],
            "module_code": module_code,
            "menu_code": menu_code,
            "operation_type": operation_type,
            "object_type": object_type,
            "object_id": object_id,
            "operator_id": LOCAL_OPERATOR,
            "before_value_json": None,
            "after_value_json": after_value_json,
            "input_snapshot_id": input_snapshot_id,
            "parameter_snapshot_id": None,
            "result_snapshot_id": None,
            "status": status,
            "failure_reason": failure_reason,
            "created_at": utc_now(),
        }
        self.repository.put_audit_log(audit_log)
        return audit_log
