import copy
import hashlib
import json
from pathlib import Path

from .constants import AlgorithmMode, P0_CONFIG, ProjectStatus
from .contracts import LOCAL_OPERATOR, SIMULATION_DISCLAIMER, utc_now


QUALITY_PRIMARY_METRICS = [
    ("QUALITY_NORM", "规范性", "QUALITY_WEIGHT_NORM", 0.15),
    ("QUALITY_ACC", "准确性", "QUALITY_WEIGHT_ACC", 0.15),
    ("QUALITY_COMP", "完整性", "QUALITY_WEIGHT_COMP", 0.15),
    ("QUALITY_UNIQ", "唯一性", "QUALITY_WEIGHT_UNIQ", 0.15),
    ("QUALITY_CONS", "一致性", "QUALITY_WEIGHT_CONS", 0.15),
    ("QUALITY_TIME", "时效性", "QUALITY_WEIGHT_TIME", 0.10),
    ("QUALITY_ACCESS", "可访问性", "QUALITY_WEIGHT_ACCESS", 0.15),
]


QUALITY_SECONDARY_METRICS = [
    ("QUALITY_NAMING_NORM", "命名规范性", "QUALITY_NORM", "QUALITY_WEIGHT_NAMING_NORM", 0.15),
    ("QUALITY_LENGTH_NORM", "数据长度规范性", "QUALITY_NORM", "QUALITY_WEIGHT_LENGTH_NORM", 0.15),
    ("QUALITY_PRECISION_NORM", "数据精度规范性", "QUALITY_NORM", "QUALITY_WEIGHT_PRECISION_NORM", 0.15),
    ("QUALITY_FORMAT_NORM", "数据格式规范性", "QUALITY_NORM", "QUALITY_WEIGHT_FORMAT_NORM", 0.15),
    ("QUALITY_METADATA_NORM", "元数据规范性", "QUALITY_NORM", "QUALITY_WEIGHT_METADATA_NORM", 0.15),
    ("QUALITY_REFERENCE_NORM", "参考数据规范性", "QUALITY_NORM", "QUALITY_WEIGHT_REFERENCE_NORM", 0.10),
    ("QUALITY_MODEL_NORM", "数据模型规范性", "QUALITY_NORM", "QUALITY_WEIGHT_MODEL_NORM", 0.15),
    ("QUALITY_RANGE_ACC", "数据范围准确性", "QUALITY_ACC", "QUALITY_WEIGHT_RANGE_ACC", 0.50),
    ("QUALITY_CODE_ACC", "编码/代码准确性", "QUALITY_ACC", "QUALITY_WEIGHT_CODE_ACC", 0.50),
    ("QUALITY_ELEMENT_COMP", "数据元素完整性", "QUALITY_COMP", "QUALITY_WEIGHT_ELEMENT_COMP", 0.50),
    ("QUALITY_RECORD_COMP", "数据记录完整性", "QUALITY_COMP", "QUALITY_WEIGHT_RECORD_COMP", 0.50),
    ("QUALITY_ID_UNIQ", "数据唯一标识程度", "QUALITY_UNIQ", "QUALITY_WEIGHT_ID_UNIQ", 0.50),
    ("QUALITY_REDUNDANCY_UNIQ", "数据冗余性", "QUALITY_UNIQ", "QUALITY_WEIGHT_REDUNDANCY_UNIQ", 0.50),
    ("QUALITY_SAME_CONS", "相同数据一致性", "QUALITY_CONS", "QUALITY_WEIGHT_SAME_CONS", 0.50),
    ("QUALITY_RELATED_CONS", "关联数据一致性", "QUALITY_CONS", "QUALITY_WEIGHT_RELATED_CONS", 0.50),
    ("QUALITY_RECORD_TIME", "数据记录及时性", "QUALITY_TIME", "QUALITY_WEIGHT_RECORD_TIME", 1.00),
    ("QUALITY_FIELD_ACCESS", "数据字段可访问性", "QUALITY_ACCESS", "QUALITY_WEIGHT_FIELD_ACCESS", 1.00),
]


def default_system_parameters(now=None):
    now = now or utc_now()
    definitions = [
        (
            "RISK_DISCLAIMER_TEXT",
            "风险提示文本",
            "TEXT",
            SIMULATION_DISCLAIMER,
            True,
        ),
        ("DEFAULT_SHUYUAN_BASE_PRICE", "默认数元基础价格", "NUMBER", 2.0, True),
        ("DEFAULT_SCENARIO_COEFFICIENT", "默认场景系数", "NUMBER", 1.1, True),
        ("DEFAULT_TECHNOLOGY_COEFFICIENT", "默认技术系数", "NUMBER", 1.05, True),
        ("DEFAULT_EXPERT_COEFFICIENT", "默认专家系数", "NUMBER", 1.0, True),
        ("DEFAULT_DEVELOPMENT_COEFFICIENT", "默认开发系数", "NUMBER", 0.98, True),
        ("DEFAULT_MD_DSHAP_SEED", "默认 MD-DShap 随机种子", "INTEGER", 42, True),
        ("DEFAULT_MD_DSHAP_SAMPLE_ROUNDS", "默认 MD-DShap 抽样轮次", "INTEGER", 64, True),
        ("DEFAULT_MD_DSHAP_EPSILON", "默认 MD-DShap 收敛阈值", "NUMBER", 0.000001, True),
        ("DEFAULT_MD_DSHAP_BASELINE_ENABLED", "默认 MD-DShap baseline_check", "BOOLEAN", True, True),
        ("DEFAULT_ALGORITHM_MODE", "默认算法模式", "ENUM", AlgorithmMode.MD_DSHAP.value, False),
        ("DEFAULT_USAGE_WEIGHT", "默认使用权重", "NUMBER", 1.0, True),
        ("DEFAULT_COVERAGE_WEIGHT", "默认覆盖权重", "NUMBER", 1.0, True),
        ("DEFAULT_SCARCITY_WEIGHT", "默认稀缺权重", "NUMBER", 1.0, True),
        ("LOW_QUALITY_RESOURCE_THRESHOLD", "低分数据资源阈值", "NUMBER", 70, True),
        ("AMOUNT_DISPLAY_PRECISION", "金额显示精度", "INTEGER", P0_CONFIG.amount_precision, False),
        ("WEIGHT_DISPLAY_PRECISION", "权重显示精度", "INTEGER", P0_CONFIG.weight_precision, False),
    ]
    definitions.extend(
        (parameter_code, f"{metric_name}一级质量指标权重", "NUMBER", default_weight, True)
        for _, metric_name, parameter_code, default_weight in QUALITY_PRIMARY_METRICS
    )
    definitions.extend(
        (parameter_code, f"{metric_name}二级质量指标权重", "NUMBER", default_weight, True)
        for _, metric_name, _, parameter_code, default_weight in QUALITY_SECONDARY_METRICS
    )
    return {
        code: {
            "parameter_code": code,
            "parameter_name": name,
            "parameter_type": parameter_type,
            "default_value": default_value,
            "current_value": default_value,
            "scope": "P0_LOCAL",
            "editable": editable,
            "version_no": 1,
            "latest_version_id": None,
            "updated_at": now,
        }
        for code, name, parameter_type, default_value, editable in definitions
    }


def initial_state():
    now = utc_now()
    return {
        "counters": {},
        "project": {
            "project_id": P0_CONFIG.default_demo_project_id,
            "project_name": "数据收益分配系统 P0 本地演示项目",
            "scenario_name": "P0 本地演示闭环",
            "project_status": ProjectStatus.DRAFT.value,
            "operator_id": LOCAL_OPERATOR,
            "created_by": LOCAL_OPERATOR,
            "current_package_id": None,
            "current_input_snapshot_id": None,
            "current_algorithm_task_id": None,
            "current_allocation_id": None,
            "created_at": now,
            "updated_at": now,
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        },
        "data_packages": {},
        "input_snapshots": {},
        "validation_results": {},
        "data_resources": {},
        "parties": {},
        "quality_assessments": {},
        "quality_details": {},
        "quality_resource_assessments": {},
        "quality_resource_score_details": {},
        "shuyuan_meterings": {},
        "shuyuan_metering_details": {},
        "contribution_records": {},
        "utility_records": {},
        "utility_traces": {},
        "md_dshap_tasks": {},
        "md_dshap_results": {},
        "md_dshap_marginal_traces": {},
        "algorithm_audit_snapshots": {},
        "contract_constraints": {},
        "contract_ratio_plans": {},
        "contract_ratio_items": {},
        "allocation_priority_items": {},
        "allocation_scenarios": {},
        "allocation_results": {},
        "constraint_apply_traces": {},
        "report_records": {},
        "export_files": {},
        "report_manifests": {},
        "user_accounts": {},
        "roles": {},
        "permissions": {},
        "user_roles": {},
        "role_permissions": {},
        "sessions": {},
        "async_jobs": {},
        "system_parameters": default_system_parameters(now),
        "parameter_versions": {},
        "business_drafts": {},
        "snapshots": {},
        "audit_logs": {},
    }


class InMemoryRepository:
    def __init__(self, state=None, runtime_dir="backend/runtime"):
        self.runtime_dir = Path(runtime_dir)
        self.state = copy.deepcopy(state) if state is not None else initial_state()
        self.state.setdefault("quality_assessments", {})
        self.state.setdefault("quality_details", {})
        self.state.setdefault("quality_resource_assessments", {})
        self.state.setdefault("quality_resource_score_details", {})
        self.state.setdefault("shuyuan_meterings", {})
        self.state.setdefault("shuyuan_metering_details", {})
        self.state.setdefault("contribution_records", {})
        self.state.setdefault("utility_records", {})
        self.state.setdefault("utility_traces", {})
        self.state.setdefault("md_dshap_tasks", {})
        self.state.setdefault("md_dshap_results", {})
        self.state.setdefault("md_dshap_marginal_traces", {})
        self.state.setdefault("algorithm_audit_snapshots", {})
        self.state.setdefault("contract_constraints", {})
        self.state.setdefault("contract_ratio_plans", {})
        self.state.setdefault("contract_ratio_items", {})
        self.state.setdefault("allocation_priority_items", {})
        self.state.setdefault("allocation_scenarios", {})
        self.state.setdefault("allocation_results", {})
        self.state.setdefault("constraint_apply_traces", {})
        self.state.setdefault("report_records", {})
        self.state.setdefault("export_files", {})
        self.state.setdefault("report_manifests", {})
        self.state.setdefault("user_accounts", {})
        self.state.setdefault("roles", {})
        self.state.setdefault("permissions", {})
        self.state.setdefault("user_roles", {})
        self.state.setdefault("role_permissions", {})
        self.state.setdefault("sessions", {})
        self.state.setdefault("async_jobs", {})
        self.state.setdefault("system_parameters", {})
        self.state.setdefault("parameter_versions", {})
        self.state.setdefault("business_drafts", {})
        self.state.setdefault("snapshots", {})
        self.state["project"].setdefault("current_algorithm_task_id", None)
        self.state["project"].setdefault("current_allocation_id", None)
        self.state["project"].setdefault("created_by", LOCAL_OPERATOR)
        self.current_user_id = LOCAL_OPERATOR
        self._ensure_p1_user_fields()
        self._seed_system_parameters()
        self._seed_p1_rbac()

    def _ensure_p1_user_fields(self):
        changed = False
        if "created_by" not in self.state["project"]:
            self.state["project"]["created_by"] = LOCAL_OPERATOR
            changed = True
        for collection_name in (
            "data_packages",
            "input_snapshots",
            "snapshots",
            "report_records",
            "export_files",
        ):
            for item in self.state.get(collection_name, {}).values():
                if "created_by" not in item:
                    item["created_by"] = LOCAL_OPERATOR
                    changed = True
        for job in self.state.get("async_jobs", {}).values():
            if "requested_by" not in job:
                job["requested_by"] = job.get("created_by", LOCAL_OPERATOR)
                changed = True
            if "created_by" not in job:
                job["created_by"] = job.get("requested_by", LOCAL_OPERATOR)
                changed = True
        for task in self.state.get("md_dshap_tasks", {}).values():
            if "requested_by" not in task:
                task["requested_by"] = task.get("created_by", LOCAL_OPERATOR)
                changed = True
            if "created_by" not in task:
                task["created_by"] = task.get("requested_by", LOCAL_OPERATOR)
                changed = True
        for audit_log in self.state.get("audit_logs", {}).values():
            if "operator_id" not in audit_log:
                audit_log["operator_id"] = audit_log.get("created_by", LOCAL_OPERATOR)
                changed = True
            if "created_by" not in audit_log:
                audit_log["created_by"] = audit_log.get("operator_id", LOCAL_OPERATOR)
                changed = True
        if changed:
            self.save()

    def _seed_system_parameters(self):
        defaults = default_system_parameters()
        changed = False
        for code, parameter in defaults.items():
            if code not in self.state["system_parameters"]:
                self.state["system_parameters"][code] = parameter
                changed = True
        if changed:
            self.save()

    def _seed_p1_rbac(self):
        now = utc_now()
        changed = False
        permission_rows = self._default_p1_permissions(now)
        for permission in permission_rows:
            code = permission["permission_code"]
            if code not in self.state["permissions"]:
                self.state["permissions"][code] = permission
                changed = True

        role_rows = [
            ("SYSTEM_ADMIN", "系统管理员", "拥有 P1 用户、权限、导入、计算、报告和审计能力"),
            ("BUSINESS_ADMIN", "业务管理员", "维护数据、参与方、合同规则和收益分配模拟"),
            ("ALGORITHM_REVIEWER", "算法复核员", "执行和复核质量、计量、效用和 MD-DShap 任务"),
            ("CONTRACT_REVIEWER", "合同复核员", "维护合同分配规则并复核收益分配结果"),
            ("AUDITOR", "审计员", "查看审计日志、快照和历史报告"),
            ("VIEWER", "只读观察员", "查看业务页面和导出结果，不执行写操作"),
        ]
        for role_id, role_name, description in role_rows:
            if role_id not in self.state["roles"]:
                self.state["roles"][role_id] = {
                    "role_id": role_id,
                    "role_code": role_id,
                    "role_name": role_name,
                    "description": description,
                    "status": "ENABLED",
                    "created_at": now,
                    "updated_at": now,
                }
                changed = True

        all_permissions = sorted(self.state["permissions"].keys())
        business_menus = {
            "MENU_NAV_SYS_HOME",
            "MENU_NAV_DATA_PACKAGE",
            "MENU_NAV_DATA_RESOURCE",
            "MENU_NAV_DATA_PARTY",
            "MENU_NAV_MEASURE_QUALITY",
            "MENU_NAV_MEASURE_SHUYUAN",
            "MENU_NAV_MEASURE_UTILITY",
            "MENU_NAV_ALLOC_MDS",
            "MENU_NAV_ALLOC_SIMULATION",
            "MENU_NAV_ALLOC_CONSTRAINT",
            "MENU_NAV_REPORT_EXPORT",
        }
        viewer_permissions = {
            "MENU_NAV_SYS_HOME",
            "MENU_NAV_REPORT_EXPORT",
            "BTN_REP-001",
            "BTN_REP-011",
            "API_GET_/auth/me",
            "API_GET_/my/projects",
            "API_GET_/my/uploads",
            "API_GET_/my/jobs",
            "API_GET_/my/reports",
            "API_GET_/my/workbench",
            "API_GET_/projects/reports",
            "API_GET_/reports/download",
            "EXPORT_REPORT_DOWNLOAD",
        }
        auditor_permissions = {
            "MENU_NAV_SYS_HOME",
            "MENU_NAV_REPORT_EXPORT",
            "MENU_NAV_SYSTEM_AUDIT",
            "BTN_AUD-002",
            "BTN_AUD-006",
            "BTN_AUD-007",
            "BTN_REP-001",
            "BTN_REP-010",
            "BTN_REP-011",
            "API_GET_/auth/me",
            "API_GET_/my/projects",
            "API_GET_/my/uploads",
            "API_GET_/my/jobs",
            "API_GET_/my/reports",
            "API_GET_/my/workbench",
            "API_GET_/projects/reports",
            "API_GET_/reports/download",
            "API_GET_/audit/logs",
            "API_GET_/audit/snapshots",
            "API_POST_/audit/export",
            "EXPORT_REPORT_DOWNLOAD",
        }
        role_permission_map = {
            "SYSTEM_ADMIN": all_permissions,
            "BUSINESS_ADMIN": [
                code
                for code in all_permissions
                if code in business_menus
                or code in {"BTN_SYS-002", "BTN_SYS-004"}
                or code.startswith("BTN_DATA")
                or code.startswith("BTN_PARTY")
                or code.startswith("BTN_QUAL")
                or code.startswith("BTN_DU")
                or code.startswith("BTN_UTIL")
                or code.startswith("BTN_MDS")
                or code.startswith("BTN_CONS")
                or code.startswith("BTN_ALLOC")
                or code.startswith("BTN_REP")
                or code.startswith("API_")
                or code.startswith("EXPORT_")
            ],
            "ALGORITHM_REVIEWER": [
                code
                for code in all_permissions
                if any(
                    code.startswith(prefix)
                    for prefix in (
                        "MENU_NAV_MEASURE",
                        "MENU_NAV_ALLOC_MDS",
                        "BTN_QUAL",
                        "BTN_DU",
                        "BTN_UTIL",
                        "BTN_MDS",
                        "API_GET_",
                        "API_POST_/allocation/md-dshap",
                    )
                )
            ],
            "CONTRACT_REVIEWER": [
                code
                for code in all_permissions
                if any(
                    code.startswith(prefix)
                    for prefix in (
                        "MENU_NAV_ALLOC",
                        "BTN_CONS",
                        "BTN_ALLOC",
                        "API_GET_",
                        "API_POST_/allocation",
                        "API_PATCH_/allocation",
                    )
                )
            ],
            "AUDITOR": sorted(auditor_permissions & set(all_permissions)),
            "VIEWER": sorted(viewer_permissions & set(all_permissions)),
        }
        for role_id, permissions in role_permission_map.items():
            normalized_permissions = sorted(set(permissions) | {"USER_CHANGE_OWN_PASSWORD"})
            if self.state["role_permissions"].get(role_id) != normalized_permissions:
                self.state["role_permissions"][role_id] = normalized_permissions
                changed = True

        users = [
            ("local_operator", "local_operator", "本地演示用户", "SYSTEM_ADMIN", "local123"),
            ("admin", "admin", "系统管理员", "SYSTEM_ADMIN", "admin123"),
            ("biz_admin", "biz_admin", "业务管理员", "BUSINESS_ADMIN", "biz123"),
            ("business_admin", "business_admin", "业务管理员", "BUSINESS_ADMIN", "business123"),
            ("algo_reviewer", "algo_reviewer", "算法审核员", "ALGORITHM_REVIEWER", "algo123"),
            ("algorithm_reviewer", "algorithm_reviewer", "算法复核员", "ALGORITHM_REVIEWER", "algorithm123"),
            ("contract_reviewer", "contract_reviewer", "合同复核员", "CONTRACT_REVIEWER", "contract123"),
            ("auditor", "auditor", "审计员", "AUDITOR", "audit123"),
            ("viewer", "viewer", "普通查看用户", "VIEWER", "viewer123"),
        ]
        for user_id, username, display_name, role_id, password in users:
            if user_id not in self.state["user_accounts"]:
                self.state["user_accounts"][user_id] = {
                    "user_id": user_id,
                    "username": username,
                    "display_name": display_name,
                    "email": "",
                    "status": "ENABLED",
                    "password_hash": self._p1_password_hash(password),
                    "password_updated_at": now,
                    "must_change_password": False,
                    "disabled_by": None,
                    "disabled_at": None,
                    "last_login_at": None,
                    "created_at": now,
                    "updated_at": now,
                }
                self.state["user_roles"][user_id] = [role_id]
                changed = True
            elif self.state["user_roles"].get(user_id) != [role_id]:
                self.state["user_roles"][user_id] = [role_id]
                changed = True
        for user in self.state["user_accounts"].values():
            defaults = {
                "email": "",
                "password_updated_at": user.get("updated_at") or now,
                "must_change_password": False,
                "disabled_by": None,
                "disabled_at": None,
            }
            for key, value in defaults.items():
                if key not in user:
                    user[key] = value
                    changed = True
        if changed:
            self.save()

    def _default_p1_permissions(self, now):
        menu_codes = [
            ("NAV_SYS_HOME", "系统首页"),
            ("NAV_DATA_PACKAGE", "数据接入管理"),
            ("NAV_DATA_RESOURCE", "数据资源管理"),
            ("NAV_DATA_PARTY", "参与方管理"),
            ("NAV_MEASURE_QUALITY", "质量评估管理"),
            ("NAV_MEASURE_SHUYUAN", "数元计量管理"),
            ("NAV_MEASURE_UTILITY", "贡献度与效用计算"),
            ("NAV_ALLOC_MDS", "MD-DShap 计算管理"),
            ("NAV_ALLOC_SIMULATION", "收益分配模拟"),
            ("NAV_ALLOC_CONSTRAINT", "合同分配规则"),
            ("NAV_REPORT_EXPORT", "报告生成与导出"),
            ("NAV_SYSTEM_PARAMETER", "参数配置"),
            ("NAV_SYSTEM_USER", "用户与权限管理"),
            ("NAV_SYSTEM_AUDIT", "审计日志管理"),
        ]
        button_codes = [
            "SYS-002", "SYS-004", "DATA-002", "DATA-003", "DATA-010", "DATA-011",
            "DATA-012", "DATA-009", "PARTY-002", "PARTY-003", "PARTY-005",
            "QUAL-003", "DU-009", "UTIL-006", "UTIL-008", "MDS-011", "MDS-012",
            "MDS-019", "ALLOC-011", "ALLOC-015", "CONS-002", "CONS-003", "CONS-011",
            "REP-001", "REP-002", "REP-003", "REP-004", "REP-005", "REP-006", "REP-010",
            "REP-011", "REP-012", "USER-001", "USER-002", "USER-003", "USER-004",
            "USER-005", "USER-007", "USER-008", "USER-009", "USER-010", "USER-011",
            "AUD-002", "AUD-006", "AUD-007",
            "PARAM-001", "PARAM-002", "PARAM-004", "PARAM-008",
        ]
        explicit_user_permissions = [
            ("USER_CREATE", "新增用户"),
            ("USER_UPDATE", "编辑用户"),
            ("USER_DISABLE", "禁用用户"),
            ("USER_RESET_PASSWORD", "重置用户密码"),
            ("USER_CHANGE_OWN_PASSWORD", "修改本人密码"),
        ]
        api_paths = [
            ("GET", "/auth/me"),
            ("POST", "/auth/login"),
            ("POST", "/auth/logout"),
            ("GET", "/my/projects"),
            ("GET", "/my/uploads"),
            ("GET", "/my/jobs"),
            ("GET", "/my/reports"),
            ("GET", "/my/workbench"),
            ("GET", "/system/users"),
            ("POST", "/system/users"),
            ("PATCH", "/system/users"),
            ("GET", "/users"),
            ("POST", "/users"),
            ("PATCH", "/users"),
            ("PUT", "/users/me/password"),
            ("GET", "/system/roles"),
            ("PUT", "/system/roles"),
            ("GET", "/system/permissions"),
            ("GET", "/import-templates"),
            ("POST", "/projects/data-packages/import"),
            ("POST", "/projects/jobs"),
            ("GET", "/jobs"),
            ("POST", "/jobs/cancel"),
            ("POST", "/projects/md-dshap/tasks"),
            ("GET", "/projects/md-dshap/tasks/progress"),
            ("POST", "/projects/reports/pdf"),
            ("GET", "/projects/reports"),
            ("GET", "/reports/download"),
            ("PATCH", "/reports/archive"),
            ("GET", "/audit/logs"),
            ("GET", "/audit/snapshots"),
            ("POST", "/audit/export"),
        ]
        permissions = []
        for menu_code, menu_name in menu_codes:
            permissions.append(
                {
                    "permission_code": f"MENU_{menu_code}",
                    "permission_name": menu_name,
                    "permission_type": "MENU",
                    "resource_code": menu_code,
                    "action": "VIEW",
                    "created_at": now,
                }
            )
        for button_code in button_codes:
            permissions.append(
                {
                    "permission_code": f"BTN_{button_code}",
                    "permission_name": button_code,
                    "permission_type": "BUTTON",
                    "resource_code": button_code,
                    "action": "EXECUTE",
                    "created_at": now,
                }
            )
        for permission_code, permission_name in explicit_user_permissions:
            permissions.append(
                {
                    "permission_code": permission_code,
                    "permission_name": permission_name,
                    "permission_type": "BUTTON",
                    "resource_code": permission_code,
                    "action": "EXECUTE",
                    "created_at": now,
                }
            )
        for method, path in api_paths:
            permissions.append(
                {
                    "permission_code": f"API_{method}_{path}",
                    "permission_name": f"{method} {path}",
                    "permission_type": "API",
                    "resource_code": path,
                    "action": method,
                    "created_at": now,
                }
            )
        permissions.append(
            {
                "permission_code": "EXPORT_REPORT_DOWNLOAD",
                "permission_name": "报告文件下载",
                "permission_type": "EXPORT",
                "resource_code": "REPORT_DOWNLOAD",
                "action": "DOWNLOAD",
                "created_at": now,
            }
        )
        return permissions

    def _p1_password_hash(self, password):
        return hashlib.sha256(f"dvas-p1:{password}".encode("utf-8")).hexdigest()

    def next_id(self, prefix):
        current = self.state["counters"].get(prefix, 0) + 1
        self.state["counters"][prefix] = current
        return f"{prefix}_{current:06d}"

    def get_project(self):
        return copy.deepcopy(self.state["project"])

    def update_project(self, **changes):
        project = self.state["project"]
        project.update(changes)
        project["updated_at"] = utc_now()
        self.save()
        return copy.deepcopy(project)

    def put_data_package(self, package):
        self.state["data_packages"][package["package_id"]] = copy.deepcopy(package)
        self.save()
        return copy.deepcopy(package)

    def get_data_package(self, package_id):
        package = self.state["data_packages"].get(package_id)
        return copy.deepcopy(package) if package else None

    def list_data_packages(self):
        return sorted(
            [copy.deepcopy(item) for item in self.state["data_packages"].values()],
            key=lambda item: item["created_at"],
        )

    def delete_data_package(self, package_id):
        package = self.state["data_packages"].pop(package_id, None)
        if package is not None:
            self.save()
        return copy.deepcopy(package) if package else None

    def put_input_snapshot(self, snapshot):
        self.state["input_snapshots"][snapshot["snapshot_id"]] = copy.deepcopy(snapshot)
        self.save()
        return copy.deepcopy(snapshot)

    def get_input_snapshot(self, snapshot_id):
        snapshot = self.state["input_snapshots"].get(snapshot_id)
        return copy.deepcopy(snapshot) if snapshot else None

    def delete_input_snapshot(self, snapshot_id):
        if not snapshot_id:
            return None
        snapshot = self.state["input_snapshots"].pop(snapshot_id, None)
        if snapshot is not None:
            self.save()
        return copy.deepcopy(snapshot) if snapshot else None

    def put_snapshot(self, snapshot):
        self.state["snapshots"][snapshot["snapshot_id"]] = copy.deepcopy(snapshot)
        self.save()
        return copy.deepcopy(snapshot)

    def get_snapshot(self, snapshot_id):
        snapshot = self.state["snapshots"].get(snapshot_id)
        return copy.deepcopy(snapshot) if snapshot else None

    def list_snapshots(self):
        return sorted(
            [copy.deepcopy(item) for item in self.state["snapshots"].values()],
            key=lambda item: item["created_at"],
        )

    def put_validation_result(self, validation_result):
        self.state["validation_results"][validation_result["package_id"]] = copy.deepcopy(
            validation_result
        )
        self.save()
        return copy.deepcopy(validation_result)

    def get_validation_result(self, package_id):
        validation = self.state["validation_results"].get(package_id)
        return copy.deepcopy(validation) if validation else None

    def delete_validation_result(self, package_id):
        validation = self.state["validation_results"].pop(package_id, None)
        if validation is not None:
            self.save()
        return copy.deepcopy(validation) if validation else None

    def put_data_resource(self, resource):
        self.state["data_resources"][resource["resource_id"]] = copy.deepcopy(resource)
        self.save()
        return copy.deepcopy(resource)

    def get_data_resource(self, resource_id):
        resource = self.state["data_resources"].get(resource_id)
        return copy.deepcopy(resource) if resource else None

    def list_data_resources(self, package_id=None):
        items = [copy.deepcopy(item) for item in self.state["data_resources"].values()]
        if package_id:
            items = [item for item in items if item["package_id"] == package_id]
        return sorted(items, key=lambda item: item["resource_id"])

    def delete_data_resources_by_package(self, package_id):
        removed = []
        for resource_id, resource in list(self.state["data_resources"].items()):
            if resource.get("package_id") == package_id:
                removed.append(copy.deepcopy(resource))
                del self.state["data_resources"][resource_id]
        if removed:
            self.save()
        return sorted(removed, key=lambda item: item["resource_id"])

    def clear_derived_calculation_artifacts(self):
        artifact_keys = [
            "quality_assessments",
            "quality_details",
            "quality_resource_assessments",
            "quality_resource_score_details",
            "shuyuan_meterings",
            "shuyuan_metering_details",
            "contribution_records",
            "utility_records",
            "utility_traces",
            "md_dshap_tasks",
            "md_dshap_results",
            "md_dshap_marginal_traces",
            "algorithm_audit_snapshots",
            "allocation_scenarios",
            "allocation_results",
            "constraint_apply_traces",
        ]
        removed_counts = {key: len(self.state.get(key, {})) for key in artifact_keys}
        if any(removed_counts.values()):
            for key in artifact_keys:
                self.state[key] = {}
            self.save()
        return removed_counts

    def put_party(self, party):
        self.state["parties"][party["party_id"]] = copy.deepcopy(party)
        self.save()
        return copy.deepcopy(party)

    def get_party(self, party_id):
        party = self.state["parties"].get(party_id)
        return copy.deepcopy(party) if party else None

    def list_parties(self):
        return sorted(
            [copy.deepcopy(item) for item in self.state["parties"].values()],
            key=lambda item: item["party_id"],
        )

    def put_quality_assessment(self, assessment, details):
        self.state["quality_assessments"][assessment["assessment_id"]] = copy.deepcopy(assessment)
        self.state["quality_details"][assessment["assessment_id"]] = copy.deepcopy(details)
        self.save()
        return copy.deepcopy(assessment)

    def get_quality_assessment(self, assessment_id):
        assessment = self.state["quality_assessments"].get(assessment_id)
        return copy.deepcopy(assessment) if assessment else None

    def list_quality_assessments(self):
        return sorted(
            [copy.deepcopy(item) for item in self.state["quality_assessments"].values()],
            key=lambda item: item["created_at"],
        )

    def get_quality_details(self, assessment_id):
        return copy.deepcopy(self.state["quality_details"].get(assessment_id, []))

    def put_quality_resource_results(self, assessment_id, resource_assessments, score_details):
        for key, item in list(self.state["quality_resource_assessments"].items()):
            if item.get("assessment_id") == assessment_id:
                del self.state["quality_resource_assessments"][key]
        for key, item in list(self.state["quality_resource_score_details"].items()):
            if item.get("assessment_id") == assessment_id:
                del self.state["quality_resource_score_details"][key]
        for resource_assessment in resource_assessments:
            self.state["quality_resource_assessments"][
                resource_assessment["resource_assessment_id"]
            ] = copy.deepcopy(resource_assessment)
        for detail in score_details:
            self.state["quality_resource_score_details"][detail["detail_id"]] = copy.deepcopy(detail)
        self.save()
        return copy.deepcopy(resource_assessments), copy.deepcopy(score_details)

    def list_quality_resource_assessments(self, assessment_id=None, package_id=None, project_id=None):
        items = [
            copy.deepcopy(item)
            for item in self.state["quality_resource_assessments"].values()
        ]
        if assessment_id:
            items = [item for item in items if item["assessment_id"] == assessment_id]
        if package_id:
            items = [item for item in items if item["package_id"] == package_id]
        if project_id:
            items = [item for item in items if item["project_id"] == project_id]
        return sorted(items, key=lambda item: (item["created_at"], item["resource_id"]))

    def list_quality_resource_score_details(
        self,
        assessment_id=None,
        resource_assessment_id=None,
        resource_id=None,
    ):
        items = [
            copy.deepcopy(item)
            for item in self.state["quality_resource_score_details"].values()
        ]
        if assessment_id:
            items = [item for item in items if item["assessment_id"] == assessment_id]
        if resource_assessment_id:
            items = [
                item
                for item in items
                if item["resource_assessment_id"] == resource_assessment_id
            ]
        if resource_id:
            items = [item for item in items if item["resource_id"] == resource_id]
        return sorted(
            items,
            key=lambda item: (item["resource_id"], item["metric_level"], item["dimension_code"]),
        )

    def put_shuyuan_metering(self, metering, details):
        self.state["shuyuan_meterings"][metering["metering_id"]] = copy.deepcopy(metering)
        self.state["shuyuan_metering_details"][metering["metering_id"]] = copy.deepcopy(details)
        self.save()
        return copy.deepcopy(metering)

    def get_shuyuan_metering(self, metering_id):
        metering = self.state["shuyuan_meterings"].get(metering_id)
        return copy.deepcopy(metering) if metering else None

    def list_shuyuan_meterings(self):
        return sorted(
            [copy.deepcopy(item) for item in self.state["shuyuan_meterings"].values()],
            key=lambda item: item["created_at"],
        )

    def get_shuyuan_metering_details(self, metering_id):
        return copy.deepcopy(self.state["shuyuan_metering_details"].get(metering_id, []))

    def put_contribution_records(self, records):
        for record in records:
            self.state["contribution_records"][record["contribution_id"]] = copy.deepcopy(record)
        self.save()
        return copy.deepcopy(records)

    def list_contribution_records(self, contribution_run_id=None):
        items = [copy.deepcopy(item) for item in self.state["contribution_records"].values()]
        if contribution_run_id:
            items = [item for item in items if item["contribution_run_id"] == contribution_run_id]
        return sorted(items, key=lambda item: (item["created_at"], item["contribution_id"]))

    def put_utility_record(self, utility, traces):
        self.state["utility_records"][utility["utility_id"]] = copy.deepcopy(utility)
        self.state["utility_traces"][utility["utility_id"]] = copy.deepcopy(traces)
        self.save()
        return copy.deepcopy(utility)

    def get_utility_record(self, utility_id):
        utility = self.state["utility_records"].get(utility_id)
        return copy.deepcopy(utility) if utility else None

    def list_utility_records(self):
        return sorted(
            [copy.deepcopy(item) for item in self.state["utility_records"].values()],
            key=lambda item: item["created_at"],
        )

    def get_utility_traces(self, utility_id):
        return copy.deepcopy(self.state["utility_traces"].get(utility_id, []))

    def put_algorithm_audit_snapshot(self, snapshot):
        self.state["algorithm_audit_snapshots"][snapshot["snapshot_id"]] = copy.deepcopy(snapshot)
        self.save()
        return copy.deepcopy(snapshot)

    def put_md_dshap_task(self, task, results, traces):
        self.state["md_dshap_tasks"][task["task_id"]] = copy.deepcopy(task)
        for result in results:
            self.state["md_dshap_results"][result["result_id"]] = copy.deepcopy(result)
        for trace in traces:
            self.state["md_dshap_marginal_traces"][trace["trace_id"]] = copy.deepcopy(trace)
        self.save()
        return copy.deepcopy(task)

    def get_md_dshap_task(self, task_id):
        task = self.state["md_dshap_tasks"].get(task_id)
        return copy.deepcopy(task) if task else None

    def list_md_dshap_tasks(self):
        return sorted(
            [copy.deepcopy(item) for item in self.state["md_dshap_tasks"].values()],
            key=lambda item: item["created_at"],
        )

    def list_md_dshap_results(self, task_id=None):
        items = [copy.deepcopy(item) for item in self.state["md_dshap_results"].values()]
        if task_id:
            items = [item for item in items if item["task_id"] == task_id]
        return sorted(items, key=lambda item: (item["created_at"], item["result_id"]))

    def list_md_dshap_marginal_traces(self, task_id=None):
        items = [
            copy.deepcopy(item) for item in self.state["md_dshap_marginal_traces"].values()
        ]
        if task_id:
            items = [item for item in items if item["task_id"] == task_id]
        return sorted(items, key=lambda item: (item["iteration_no"], item["trace_id"]))

    def put_contract_constraint(self, constraint):
        self.state["contract_constraints"][constraint["constraint_id"]] = copy.deepcopy(constraint)
        self.save()
        return copy.deepcopy(constraint)

    def get_contract_constraint(self, constraint_id):
        constraint = self.state["contract_constraints"].get(constraint_id)
        return copy.deepcopy(constraint) if constraint else None

    def list_contract_constraints(self):
        return sorted(
            [copy.deepcopy(item) for item in self.state["contract_constraints"].values()],
            key=lambda item: (item["priority"], item["constraint_id"]),
        )

    def put_contract_ratio_plan(self, plan, items):
        self.state["contract_ratio_plans"][plan["plan_id"]] = copy.deepcopy(plan)
        for item_id, item in list(self.state["contract_ratio_items"].items()):
            if item.get("plan_id") == plan["plan_id"]:
                del self.state["contract_ratio_items"][item_id]
        for item in items:
            self.state["contract_ratio_items"][item["item_id"]] = copy.deepcopy(item)
        self.save()
        return copy.deepcopy(plan), copy.deepcopy(items)

    def get_contract_ratio_plan(self, plan_id):
        plan = self.state["contract_ratio_plans"].get(plan_id)
        return copy.deepcopy(plan) if plan else None

    def latest_contract_ratio_plan(self, project_id=None):
        plans = [copy.deepcopy(item) for item in self.state["contract_ratio_plans"].values()]
        if project_id:
            plans = [item for item in plans if item.get("project_id") == project_id]
        if not plans:
            return None
        return sorted(plans, key=lambda item: (item.get("updated_at", ""), item["plan_id"]))[-1]

    def list_contract_ratio_items(self, plan_id=None):
        items = [copy.deepcopy(item) for item in self.state["contract_ratio_items"].values()]
        if plan_id:
            items = [item for item in items if item.get("plan_id") == plan_id]
        return sorted(items, key=lambda item: (item.get("sort_no", 0), item["item_id"]))

    def delete_contract_ratio_plan(self, project_id):
        removed = []
        for plan_id, plan in list(self.state["contract_ratio_plans"].items()):
            if plan.get("project_id") == project_id:
                removed.append(copy.deepcopy(plan))
                del self.state["contract_ratio_plans"][plan_id]
        if removed:
            for item_id, item in list(self.state["contract_ratio_items"].items()):
                if item.get("project_id") == project_id:
                    del self.state["contract_ratio_items"][item_id]
            self.save()
        return removed

    def put_allocation_priority_items(self, items, allocation_id=None, source_constraint_id=None):
        if allocation_id is not None or source_constraint_id is not None:
            for item_id, item in list(self.state["allocation_priority_items"].items()):
                if allocation_id is not None and item.get("allocation_id") == allocation_id:
                    del self.state["allocation_priority_items"][item_id]
                elif source_constraint_id is not None and item.get("source_constraint_id") == source_constraint_id:
                    del self.state["allocation_priority_items"][item_id]
        for item in items:
            self.state["allocation_priority_items"][item["item_id"]] = copy.deepcopy(item)
        self.save()
        return copy.deepcopy(items)

    def list_allocation_priority_items(self, allocation_id=None):
        items = [copy.deepcopy(item) for item in self.state["allocation_priority_items"].values()]
        if allocation_id is not None:
            items = [item for item in items if item.get("allocation_id") == allocation_id]
        return sorted(items, key=lambda item: (item.get("priority_order", 0), item["item_id"]))

    def put_allocation_scenario(self, allocation):
        self.state["allocation_scenarios"][allocation["allocation_id"]] = copy.deepcopy(allocation)
        self.save()
        return copy.deepcopy(allocation)

    def get_allocation_scenario(self, allocation_id):
        allocation = self.state["allocation_scenarios"].get(allocation_id)
        return copy.deepcopy(allocation) if allocation else None

    def list_allocation_scenarios(self):
        return sorted(
            [copy.deepcopy(item) for item in self.state["allocation_scenarios"].values()],
            key=lambda item: item["created_at"],
        )

    def put_allocation_results(self, results, traces):
        for result in results:
            self.state["allocation_results"][result["result_id"]] = copy.deepcopy(result)
        for trace in traces:
            self.state["constraint_apply_traces"][trace["trace_id"]] = copy.deepcopy(trace)
        self.save()
        return copy.deepcopy(results)

    def list_allocation_results(self, allocation_id=None):
        items = [copy.deepcopy(item) for item in self.state["allocation_results"].values()]
        if allocation_id:
            items = [item for item in items if item["allocation_id"] == allocation_id]
        return sorted(
            items,
            key=lambda item: (
                item["version_no"],
                0 if item.get("subject_track") == "CONTRACT_PRIORITY" else 1,
                item["result_id"],
            ),
        )

    def list_constraint_apply_traces(self, allocation_id=None):
        items = [copy.deepcopy(item) for item in self.state["constraint_apply_traces"].values()]
        if allocation_id:
            items = [item for item in items if item["allocation_id"] == allocation_id]
        return sorted(items, key=lambda item: (item["version_no"], item["trace_id"]))

    def put_report_record(self, report):
        self.state["report_records"][report["report_id"]] = copy.deepcopy(report)
        self.save()
        return copy.deepcopy(report)

    def list_report_records(self):
        return sorted(
            [copy.deepcopy(item) for item in self.state["report_records"].values()],
            key=lambda item: item["created_at"],
        )

    def put_export_files(self, export_files):
        for export_file in export_files:
            self.state["export_files"][export_file["export_file_id"]] = copy.deepcopy(export_file)
        self.save()
        return copy.deepcopy(export_files)

    def list_export_files(self, report_id=None):
        items = [copy.deepcopy(item) for item in self.state["export_files"].values()]
        if report_id:
            items = [item for item in items if item["report_id"] == report_id]
        return sorted(items, key=lambda item: (item["created_at"], item["export_file_id"]))

    def get_report_record(self, report_id):
        report = self.state["report_records"].get(report_id)
        return copy.deepcopy(report) if report else None

    def update_report_record(self, report_id, **changes):
        report = self.state["report_records"].get(report_id)
        if not report:
            return None
        report.update(changes)
        report["updated_at"] = utc_now()
        self.save()
        return copy.deepcopy(report)

    def get_export_file(self, export_file_id):
        export_file = self.state["export_files"].get(export_file_id)
        return copy.deepcopy(export_file) if export_file else None

    def put_report_manifest(self, manifest):
        self.state["report_manifests"][manifest["report_id"]] = copy.deepcopy(manifest)
        self.save()
        return copy.deepcopy(manifest)

    def get_report_manifest(self, report_id):
        manifest = self.state["report_manifests"].get(report_id)
        return copy.deepcopy(manifest) if manifest else None

    def list_report_manifests(self):
        return sorted(
            [copy.deepcopy(item) for item in self.state["report_manifests"].values()],
            key=lambda item: item["created_at"],
        )

    def put_system_parameter(self, parameter):
        self.state["system_parameters"][parameter["parameter_code"]] = copy.deepcopy(parameter)
        self.save()
        return copy.deepcopy(parameter)

    def get_system_parameter(self, parameter_code):
        parameter = self.state["system_parameters"].get(parameter_code)
        return copy.deepcopy(parameter) if parameter else None

    def list_system_parameters(self):
        return sorted(
            [copy.deepcopy(item) for item in self.state["system_parameters"].values()],
            key=lambda item: item["parameter_code"],
        )

    def put_parameter_version(self, parameter_version):
        self.state["parameter_versions"][parameter_version["version_id"]] = copy.deepcopy(
            parameter_version
        )
        self.save()
        return copy.deepcopy(parameter_version)

    def list_parameter_versions(self, parameter_code=None):
        items = [copy.deepcopy(item) for item in self.state["parameter_versions"].values()]
        if parameter_code:
            items = [item for item in items if item["parameter_code"] == parameter_code]
        return sorted(items, key=lambda item: (item["created_at"], item["version_id"]))

    def put_business_draft(self, draft):
        self.state["business_drafts"][draft["draft_id"]] = copy.deepcopy(draft)
        self.save()
        return copy.deepcopy(draft)

    def get_business_draft(self, draft_id):
        draft = self.state["business_drafts"].get(draft_id)
        return copy.deepcopy(draft) if draft else None

    def list_business_drafts(self, draft_type=None):
        items = [copy.deepcopy(item) for item in self.state["business_drafts"].values()]
        if draft_type:
            items = [item for item in items if item["draft_type"] == draft_type]
        return sorted(items, key=lambda item: (item["created_at"], item["draft_id"]))

    def put_audit_log(self, audit_log):
        self.state["audit_logs"][audit_log["log_id"]] = copy.deepcopy(audit_log)
        self.save()
        return copy.deepcopy(audit_log)

    def get_audit_log(self, log_id):
        audit_log = self.state["audit_logs"].get(log_id)
        return copy.deepcopy(audit_log) if audit_log else None

    def list_audit_logs(self):
        return sorted(
            [copy.deepcopy(item) for item in self.state["audit_logs"].values()],
            key=lambda item: item["created_at"],
        )

    def get_snapshot(self, snapshot_id):
        snapshot = self.state["snapshots"].get(snapshot_id)
        return copy.deepcopy(snapshot) if snapshot else None

    def list_user_accounts(self):
        return sorted(
            [self._public_user(item) for item in self.state["user_accounts"].values()],
            key=lambda item: item["username"],
        )

    def get_user_account(self, user_id_or_username):
        for user in self.state["user_accounts"].values():
            if user.get("user_id") == user_id_or_username or user.get("username") == user_id_or_username:
                return copy.deepcopy(user)
        return None

    def put_user_account(self, user):
        self.state["user_accounts"][user["user_id"]] = copy.deepcopy(user)
        self.save()
        return self._public_user(user)

    def update_user_account(self, user_id, **changes):
        user = self.state["user_accounts"].get(user_id)
        if not user:
            return None
        user.update(changes)
        user["updated_at"] = utc_now()
        self.save()
        return self._public_user(user)

    def _public_user(self, user):
        public = copy.deepcopy(user)
        for key in (
            "password",
            "password_hash",
            "initial_password",
            "temporary_password",
            "one_time_initial_password",
            "one_time_temporary_password",
        ):
            public.pop(key, None)
        public["roles"] = self.state["user_roles"].get(user["user_id"], [])
        return public

    def list_roles(self):
        return sorted(
            [copy.deepcopy(item) for item in self.state["roles"].values()],
            key=lambda item: item["role_id"],
        )

    def get_role(self, role_id):
        role = self.state["roles"].get(role_id)
        return copy.deepcopy(role) if role else None

    def put_role(self, role):
        self.state["roles"][role["role_id"]] = copy.deepcopy(role)
        self.save()
        return copy.deepcopy(role)

    def list_permissions(self):
        return sorted(
            [copy.deepcopy(item) for item in self.state["permissions"].values()],
            key=lambda item: item["permission_code"],
        )

    def get_role_permission_codes(self, role_id):
        return list(self.state["role_permissions"].get(role_id, []))

    def set_role_permission_codes(self, role_id, permission_codes):
        self.state["role_permissions"][role_id] = sorted(set(permission_codes))
        self.save()
        return self.get_role_permission_codes(role_id)

    def set_user_roles(self, user_id, role_ids):
        self.state["user_roles"][user_id] = sorted(set(role_ids))
        self.save()
        return list(self.state["user_roles"][user_id])

    def user_role_ids(self, user_id):
        return list(self.state["user_roles"].get(user_id, []))

    def user_has_any_role(self, user_id, role_ids):
        return bool(set(self.user_role_ids(user_id)) & set(role_ids))

    def user_permission_codes(self, user_id):
        permission_codes = set()
        for role_id in self.state["user_roles"].get(user_id, []):
            permission_codes.update(self.state["role_permissions"].get(role_id, []))
        return sorted(permission_codes)

    def enabled_system_admin_user_ids(self):
        return sorted(
            user_id
            for user_id, user in self.state["user_accounts"].items()
            if user.get("status") == "ENABLED"
            and "SYSTEM_ADMIN" in self.state["user_roles"].get(user_id, [])
        )

    def put_session(self, session):
        self.state["sessions"][session["token"]] = copy.deepcopy(session)
        self.save()
        return copy.deepcopy(session)

    def get_session(self, token):
        session = self.state["sessions"].get(token)
        return copy.deepcopy(session) if session else None

    def delete_session(self, token):
        session = self.state["sessions"].pop(token, None)
        if session is not None:
            self.save()
        return copy.deepcopy(session) if session else None

    def revoke_user_sessions(self, user_id, except_token=None):
        changed = False
        for token, session in self.state["sessions"].items():
            if session.get("user_id") == user_id and token != except_token and session.get("status") == "ACTIVE":
                session["status"] = "REVOKED"
                session["revoked_at"] = utc_now()
                changed = True
        if changed:
            self.save()

    def put_async_job(self, job):
        self.state["async_jobs"][job["job_id"]] = copy.deepcopy(job)
        self.save()
        return copy.deepcopy(job)

    def get_async_job(self, job_id):
        job = self.state["async_jobs"].get(job_id)
        return copy.deepcopy(job) if job else None

    def list_async_jobs(self, project_id=None):
        items = [copy.deepcopy(item) for item in self.state["async_jobs"].values()]
        if project_id:
            items = [item for item in items if item.get("project_id") == project_id]
        return sorted(items, key=lambda item: item["created_at"])

    def save(self):
        return None


class JsonFileRepository(InMemoryRepository):
    def __init__(self, path="backend/runtime/dvas_state.json"):
        self.path = Path(path)
        if self.path.exists():
            state = json.loads(self.path.read_text(encoding="utf-8"))
        else:
            state = initial_state()
        super().__init__(state, runtime_dir=self.path.parent)

    def save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(
            json.dumps(self.state, ensure_ascii=False, indent=2, sort_keys=True),
            encoding="utf-8",
        )
