import base64
import copy
import csv
import hashlib
import io
import json
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from uuid import uuid4
import zipfile
import xml.etree.ElementTree as ET

from .audit import AuditService
from .constants import (
    AllocationMode,
    AlgorithmMode,
    ContractConstraintType,
    P0_CONFIG,
    ProjectStatus,
    ReportFormat,
    SnapshotType,
)
from .contracts import (
    LOCAL_OPERATOR,
    SIMULATION_DISCLAIMER,
    ApiError,
    stable_checksum,
    table_page,
    utc_now,
)
from .demo_data import get_demo_case
from .repository import QUALITY_PRIMARY_METRICS, QUALITY_SECONDARY_METRICS
from .state_machine import ProjectStateMachine


SYSTEM_HOME_MENU = {
    "menu_id": "MENU_SYS_HOME",
    "parent_id": None,
    "menu_code": "NAV_SYS_HOME",
    "menu_name": "系统首页",
    "module_code": "SYS",
    "route_path": "/dashboard",
    "menu_level": 1,
    "sort_no": 1,
    "p0_required": True,
    "p1_only": False,
    "status": "ENABLED",
    "children": [],
}

SYSTEM_HOME_BUTTON_PERMISSIONS = [
    {
        "button_code": "SYS-002",
        "button_name": "选择演示数据",
        "module_code": "SYS",
        "menu_code": "NAV_SYS_HOME",
        "menu_id": "MENU_SYS_HOME",
        "permission_action": "CREATE",
    },
    {
        "button_code": "SYS-004",
        "button_name": "启动完整计算",
        "module_code": "SYS",
        "menu_code": "NAV_SYS_HOME",
        "menu_id": "MENU_SYS_HOME",
        "permission_action": "CALCULATE",
    },
    {
        "button_code": "SYS-005",
        "button_name": "查看系统风险提示",
        "module_code": "SYS",
        "menu_code": "NAV_SYS_HOME",
        "menu_id": "MENU_SYS_HOME",
        "permission_action": "VIEW",
    },
]


SENSITIVE_AUDIT_KEYS = {
    "password",
    "password_hash",
    "initial_password",
    "temporary_password",
    "one_time_initial_password",
    "one_time_temporary_password",
    "current_password",
    "new_password",
    "confirm_password",
    "token",
    "_auth_token",
}


def redact_sensitive(value):
    if isinstance(value, dict):
        redacted = {}
        for key, item in value.items():
            if key in SENSITIVE_AUDIT_KEYS or key.endswith("_password"):
                redacted[key] = "***REDACTED***"
            else:
                redacted[key] = redact_sensitive(item)
        return redacted
    if isinstance(value, list):
        return [redact_sensitive(item) for item in value]
    return value


def current_operator_id(repository):
    return getattr(repository, "current_user_id", LOCAL_OPERATOR) or LOCAL_OPERATOR


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
    button_code=None,
):
    audit = AuditService(repository)
    if status == "FAILED":
        return audit.record_failure(
            module_code=module_code,
            menu_code=menu_code,
            operation_type=operation_type,
            object_type=object_type,
            object_id=object_id,
            error_message=failure_reason,
            input_snapshot_id=input_snapshot_id,
            parameter_snapshot_id=parameter_snapshot_id,
            output_snapshot_id=result_snapshot_id,
            before_value_json=before_value_json,
            after_value_json=after_value_json,
            button_code=button_code,
        )
    return audit.record_success(
        module_code=module_code,
        menu_code=menu_code,
        operation_type=operation_type,
        object_type=object_type,
        object_id=object_id,
        input_snapshot_id=input_snapshot_id,
        parameter_snapshot_id=parameter_snapshot_id,
        output_snapshot_id=result_snapshot_id,
        before_value_json=before_value_json,
        after_value_json=after_value_json,
        button_code=button_code,
    )


def parameter_current_value(repository, parameter_code, default):
    parameter = repository.get_system_parameter(parameter_code)
    if not parameter:
        return default
    return parameter.get("current_value", default)


class ProjectService:
    def __init__(self, repository):
        self.repository = repository

    def current_project(self):
        return self.repository.get_project()

    def status(self, project_id=None):
        project = self.repository.get_project()
        if project_id and project_id != project["project_id"]:
            raise ApiError("DVAS_NOT_FOUND", "项目不存在", status=404)
        return {
            **project,
            "flow": DashboardService(self.repository).preconditions(),
        }

    def flow(self, project_id=None):
        project = self.repository.get_project()
        if project_id and project_id != project["project_id"]:
            raise ApiError("DVAS_NOT_FOUND", "项目不存在", status=404)
        return DashboardService(self.repository).preconditions()


class AuthService:
    def __init__(self, repository):
        self.repository = repository

    def login(self, payload):
        username = str((payload or {}).get("username") or "").strip()
        password = str((payload or {}).get("password") or "")
        user = self.repository.get_user_account(username)
        if not user or user.get("status") != "ENABLED" or user.get("password_hash") != self._hash_password(password):
            raise ApiError(
                "DVAS_AUTH_FAILED",
                "用户名或密码错误",
                status=401,
                field_errors=[{"field": "username", "reason": "认证失败"}],
            )
        token = f"session_{uuid4().hex}"
        now = utc_now()
        session = {
            "token": token,
            "user_id": user["user_id"],
            "username": user["username"],
            "created_at": now,
            "last_seen_at": now,
            "status": "ACTIVE",
        }
        self.repository.put_session(session)
        self.repository.update_user_account(user["user_id"], last_login_at=now)
        self.repository.current_user_id = user["user_id"]
        public_user = self._public_user(user["user_id"])
        write_audit(
            self.repository,
            module_code="USER",
            menu_code="NAV_SYSTEM_USER",
            operation_type="LOGIN",
            object_type="user_account",
            object_id=user["user_id"],
            status="SUCCESS",
            after_value_json={"user_id": user["user_id"], "username": user["username"]},
        )
        return {
            "token": token,
            "user": public_user,
            "roles": public_user["roles"],
            "permissions": self.permission_summary(user["user_id"]),
        }

    def logout(self, payload):
        token = (payload or {}).get("_auth_token") or (payload or {}).get("token")
        session = self.repository.delete_session(token) if token else None
        if session:
            write_audit(
                self.repository,
                module_code="USER",
                menu_code="NAV_SYSTEM_USER",
                operation_type="LOGOUT",
                object_type="user_session",
                object_id=session["token"],
                status="SUCCESS",
                after_value_json={"user_id": session["user_id"]},
            )
        return {"logged_out": bool(session)}

    def me(self, payload):
        user = self.current_user(payload, require_login=True)
        return {
            "user": user,
            "roles": user["roles"],
            "permissions": self.permission_summary(user["user_id"]),
        }

    def current_user(self, payload, require_login=False):
        token = (payload or {}).get("_auth_token")
        if token:
            session = self.repository.get_session(token)
            if not session or session.get("status") != "ACTIVE":
                raise ApiError("DVAS_AUTH_REQUIRED", "登录状态已失效", status=401)
            account = self.repository.get_user_account(session["user_id"])
            if not account or account.get("status") != "ENABLED":
                self.repository.delete_session(token)
                raise ApiError("DVAS_AUTH_REQUIRED", "账号已禁用或登录状态已失效", status=401)
            return self._public_user(session["user_id"])
        if require_login:
            raise ApiError("DVAS_AUTH_REQUIRED", "请先登录", status=401)
        return self._public_user(LOCAL_OPERATOR)

    def permission_summary(self, user_id):
        permission_codes = self.repository.user_permission_codes(user_id)
        permissions = self.repository.list_permissions()
        by_code = {item["permission_code"]: item for item in permissions}
        menu_codes = []
        button_codes = []
        api_permissions = []
        export_permissions = []
        for code in permission_codes:
            permission = by_code.get(code)
            if not permission:
                continue
            if permission["permission_type"] == "MENU":
                menu_codes.append(permission["resource_code"])
            elif permission["permission_type"] == "BUTTON":
                button_codes.append(permission["resource_code"])
            elif permission["permission_type"] == "API":
                api_permissions.append(
                    {
                        "permission_code": code,
                        "method": permission["action"],
                        "path": permission["resource_code"],
                    }
                )
            elif permission["permission_type"] == "EXPORT":
                export_permissions.append(permission["resource_code"])
        return {
            "permission_codes": permission_codes,
            "menu_codes": sorted(set(menu_codes)),
            "button_codes": sorted(set(button_codes)),
            "api_permissions": api_permissions,
            "export_permissions": sorted(set(export_permissions)),
        }

    def require_button(self, payload, button_code, aliases=None):
        user = self.current_user(payload)
        permissions = self.permission_summary(user["user_id"])
        accepted_codes = [button_code, *(aliases or [])]
        if not any(code in permissions["button_codes"] for code in accepted_codes):
            raise ApiError(
                "DVAS_PERMISSION_DENIED",
                "当前用户无此操作权限",
                status=403,
                field_errors=[{"field": "button_code", "reason": button_code}],
            )
        return user

    def require_menu(self, payload, menu_code):
        user = self.current_user(payload)
        permissions = self.permission_summary(user["user_id"])
        if menu_code not in permissions["menu_codes"]:
            raise ApiError(
                "DVAS_PERMISSION_DENIED",
                "当前用户无此页面权限",
                status=403,
                field_errors=[{"field": "menu_code", "reason": menu_code}],
            )
        return user

    def has_any_role(self, user_id, role_ids):
        return self.repository.user_has_any_role(user_id, role_ids)

    def _public_user(self, user_id):
        user = self.repository.get_user_account(user_id)
        if not user:
            raise ApiError("DVAS_AUTH_REQUIRED", "用户不存在或未登录", status=401)
        user = self.repository._public_user(user)
        user["roles"] = self.repository.state["user_roles"].get(user_id, [])
        return user

    def _hash_password(self, password):
        return hashlib.sha256(f"dvas-p1:{password}".encode("utf-8")).hexdigest()


class UserAccessService:
    def __init__(self, repository, auth_service):
        self.repository = repository
        self.auth_service = auth_service

    def me(self, payload):
        return self.auth_service.current_user(payload, require_login=True)

    def list_users(self, payload):
        self.auth_service.require_button(payload, "USER-001")
        rows = self.repository.list_user_accounts()
        return table_page(rows)

    def get_user(self, user_id, payload):
        self._require_user_admin(payload, "USER_UPDATE")
        user = self.repository.get_user_account(user_id)
        if not user:
            raise ApiError("DVAS_NOT_FOUND", "用户不存在", status=404)
        return self.repository._public_user(user)

    def create_user(self, payload):
        actor = self._require_user_admin(payload, "USER_CREATE")
        now = utc_now()
        username = str(payload.get("username") or "").strip()
        if not username:
            raise ApiError(
                "DVAS_REQUIRED_FIELD_MISSING",
                "用户名不能为空",
                status=422,
                field_errors=[{"field": "username", "reason": "用户名不能为空"}],
            )
        if self.repository.get_user_account(username):
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                "用户名已存在",
                status=409,
                field_errors=[{"field": "username", "reason": "用户名已存在"}],
            )
        user_id = self.repository.next_id("user")
        roles = self._validated_roles(payload.get("roles"))
        password = str(
            payload.get("initial_password")
            or payload.get("password")
            or self._generate_temporary_password()
        )
        self._validate_password_strength(password)
        user = {
            "user_id": user_id,
            "username": username,
            "display_name": payload.get("display_name") or username,
            "email": str(payload.get("email") or "").strip(),
            "status": payload.get("status") or "ENABLED",
            "password_hash": self._hash_password(password),
            "password_updated_at": now,
            "must_change_password": True,
            "disabled_by": None,
            "disabled_at": None,
            "last_login_at": None,
            "created_at": now,
            "updated_at": now,
        }
        saved = self.repository.put_user_account(user)
        self.repository.set_user_roles(user_id, roles)
        saved = {**saved, "roles": roles}
        write_audit(
            self.repository,
            module_code="USER",
            menu_code="NAV_SYSTEM_USER",
            operation_type="CREATE",
            object_type="user_account",
            object_id=user_id,
            status="SUCCESS",
            after_value_json={"user": saved, "password_set": True, "created_by": actor["user_id"]},
            button_code="USER-002",
        )
        return {**saved, "one_time_initial_password": password}

    def update_user(self, user_id, payload):
        actor = self._require_user_admin(payload, "USER_UPDATE")
        user = self.repository.get_user_account(user_id)
        if not user:
            raise ApiError("DVAS_NOT_FOUND", "用户不存在", status=404)
        if payload.get("status") == "DISABLED" and user.get("status") != "DISABLED":
            return self.disable_user(user_id, payload)
        changes = {}
        for key in ("display_name", "email", "status", "must_change_password"):
            if key in payload:
                changes[key] = payload[key]
        if "roles" in payload:
            self.repository.set_user_roles(user_id, self._validated_roles(payload.get("roles")))
        saved = self.repository.update_user_account(user_id, **changes)
        result = {**saved, "roles": self.repository.state["user_roles"].get(user_id, [])}
        write_audit(
            self.repository,
            module_code="USER",
            menu_code="NAV_SYSTEM_USER",
            operation_type="UPDATE",
            object_type="user_account",
            object_id=user_id,
            status="SUCCESS",
            before_value_json={"user": self.repository._public_user(user)},
            after_value_json={"user": result, "updated_by": actor["user_id"]},
            button_code="USER-003",
        )
        return result

    def disable_user(self, user_id, payload):
        actor = self._require_user_admin(payload, "USER_DISABLE")
        target = self.repository.get_user_account(user_id)
        if not target:
            raise ApiError("DVAS_NOT_FOUND", "用户不存在", status=404)
        if actor["user_id"] == target["user_id"]:
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                "系统管理员不能禁用自己",
                status=409,
                field_errors=[{"field": "user_id", "reason": "不能禁用当前登录用户"}],
            )
        target_roles = set(self.repository.user_role_ids(target["user_id"]))
        if "SYSTEM_ADMIN" in target_roles and len(self.repository.enabled_system_admin_user_ids()) <= 1:
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                "不能禁用最后一个启用的系统管理员",
                status=409,
                field_errors=[{"field": "user_id", "reason": "最后一个启用的 SYSTEM_ADMIN"}],
            )
        now = utc_now()
        saved = self.repository.update_user_account(
            user_id,
            status="DISABLED",
            disabled_by=actor["user_id"],
            disabled_at=now,
        )
        self.repository.revoke_user_sessions(user_id)
        write_audit(
            self.repository,
            module_code="USER",
            menu_code="NAV_SYSTEM_USER",
            operation_type="DISABLE",
            object_type="user_account",
            object_id=user_id,
            status="SUCCESS",
            before_value_json={"user": self.repository._public_user(target)},
            after_value_json={"user": saved, "disabled_by": actor["user_id"], "disabled_at": now},
            button_code="USER-005",
        )
        return saved

    def reset_password(self, user_id, payload):
        actor = self._require_user_admin(payload, "USER_RESET_PASSWORD")
        target = self.repository.get_user_account(user_id)
        if not target:
            raise ApiError("DVAS_NOT_FOUND", "用户不存在", status=404)
        password = str(
            payload.get("temporary_password")
            or payload.get("password")
            or self._generate_temporary_password()
        )
        self._validate_password_strength(password)
        now = utc_now()
        saved = self.repository.update_user_account(
            user_id,
            password_hash=self._hash_password(password),
            password_updated_at=now,
            must_change_password=True,
        )
        self.repository.revoke_user_sessions(user_id, except_token=(payload or {}).get("_auth_token"))
        write_audit(
            self.repository,
            module_code="USER",
            menu_code="NAV_SYSTEM_USER",
            operation_type="RESET_PASSWORD",
            object_type="user_account",
            object_id=user_id,
            status="SUCCESS",
            before_value_json={"user": self.repository._public_user(target)},
            after_value_json={"user": saved, "password_set": True, "reset_by": actor["user_id"]},
            button_code="USER-007",
        )
        return {**saved, "one_time_temporary_password": password}

    def change_own_password(self, payload):
        actor = self.auth_service.current_user(payload, require_login=True)
        self._require_permission(actor, "USER_CHANGE_OWN_PASSWORD")
        current_password = str(payload.get("current_password") or "")
        new_password = str(payload.get("new_password") or "")
        confirm_password = str(payload.get("confirm_password") or "")
        account = self.repository.get_user_account(actor["user_id"])
        if not account or account.get("password_hash") != self._hash_password(current_password):
            raise ApiError(
                "DVAS_AUTH_FAILED",
                "当前密码不正确",
                status=403,
                field_errors=[{"field": "current_password", "reason": "当前密码不正确"}],
            )
        if new_password != confirm_password:
            raise ApiError(
                "DVAS_PASSWORD_CONFIRM_MISMATCH",
                "两次输入的新密码不一致",
                status=422,
                field_errors=[{"field": "confirm_password", "reason": "两次输入的新密码不一致"}],
            )
        if self._hash_password(new_password) == account.get("password_hash"):
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                "新密码不能与旧密码相同",
                status=409,
                field_errors=[{"field": "new_password", "reason": "新密码不能与旧密码相同"}],
            )
        self._validate_password_strength(new_password)
        now = utc_now()
        saved = self.repository.update_user_account(
            actor["user_id"],
            password_hash=self._hash_password(new_password),
            password_updated_at=now,
            must_change_password=False,
        )
        write_audit(
            self.repository,
            module_code="USER",
            menu_code="NAV_SYSTEM_USER",
            operation_type="UPDATE",
            object_type="user_account",
            object_id=actor["user_id"],
            status="SUCCESS",
            before_value_json={"user": self.repository._public_user(account)},
            after_value_json={"user": saved, "password_set": True},
            button_code="USER-010",
        )
        return saved

    def list_roles(self, payload):
        self.auth_service.require_button(payload, "USER-008")
        rows = []
        for role in self.repository.list_roles():
            rows.append(
                {
                    **role,
                    "permission_codes": self.repository.get_role_permission_codes(role["role_id"]),
                }
            )
        return table_page(rows)

    def list_permissions(self, payload):
        self.auth_service.require_button(payload, "USER-009")
        return table_page(self.repository.list_permissions())

    def update_role_permissions(self, role_id, payload):
        self.auth_service.require_button(payload, "USER-009")
        role = self.repository.get_role(role_id)
        if not role:
            raise ApiError("DVAS_NOT_FOUND", "角色不存在", status=404)
        valid_codes = {item["permission_code"] for item in self.repository.list_permissions()}
        requested = [code for code in payload.get("permission_codes", []) if code in valid_codes]
        permission_codes = self.repository.set_role_permission_codes(role_id, requested)
        return {**role, "permission_codes": permission_codes}

    def _require_user_admin(self, payload, permission_code):
        actor = self.auth_service.current_user(payload, require_login=True)
        self._require_permission(actor, permission_code)
        return actor

    def _require_permission(self, actor, permission_code):
        permission_codes = set(self.repository.user_permission_codes(actor["user_id"]))
        if "SYSTEM_ADMIN" in actor.get("roles", []) or permission_code in permission_codes:
            return
        raise ApiError(
            "DVAS_PERMISSION_DENIED",
            "当前用户无此用户管理权限",
            status=403,
            field_errors=[{"field": "permission_code", "reason": permission_code}],
        )

    def _validated_roles(self, roles):
        if not isinstance(roles, list) or not roles:
            raise ApiError(
                "DVAS_REQUIRED_FIELD_MISSING",
                "至少需要分配一个角色",
                status=422,
                field_errors=[{"field": "roles", "reason": "至少需要分配一个角色"}],
            )
        normalized = sorted({str(role).strip() for role in roles if str(role).strip()})
        if not normalized:
            raise ApiError(
                "DVAS_REQUIRED_FIELD_MISSING",
                "至少需要分配一个角色",
                status=422,
                field_errors=[{"field": "roles", "reason": "至少需要分配一个角色"}],
            )
        missing = [role for role in normalized if not self.repository.get_role(role)]
        if missing:
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                "角色不存在",
                status=422,
                field_errors=[{"field": "roles", "reason": ",".join(missing)}],
            )
        return normalized

    def _hash_password(self, password):
        return hashlib.sha256(f"dvas-p1:{password}".encode("utf-8")).hexdigest()

    def _generate_temporary_password(self):
        return f"Dvas{uuid4().hex[:10]}1"

    def _validate_password_strength(self, password):
        if len(password) < 8 or not any(ch.isalpha() for ch in password) or not any(ch.isdigit() for ch in password):
            raise ApiError(
                "DVAS_PASSWORD_WEAK",
                "密码长度至少 8 位，且必须包含字母和数字",
                status=422,
                field_errors=[{"field": "password", "reason": "长度至少 8 位，且包含字母和数字"}],
            )


class MyContentService:
    ADMIN_ROLES = {"SYSTEM_ADMIN"}
    BUSINESS_ROLES = {"BUSINESS_ADMIN"}
    AUDIT_ROLES = {"AUDITOR"}

    def __init__(self, repository, auth_service):
        self.repository = repository
        self.auth_service = auth_service

    def projects(self, payload):
        user = self._user(payload)
        project = self.repository.get_project()
        scope = str(payload.get("scope") or "").strip().lower()
        if scope in {"mine", "my", "current_user"}:
            items = [project] if project.get("created_by") == user["user_id"] or project.get("operator_id") == user["user_id"] else []
        else:
            items = [project] if self._can_see_project(user["user_id"], project) else []
        return table_page(items)

    def uploads(self, payload):
        user = self._user(payload)
        scope = str(payload.get("scope") or "").strip().lower()
        if scope in {"mine", "my", "current_user"}:
            items = [
                package
                for package in self.repository.list_data_packages()
                if package.get("created_by") == user["user_id"]
            ]
        else:
            items = [
                package
                for package in self.repository.list_data_packages()
                if self._can_see_upload(user["user_id"], package)
            ]
        return table_page(items)

    def jobs(self, payload):
        user = self._user(payload)
        project_id = payload.get("project_id") or self.repository.get_project()["project_id"]
        scope = str(payload.get("scope") or "").strip().lower()
        items = [
            job
            for job in self.repository.list_async_jobs(project_id)
            if self._can_see_job(user["user_id"], job)
        ]
        md_tasks = [
            self._md_task_as_job(task)
            for task in self.repository.list_md_dshap_tasks()
            if self._can_see_job(user["user_id"], task)
        ]
        if scope in {"mine", "my", "current_user"}:
            items = [
                job
                for job in items
                if job.get("requested_by") == user["user_id"] or job.get("created_by") == user["user_id"]
            ]
            md_tasks = [
                job
                for job in md_tasks
                if job.get("requested_by") == user["user_id"] or job.get("created_by") == user["user_id"]
            ]
        return table_page(sorted(items + md_tasks, key=lambda item: item.get("created_at", "")))

    def reports(self, payload):
        user = self._user(payload)
        scope = str(payload.get("scope") or "").strip().lower()
        if scope in {"mine", "my", "current_user"}:
            items = [
                report
                for report in self.repository.list_report_records()
                if report.get("created_by") == user["user_id"]
            ]
        else:
            items = [
                report
                for report in self.repository.list_report_records()
                if self._can_see_report(user["user_id"], report)
            ]
        return table_page(items)

    def workbench(self, payload):
        user = self._user(payload)
        projects = self.projects(payload)["items"]
        uploads = self.uploads(payload)["items"]
        jobs = self.jobs(payload)["items"]
        reports = self.reports(payload)["items"]
        recent_operations = [
            item
            for item in reversed(self.repository.list_audit_logs())
            if self._can_see_audit(user["user_id"], item)
        ][:8]
        return {
            "user_id": user["user_id"],
            "username": user["username"],
            "display_name": user.get("display_name"),
            "roles": user.get("roles", []),
            "projects": projects,
            "uploads": uploads,
            "jobs": jobs,
            "reports": reports,
            "recent_operations": recent_operations,
            "summary": {
                "project_count": len(projects),
                "upload_count": len(uploads),
                "job_count": len(jobs),
                "report_count": len(reports),
                "recent_operation_count": len(recent_operations),
            },
        }

    def _user(self, payload):
        return self.auth_service.current_user(payload, require_login=True)

    def _is_admin(self, user_id):
        return self.repository.user_has_any_role(user_id, self.ADMIN_ROLES)

    def _is_business_admin(self, user_id):
        return self.repository.user_has_any_role(user_id, self.BUSINESS_ROLES)

    def _is_auditor(self, user_id):
        return self.repository.user_has_any_role(user_id, self.AUDIT_ROLES)

    def _has_elevated_read(self, user_id):
        return self._is_admin(user_id) or self._is_business_admin(user_id) or self._is_auditor(user_id)

    def _can_see_project(self, user_id, project):
        if self._has_elevated_read(user_id):
            return True
        if project.get("created_by") == user_id or project.get("operator_id") == user_id:
            return True
        return project.get("project_status") in {ProjectStatus.CONFIRMED.value, ProjectStatus.EXPORTED.value}

    def _can_see_upload(self, user_id, package):
        if self._is_admin(user_id) or self._is_business_admin(user_id):
            return True
        if package.get("created_by") == user_id:
            return True
        if self._is_auditor(user_id):
            return package.get("status") in {"VALIDATED", "CONFIRMED"}
        return False

    def _can_see_job(self, user_id, job):
        if self._has_elevated_read(user_id):
            return True
        return (
            job.get("requested_by") == user_id
            or job.get("created_by") == user_id
        ) and job.get("status") in {"SUCCESS", "COMPLETED", "CONFIRMED"}

    def _can_see_report(self, user_id, report):
        if self._has_elevated_read(user_id):
            return True
        if report.get("created_by") == user_id:
            return True
        return report.get("status") in {"PUBLISHED"}

    def _can_see_audit(self, user_id, audit_log):
        if self._has_elevated_read(user_id):
            return True
        return audit_log.get("operator_id") == user_id

    def _md_task_as_job(self, task):
        return {
            "job_id": task.get("task_id"),
            "project_id": task.get("project_id"),
            "job_type": "MD_DSHAP_TASK",
            "job_name": "MD-DShap 权重计算",
            "status": task.get("status"),
            "progress": 100 if task.get("status") == "COMPLETED" else 0,
            "subject_id": task.get("task_id"),
            "requested_by": task.get("requested_by") or task.get("created_by"),
            "created_by": task.get("created_by"),
            "created_at": task.get("created_at"),
            "completed_at": task.get("completed_at"),
            "result_json": {
                "algorithm_party_count": task.get("algorithm_party_count"),
                "contract_party_count": task.get("contract_party_count"),
            },
            "simulation_disclaimer": task.get("simulation_disclaimer", SIMULATION_DISCLAIMER),
        }


class ImportTemplateService:
    REQUIRED_SHEETS = [
        "participants",
        "data_units",
        "revenue_pool",
        "resource_party_relation",
        "optional_constraints",
    ]

    def __init__(self, repository, ingestion_service, auth_service):
        self.repository = repository
        self.ingestion_service = ingestion_service
        self.auth_service = auth_service

    def csv_template(self, payload):
        self.auth_service.require_button(payload, "DATA-010")
        rows = [
            ["record_type", "package_name", "party_id", "party_name", "party_type", "is_data_provider", "include_in_md_dshap", "resource_name", "provider_party_name", "modality", "field_count", "sample_count", "missing_rate", "revenue_pool"],
            ["participant", "导入数据包", "P001", "数据源主体A", "DATA_PROVIDER", "true", "true", "", "", "", "", "", "", ""],
            ["data_unit", "导入数据包", "P001", "", "", "", "", "资源A", "数据源主体A", "结构化数据", "10", "1000", "0.02", ""],
            ["revenue_pool", "导入数据包", "", "", "", "", "", "", "", "", "", "", "", "1200000"],
        ]
        content = "\n".join(",".join(row) for row in rows) + "\n"
        return self._download_payload("dvas_import_template.csv", "text/csv", content.encode("utf-8"))

    def xlsx_template(self, payload):
        self.auth_service.require_button(payload, "DATA-011")
        sheets = {
            "participants": [
                ["package_name", "party_id", "party_name", "party_type", "is_data_provider", "include_in_md_dshap"],
                ["导入数据包", "P001", "数据源主体A", "DATA_PROVIDER", "true", "true"],
            ],
            "data_units": [
                ["package_name", "resource_name", "party_id", "provider_party_name", "modality", "field_count", "sample_count", "missing_rate"],
                ["导入数据包", "资源A", "P001", "数据源主体A", "结构化数据", "10", "1000", "0.02"],
            ],
            "revenue_pool": [["package_name", "total_revenue"], ["导入数据包", "1200000"]],
            "resource_party_relation": [["resource_name", "party_id", "split_ratio"], ["资源A", "P001", "1"]],
            "optional_constraints": [["constraint_name", "party_id", "constraint_type", "constraint_value"], ["", "", "", ""]],
        }
        content = self._xlsx_bytes(sheets)
        return self._download_payload(
            "dvas_import_template.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            content,
        )

    def import_csv(self, payload):
        self.auth_service.require_button(payload, "DATA-012")
        file_part = self._file_part(payload)
        content = file_part["content"]
        text = content.decode("utf-8-sig")
        rows = list(csv.DictReader(io.StringIO(text)))
        package_payload = self._payload_from_rows(rows)
        return self.ingestion_service.import_structured_payload(
            package_payload,
            "CSV_UPLOAD",
            file_part.get("filename") or "uploaded.csv",
            len(content),
            hashlib.sha256(content).hexdigest(),
        )

    def import_xlsx(self, payload):
        self.auth_service.require_button(payload, "DATA-012")
        file_part = self._file_part(payload)
        content = file_part["content"]
        sheets = self._read_xlsx_rows(content)
        rows = []
        for sheet_name, sheet_rows in sheets.items():
            if not sheet_rows:
                continue
            header = sheet_rows[0]
            for values in sheet_rows[1:]:
                row = {header[index]: values[index] if index < len(values) else "" for index in range(len(header))}
                row["record_type"] = self._record_type_for_sheet(sheet_name)
                rows.append(row)
        package_payload = self._payload_from_rows(rows)
        return self.ingestion_service.import_structured_payload(
            package_payload,
            "XLSX_UPLOAD",
            file_part.get("filename") or "uploaded.xlsx",
            len(content),
            hashlib.sha256(content).hexdigest(),
        )

    def _file_part(self, payload):
        file_part = (payload.get("_multipart_files") or {}).get("file")
        if not file_part:
            raise ApiError(
                "DVAS_REQUIRED_FIELD_MISSING",
                "必须使用 FormData 的 file 字段上传导入模板",
                status=422,
                field_errors=[{"field": "file", "reason": "缺少上传文件"}],
            )
        return file_part

    def _payload_from_rows(self, rows):
        participants = []
        resources = []
        package_name = "导入数据包"
        revenue_pool = None
        for raw in rows:
            row = {str(key or "").strip(): str(value or "").strip() for key, value in raw.items()}
            if row.get("package_name"):
                package_name = row["package_name"]
            record_type = (row.get("record_type") or "").lower()
            if record_type == "participant":
                participants.append(
                    {
                        "party_id": row.get("party_id"),
                        "party_name": row.get("party_name"),
                        "party_type": row.get("party_type") or "DATA_PROVIDER",
                        "is_data_provider": self._bool(row.get("is_data_provider")),
                        "include_in_md_dshap": self._bool(row.get("include_in_md_dshap")),
                    }
                )
            elif record_type == "data_unit":
                resources.append(
                    {
                        "resource_name": row.get("resource_name"),
                        "party_id": row.get("party_id"),
                        "provider_party_name": row.get("provider_party_name"),
                        "modality": row.get("modality") or "结构化数据",
                        "field_count": self._int(row.get("field_count")),
                        "sample_count": self._int(row.get("sample_count")),
                        "missing_rate": self._float(row.get("missing_rate")),
                    }
                )
            elif record_type == "revenue_pool":
                revenue_pool = self._float(row.get("total_revenue") or row.get("revenue_pool"))
        return {
            "package_name": package_name,
            "project_name": package_name,
            "participants": participants,
            "data_units": resources,
            "revenue_pool": revenue_pool,
            "import_sheets": self.REQUIRED_SHEETS,
        }

    def _download_payload(self, file_name, mime_type, content):
        return {
            "file_name": file_name,
            "mime_type": mime_type,
            "byte_size": len(content),
            "checksum": hashlib.sha256(content).hexdigest(),
            "content_base64": base64.b64encode(content).decode("ascii"),
        }

    def _xlsx_bytes(self, sheets):
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("[Content_Types].xml", self._xlsx_content_types(len(sheets)))
            archive.writestr("_rels/.rels", self._xlsx_root_rels())
            archive.writestr("xl/workbook.xml", self._xlsx_workbook_xml(list(sheets)))
            archive.writestr("xl/_rels/workbook.xml.rels", self._xlsx_workbook_rels(len(sheets)))
            for index, rows in enumerate(sheets.values(), start=1):
                archive.writestr(f"xl/worksheets/sheet{index}.xml", self._xlsx_sheet_xml(rows))
        return output.getvalue()

    def _read_xlsx_rows(self, content):
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            workbook = ET.fromstring(archive.read("xl/workbook.xml"))
            ns = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
            names = [sheet.attrib["name"] for sheet in workbook.findall(".//main:sheet", ns)]
            result = {}
            for index, sheet_name in enumerate(names, start=1):
                xml = ET.fromstring(archive.read(f"xl/worksheets/sheet{index}.xml"))
                rows = []
                for row in xml.findall(".//main:row", ns):
                    values = []
                    for cell in row.findall("main:c", ns):
                        value = cell.find("main:is/main:t", ns)
                        values.append(value.text if value is not None and value.text is not None else "")
                    rows.append(values)
                result[sheet_name] = rows
            return result

    def _record_type_for_sheet(self, sheet_name):
        return {
            "participants": "participant",
            "data_units": "data_unit",
            "revenue_pool": "revenue_pool",
        }.get(sheet_name, sheet_name)

    def _xlsx_content_types(self, sheet_count):
        sheets = "".join(
            f'<Override PartName="/xl/worksheets/sheet{index}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            for index in range(1, sheet_count + 1)
        )
        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            f"{sheets}</Types>"
        )

    def _xlsx_root_rels(self):
        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            "</Relationships>"
        )

    def _xlsx_workbook_xml(self, sheet_names):
        sheets = "".join(
            f'<sheet name="{name}" sheetId="{index}" r:id="rId{index}"/>'
            for index, name in enumerate(sheet_names, start=1)
        )
        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            f"<sheets>{sheets}</sheets></workbook>"
        )

    def _xlsx_workbook_rels(self, sheet_count):
        rels = "".join(
            f'<Relationship Id="rId{index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{index}.xml"/>'
            for index in range(1, sheet_count + 1)
        )
        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            f"{rels}</Relationships>"
        )

    def _xlsx_sheet_xml(self, rows):
        xml_rows = []
        for row_index, row in enumerate(rows, start=1):
            cells = []
            for col_index, value in enumerate(row, start=1):
                cell_ref = f"{chr(64 + col_index)}{row_index}"
                escaped = str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                cells.append(f'<c r="{cell_ref}" t="inlineStr"><is><t>{escaped}</t></is></c>')
            xml_rows.append(f'<row r="{row_index}">{"".join(cells)}</row>')
        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            f'<sheetData>{"".join(xml_rows)}</sheetData></worksheet>'
        )

    def _bool(self, value):
        return str(value).strip().lower() in {"1", "true", "yes", "是"}

    def _int(self, value):
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return 0

    def _float(self, value):
        try:
            return float(value)
        except (TypeError, ValueError):
            return None


class NavigationService:
    def menu_tree(self):
        return {
            "items": [
                copy.deepcopy(SYSTEM_HOME_MENU),
                self._group(
                    "MENU_GROUP_DATA",
                    "NAV_GROUP_DATA",
                    "数据管理",
                    "DATA",
                    "/data/ingestion",
                    2,
                    [
                        self._leaf("MENU_DATA_PACKAGE", "NAV_DATA_PACKAGE", "数据接入管理", "DATA", "/data/ingestion", 21),
                        self._leaf("MENU_DATA_RESOURCE", "NAV_DATA_RESOURCE", "数据资源管理", "RES", "/data/resources", 22),
                        self._leaf("MENU_DATA_PARTY", "NAV_DATA_PARTY", "参与方管理", "PARTY", "/data/parties", 23),
                    ],
                ),
                self._group(
                    "MENU_GROUP_MEASURE",
                    "NAV_GROUP_MEASURE",
                    "数元贡献度计量",
                    "QUAL",
                    "/metering/quality",
                    3,
                    [
                        self._leaf("MENU_MEASURE_QUALITY", "NAV_MEASURE_QUALITY", "质量评估管理", "QUAL", "/metering/quality", 31),
                        self._leaf("MENU_MEASURE_SHUYUAN", "NAV_MEASURE_SHUYUAN", "数元计量管理", "DU", "/metering/shuyuan", 32),
                        self._leaf("MENU_MEASURE_UTILITY", "NAV_MEASURE_UTILITY", "贡献度与效用计算", "UTIL", "/metering/utility", 33),
                    ],
                ),
                self._group(
                    "MENU_GROUP_ALLOCATION",
                    "NAV_GROUP_ALLOCATION",
                    "收益分配计算",
                    "MDS",
                    "/allocation/md-dshap",
                    4,
                    [
                        self._leaf("MENU_ALLOC_MDS", "NAV_ALLOC_MDS", "MD-DShap 计算管理", "MDS", "/allocation/md-dshap", 41),
                        self._leaf("MENU_ALLOC_SIMULATION", "NAV_ALLOC_SIMULATION", "收益分配模拟", "ALLOC", "/allocation/simulation", 42),
                        self._leaf("MENU_ALLOC_CONSTRAINT", "NAV_ALLOC_CONSTRAINT", "合同分配规则", "CONS", "/allocation/constraints", 43),
                    ],
                ),
                self._leaf("MENU_REPORT_EXPORT", "NAV_REPORT_EXPORT", "报告生成与导出", "REP", "/reports", 5),
                self._group(
                    "MENU_GROUP_SYSTEM",
                    "NAV_GROUP_SYSTEM",
                    "系统管理",
                    "PARAM",
                    "/system/parameters",
                    6,
                    [
                        self._leaf("MENU_SYSTEM_PARAMETER", "NAV_SYSTEM_PARAMETER", "参数配置", "PARAM", "/system/parameters", 61),
                        self._leaf("MENU_SYSTEM_USER", "NAV_SYSTEM_USER", "用户与权限管理", "USER", "/system/users", 62, p0_required=False, p1_only=True),
                        self._leaf("MENU_SYSTEM_AUDIT", "NAV_SYSTEM_AUDIT", "审计日志管理", "AUD", "/system/audit", 63),
                    ],
                ),
            ]
        }

    def button_permissions(self):
        return table_page(copy.deepcopy(SYSTEM_HOME_BUTTON_PERMISSIONS))

    def _group(self, menu_id, menu_code, menu_name, module_code, route_path, sort_no, children):
        return {
            "menu_id": menu_id,
            "parent_id": None,
            "menu_code": menu_code,
            "menu_name": menu_name,
            "module_code": module_code,
            "route_path": route_path,
            "menu_level": 1,
            "sort_no": sort_no,
            "p0_required": True,
            "p1_only": False,
            "status": "ENABLED",
            "children": children,
        }

    def _leaf(
        self,
        menu_id,
        menu_code,
        menu_name,
        module_code,
        route_path,
        sort_no,
        p0_required=True,
        p1_only=False,
    ):
        return {
            "menu_id": menu_id,
            "parent_id": None,
            "menu_code": menu_code,
            "menu_name": menu_name,
            "module_code": module_code,
            "route_path": route_path,
            "menu_level": 2 if sort_no >= 10 else 1,
            "sort_no": sort_no,
            "p0_required": p0_required,
            "p1_only": p1_only,
            "status": "ENABLED",
            "children": [],
        }


class SystemParameterService:
    QUALITY_METRIC_ROWS = [
        {
            "metric_code": metric_code,
            "metric_name": metric_name,
            "metric_level": 1,
            "parent_metric_code": None,
            "parameter_code": parameter_code,
            "default_weight": default_weight,
        }
        for metric_code, metric_name, parameter_code, default_weight in QUALITY_PRIMARY_METRICS
    ] + [
        {
            "metric_code": metric_code,
            "metric_name": metric_name,
            "metric_level": 2,
            "parent_metric_code": parent_metric_code,
            "parameter_code": parameter_code,
            "default_weight": default_weight,
        }
        for metric_code, metric_name, parent_metric_code, parameter_code, default_weight in QUALITY_SECONDARY_METRICS
    ]
    QUALITY_WEIGHT_PARAMS = {
        row["metric_code"]: row["parameter_code"] for row in QUALITY_METRIC_ROWS
    }
    QUALITY_METRIC_BY_CODE = {row["metric_code"]: row for row in QUALITY_METRIC_ROWS}
    POSITIVE_NUMBER_CODES = {
        "DEFAULT_SHUYUAN_BASE_PRICE",
        "DEFAULT_SCENARIO_COEFFICIENT",
        "DEFAULT_TECHNOLOGY_COEFFICIENT",
        "DEFAULT_EXPERT_COEFFICIENT",
        "DEFAULT_DEVELOPMENT_COEFFICIENT",
        "DEFAULT_MD_DSHAP_EPSILON",
        "DEFAULT_USAGE_WEIGHT",
        "DEFAULT_COVERAGE_WEIGHT",
        "DEFAULT_SCARCITY_WEIGHT",
    } | set(QUALITY_WEIGHT_PARAMS.values())
    SHUYUAN_PARAM_CODES = {
        "base_price": "DEFAULT_SHUYUAN_BASE_PRICE",
        "scenario_coefficient": "DEFAULT_SCENARIO_COEFFICIENT",
        "technology_coefficient": "DEFAULT_TECHNOLOGY_COEFFICIENT",
        "expert_coefficient": "DEFAULT_EXPERT_COEFFICIENT",
        "development_coefficient": "DEFAULT_DEVELOPMENT_COEFFICIENT",
    }
    CONTRIBUTION_FACTOR_CODES = {
        "usage_weight": "DEFAULT_USAGE_WEIGHT",
        "coverage_weight": "DEFAULT_COVERAGE_WEIGHT",
        "scarcity_weight": "DEFAULT_SCARCITY_WEIGHT",
    }
    MD_DSHAP_PARAM_CODES = {
        "seed": "DEFAULT_MD_DSHAP_SEED",
        "sample_rounds": "DEFAULT_MD_DSHAP_SAMPLE_ROUNDS",
        "epsilon": "DEFAULT_MD_DSHAP_EPSILON",
        "baseline_enabled": "DEFAULT_MD_DSHAP_BASELINE_ENABLED",
    }

    def __init__(self, repository):
        self.repository = repository

    def list(self):
        return table_page(self.repository.list_system_parameters())

    def detail(self, parameter_code):
        return self._parameter(parameter_code)

    def quality_weights(self):
        return {
            "project_status": self.repository.get_project()["project_status"],
            "primary_metric_count": len(QUALITY_PRIMARY_METRICS),
            "secondary_metric_count": len(QUALITY_SECONDARY_METRICS),
            "items": [
                {
                    "metric_code": row["metric_code"],
                    "dimension_code": row["metric_code"],
                    "metric_name": row["metric_name"],
                    "metric_level": row["metric_level"],
                    "parent_metric_code": row["parent_metric_code"],
                    "parameter_code": row["parameter_code"],
                    "weight": self._parameter(row["parameter_code"])["current_value"],
                }
                for row in self.QUALITY_METRIC_ROWS
            ],
        }

    def update_quality_weights(self, payload):
        items = payload.get("items") if isinstance(payload, dict) else None
        if not isinstance(items, list) or not items:
            raise ApiError(
                "DVAS_REQUIRED_FIELD_MISSING",
                "质量权重配置不能为空",
                field_errors=[{"field": "items", "reason": "items 必须为非空数组"}],
            )
        seen = set()
        pending_updates = []
        for index, item in enumerate(items):
            metric_code = item.get("metric_code") or item.get("dimension_code")
            if metric_code not in self.QUALITY_WEIGHT_PARAMS:
                raise ApiError(
                    "DVAS_FACTOR_INVALID",
                    "质量权重指标不支持",
                    field_errors=[{"field": f"items[{index}].metric_code", "reason": "不支持的质量指标"}],
                )
            if metric_code in seen:
                raise ApiError(
                    "DVAS_FACTOR_INVALID",
                    "质量权重指标重复",
                    field_errors=[{"field": f"items[{index}].metric_code", "reason": "质量指标不能重复"}],
                )
            seen.add(metric_code)
            try:
                weight = float(item.get("weight"))
            except (TypeError, ValueError) as exc:
                raise ApiError(
                    "DVAS_FACTOR_INVALID",
                    "质量权重不合法",
                    field_errors=[{"field": f"items[{index}].weight", "reason": "weight 必须是数字"}],
                ) from exc
            if weight < 0:
                raise ApiError(
                    "DVAS_FACTOR_INVALID",
                    "质量权重不合法",
                    field_errors=[{"field": f"items[{index}].weight", "reason": "weight 必须大于等于 0"}],
                )
            pending_updates.append((metric_code, weight))
        missing = set(self.QUALITY_WEIGHT_PARAMS) - seen
        if missing:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "质量权重指标不完整",
                field_errors=[{"field": "items", "reason": f"缺少指标: {', '.join(sorted(missing))}"}],
            )
        pending_by_code = dict(pending_updates)
        primary_sum = sum(
            pending_by_code[metric_code] for metric_code, _, _, _ in QUALITY_PRIMARY_METRICS
        )
        if abs(primary_sum - 1.0) > P0_CONFIG.weight_normalization_tolerance:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "质量权重不合法",
                field_errors=[{"field": "items", "reason": "一级质量指标权重之和必须为 1.000000"}],
            )
        for parent_metric_code, parent_name, _, _ in QUALITY_PRIMARY_METRICS:
            child_sum = sum(
                pending_by_code[metric_code]
                for metric_code, _, child_parent_code, _, _ in QUALITY_SECONDARY_METRICS
                if child_parent_code == parent_metric_code
            )
            if abs(child_sum - 1.0) > P0_CONFIG.weight_normalization_tolerance:
                raise ApiError(
                    "DVAS_FACTOR_INVALID",
                    "质量权重不合法",
                    field_errors=[
                        {
                            "field": "items",
                            "reason": f"{parent_name}下二级质量指标权重之和必须为 1.000000",
                        }
                    ],
                )
        updated = [
            self.update(self.QUALITY_WEIGHT_PARAMS[metric_code], {"current_value": weight})
            for metric_code, weight in pending_updates
        ]
        return {**self.quality_weights(), "updated_parameters": updated}

    def update_shuyuan_parameters(self, payload):
        return self._update_parameter_group(
            payload,
            self.SHUYUAN_PARAM_CODES,
            "数元计量参数配置不能为空",
            "shuyuan_parameters",
        )

    def shuyuan_parameters(self):
        return {
            "project_status": self.repository.get_project()["project_status"],
            "shuyuan_parameters": self._parameter_group(self.SHUYUAN_PARAM_CODES),
        }

    def update_contribution_factors(self, payload):
        return self._update_parameter_group(
            payload,
            self.CONTRIBUTION_FACTOR_CODES,
            "贡献因子配置不能为空",
            "contribution_factors",
        )

    def md_dshap_config(self):
        return {
            "project_status": self.repository.get_project()["project_status"],
            "algorithm_mode": self._parameter("DEFAULT_ALGORITHM_MODE")["current_value"],
            "seed": self._parameter("DEFAULT_MD_DSHAP_SEED")["current_value"],
            "sample_rounds": self._parameter("DEFAULT_MD_DSHAP_SAMPLE_ROUNDS")["current_value"],
            "epsilon": self._parameter("DEFAULT_MD_DSHAP_EPSILON")["current_value"],
            "baseline_enabled": self._parameter("DEFAULT_MD_DSHAP_BASELINE_ENABLED")["current_value"],
        }

    def update_md_dshap_config(self, payload):
        if "algorithm_mode" in payload and payload["algorithm_mode"] != AlgorithmMode.MD_DSHAP.value:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "P0 默认分配算法必须为 MD_DSHAP",
                field_errors=[
                    {
                        "field": "algorithm_mode",
                        "reason": "BASELINE_SHAPLEY 仅可作为 baseline_check，不可作为默认分配算法",
                    }
                ],
            )
        allowed_payload = {key: payload[key] for key in self.MD_DSHAP_PARAM_CODES if key in payload}
        if not allowed_payload:
            if "algorithm_mode" in payload:
                return {**self.md_dshap_config(), "updated_parameters": []}
            raise ApiError(
                "DVAS_REQUIRED_FIELD_MISSING",
                "MD-DShap 配置不能为空",
                field_errors=[{"field": "config", "reason": "至少提供一个可配置字段"}],
            )
        updated = self._update_parameter_group(
            allowed_payload,
            self.MD_DSHAP_PARAM_CODES,
            "MD-DShap 配置不能为空",
            "md_dshap_config",
        )
        return {**self.md_dshap_config(), "updated_parameters": updated["updated_parameters"]}

    def update(self, parameter_code, payload):
        parameter = self._parameter(parameter_code)
        if not parameter["editable"]:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "系统参数不可编辑",
                field_errors=[{"field": "parameter_code", "reason": "该参数不可编辑"}],
            )
        if "current_value" not in payload:
            raise ApiError(
                "DVAS_REQUIRED_FIELD_MISSING",
                "系统参数值不能为空",
                field_errors=[{"field": "current_value", "reason": "current_value 为必填字段"}],
            )
        current_value = self._normalize_value(parameter, payload["current_value"])
        return self._write_parameter_version(
            parameter,
            current_value=current_value,
            operation_type="UPDATE_PARAMETER",
        )

    def restore_default(self, parameter_code):
        parameter = self._parameter(parameter_code)
        if not parameter["editable"]:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "系统参数不可编辑",
                field_errors=[{"field": "parameter_code", "reason": "该参数不可编辑"}],
            )
        return self._write_parameter_version(
            parameter,
            current_value=copy.deepcopy(parameter["default_value"]),
            operation_type="RESTORE_DEFAULT",
        )

    def _parameter(self, parameter_code):
        parameter = self.repository.get_system_parameter(parameter_code)
        if not parameter:
            raise ApiError("DVAS_NOT_FOUND", "系统参数不存在", status=404)
        return parameter

    def _write_parameter_version(self, parameter, current_value, operation_type):
        now = utc_now()
        version_no = int(parameter["version_no"]) + 1
        snapshot_id = self.repository.next_id("snapshot")
        version_id = self.repository.next_id("parameter_version")
        updated = {
            **parameter,
            "current_value": current_value,
            "version_no": version_no,
            "latest_version_id": version_id,
            "updated_at": now,
        }
        version = {
            "version_id": version_id,
            "project_id": self.repository.get_project()["project_id"],
            "parameter_code": parameter["parameter_code"],
            "parameter_name": parameter["parameter_name"],
            "parameter_type": parameter["parameter_type"],
            "default_value": copy.deepcopy(parameter["default_value"]),
            "previous_value": copy.deepcopy(parameter["current_value"]),
            "current_value": copy.deepcopy(current_value),
            "version_no": version_no,
            "operation_type": operation_type,
            "snapshot_id": snapshot_id,
            "updated_by": current_operator_id(self.repository),
            "created_at": now,
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        }
        snapshot = {
            "snapshot_id": snapshot_id,
            "project_id": version["project_id"],
            "snapshot_type": "PARAMETER",
            "content_json": {"parameter": updated, "version": version},
            "checksum": stable_checksum({"parameter": updated, "version": version}),
            "created_by": current_operator_id(self.repository),
            "created_at": now,
        }
        self.repository.put_snapshot(snapshot)
        self.repository.put_parameter_version(version)
        self.repository.put_system_parameter(updated)
        write_audit(
            self.repository,
            module_code="SYS",
            menu_code="NAV_SYSTEM_PARAMETER",
            operation_type=operation_type,
            object_type="system_parameter",
            object_id=parameter["parameter_code"],
            status="SUCCESS",
            parameter_snapshot_id=snapshot_id,
            before_value_json=parameter,
            after_value_json=updated,
        )
        return updated

    def _update_parameter_group(self, payload, mapping, empty_message, response_key):
        values = payload.get(response_key, payload) if isinstance(payload, dict) else {}
        if not isinstance(values, dict) or not values:
            raise ApiError(
                "DVAS_REQUIRED_FIELD_MISSING",
                empty_message,
                field_errors=[{"field": response_key, "reason": "至少提供一个可配置字段"}],
            )
        unknown = sorted(set(values) - set(mapping))
        if unknown:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "存在不支持的参数字段",
                field_errors=[{"field": response_key, "reason": f"不支持字段: {', '.join(unknown)}"}],
            )
        updated = [
            self.update(parameter_code, {"current_value": values[field]})
            for field, parameter_code in mapping.items()
            if field in values
        ]
        return {
            "project_status": self.repository.get_project()["project_status"],
            response_key: self._parameter_group(mapping),
            "updated_parameters": updated,
        }

    def _parameter_group(self, mapping):
        return {
            field: self._parameter(parameter_code)["current_value"]
            for field, parameter_code in mapping.items()
        }

    def _normalize_value(self, parameter, raw_value):
        parameter_code = parameter["parameter_code"]
        parameter_type = parameter["parameter_type"]
        if parameter_type == "TEXT":
            if not isinstance(raw_value, str) or not raw_value.strip():
                raise ApiError(
                    "DVAS_FACTOR_INVALID",
                    "系统参数值不合法",
                    field_errors=[{"field": "current_value", "reason": f"{parameter_code} 不能为空"}],
                )
            return raw_value
        if parameter_type == "BOOLEAN":
            if isinstance(raw_value, bool):
                return raw_value
            if isinstance(raw_value, str):
                normalized = raw_value.strip().lower()
                if normalized in {"true", "1", "yes", "y"}:
                    return True
                if normalized in {"false", "0", "no", "n"}:
                    return False
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "系统参数值不合法",
                field_errors=[{"field": "current_value", "reason": f"{parameter_code} 必须是布尔值"}],
            )
        if parameter_type == "ENUM":
            if raw_value != AlgorithmMode.MD_DSHAP.value:
                raise ApiError(
                    "DVAS_FACTOR_INVALID",
                    "系统参数值不合法",
                    field_errors=[{"field": "current_value", "reason": "默认算法必须为 MD_DSHAP"}],
                )
            return raw_value
        if parameter_type == "INTEGER":
            try:
                value = int(raw_value)
            except (TypeError, ValueError) as exc:
                raise ApiError(
                    "DVAS_FACTOR_INVALID",
                    "系统参数值不合法",
                    field_errors=[{"field": "current_value", "reason": f"{parameter_code} 必须是整数"}],
                ) from exc
            if parameter_code == "DEFAULT_MD_DSHAP_SAMPLE_ROUNDS" and value <= 0:
                raise ApiError(
                    "DVAS_FACTOR_INVALID",
                    "系统参数值不合法",
                    field_errors=[{"field": "current_value", "reason": f"{parameter_code} 必须大于 0"}],
                )
            if parameter_code == "DEFAULT_MD_DSHAP_SEED" and value < 0:
                raise ApiError(
                    "DVAS_FACTOR_INVALID",
                    "系统参数值不合法",
                    field_errors=[{"field": "current_value", "reason": f"{parameter_code} 必须大于等于 0"}],
                )
            if parameter_code == "AMOUNT_DISPLAY_PRECISION" and value != 2:
                raise ApiError(
                    "DVAS_FACTOR_INVALID",
                    "系统参数值不合法",
                    field_errors=[{"field": "current_value", "reason": "金额显示精度必须保持为 2"}],
                )
            if parameter_code == "WEIGHT_DISPLAY_PRECISION" and value != 6:
                raise ApiError(
                    "DVAS_FACTOR_INVALID",
                    "系统参数值不合法",
                    field_errors=[{"field": "current_value", "reason": "权重显示精度必须保持为 6"}],
                )
            return value
        try:
            value = float(raw_value)
        except (TypeError, ValueError) as exc:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "系统参数值不合法",
                field_errors=[{"field": "current_value", "reason": f"{parameter_code} 必须是数字"}],
            ) from exc
        if parameter_code in self.POSITIVE_NUMBER_CODES and value <= 0:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "系统参数值不合法",
                field_errors=[{"field": "current_value", "reason": f"{parameter_code} 必须大于 0"}],
            )
        return round(value, 6)


class DraftConfigurationService:
    DRAFT_SPECS = {
        "SHUYUAN_CALL_COUNTS": {
            "module_code": "DU",
            "menu_code": "NAV_MEASURE_SHUYUAN",
            "operation_type": "SAVE_SHUYUAN_CALL_COUNTS_DRAFT",
            "snapshot_type": SnapshotType.PARAMETER.value,
        },
        "UTILITY_FUNCTION": {
            "module_code": "UTIL",
            "menu_code": "NAV_MEASURE_UTILITY",
            "operation_type": "SAVE_UTILITY_FUNCTION_DRAFT",
            "snapshot_type": SnapshotType.PARAMETER.value,
        },
        "ALLOCATION_REVENUE_POOL": {
            "module_code": "ALLOC",
            "menu_code": "NAV_ALLOC_SIMULATION",
            "operation_type": "SAVE_REVENUE_POOL_DRAFT",
            "snapshot_type": SnapshotType.ASSUMPTION.value,
        },
        "ALLOCATION_PRIORITY_ITEMS": {
            "module_code": "ALLOC",
            "menu_code": "NAV_ALLOC_SIMULATION",
            "operation_type": "SAVE_PRIORITY_ITEMS_DRAFT",
            "snapshot_type": SnapshotType.ASSUMPTION.value,
        },
        "ALLOCATION_MODE": {
            "module_code": "ALLOC",
            "menu_code": "NAV_ALLOC_SIMULATION",
            "operation_type": "SAVE_ALLOCATION_MODE_DRAFT",
            "snapshot_type": SnapshotType.PARAMETER.value,
        },
    }

    def __init__(self, repository):
        self.repository = repository

    def save_shuyuan_call_counts(self, payload):
        values = payload.get("call_counts", payload) if isinstance(payload, dict) else {}
        if not isinstance(values, dict) or not values:
            raise ApiError(
                "DVAS_REQUIRED_FIELD_MISSING",
                "数元调用次数草稿不能为空",
                field_errors=[{"field": "call_counts", "reason": "call_counts 必须为非空对象"}],
            )
        normalized = {}
        for resource_id, raw_count in values.items():
            try:
                count = int(raw_count)
            except (TypeError, ValueError) as exc:
                raise ApiError(
                    "DVAS_FACTOR_INVALID",
                    "数元调用次数不合法",
                    field_errors=[{"field": str(resource_id), "reason": "调用次数必须是整数"}],
                ) from exc
            if count < 0:
                raise ApiError(
                    "DVAS_FACTOR_INVALID",
                    "数元调用次数不合法",
                    field_errors=[{"field": str(resource_id), "reason": "调用次数必须大于等于 0"}],
                )
            normalized[str(resource_id)] = count
        return self._persist("SHUYUAN_CALL_COUNTS", normalized)

    def save_utility_function(self, payload):
        if not isinstance(payload, dict) or not payload:
            raise ApiError(
                "DVAS_REQUIRED_FIELD_MISSING",
                "效用函数草稿不能为空",
                field_errors=[{"field": "utility_function", "reason": "必须提供效用函数配置"}],
            )
        return self._persist("UTILITY_FUNCTION", copy.deepcopy(payload))

    def utility_function(self):
        draft = self._latest_draft("UTILITY_FUNCTION")
        content = draft.get("content_json") if draft else {}
        if not isinstance(content, dict):
            content = {}
        formula = content.get("formula") or "normalized_contribution × quality_factor × usage_factor × scenario_factor"
        return {
            "project_id": self.repository.get_project()["project_id"],
            "project_status": self.repository.get_project()["project_status"],
            "utility_function": {
                "formula": formula,
                "usage_factor": content.get("usage_factor", 1.0),
                "scenario_factor": content.get("scenario_factor", 1.0),
                "quality_factor_source": content.get(
                    "quality_factor_source",
                    "SHUYUAN_RESOURCE_WEIGHTED_AVERAGE",
                ),
            },
            "draft": draft,
        }

    def save_revenue_pool(self, payload):
        try:
            total_revenue = float(payload["total_revenue"])
        except (KeyError, TypeError, ValueError) as exc:
            raise ApiError(
                "DVAS_REQUIRED_FIELD_MISSING",
                "收益池草稿缺少总收益",
                field_errors=[{"field": "total_revenue", "reason": "total_revenue 为必填数字"}],
            ) from exc
        priority_amount = self._amount(payload.get("priority_allocation_amount", 0), "priority_allocation_amount")
        if total_revenue < 0:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "收益池金额不合法",
                field_errors=[{"field": "total_revenue", "reason": "total_revenue 必须大于等于 0"}],
            )
        if priority_amount > total_revenue:
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                "优先分配金额不能超过总收益",
                field_errors=[{"field": "priority_allocation_amount", "reason": "优先分配金额不能超过总收益"}],
            )
        return self._persist(
            "ALLOCATION_REVENUE_POOL",
            {
                "total_revenue": round(total_revenue, P0_CONFIG.amount_precision),
                "priority_allocation_amount": priority_amount,
                "currency": payload.get("currency", "CNY"),
                "data_provider_revenue_pool": round(total_revenue - priority_amount, P0_CONFIG.amount_precision),
            },
        )

    def save_priority_items(self, payload):
        items = payload.get("items", payload.get("priority_items")) if isinstance(payload, dict) else None
        if not isinstance(items, list):
            raise ApiError(
                "DVAS_REQUIRED_FIELD_MISSING",
                "优先分配草稿不能为空",
                field_errors=[{"field": "items", "reason": "items 必须为数组"}],
            )
        normalized = []
        for index, item in enumerate(items):
            party_id = item.get("party_id")
            if not party_id:
                raise ApiError(
                    "DVAS_REQUIRED_FIELD_MISSING",
                    "优先分配项缺少参与方",
                    field_errors=[{"field": f"items[{index}].party_id", "reason": "party_id 为必填字段"}],
                )
            value_type = item.get("value_type", "AMOUNT")
            if value_type == "RATIO":
                priority_ratio = self._ratio(item.get("priority_ratio"), f"items[{index}].priority_ratio")
                priority_amount = None
            elif value_type == "AMOUNT":
                priority_ratio = None
                priority_amount = self._amount(
                    item.get("priority_amount", 0),
                    f"items[{index}].priority_amount",
                )
            else:
                raise ApiError(
                    "DVAS_FACTOR_INVALID",
                    "优先分配值类型不支持",
                    field_errors=[{"field": f"items[{index}].value_type", "reason": "value_type 必须为 AMOUNT 或 RATIO"}],
                )
            normalized.append(
                {
                    "party_id": party_id,
                    "value_type": value_type,
                    "priority_amount": priority_amount,
                    "priority_ratio": priority_ratio,
                    "cap_amount": item.get("cap_amount"),
                    "basis_text": item.get("basis_text") or "P0 本地草稿配置",
                    "priority_order": int(item.get("priority_order", index + 1)),
                }
            )
        persisted = self._persist("ALLOCATION_PRIORITY_ITEMS", normalized)
        now = utc_now()
        priority_items = []
        for index, item in enumerate(normalized):
            priority_items.append(
                {
                    "item_id": self.repository.next_id("allocation_priority_item"),
                    "allocation_id": None,
                    "project_id": persisted["project_id"],
                    "party_id": item["party_id"],
                    "value_type": item["value_type"],
                    "priority_amount": item["priority_amount"],
                    "priority_ratio": item["priority_ratio"],
                    "cap_amount": item["cap_amount"],
                    "basis_text": item["basis_text"],
                    "priority_order": item["priority_order"],
                    "status": "DRAFT",
                    "source_draft_id": persisted["draft"]["draft_id"],
                    "source_constraint_id": None,
                    "created_at": now,
                    "updated_at": now,
                    "simulation_disclaimer": SIMULATION_DISCLAIMER,
                }
            )
        self.repository.put_allocation_priority_items(
            priority_items,
            source_constraint_id=f"draft:{persisted['draft']['draft_id']}",
        )
        return {**persisted, "allocation_priority_items": priority_items}

    def save_allocation_mode(self, payload):
        mode = payload.get("allocation_mode") or payload.get("mode")
        if mode not in AllocationMode.values():
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "收益分配模式不支持",
                field_errors=[{"field": "allocation_mode", "reason": "不支持的收益分配模式"}],
            )
        return self._persist("ALLOCATION_MODE", {"allocation_mode": mode})

    def _persist(self, draft_type, content):
        now = utc_now()
        spec = self.DRAFT_SPECS[draft_type]
        project = self.repository.get_project()
        snapshot_id = self.repository.next_id("snapshot")
        draft_id = self.repository.next_id("draft")
        snapshot = {
            "snapshot_id": snapshot_id,
            "project_id": project["project_id"],
            "snapshot_type": spec["snapshot_type"],
            "content_json": {"draft_type": draft_type, "content": copy.deepcopy(content)},
            "checksum": stable_checksum({"draft_type": draft_type, "content": content}),
            "created_by": current_operator_id(self.repository),
            "created_at": now,
        }
        draft = {
            "draft_id": draft_id,
            "project_id": project["project_id"],
            "draft_type": draft_type,
            "content_json": copy.deepcopy(content),
            "snapshot_id": snapshot_id,
            "checksum": snapshot["checksum"],
            "created_by": current_operator_id(self.repository),
            "created_at": now,
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        }
        self.repository.put_snapshot(snapshot)
        self.repository.put_business_draft(draft)
        write_audit(
            self.repository,
            module_code=spec["module_code"],
            menu_code=spec["menu_code"],
            operation_type=spec["operation_type"],
            object_type="business_draft",
            object_id=draft_id,
            status="SUCCESS",
            parameter_snapshot_id=snapshot_id
            if spec["snapshot_type"] == SnapshotType.PARAMETER.value
            else None,
            result_snapshot_id=snapshot_id
            if spec["snapshot_type"] == SnapshotType.ASSUMPTION.value
            else None,
            after_value_json=draft,
        )
        return {
            "project_id": project["project_id"],
            "project_status": project["project_status"],
            "draft": draft,
            "snapshot": snapshot,
        }

    def _latest_draft(self, draft_type):
        drafts = self.repository.list_business_drafts(draft_type)
        return drafts[-1] if drafts else None

    def _amount(self, raw_value, field):
        try:
            value = float(raw_value)
        except (TypeError, ValueError) as exc:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "金额参数不合法",
                field_errors=[{"field": field, "reason": f"{field} 必须是数字"}],
            ) from exc
        if value < 0:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "金额参数不合法",
                field_errors=[{"field": field, "reason": f"{field} 必须大于等于 0"}],
            )
        return round(value, P0_CONFIG.amount_precision)

    def _ratio(self, raw_value, field):
        try:
            value = float(raw_value)
        except (TypeError, ValueError) as exc:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "优先分配比例不合法",
                field_errors=[{"field": field, "reason": f"{field} 必须是数字"}],
            ) from exc
        if value < 0 or value > 1:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "优先分配比例不合法",
                field_errors=[{"field": field, "reason": f"{field} 必须在 0 到 1 之间"}],
            )
        return round(value, 6)


class AuditLogService:
    FILTER_FIELDS = {"module_code", "operation_type", "object_type", "object_id", "status"}

    def __init__(self, repository):
        self.repository = repository

    def list(self, filters):
        items = self.repository.list_audit_logs()
        for field in self.FILTER_FIELDS:
            value = filters.get(field)
            if value:
                items = [item for item in items if str(item.get(field)) == str(value)]
        limit = self._limit(filters.get("limit"))
        if limit is not None:
            items = items[:limit]
        return table_page(items)

    def detail(self, log_id):
        audit_log = self.repository.get_audit_log(log_id)
        if not audit_log:
            raise ApiError("DVAS_NOT_FOUND", "审计日志不存在", status=404)
        snapshot_refs = []
        snapshots = {}
        for field in ["input_snapshot_id", "parameter_snapshot_id", "result_snapshot_id"]:
            snapshot_id = audit_log.get(field)
            if not snapshot_id:
                continue
            snapshot = self.repository.get_snapshot(snapshot_id)
            snapshot_refs.append(
                {
                    "field": field,
                    "snapshot_id": snapshot_id,
                    "available": snapshot is not None,
                }
            )
            if snapshot:
                snapshots[snapshot_id] = snapshot
        return {
            "audit_log": audit_log,
            "snapshot_refs": snapshot_refs,
            "snapshots": snapshots,
            "empty_state": None if snapshot_refs else "该审计日志未关联快照",
        }

    def _limit(self, raw_limit):
        if raw_limit in (None, ""):
            return None
        try:
            limit = int(raw_limit)
        except (TypeError, ValueError) as exc:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "审计日志查询参数不合法",
                field_errors=[{"field": "limit", "reason": "limit 必须是正整数"}],
            ) from exc
        if limit <= 0:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "审计日志查询参数不合法",
                field_errors=[{"field": "limit", "reason": "limit 必须是正整数"}],
            )
        return limit


class DashboardService:
    def __init__(self, repository):
        self.repository = repository

    def overview(self):
        project = self.repository.get_project()
        packages = self.repository.list_data_packages()
        current_package_id = project.get("current_package_id")
        resources = self.repository.list_data_resources(current_package_id) if current_package_id else []
        parties = self.repository.list_parties()
        current_package = (
            self.repository.get_data_package(current_package_id) if current_package_id else None
        )
        current_snapshot = self._current_input_snapshot(project, current_package)
        metering_count = len(self.repository.list_shuyuan_meterings())
        utility_count = len(self.repository.list_utility_records())
        weight_count = len(self.repository.list_md_dshap_tasks())
        allocation_count = len(self.repository.list_allocation_scenarios())
        report_count = len(self.repository.list_report_records())
        export_file_count = len(self.repository.list_export_files())
        preconditions = self.preconditions()
        return {
            **project,
            "metrics": {
                "data_package_count": len([item for item in packages if item["status"] == "VALIDATED"]),
                "resource_count": len(resources),
                "party_count": self._current_participant_count(current_snapshot, parties, resources),
                "current_revenue_pool": self._current_revenue_pool(project, current_snapshot),
                "metering_count": metering_count,
                "utility_count": utility_count,
                "weight_count": weight_count,
                "allocation_count": allocation_count,
                "report_count": report_count,
                "export_file_count": export_file_count,
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

    def _current_input_snapshot(self, project, current_package=None):
        snapshot_id = project.get("current_input_snapshot_id") or (current_package or {}).get(
            "input_snapshot_id"
        )
        if not snapshot_id:
            return None
        return self.repository.get_input_snapshot(snapshot_id)

    def _current_participant_count(self, snapshot, parties, resources):
        content = self._snapshot_content(snapshot)
        participants = content.get("participants")
        if not isinstance(participants, list):
            participants = content.get("parties")
        if isinstance(participants, list):
            return len(participants)

        party_ids = {
            resource.get("party_id")
            for resource in resources
            if resource.get("party_id")
        }
        if party_ids:
            return len(party_ids)
        return len(parties)

    def _current_revenue_pool(self, project, snapshot):
        allocation_id = project.get("current_allocation_id")
        if allocation_id:
            allocation = self.repository.get_allocation_scenario(allocation_id)
            if allocation and allocation.get("data_provider_revenue_pool") is not None:
                return allocation["data_provider_revenue_pool"]

        content = self._snapshot_content(snapshot)
        for field in ("data_provider_revenue_pool", "revenue_pool", "total_revenue"):
            value = content.get(field)
            if value is not None and value != "":
                try:
                    return round(float(value), P0_CONFIG.amount_precision)
                except (TypeError, ValueError):
                    return value
        return None

    def _snapshot_content(self, snapshot):
        content = (snapshot or {}).get("content_json")
        return content if isinstance(content, dict) else {}

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
        has_mds_weight_result = bool(self.repository.list_md_dshap_tasks())
        has_allocation_scenario = bool(self.repository.list_allocation_scenarios())
        has_allocation_result = bool(self.repository.list_allocation_results())
        has_confirmed_allocation = any(
            item["status"] == "CONFIRMED" for item in self.repository.list_allocation_scenarios()
        )
        has_report_record = bool(self.repository.list_report_records())
        has_export_file = bool(self.repository.list_export_files())
        mds_ready, mds_reason = self._mds_ready_reason(project)
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
            {
                "code": "HAS_MDS_WEIGHT_RESULT",
                "passed": has_mds_weight_result,
                "message": "已完成 MD-DShap 权重计算" if has_mds_weight_result else "待完成 MD-DShap 权重计算",
            },
            {
                "code": "HAS_ALLOCATION_SCENARIO",
                "passed": has_allocation_scenario,
                "message": "已创建收益分配模拟方案" if has_allocation_scenario else "待创建收益分配模拟方案",
            },
            {
                "code": "HAS_ALLOCATION_RESULT",
                "passed": has_allocation_result,
                "message": "已完成收益分配模拟" if has_allocation_result else "待完成收益分配模拟",
            },
            {
                "code": "HAS_CONFIRMED_ALLOCATION",
                "passed": has_confirmed_allocation,
                "message": "已锁定模拟参考方案" if has_confirmed_allocation else "待锁定模拟参考方案",
            },
            {
                "code": "HAS_REPORT_RECORD",
                "passed": has_report_record,
                "message": "已生成报告记录" if has_report_record else "待生成报告记录",
            },
            {
                "code": "HAS_EXPORT_FILE",
                "passed": has_export_file,
                "message": "已生成导出文件" if has_export_file else "待生成导出文件",
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
            mds_ready,
            mds_reason,
        )
        return {
            "project_id": project["project_id"],
            "project_status": project["project_status"],
            "preconditions": preconditions,
            "available_actions": available_actions,
            "disabled_actions": disabled_actions,
        }

    def quick_run(self, payload=None):
        payload = payload or {}
        preconditions = self.preconditions()
        failures = [
            item
            for item in preconditions["preconditions"]
            if item["code"] in {"HAS_VALID_DATA_PACKAGE", "HAS_RESOURCE_PARTY_RELATION"}
            and not item["passed"]
        ]
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
        project = self.repository.get_project()
        contract_ratio_plan = self.repository.latest_contract_ratio_plan(project["project_id"])
        if not contract_ratio_plan or contract_ratio_plan.get("status") not in {"SAVED", "LOCKED"}:
            raise ApiError(
                "DVAS_CONTRACT_RATIO_REQUIRED",
                "请先在合同分配规则页保存合同比例方案后再执行完整链路计算。",
                field_errors=[
                    {
                        "field": "contract_ratio_plan",
                        "reason": "请先在合同分配规则页保存合同比例方案后再执行完整链路计算",
                    }
                ],
            )
        if contract_ratio_plan.get("ratio_sum") != "1.000000":
            raise ApiError(
                "DVAS_CONTRACT_RATIO_INVALID",
                "合同比例合计必须等于 100.0000%。",
                field_errors=[
                    {
                        "field": "ratio_sum",
                        "reason": f"当前比例合计为 {contract_ratio_plan.get('ratio_sum')}",
                    }
                ],
            )
        quality = QualityAssessmentService(self.repository).run(payload.get("quality", {}))
        metering = ShuyuanMeteringService(self.repository).run(payload.get("shuyuan", {}))
        contribution = ContributionService(self.repository).run(payload.get("contribution", {}))
        utility = UtilityService(self.repository).run(payload.get("utility", {}))
        weights = MdDshapService(self.repository).run(payload.get("md_dshap", {}))
        simulation = AllocationService(self.repository).simulate_contract_ratio(project["project_id"])
        contract_ratio = ContractRatioService(self.repository).get(project["project_id"])
        write_audit(
            self.repository,
            module_code="SYS",
            menu_code="NAV_SYS_HOME",
            button_code="SYS-004",
            operation_type="RUN_FULL_PIPELINE",
            object_type="pipeline_run",
            object_id=simulation["allocation"]["allocation_id"],
            status="SUCCESS",
            after_value_json={
                "quality_assessment_id": quality["assessment"]["assessment_id"],
                "metering_id": metering["metering"]["metering_id"],
                "contribution_run_id": contribution["contribution_run_id"],
                "utility_id": utility["utility"]["utility_id"],
                "md_dshap_task_id": weights["task"]["task_id"],
                "allocation_id": simulation["allocation"]["allocation_id"],
                "contract_ratio_plan_id": simulation["allocation"].get("contract_ratio_plan_id"),
                "contract_ratio_sum": simulation["allocation"].get("contract_ratio_sum"),
            },
        )
        return {
            "project_id": simulation["project_id"],
            "project_status": simulation["project_status"],
            "pipeline_status": "COMPLETED",
            "contract_ratio_plan_id": simulation["allocation"].get("contract_ratio_plan_id"),
            "contract_ratio_sum": simulation["allocation"].get("contract_ratio_sum"),
            "steps": {
                "contract_ratio": contract_ratio,
                "quality": quality,
                "shuyuan": metering,
                "contribution": contribution,
                "utility": utility,
                "md_dshap": weights,
                "allocation": simulation,
            },
            "message": "完整链路已按后端真实服务执行至收益分配模拟。",
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
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
        if project_status == "WEIGHT_CALCULATED":
            return {"label": "创建收益分配模拟方案", "button_code": "ALLOC-001"}
        if project_status == "ALLOCATED":
            return {"label": "锁定模拟参考方案", "button_code": "ALLOC-009"}
        if project_status == "CONFIRMED":
            return {"label": "查看已确认模拟参考方案", "button_code": "ALLOC-010"}
        if project_status == "EXPORTED":
            return {"label": "查看报告与审计导出", "button_code": "REPORT-001"}
        return {"label": "查看当前状态", "button_code": "SYS-001"}

    def _gate_action(self, available_actions, disabled_actions, button_code, passed, reason):
        if passed:
            available_actions.append(button_code)
        else:
            disabled_actions.append({"button_code": button_code, "reason": reason})

    def _mds_ready_reason(self, project):
        if project["project_status"] not in {"UTILITY_CALCULATED", "WEIGHT_CALCULATED"}:
            return False, "请先完成效用计算"
        utility_records = self.repository.list_utility_records()
        if not utility_records:
            return False, "请先完成效用计算"
        current_resource_party_ids = self._current_resource_party_ids(project)
        participants = [
            party
            for party in self.repository.list_parties()
            if self._is_data_provider_party(party)
            and self._is_active_party(party)
            and party.get("include_in_md_dshap")
            and party.get("party_id") in current_resource_party_ids
        ]
        if not participants:
            return False, "请先维护可进入 MD-DShap 的数据源主体"
        latest_utility = utility_records[-1]
        traces = self.repository.get_utility_traces(latest_utility["utility_id"])
        utility_by_party = {trace["party_id"]: trace["utility_value"] for trace in traces}
        total_utility = sum(float(utility_by_party.get(party["party_id"], 0)) for party in participants)
        if len(participants) > 1 and total_utility <= 0:
            return False, "效用总值必须大于 0"
        return True, ""

    def _is_data_provider_party(self, party):
        return bool(party.get("is_data_provider", party.get("party_type") == "DATA_PROVIDER"))

    def _is_active_party(self, party):
        return party.get("status") in {"ACTIVE", "ENABLED"}

    def _current_resource_party_ids(self, project):
        package_id = project.get("current_package_id")
        resources = (
            self.repository.list_data_resources(package_id)
            if package_id
            else self.repository.list_data_resources()
        )
        return {
            resource.get("party_id")
            for resource in resources
            if resource.get("party_id")
            and resource.get("status") == "ACTIVE"
            and resource.get("include_in_calculation", True) is not False
        }


class AsyncJobService:
    def __init__(self, repository, auth_service):
        self.repository = repository
        self.auth_service = auth_service

    def run_pipeline(self, payload, runner):
        self.auth_service.require_button(payload, "SYS-004")
        return self._run_job(payload, "FULL_PIPELINE", "完整链路计算", runner)

    def run_md_dshap(self, payload, runner):
        self.auth_service.require_button(payload, "MDS-011")
        return self._run_job(payload, "MD_DSHAP", "MD-DShap 权重计算", runner)

    def _run_job(self, payload, job_type, job_name, runner):
        now = utc_now()
        project = self.repository.get_project()
        user_id = self.auth_service.current_user(payload, require_login=True)["user_id"]
        job = {
            "job_id": self.repository.next_id("job"),
            "project_id": project["project_id"],
            "job_type": job_type,
            "job_name": job_name,
            "status": "RUNNING",
            "progress": 10,
            "can_cancel": True,
            "subject_id": None,
            "requested_by": user_id,
            "created_by": user_id,
            "created_at": now,
            "started_at": now,
            "completed_at": None,
            "cancelled_at": None,
            "failure_reason": None,
            "error_code": None,
            "result_json": None,
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        }
        self.repository.put_async_job(job)
        try:
            result = runner()
        except ApiError as error:
            failed = {
                **job,
                "status": "FAILED",
                "progress": 100,
                "can_cancel": False,
                "completed_at": utc_now(),
                "failure_reason": error.message,
                "error_code": error.code,
                "result_json": {"field_errors": error.field_errors, "detail_json": error.detail_json},
            }
            self.repository.put_async_job(failed)
            raise
        subject_id = None
        if isinstance(result, dict):
            subject_id = (
                result.get("task", {}).get("task_id")
                or result.get("task_id")
                or result.get("allocation_id")
                or result.get("report", {}).get("report_id")
            )
        completed = {
            **job,
            "status": "SUCCESS",
            "progress": 100,
            "can_cancel": False,
            "subject_id": subject_id,
            "completed_at": utc_now(),
            "result_json": result,
        }
        self.repository.put_async_job(completed)
        return {"job": completed, "result": result}

    def list_jobs(self, payload):
        user = self.auth_service.current_user(payload, require_login=True)
        project_id = payload.get("project_id") or self.repository.get_project()["project_id"]
        jobs = self.repository.list_async_jobs(project_id)
        if not self.repository.user_has_any_role(user["user_id"], {"SYSTEM_ADMIN", "BUSINESS_ADMIN", "AUDITOR"}):
            jobs = [
                job
                for job in jobs
                if (job.get("requested_by") == user["user_id"] or job.get("created_by") == user["user_id"])
                and job.get("status") in {"SUCCESS", "COMPLETED", "CONFIRMED"}
            ]
        return table_page(jobs)

    def detail(self, payload, job_id):
        user = self.auth_service.current_user(payload, require_login=True)
        job = self.repository.get_async_job(job_id)
        if not job:
            raise ApiError("DVAS_NOT_FOUND", "任务不存在", status=404)
        if (
            not self.repository.user_has_any_role(user["user_id"], {"SYSTEM_ADMIN", "BUSINESS_ADMIN", "AUDITOR"})
            and job.get("requested_by") != user["user_id"]
            and job.get("created_by") != user["user_id"]
        ):
            raise ApiError("DVAS_PERMISSION_DENIED", "当前用户无此任务权限", status=403)
        return job

    def cancel(self, payload, job_id):
        self.auth_service.require_button(payload, "MDS-019")
        job = self.repository.get_async_job(job_id)
        if not job:
            raise ApiError("DVAS_NOT_FOUND", "任务不存在", status=404)
        if job["status"] not in {"PENDING", "RUNNING"}:
            return {**job, "cancel_requested": False, "message": "任务已结束，不能取消"}
        cancelled = {
            **job,
            "status": "CANCELLED",
            "can_cancel": False,
            "cancelled_at": utc_now(),
            "failure_reason": "用户取消",
        }
        self.repository.put_async_job(cancelled)
        return {**cancelled, "cancel_requested": True}

    def md_dshap_progress(self, payload, task_id):
        user = self.auth_service.current_user(payload, require_login=True)
        task = self.repository.get_md_dshap_task(task_id)
        if not task:
            raise ApiError("DVAS_NOT_FOUND", "MD-DShap 任务不存在", status=404)
        if (
            not self.repository.user_has_any_role(user["user_id"], {"SYSTEM_ADMIN", "BUSINESS_ADMIN", "AUDITOR"})
            and task.get("requested_by") != user["user_id"]
            and task.get("created_by") != user["user_id"]
        ):
            raise ApiError("DVAS_PERMISSION_DENIED", "当前用户无此任务权限", status=403)
        linked_jobs = [
            job
            for job in self.repository.list_async_jobs(task.get("project_id"))
            if job.get("subject_id") == task_id
            or (job.get("result_json") or {}).get("task", {}).get("task_id") == task_id
        ]
        job = linked_jobs[-1] if linked_jobs else None
        status = "SUCCESS" if task.get("status") == "COMPLETED" else task.get("status", "UNKNOWN")
        return {
            "task_id": task_id,
            "job": job,
            "status": status,
            "progress": 100 if status == "SUCCESS" else 0,
            "result_count": task.get("result_count", 0),
            "algorithm_party_count": task.get("algorithm_party_count", 0),
            "failure_reason": task.get("failure_reason"),
            "can_cancel": bool(job and job.get("can_cancel")),
        }


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
            audit_context={"module_code": "SYS", "menu_code": "NAV_SYS_HOME"},
        )

    def upload_multipart(self, payload):
        files = payload.get("_multipart_files") or {}
        file_part = files.get("file")
        if not file_part:
            diagnostics = {
                "filename": None,
                "content_length": 0,
                "sha256": None,
                "json_keys": [],
                "field_name": "file",
            }
            return self._reject_upload(
                {},
                [{"field": "file", "reason": "必须使用 FormData 的 file 字段上传 JSON 文件"}],
                diagnostics,
                code="DVAS_REQUIRED_FIELD_MISSING",
            )

        content = file_part.get("content") or b""
        diagnostics = self._upload_diagnostics(
            file_part.get("filename") or "uploaded.json",
            content,
        )
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError as exc:
            return self._reject_upload(
                {"file_name": diagnostics["filename"]},
                [{"field": "file", "reason": f"文件必须是合法 UTF-8 JSON：{exc}"}],
                diagnostics,
                code="DVAS_INPUT_FORMAT_ERROR",
            )
        try:
            payload = json.loads(text)
        except json.JSONDecodeError as exc:
            return self._reject_upload(
                {"file_name": diagnostics["filename"]},
                [{"field": "file", "reason": f"文件内容不是合法 JSON：{exc}"}],
                diagnostics,
                code="DVAS_INPUT_FORMAT_ERROR",
            )
        if not isinstance(payload, dict):
            return self._reject_upload(
                {"file_name": diagnostics["filename"]},
                [{"field": "body", "reason": "上传 JSON 顶层必须是对象"}],
                diagnostics,
                code="DVAS_INPUT_FORMAT_ERROR",
            )

        diagnostics["json_keys"] = sorted(payload.keys())
        self._print_upload_diagnostics(diagnostics)
        payload = {**payload, "_upload_diagnostics": diagnostics}
        return self.upload_json(payload)

    def upload_json(self, payload):
        payload = payload or {}
        upload_diagnostics = payload.get("_upload_diagnostics") if isinstance(payload, dict) else None
        payload = self._normalize_upload_payload(payload)
        field_errors = self._validate_upload_payload(payload)
        if field_errors:
            package = self._create_invalid_package(payload, field_errors, upload_diagnostics=upload_diagnostics)
            validation_result = self.repository.get_validation_result(package["package_id"])
            raise ApiError(
                validation_result["code"],
                "上传 JSON 校验失败",
                field_errors=validation_result["field_errors"],
                audit_recorded=True,
                detail_json=validation_result["detail_json"],
            )
        return self._create_valid_ingestion(
            source_type="UPLOAD",
            package_name=payload["package_name"],
            raw_payload=payload,
            resources=payload["resources"],
            parties=payload["parties"],
            file_name=payload.get("file_name", "uploaded.json"),
            file_size=payload.get("file_size"),
            upload_diagnostics=upload_diagnostics,
        )

    def import_structured_payload(self, payload, source_type, file_name, file_size, checksum):
        payload = payload or {}
        diagnostics = {
            "filename": file_name,
            "content_length": int(file_size or 0),
            "sha256": checksum,
            "json_keys": sorted(payload.keys()),
            "field_name": "file",
        }
        normalized = self._normalize_upload_payload({**payload, "_upload_diagnostics": diagnostics})
        field_errors = self._validate_upload_payload(normalized)
        if field_errors:
            package = self._create_invalid_package(
                {
                    **normalized,
                    "file_name": file_name,
                    "file_size": file_size,
                },
                field_errors,
                upload_diagnostics=diagnostics,
            )
            validation_result = self.repository.get_validation_result(package["package_id"])
            raise ApiError(
                validation_result["code"],
                f"{source_type} 导入校验失败",
                field_errors=validation_result["field_errors"],
                audit_recorded=True,
                detail_json=validation_result["detail_json"],
            )
        return self._create_valid_ingestion(
            source_type=source_type,
            package_name=normalized["package_name"],
            raw_payload=normalized,
            resources=normalized["resources"],
            parties=normalized["parties"],
            file_name=file_name,
            file_size=file_size,
            upload_diagnostics=diagnostics,
        )

    def list_packages(self, payload=None):
        payload = payload or {}
        packages = self.repository.list_data_packages()
        user_id = current_operator_id(self.repository)
        scope = str(payload.get("scope") or payload.get("created_by") or "").strip().lower()
        if scope in {"mine", "my", "current_user"}:
            packages = [package for package in packages if package.get("created_by") == user_id]
        elif not self.repository.user_has_any_role(user_id, {"SYSTEM_ADMIN", "BUSINESS_ADMIN"}):
            if self.repository.user_has_any_role(user_id, {"AUDITOR"}):
                packages = [package for package in packages if package.get("status") in {"VALIDATED", "CONFIRMED"}]
            else:
                packages = [package for package in packages if package.get("created_by") == user_id]
        query = str(payload.get("q") or payload.get("search") or "").strip().lower()
        if query:
            packages = [
                package
                for package in packages
                if self._package_matches_query(package, query)
            ]
        return table_page(packages)

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

    def delete_package(self, package_id):
        package = self.repository.get_data_package(package_id)
        if not package:
            raise ApiError("DVAS_NOT_FOUND", "数据包不存在", status=404)

        resources = self.repository.delete_data_resources_by_package(package_id)
        validation = self.repository.delete_validation_result(package_id)
        input_snapshot = self.repository.delete_input_snapshot(package.get("input_snapshot_id"))
        deleted_package = self.repository.delete_data_package(package_id)
        remaining_packages = self.repository.list_data_packages()
        project = self.repository.get_project()
        if project.get("current_package_id") == package_id:
            if remaining_packages:
                latest_package = remaining_packages[-1]
                project = self.repository.update_project(
                    project_status=ProjectStatus.INGESTED.value,
                    current_package_id=latest_package["package_id"],
                    current_input_snapshot_id=latest_package.get("input_snapshot_id"),
                    current_algorithm_task_id=None,
                    current_allocation_id=None,
                )
            else:
                self.repository.clear_derived_calculation_artifacts()
                project = self.repository.update_project(
                    project_status=ProjectStatus.DRAFT.value,
                    current_package_id=None,
                    current_input_snapshot_id=None,
                    current_algorithm_task_id=None,
                    current_allocation_id=None,
                )

        deleted_summary = {
            "package_id": package_id,
            "package_name": package.get("package_name"),
            "deleted": True,
            "deleted_resource_count": len(resources),
            "deleted_validation_result_id": (validation or {}).get("validation_result_id"),
            "deleted_input_snapshot_id": (input_snapshot or {}).get("snapshot_id"),
            "remaining_package_count": len(remaining_packages),
            "current_package_id": project.get("current_package_id"),
            "project_status": project["project_status"],
        }
        self._audit(
            module_code="DATA",
            menu_code="NAV_DATA_PACKAGE",
            operation_type="DELETE_DATA_PACKAGE",
            object_type="data_package",
            object_id=package_id,
            status="SUCCESS",
            after_value_json={
                "deleted_package": deleted_package,
                "deleted_resource_count": len(resources),
                "remaining_package_count": len(remaining_packages),
            },
            button_code="DATA-009",
        )
        return deleted_summary

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

    def _normalize_upload_payload(self, payload):
        payload = copy.deepcopy(payload) if isinstance(payload, dict) else {}
        upload_diagnostics = payload.pop("_upload_diagnostics", None) or {}
        participants = payload.get("parties")
        if not isinstance(participants, list) and isinstance(payload.get("participants"), list):
            participants = payload.get("participants")
        parties = self._normalize_uploaded_parties(participants or [])
        party_name_by_id = {
            str(party.get("party_id")): party.get("party_name")
            for party in parties
            if party.get("party_id") and party.get("party_name")
        }

        data_units = payload.get("resources")
        if not isinstance(data_units, list) and isinstance(payload.get("data_units"), list):
            data_units = payload.get("data_units")
        resources = self._normalize_uploaded_resources(data_units or [], party_name_by_id)

        package_name = payload.get("package_name") or payload.get("project_name")
        file_name = payload.get("file_name") or upload_diagnostics.get("filename") or "uploaded.json"
        normalized = {
            **payload,
            "package_name": package_name,
            "scenario_name": payload.get("scenario_name") or payload.get("project_name"),
            "resources": resources,
            "parties": parties,
            "file_name": file_name,
        }
        if "content_length" in upload_diagnostics:
            normalized["file_size"] = upload_diagnostics["content_length"]
        elif "file_size" in payload:
            normalized["file_size"] = payload["file_size"]
        return normalized

    def _package_matches_query(self, package, query):
        fields = (
            "package_id",
            "package_name",
            "source_type",
            "file_name",
            "status",
            "checksum",
            "created_at",
        )
        return any(query in str(package.get(field, "")).lower() for field in fields)

    def _normalize_uploaded_parties(self, parties):
        normalized = []
        for party in parties:
            if not isinstance(party, dict):
                normalized.append({})
                continue
            party_type = party.get("party_type") or (
                "DATA_PROVIDER" if party.get("is_data_provider") else "CONTRACT_PARTY"
            )
            normalized.append(
                {
                    **party,
                    "party_name": party.get("party_name"),
                    "party_type": party_type,
                    "is_data_provider": bool(
                        party.get("is_data_provider", party_type == "DATA_PROVIDER")
                    ),
                    "include_in_md_dshap": bool(
                        party.get("include_in_md_dshap", party_type == "DATA_PROVIDER")
                    ),
                }
            )
        return normalized

    def _normalize_uploaded_resources(self, resources, party_name_by_id):
        normalized = []
        for resource in resources:
            if not isinstance(resource, dict):
                normalized.append({})
                continue
            provider_party_name = (
                resource.get("provider_party_name")
                or party_name_by_id.get(str(resource.get("party_id")))
            )
            normalized.append(
                {
                    **resource,
                    "resource_name": resource.get("resource_name"),
                    "modality": resource.get("modality", "TABULAR"),
                    "field_count": resource.get("field_count", 0),
                    "sample_count": resource.get("sample_count", 0),
                    "provider_party_name": provider_party_name,
                }
            )
        return normalized

    def _upload_diagnostics(self, filename, content):
        return {
            "filename": filename,
            "content_length": len(content),
            "sha256": hashlib.sha256(content).hexdigest(),
            "json_keys": [],
            "field_name": "file",
        }

    def _print_upload_diagnostics(self, diagnostics):
        print(
            "DVAS upload received "
            f"filename={diagnostics['filename']} "
            f"content_length={diagnostics['content_length']} "
            f"sha256={diagnostics['sha256']} "
            f"json_keys={diagnostics['json_keys']}"
        )

    def _reject_upload(self, payload, field_errors, upload_diagnostics, code):
        package = self._create_invalid_package(
            payload,
            field_errors,
            code=code,
            upload_diagnostics=upload_diagnostics,
        )
        validation_result = self.repository.get_validation_result(package["package_id"])
        raise ApiError(
            validation_result["code"],
            validation_result["message"],
            field_errors=validation_result["field_errors"],
            audit_recorded=True,
            detail_json=validation_result["detail_json"],
        )

    def _create_invalid_package(
        self,
        payload,
        field_errors,
        code="DVAS_REQUIRED_FIELD_MISSING",
        upload_diagnostics=None,
    ):
        now = utc_now()
        operator_id = current_operator_id(self.repository)
        package_id = self.repository.next_id("package")
        validation_result_id = self.repository.next_id("validation")
        upload_diagnostics = upload_diagnostics or {}
        first_error = field_errors[0] if field_errors else {}
        package = {
            "package_id": package_id,
            "project_id": self.repository.get_project()["project_id"],
            "package_name": payload.get("package_name") or "未命名上传数据包",
            "source_type": "UPLOAD",
            "file_name": payload.get("file_name") or upload_diagnostics.get("filename") or "uploaded.json",
            "file_size": int(payload.get("file_size", upload_diagnostics.get("content_length", 0)) or 0),
            "status": "INVALID",
            "input_snapshot_id": None,
            "validation_result_id": validation_result_id,
            "checksum": upload_diagnostics.get("sha256") or stable_checksum(payload),
            "created_by": operator_id,
            "created_at": now,
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        }
        detail_json = {
            "field_errors": field_errors,
            "upload_diagnostics": upload_diagnostics,
        }
        validation_result = {
            "validation_result_id": validation_result_id,
            "package_id": package_id,
            "project_id": package["project_id"],
            "status": "INVALID",
            "is_valid": False,
            "code": code,
            "message": "上传 JSON 校验失败",
            "error_code": code,
            "error_field": first_error.get("field"),
            "error_message": first_error.get("reason") or "上传 JSON 校验失败",
            "field_errors": field_errors,
            "detail_json": detail_json,
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
        file_size=None,
        upload_diagnostics=None,
        audit_context=None,
    ):
        now = utc_now()
        operator_id = current_operator_id(self.repository)
        project = self.repository.get_project()
        upload_diagnostics = upload_diagnostics or {}
        snapshot_id = self.repository.next_id("snapshot")
        snapshot = {
            "snapshot_id": snapshot_id,
            "project_id": project["project_id"],
            "snapshot_type": "INPUT",
            "content_json": copy.deepcopy(raw_payload),
            "checksum": stable_checksum(raw_payload),
            "created_by": operator_id,
            "created_at": now,
        }
        package_id = self.repository.next_id("package")
        validation_result_id = self.repository.next_id("validation")
        package = {
            "package_id": package_id,
            "project_id": project["project_id"],
            "package_name": package_name,
            "source_type": source_type,
            "demo_case_id": demo_case_id,
            "file_name": file_name,
            "file_size": int(file_size or upload_diagnostics.get("content_length", 0) or 0),
            "status": "VALIDATED",
            "input_snapshot_id": snapshot_id,
            "validation_result_id": validation_result_id,
            "checksum": upload_diagnostics.get("sha256") or snapshot["checksum"],
            "created_by": operator_id,
            "created_at": now,
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        }
        validation_result = {
            "validation_result_id": validation_result_id,
            "package_id": package_id,
            "project_id": project["project_id"],
            "status": "VALIDATED",
            "is_valid": True,
            "code": "OK",
            "message": "数据包校验通过",
            "error_code": None,
            "error_field": None,
            "error_message": None,
            "field_errors": [],
            "detail_json": {
                "resource_count": len(resources),
                "party_count": len(parties),
                "upload_diagnostics": upload_diagnostics,
            },
            "created_at": now,
        }

        self.repository.put_input_snapshot(snapshot)
        self.repository.put_data_package(package)
        self.repository.put_validation_result(validation_result)
        created_parties = self._upsert_parties(parties, project["project_id"], now, operator_id)
        party_by_name = {party["party_name"]: party for party in created_parties}
        created_resources = self._create_resources(
            resources,
            package_id,
            project["project_id"],
            party_by_name,
            now,
            operator_id,
        )
        updated_project = self.repository.update_project(
            project_status=ProjectStatus.INGESTED.value,
            current_package_id=package_id,
            current_input_snapshot_id=snapshot_id,
            scenario_name=scenario_name or project["scenario_name"],
            operator_id=operator_id,
            created_by=operator_id,
        )
        audit_context = audit_context or {"module_code": "DATA", "menu_code": "NAV_DATA_PACKAGE"}
        self._audit(
            module_code=audit_context["module_code"],
            menu_code=audit_context["menu_code"],
            operation_type=self._ingestion_operation_type(source_type),
            object_type="data_package",
            object_id=package_id,
            status="SUCCESS",
            input_snapshot_id=snapshot_id,
            after_value_json={"package": package, "resources": created_resources, "parties": created_parties},
            button_code="SYS-002" if source_type == "DEMO" else None,
        )
        return {
            "project_id": updated_project["project_id"],
            "project_status": updated_project["project_status"],
            "package": package,
            "input_snapshot": snapshot,
            "validation_result": validation_result,
            "resources": created_resources,
            "parties": created_parties,
            "upload_diagnostics": upload_diagnostics,
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        }

    def _ingestion_operation_type(self, source_type):
        if source_type == "DEMO":
            return "INITIALIZE_DEMO"
        if source_type == "CSV_UPLOAD":
            return "IMPORT_CSV_TEMPLATE"
        if source_type == "XLSX_UPLOAD":
            return "IMPORT_XLSX_TEMPLATE"
        return "UPLOAD_JSON"

    def _upsert_parties(self, parties, project_id, now, operator_id):
        existing_by_name = {party["party_name"]: party for party in self.repository.list_parties()}
        created = []
        for party_payload in parties:
            party = existing_by_name.get(party_payload["party_name"])
            if not party:
                party_type = party_payload.get("party_type", "DATA_PROVIDER")
                is_data_provider = bool(
                    party_payload.get("is_data_provider", party_type == "DATA_PROVIDER")
                )
                party = {
                    "party_id": self.repository.next_id("party"),
                    "project_id": project_id,
                    "party_name": party_payload["party_name"],
                    "party_type": party_type,
                    "is_data_provider": is_data_provider,
                    "include_in_md_dshap": bool(
                        party_payload.get("include_in_md_dshap", is_data_provider)
                    ),
                    "status": "ENABLED",
                    "created_by": operator_id,
                    "created_at": now,
                    "updated_at": now,
                }
                self.repository.put_party(party)
            created.append(party)
        return created

    def _create_resources(self, resources, package_id, project_id, party_by_name, now, operator_id):
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
                "missing_rate": float(resource_payload.get("missing_rate", 0) or 0),
                "sensitive_field_count": int(resource_payload.get("sensitive_field_count", 0) or 0),
                "include_in_calculation": bool(resource_payload.get("include_in_calculation", True)),
                "party_id": party["party_id"] if party else None,
                "provider_party_name": resource_payload["provider_party_name"],
                "status": "ACTIVE",
                "created_by": operator_id,
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
        button_code=None,
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
            button_code=button_code,
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
            "is_data_provider": party_type == "DATA_PROVIDER",
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
            "is_data_provider": party_type == "DATA_PROVIDER",
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
    ALGORITHM_VERSION = "DVAS_QUALITY_7P17S_V1"

    def __init__(self, repository):
        self.repository = repository

    def run(self, payload):
        project = self.repository.get_project()
        ProjectStateMachine(self.repository).require_quality_allowed()
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
        assessment_id = self.repository.next_id("assessment")
        details, dimension_scores, quality_score = self._evaluate_quality(resources)
        quality_level = self._quality_level(quality_score)
        evidence_summary = (
            "质量评估按 7 个一级指标和 17 个二级指标逐级加权生成，"
            f"本次覆盖 {len(resources)} 个数据资源。"
        )
        snapshot_id = self.repository.next_id("snapshot")
        snapshot_content = {
            "details": details,
            "quality_score_detail": details,
            "dimension_scores": dimension_scores,
            "quality_score": round(quality_score, 2),
            "evidence_summary": evidence_summary,
        }
        output_snapshot = {
            "snapshot_id": snapshot_id,
            "project_id": project["project_id"],
            "snapshot_type": "RESULT",
            "content_json": snapshot_content,
            "checksum": stable_checksum(snapshot_content),
            "created_by": current_operator_id(self.repository),
            "created_at": now,
        }
        assessment = {
            "assessment_id": assessment_id,
            "project_id": project["project_id"],
            "package_id": package_id,
            "version_no": version_no,
            "quality_score": round(quality_score, 2),
            "quality_level": quality_level,
            "quality_factor": round(quality_score / 100, 4),
            "dimension_scores": dimension_scores,
            "quality_score_detail": details,
            "primary_metric_count": len(QUALITY_PRIMARY_METRICS),
            "secondary_metric_count": len(QUALITY_SECONDARY_METRICS),
            "evidence_summary": evidence_summary,
            "algorithm_version": self.ALGORITHM_VERSION,
            "input_snapshot_id": package.get("input_snapshot_id"),
            "parameter_snapshot_id": None,
            "output_snapshot_id": snapshot_id,
            "created_by": current_operator_id(self.repository),
            "created_at": now,
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        }
        resource_assessments, resource_score_details = self.evaluate_resources(
            resources,
            assessment,
            now=now,
        )
        resource_results = self._resource_result_payload(
            assessment,
            resource_assessments,
            resource_score_details,
        )
        assessment.update(
            {
                "assessed_resource_count": resource_results["assessed_resource_count"],
                "average_resource_score": resource_results["average_resource_score"],
                "avg_resource_score": resource_results["average_resource_score"],
                "low_score_resource_count": resource_results["low_score_resource_count"],
                "low_score_threshold": resource_results["low_score_threshold"],
            }
        )
        snapshot_content["resource_quality"] = resource_results
        output_snapshot["content_json"] = snapshot_content
        output_snapshot["checksum"] = stable_checksum(snapshot_content)
        self.repository.put_snapshot(output_snapshot)
        self.repository.put_quality_assessment(assessment, details)
        self.repository.put_quality_resource_results(
            assessment["assessment_id"],
            resource_assessments,
            resource_score_details,
        )
        updated_project = self.repository.update_project(project_status=ProjectStatus.ASSESSED.value)
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
            after_value_json={
                "assessment": assessment,
                "details": details,
                "resource_results": resource_results,
            },
        )
        return {
            "project_id": updated_project["project_id"],
            "project_status": updated_project["project_status"],
            "assessment": assessment,
            "details": details,
            "quality_score_detail": details,
            "dimension_scores": dimension_scores,
            "evidence_summary": evidence_summary,
            "resource_quality": resource_results,
            "resource_results": resource_results,
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

    def resource_results(self, payload):
        assessment_id = payload.get("assessment_id") or "latest"
        if assessment_id == "latest":
            assessment = self.latest()
        else:
            assessment = self.repository.get_quality_assessment(assessment_id)
            if not assessment:
                raise ApiError("DVAS_NOT_FOUND", "质量评估结果不存在", status=404)
        if payload.get("project_id") and payload["project_id"] != assessment["project_id"]:
            raise ApiError("DVAS_NOT_FOUND", "质量评估结果不存在", status=404)
        resources = self._assessable_resources(assessment["package_id"])
        resource_assessments = self.repository.list_quality_resource_assessments(
            assessment_id=assessment["assessment_id"]
        )
        expected_resource_ids = {resource["resource_id"] for resource in resources}
        actual_resource_ids = {item["resource_id"] for item in resource_assessments}
        if expected_resource_ids != actual_resource_ids:
            resource_assessments, resource_score_details = self._backfill_resource_quality(
                assessment,
                resources,
            )
        else:
            resource_score_details = self.repository.list_quality_resource_score_details(
                assessment_id=assessment["assessment_id"]
            )
        return self._resource_result_payload(
            assessment,
            resource_assessments,
            resource_score_details,
        )

    def evaluate_resources(self, resources, assessment, now=None):
        now = now or utc_now()
        resource_assessments = []
        all_details = []
        for resource in self._assessable_resource_items(resources):
            resource_assessment_id = self.repository.next_id("quality_resource")
            secondary_scores = self._resource_secondary_scores(resource)
            secondary_by_parent = {}
            metric_scores = {}
            for metric_code, metric_name, parent_metric_code, parameter_code, default_weight in QUALITY_SECONDARY_METRICS:
                weight = self._weight(parameter_code, default_weight)
                score = secondary_scores[metric_code]
                metric_scores[metric_code] = score
                secondary_by_parent.setdefault(parent_metric_code, []).append(
                    self._resource_detail(
                        resource_assessment_id=resource_assessment_id,
                        assessment=assessment,
                        resource=resource,
                        metric_code=metric_code,
                        metric_name=metric_name,
                        metric_level=2,
                        parent_metric_code=parent_metric_code,
                        weight=weight,
                        score=score,
                        weighted_score=score * weight,
                        created_at=now,
                    )
                )

            details = []
            dimension_scores = {}
            total_score = 0.0
            for metric_code, metric_name, parameter_code, default_weight in QUALITY_PRIMARY_METRICS:
                weight = self._weight(parameter_code, default_weight)
                child_details = secondary_by_parent.get(metric_code, [])
                primary_score = round(sum(detail["weighted_score"] for detail in child_details), 2)
                dimension_scores[metric_code] = primary_score
                details.append(
                    self._resource_detail(
                        resource_assessment_id=resource_assessment_id,
                        assessment=assessment,
                        resource=resource,
                        metric_code=metric_code,
                        metric_name=metric_name,
                        metric_level=1,
                        parent_metric_code=None,
                        weight=weight,
                        score=primary_score,
                        weighted_score=primary_score * weight,
                        created_at=now,
                    )
                )
                details.extend(child_details)
                total_score += primary_score * weight

            total_score = round(self._bounded_score(total_score), 2)
            lowest_dimension_code, lowest_dimension_name = self._lowest_dimension(dimension_scores)
            party_names = self._party_names_for_resource(resource)
            resource_assessment = {
                "resource_assessment_id": resource_assessment_id,
                "assessment_id": assessment["assessment_id"],
                "project_id": assessment["project_id"],
                "package_id": assessment["package_id"],
                "resource_id": resource["resource_id"],
                "resource_name": resource["resource_name"],
                "party_names": party_names,
                "party_names_text": "、".join(party_names),
                "modality": resource.get("modality", "TABULAR"),
                "total_score": total_score,
                "quality_level": self._quality_level(total_score),
                "quality_factor": round(total_score / 100, 4),
                "lowest_dimension_code": lowest_dimension_code,
                "lowest_dimension_name": lowest_dimension_name,
                "min_primary_metric": lowest_dimension_name,
                "dimension_scores": dimension_scores,
                "metric_scores": metric_scores,
                "evidence_summary": (
                    f"{resource['resource_name']} 基于字段数、样本量、缺失率、状态和主体关系"
                    "生成逐数据资源质量评分。"
                ),
                "version_no": assessment["version_no"],
                "status": "ASSESSED",
                "created_at": now,
                "updated_at": now,
            }
            resource_assessments.append(resource_assessment)
            all_details.extend(details)
        return resource_assessments, all_details

    def _backfill_resource_quality(self, assessment, resources):
        now = utc_now()
        resource_assessments, resource_score_details = self.evaluate_resources(
            resources,
            assessment,
            now=now,
        )
        self.repository.put_quality_resource_results(
            assessment["assessment_id"],
            resource_assessments,
            resource_score_details,
        )
        return resource_assessments, resource_score_details

    def _resource_result_payload(self, assessment, resource_assessments, resource_score_details):
        dimensions = [
            {
                "dimension_code": metric_code,
                "dimension_name": metric_name,
                "weight": round(self._weight(parameter_code, default_weight), 6),
            }
            for metric_code, metric_name, parameter_code, default_weight in QUALITY_PRIMARY_METRICS
        ]
        resources = []
        for item in sorted(resource_assessments, key=lambda row: row["resource_id"]):
            dimension_scores = {
                dimension["dimension_code"]: round(
                    float(item.get("dimension_scores", {}).get(dimension["dimension_code"], 0)),
                    2,
                )
                for dimension in dimensions
            }
            row = {
                **item,
                "dimension_scores": dimension_scores,
                "owner_name": item.get("party_names_text", ""),
                "provider_party": item.get("party_names_text", ""),
                "resource_type": item.get("modality", ""),
                "update_time": item.get("updated_at", ""),
            }
            resources.append(row)
        scores = [float(item["total_score"]) for item in resources]
        low_score_threshold = float(
            parameter_current_value(self.repository, "LOW_QUALITY_RESOURCE_THRESHOLD", 70)
        )
        average_resource_score = round(sum(scores) / len(scores), 1) if scores else 0
        heatmap_rows = [
            {
                "resource_id": item["resource_id"],
                "resource_name": item["resource_name"],
            }
            for item in resources
        ]
        heatmap_columns = [
            {
                "dimension_code": dimension["dimension_code"],
                "dimension_name": dimension["dimension_name"],
            }
            for dimension in dimensions
        ]
        heatmap_values = [
            [
                float(item["dimension_scores"][dimension["dimension_code"]])
                for dimension in dimensions
            ]
            for item in resources
        ]
        return {
            "project_id": assessment["project_id"],
            "package_id": assessment["package_id"],
            "assessment_id": assessment["assessment_id"],
            "package_score": assessment["quality_score"],
            "package_level": assessment["quality_level"],
            "assessed_resource_count": len(resources),
            "average_resource_score": average_resource_score,
            "avg_resource_score": average_resource_score,
            "low_score_resource_count": sum(
                1 for score in scores if score < low_score_threshold
            ),
            "low_score_threshold": low_score_threshold,
            "dimensions": dimensions,
            "resources": resources,
            "resource_scores": resources,
            "details": resource_score_details,
            "heatmap": {
                "rows": heatmap_rows,
                "columns": heatmap_columns,
                "values": heatmap_values,
            },
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        }

    def resource_result_detail(self, resource_id, payload):
        results = self.resource_results(payload)
        resource = next(
            (
                item
                for item in results["resources"]
                if item["resource_id"] == resource_id
            ),
            None,
        )
        if not resource:
            raise ApiError("DVAS_NOT_FOUND", "资源级质量评估结果不存在", status=404)
        details = [
            item
            for item in results["details"]
            if item.get("resource_id") == resource_id
        ]
        primary_order = {
            metric_code: index
            for index, (metric_code, _, _, _) in enumerate(QUALITY_PRIMARY_METRICS)
        }
        secondary_order = {
            metric_code: index
            for index, (metric_code, _, _, _, _) in enumerate(QUALITY_SECONDARY_METRICS)
        }
        primary_details = sorted(
            [item for item in details if item.get("metric_level") == 1],
            key=lambda item: primary_order.get(item.get("metric_code"), 999),
        )
        secondary_details = sorted(
            [item for item in details if item.get("metric_level") == 2],
            key=lambda item: secondary_order.get(item.get("metric_code"), 999),
        )
        return {
            "project_id": results["project_id"],
            "package_id": results["package_id"],
            "assessment_id": results["assessment_id"],
            "resource_id": resource_id,
            "resource": resource,
            "primary_details": primary_details,
            "secondary_details": secondary_details,
            "details": [*primary_details, *secondary_details],
            "primary_metric_count": len(primary_details),
            "secondary_metric_count": len(secondary_details),
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        }

    def _assessable_resources(self, package_id):
        return self._assessable_resource_items(self.repository.list_data_resources(package_id))

    def _assessable_resource_items(self, resources):
        return [
            resource
            for resource in resources
            if resource.get("status") == "ACTIVE"
            and resource.get("include_in_calculation", True) is not False
        ]

    def _resource_secondary_scores(self, resource):
        field_count = self._number_value(resource.get("field_count"), 0)
        sample_count = self._number_value(resource.get("sample_count"), 0)
        missing_rate = self._missing_rate(resource.get("missing_rate", 0))
        name = str(resource.get("resource_name") or "")
        modality = str(resource.get("modality") or "")
        provider = str(resource.get("provider_party_name") or resource.get("party_id") or "")
        active = resource.get("status") == "ACTIVE"
        include = resource.get("include_in_calculation", True) is not False
        field_factor = min(field_count, 50) / 50 * 6
        sample_factor = min(sample_count, 30000) / 30000 * 7
        small_sample_penalty = max(0, 1000 - sample_count) / 1000 * 5
        missing_penalty = missing_rate * 100
        name_bonus = 4 if name else -10
        provider_bonus = 3 if provider else -6
        modality_bonus = 2 if modality else -5
        active_bonus = 3 if active else -25
        include_bonus = 2 if include else -20
        base_score = 80 + field_factor + sample_factor - small_sample_penalty
        raw_scores = {
            "QUALITY_NAMING_NORM": 84 + name_bonus + min(len(name), 24) * 0.12 + field_factor,
            "QUALITY_LENGTH_NORM": base_score + (2 if 3 <= field_count <= 120 else -4),
            "QUALITY_PRECISION_NORM": base_score + modality_bonus - missing_penalty * 0.15,
            "QUALITY_FORMAT_NORM": base_score + modality_bonus,
            "QUALITY_METADATA_NORM": 78 + name_bonus + provider_bonus + modality_bonus + field_factor,
            "QUALITY_REFERENCE_NORM": 80 + provider_bonus + min(sample_count, 20000) / 20000 * 5,
            "QUALITY_MODEL_NORM": 82 + field_factor + modality_bonus,
            "QUALITY_RANGE_ACC": base_score + sample_factor - missing_penalty * 0.25,
            "QUALITY_CODE_ACC": 84 + field_factor - missing_penalty * 0.2,
            "QUALITY_ELEMENT_COMP": 95 + field_factor - missing_penalty * 1.1,
            "QUALITY_RECORD_COMP": 94 + sample_factor - missing_penalty * 1.2 - small_sample_penalty,
            "QUALITY_ID_UNIQ": 88 + min(sample_count, 20000) / 20000 * 4 - missing_penalty * 0.15,
            "QUALITY_REDUNDANCY_UNIQ": 87 + min(field_count, 60) * 0.05 - missing_penalty * 0.1,
            "QUALITY_SAME_CONS": 86 + field_factor + sample_factor - missing_penalty * 0.2,
            "QUALITY_RELATED_CONS": 84 + provider_bonus + modality_bonus - missing_penalty * 0.2,
            "QUALITY_RECORD_TIME": 86 + active_bonus + (2 if resource.get("updated_at") else -4) - small_sample_penalty,
            "QUALITY_FIELD_ACCESS": 88 + active_bonus + include_bonus + min(field_count, 50) * 0.08,
        }
        return {metric_code: self._bounded_score(score) for metric_code, score in raw_scores.items()}

    def _resource_detail(
        self,
        resource_assessment_id,
        assessment,
        resource,
        metric_code,
        metric_name,
        metric_level,
        parent_metric_code,
        weight,
        score,
        weighted_score,
        created_at,
    ):
        level_name = "一级指标" if metric_level == 1 else "二级指标"
        evidence_text = (
            f"{resource['resource_name']} 的{metric_name}{level_name}评分由资源字段数、"
            "样本量、缺失率、接入状态和主体关系等元数据规则生成。"
        )
        return {
            "detail_id": self.repository.next_id("quality_resource_detail"),
            "resource_assessment_id": resource_assessment_id,
            "assessment_id": assessment["assessment_id"],
            "project_id": assessment["project_id"],
            "package_id": assessment["package_id"],
            "resource_id": resource["resource_id"],
            "resource_name": resource["resource_name"],
            "dimension_code": metric_code,
            "dimension_name": metric_name,
            "metric_code": metric_code,
            "metric_name": metric_name,
            "parent_dimension_code": parent_metric_code,
            "parent_metric_code": parent_metric_code,
            "metric_level": metric_level,
            "weight": round(weight, 6),
            "score": round(score, 2),
            "weighted_score": round(weighted_score, 6),
            "evidence_text": evidence_text,
            "evidence": evidence_text,
            "rule_code": f"QUAL_RESOURCE_RULE_{metric_code}",
            "created_at": created_at,
        }

    def _lowest_dimension(self, dimension_scores):
        primary_name_by_code = {
            metric_code: metric_name
            for metric_code, metric_name, _, _ in QUALITY_PRIMARY_METRICS
        }
        lowest_code = min(dimension_scores, key=dimension_scores.get)
        return lowest_code, primary_name_by_code[lowest_code]

    def _party_names_for_resource(self, resource):
        if resource.get("provider_party_name"):
            return [resource["provider_party_name"]]
        if resource.get("party_id"):
            party = self.repository.get_party(resource["party_id"])
            if party:
                return [party["party_name"]]
        return []

    def _number_value(self, value, default):
        try:
            if isinstance(value, str):
                normalized = value.strip().rstrip("%")
                if not normalized:
                    return default
                return float(normalized)
            return float(value)
        except (TypeError, ValueError):
            return default

    def _missing_rate(self, value):
        numeric = self._number_value(value, 0.0)
        if numeric > 1:
            numeric = numeric / 100
        return max(0.0, min(1.0, numeric))

    def _evaluate_quality(self, resources):
        secondary_scores = self._secondary_scores(resources)
        secondary_by_parent = {}
        for metric_code, metric_name, parent_metric_code, parameter_code, default_weight in QUALITY_SECONDARY_METRICS:
            weight = self._weight(parameter_code, default_weight)
            score = secondary_scores[metric_code]
            secondary_by_parent.setdefault(parent_metric_code, []).append(
                self._detail(
                    metric_code=metric_code,
                    metric_name=metric_name,
                    metric_level=2,
                    parent_metric_code=parent_metric_code,
                    weight=weight,
                    score=score,
                    weighted_score=score * weight,
                )
            )

        details = []
        dimension_scores = {}
        total_score = 0.0
        for metric_code, metric_name, parameter_code, default_weight in QUALITY_PRIMARY_METRICS:
            weight = self._weight(parameter_code, default_weight)
            child_details = secondary_by_parent.get(metric_code, [])
            primary_score = sum(detail["weighted_score"] for detail in child_details)
            dimension_scores[metric_code] = round(primary_score, 2)
            details.append(
                self._detail(
                    metric_code=metric_code,
                    metric_name=metric_name,
                    metric_level=1,
                    parent_metric_code=None,
                    weight=weight,
                    score=primary_score,
                    weighted_score=primary_score * weight,
                )
            )
            details.extend(child_details)
            total_score += primary_score * weight
        return details, dimension_scores, total_score

    def _secondary_scores(self, resources):
        resource_count = len(resources)
        total_fields = sum(int(resource.get("field_count") or 0) for resource in resources)
        total_samples = sum(int(resource.get("sample_count") or 0) for resource in resources)
        avg_missing_rate = 0.0
        missing_rates = [float(resource.get("missing_rate") or 0) for resource in resources]
        if missing_rates:
            avg_missing_rate = sum(missing_rates) / len(missing_rates)
        base_score = 80.0 + min(resource_count, 4) * 2.0 + min(total_fields, 30) * 0.15
        completeness_score = base_score - avg_missing_rate * 100
        timeliness_score = base_score - max(0, resource_count - 2) * 1.5
        accessibility_score = base_score + min(total_samples / 10000, 3.0)
        raw_scores = {
            "QUALITY_NAMING_NORM": base_score + 1.0,
            "QUALITY_LENGTH_NORM": base_score,
            "QUALITY_PRECISION_NORM": base_score - 0.5,
            "QUALITY_FORMAT_NORM": base_score + 0.5,
            "QUALITY_METADATA_NORM": base_score - 1.0,
            "QUALITY_REFERENCE_NORM": base_score - 1.5,
            "QUALITY_MODEL_NORM": base_score - 0.8,
            "QUALITY_RANGE_ACC": base_score + 0.8,
            "QUALITY_CODE_ACC": base_score - 0.7,
            "QUALITY_ELEMENT_COMP": completeness_score + 0.8,
            "QUALITY_RECORD_COMP": completeness_score,
            "QUALITY_ID_UNIQ": base_score + 0.6,
            "QUALITY_REDUNDANCY_UNIQ": base_score - 1.2,
            "QUALITY_SAME_CONS": base_score + 0.2,
            "QUALITY_RELATED_CONS": base_score - 0.6,
            "QUALITY_RECORD_TIME": timeliness_score,
            "QUALITY_FIELD_ACCESS": accessibility_score,
        }
        return {metric_code: self._bounded_score(score) for metric_code, score in raw_scores.items()}

    def _detail(self, metric_code, metric_name, metric_level, parent_metric_code, weight, score, weighted_score):
        level_name = "一级指标" if metric_level == 1 else "二级指标"
        return {
            "detail_id": self.repository.next_id("quality_detail"),
            "metric_code": metric_code,
            "dimension_code": metric_code,
            "metric_name": metric_name,
            "dimension_name": metric_name,
            "metric_level": metric_level,
            "parent_metric_code": parent_metric_code,
            "parent_dimension_code": parent_metric_code,
            "weight": round(weight, 6),
            "score": round(score, 2),
            "weighted_score": round(weighted_score, 6),
            "evidence": f"{metric_name}{level_name}评分由资源统计、参数权重和规则编码生成。",
            "evidence_summary": f"{metric_name}{level_name}纳入质量评估通用指标框架。",
            "issue_summary": "P0 演示数据未发现阻断性质量问题。",
            "rule_code": f"QUAL_RULE_{metric_code}",
        }

    def _weight(self, parameter_code, default_weight):
        return float(parameter_current_value(self.repository, parameter_code, default_weight))

    def _bounded_score(self, score):
        return round(max(0.0, min(100.0, score)), 2)

    def _quality_level(self, quality_score):
        if quality_score >= 85:
            return "A"
        if quality_score >= 75:
            return "B"
        return "C"


class ShuyuanMeteringService:
    def __init__(self, repository):
        self.repository = repository

    def run(self, payload):
        payload = payload or {}
        ProjectStateMachine(self.repository).require_metering_allowed()
        quality = self._latest_quality()
        package = self.repository.get_data_package(quality["package_id"])
        resources = self._meterable_resources(quality["package_id"])
        if not resources:
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                "当前数据包无有效数据资源",
                field_errors=[{"field": "resources", "reason": "当前数据包无有效数据资源"}],
            )

        now = utc_now()
        version_no = len(self.repository.list_shuyuan_meterings()) + 1
        call_counts = self._resource_call_counts(resources, payload)
        call_count = sum(call_counts.values())
        package_quality_factor = self._number(payload, "quality_coefficient", quality["quality_factor"])
        resource_quality_factors = self._resource_quality_factors(quality)
        parameters = {
            "base_price": self._number(
                payload,
                "base_price",
                parameter_current_value(self.repository, "DEFAULT_SHUYUAN_BASE_PRICE", 2.0),
            ),
            "scenario_coefficient": self._number(
                payload,
                "scenario_coefficient",
                parameter_current_value(self.repository, "DEFAULT_SCENARIO_COEFFICIENT", 1.1),
            ),
            "quality_coefficient": package_quality_factor,
            "package_quality_coefficient": package_quality_factor,
            "resource_quality_strategy": "RESOURCE_FIRST_PACKAGE_FALLBACK",
            "resource_quality_factors": resource_quality_factors,
            "technology_coefficient": self._number(
                payload,
                "technology_coefficient",
                parameter_current_value(self.repository, "DEFAULT_TECHNOLOGY_COEFFICIENT", 1.05),
            ),
            "expert_coefficient": self._number(
                payload,
                "expert_coefficient",
                parameter_current_value(self.repository, "DEFAULT_EXPERT_COEFFICIENT", 1.0),
            ),
            "development_coefficient": self._number(
                payload,
                "development_coefficient",
                parameter_current_value(self.repository, "DEFAULT_DEVELOPMENT_COEFFICIENT", 0.98),
            ),
            "call_count": call_count,
            "call_counts": call_counts,
        }
        details = self._details(resources, parameters, call_counts)
        total_amount = round(sum(item["metering_amount"] for item in details), 2)
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
            "algorithm_version": "DVAS_SHUYUAN_METERING_RESOURCE_QUALITY_V1",
            "created_by": current_operator_id(self.repository),
            "created_at": now,
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        }

        self.repository.put_snapshot(parameter_snapshot)
        self.repository.put_snapshot(result_snapshot)
        self.repository.put_shuyuan_metering(metering, details)
        updated_project = self.repository.update_project(project_status=ProjectStatus.METERED.value)
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

    def _metering_amount(self, parameters, call_count, quality_coefficient):
        return (
            parameters["base_price"]
            * parameters["scenario_coefficient"]
            * quality_coefficient
            * parameters["technology_coefficient"]
            * parameters["expert_coefficient"]
            * parameters["development_coefficient"]
            * call_count
        )

    def _details(self, resources, parameters, call_counts):
        details = []
        resource_quality_factors = parameters["resource_quality_factors"]
        package_quality_coefficient = parameters["package_quality_coefficient"]
        for resource in resources:
            valid_units = int(call_counts.get(resource["resource_id"], resource.get("sample_count", 0) or 0))
            quality_coefficient = float(
                resource_quality_factors.get(resource["resource_id"], package_quality_coefficient)
            )
            amount = round(self._metering_amount(parameters, valid_units, quality_coefficient), 2)
            party = self.repository.get_party(resource.get("party_id")) if resource.get("party_id") else None
            quality_factor_source = (
                "RESOURCE_QUALITY_ASSESSMENT"
                if resource["resource_id"] in resource_quality_factors
                else "PACKAGE_QUALITY_FALLBACK"
            )
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
                    "quality_coefficient": round(quality_coefficient, 6),
                    "resource_quality_factor": round(quality_coefficient, 6),
                    "package_quality_coefficient": package_quality_coefficient,
                    "quality_factor_source": quality_factor_source,
                    "technology_coefficient": parameters["technology_coefficient"],
                    "expert_coefficient": parameters["expert_coefficient"],
                    "development_coefficient": parameters["development_coefficient"],
                    "call_count": valid_units,
                    "metering_amount": amount,
                    "evidence": "数元计量按资源调用量和资源级质量因子计算；缺少资源级质量结果时回退包级质量因子。",
                }
            )
        return details

    def _meterable_resources(self, package_id):
        return [
            resource
            for resource in self.repository.list_data_resources(package_id)
            if resource.get("status") == "ACTIVE"
            and resource.get("include_in_calculation", True) is not False
        ]

    def _resource_quality_factors(self, quality):
        resource_results = self.repository.list_quality_resource_assessments(
            assessment_id=quality["assessment_id"],
            package_id=quality["package_id"],
            project_id=quality["project_id"],
        )
        return {
            item["resource_id"]: round(float(item["quality_factor"]), 6)
            for item in resource_results
            if item.get("resource_id") and item.get("quality_factor") is not None
        }

    def _resource_call_counts(self, resources, payload):
        raw_counts = payload.get("call_counts") if isinstance(payload, dict) else None
        if raw_counts is None:
            raw_counts = self._latest_call_count_draft()
        if isinstance(raw_counts, dict) and raw_counts:
            return {
                resource["resource_id"]: self._non_negative_int(
                    raw_counts.get(resource["resource_id"], resource.get("sample_count", 0)),
                    f"call_counts.{resource['resource_id']}",
                )
                for resource in resources
            }
        if "call_count" in payload:
            return self._distribute_call_count(resources, payload["call_count"])
        return {
            resource["resource_id"]: self._non_negative_int(
                resource.get("sample_count", 0),
                f"resources.{resource['resource_id']}.sample_count",
            )
            for resource in resources
        }

    def _latest_call_count_draft(self):
        drafts = self.repository.list_business_drafts("SHUYUAN_CALL_COUNTS")
        if not drafts:
            return None
        content = drafts[-1].get("content_json")
        return content if isinstance(content, dict) else None

    def _distribute_call_count(self, resources, raw_total):
        total_call_count = self._non_negative_int(raw_total, "call_count")
        if not resources:
            return {}
        total_units = sum(int(resource.get("sample_count", 0) or 0) for resource in resources)
        if total_units <= 0:
            base = total_call_count // len(resources)
            remainder = total_call_count - base * len(resources)
            return {
                resource["resource_id"]: base + (1 if index < remainder else 0)
                for index, resource in enumerate(resources)
            }
        distributed = {}
        running = 0
        for index, resource in enumerate(resources):
            if index == len(resources) - 1:
                count = total_call_count - running
            else:
                count = round(total_call_count * int(resource.get("sample_count", 0) or 0) / total_units)
                running += count
            distributed[resource["resource_id"]] = max(0, int(count))
        return distributed

    def _non_negative_int(self, raw_value, field):
        try:
            value = int(raw_value)
        except (TypeError, ValueError) as exc:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "数元调用量不合法",
                field_errors=[{"field": field, "reason": f"{field} 必须是非负整数"}],
            ) from exc
        if value < 0:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "数元调用量不合法",
                field_errors=[{"field": field, "reason": f"{field} 必须大于等于 0"}],
            )
        return value

    def _snapshot(self, snapshot_id, snapshot_type, content, now):
        return {
            "snapshot_id": snapshot_id,
            "project_id": self.repository.get_project()["project_id"],
            "snapshot_type": snapshot_type,
            "content_json": copy.deepcopy(content),
            "checksum": stable_checksum(content),
            "created_by": current_operator_id(self.repository),
            "created_at": now,
        }


class ContributionService:
    def __init__(self, repository):
        self.repository = repository

    def run(self, payload):
        ProjectStateMachine(self.repository).require_contribution_allowed()
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
                    "created_by": current_operator_id(self.repository),
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
            "created_by": current_operator_id(self.repository),
            "created_at": now,
        }


class UtilityService:
    def __init__(self, repository):
        self.repository = repository

    def run(self, payload):
        ProjectStateMachine(self.repository).require_utility_allowed()
        contribution_records = self._latest_contribution_records()
        quality = self._latest_quality()
        party_quality_factors = self._party_quality_factors(quality)
        now = utc_now()
        version_no = len(self.repository.list_utility_records()) + 1
        package_quality_factor = self._number(payload, "quality_factor", quality["quality_factor"])
        parameters = {
            "quality_factor": package_quality_factor,
            "package_quality_factor": package_quality_factor,
            "quality_factor_strategy": "PARTY_RESOURCE_WEIGHTED_AVERAGE_FALLBACK_PACKAGE",
            "party_quality_factors": party_quality_factors,
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
            "algorithm_version": "DVAS_UTILITY_PARTY_QUALITY_V1",
            "created_by": current_operator_id(self.repository),
            "created_at": now,
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        }
        self.repository.put_snapshot(self._snapshot(parameter_snapshot_id, "PARAMETER", parameters, now))
        self.repository.put_snapshot(
            self._snapshot(result_snapshot_id, "RESULT", {"utility": utility, "trace": trace}, now)
        )
        self.repository.put_utility_record(utility, trace)
        updated_project = self.repository.update_project(project_status=ProjectStatus.UTILITY_CALCULATED.value)
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
            party_id = record["party_id"]
            quality_factor = float(
                parameters["party_quality_factors"].get(
                    party_id,
                    parameters["package_quality_factor"],
                )
            )
            quality_factor_source = (
                "SHUYUAN_RESOURCE_WEIGHTED_AVERAGE"
                if party_id in parameters["party_quality_factors"]
                else "PACKAGE_QUALITY_FALLBACK"
            )
            utility_value = round(
                record["normalized_contribution"]
                * quality_factor
                * parameters["usage_factor"]
                * parameters["scenario_factor"],
                6,
            )
            trace.append(
                {
                    "trace_id": self.repository.next_id("utility_trace"),
                    "utility_id": utility_id,
                    "contribution_id": record["contribution_id"],
                    "party_id": party_id,
                    "party_name": record["party_name"],
                    "normalized_contribution": record["normalized_contribution"],
                    "quality_factor": round(quality_factor, 6),
                    "package_quality_factor": parameters["package_quality_factor"],
                    "quality_factor_source": quality_factor_source,
                    "usage_factor": parameters["usage_factor"],
                    "scenario_factor": parameters["scenario_factor"],
                    "utility_value": utility_value,
                    "formula_text": "normalized_contribution × quality_factor × usage_factor × scenario_factor",
                    "created_at": now,
                }
            )
        return trace

    def _party_quality_factors(self, quality):
        meterings = self.repository.list_shuyuan_meterings()
        if not meterings:
            return {}
        latest_metering = meterings[-1]
        if latest_metering.get("assessment_id") != quality["assessment_id"]:
            return {}
        details = self.repository.get_shuyuan_metering_details(latest_metering["metering_id"])
        grouped = {}
        for detail in details:
            party_id = detail.get("party_id")
            if not party_id:
                continue
            quality_factor = detail.get("resource_quality_factor", detail.get("quality_coefficient"))
            if quality_factor is None:
                continue
            weight = (
                detail.get("valid_units")
                or detail.get("call_count")
                or detail.get("metering_amount")
                or 1
            )
            try:
                numeric_weight = float(weight)
                numeric_quality_factor = float(quality_factor)
            except (TypeError, ValueError):
                continue
            if numeric_weight < 0:
                continue
            if numeric_weight == 0:
                numeric_weight = 1.0
            bucket = grouped.setdefault(party_id, {"weighted": 0.0, "weight": 0.0})
            bucket["weighted"] += numeric_quality_factor * numeric_weight
            bucket["weight"] += numeric_weight
        return {
            party_id: round(bucket["weighted"] / bucket["weight"], 6)
            for party_id, bucket in grouped.items()
            if bucket["weight"] > 0
        }

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
            "created_by": current_operator_id(self.repository),
            "created_at": now,
        }


class MdDshapService:
    TASK_KEY = "P0_DETERMINISTIC_UTILITY"
    ALGORITHM_VERSION = "DVAS_MD_DSHAP_P0_DETERMINISTIC_V0"
    WEIGHT_NOTE = "P0 deterministic MD-DShap weight-layer reference; not allocation, payment, or legal settlement."
    SINGLE_NOTE = (
        "single-data-provider simplification: one data provider receives weight 1.000000; "
        "P0 deterministic MD-DShap weight-layer reference only."
    )

    def __init__(self, repository):
        self.repository = repository

    def run(self, payload):
        project = self.repository.get_project()
        self._ensure_project_ready(project)
        operator_id = current_operator_id(self.repository)
        utility = self._latest_utility()
        utility_traces = self.repository.get_utility_traces(utility["utility_id"])
        participants, excluded_parties = self._participant_pool_rows()
        if not participants:
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                "缺少可进入 MD-DShap 的数据源主体",
                field_errors=[
                    {"field": "participant_set", "reason": "请先维护可进入 MD-DShap 的数据源主体"}
                ],
            )

        utility_by_party = {
            trace["party_id"]: float(trace["utility_value"]) for trace in utility_traces
        }
        total_utility = sum(utility_by_party.get(party["party_id"], 0.0) for party in participants)
        if len(participants) > 1 and total_utility <= 0:
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                "效用总值必须大于 0",
                field_errors=[{"field": "utility_records", "reason": "效用总值必须大于 0"}],
            )

        now = utc_now()
        parameters = self._parameters(payload, len(participants))
        task_id = self.repository.next_id("task")
        weights = self._weights(participants, utility_by_party, total_utility)
        baseline_weights = self._baseline_weights(participants) if parameters["baseline_enabled"] else {}
        approximation_note = self.SINGLE_NOTE if len(participants) == 1 else self.WEIGHT_NOTE
        parameter_snapshot_id = self.repository.next_id("snapshot")
        result_snapshot_id = self.repository.next_id("snapshot")
        algorithm_audit_snapshot_id = self.repository.next_id("snapshot")
        participant_set = [
            {
                "party_id": party["party_id"],
                "party_name": party["party_name"],
                "party_type": party["party_type"],
            }
            for party in participants
        ]
        task = {
            "task_id": task_id,
            "project_id": project["project_id"],
            "algorithm_mode": parameters["algorithm_mode"],
            "baseline_enabled": parameters["baseline_enabled"],
            "participant_set": participant_set,
            "task_set": [self.TASK_KEY],
            "seed": parameters["seed"],
            "sample_rounds": parameters["sample_rounds"],
            "epsilon": parameters["epsilon"],
            "status": "COMPLETED",
            "result_count": len(participants),
            "approximation_note": approximation_note,
            "algorithm_version": self.ALGORITHM_VERSION,
            "parameter_snapshot_id": parameter_snapshot_id,
            "result_snapshot_id": result_snapshot_id,
            "algorithm_audit_snapshot_id": algorithm_audit_snapshot_id,
            "created_at": now,
            "completed_at": now,
            "failure_reason": None,
            "requested_by": operator_id,
            "created_by": operator_id,
            "algorithm_party_count": len(participants),
            "contract_party_count": self._contract_party_count(excluded_parties),
            "excluded_party_count": len(excluded_parties),
            "excluded_parties": excluded_parties,
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        }
        results = self._results(task_id, participants, weights, baseline_weights, approximation_note, now)
        traces = (
            self._marginal_traces(task_id, participants, utility_by_party, parameters["seed"], now)
            if parameters["save_marginal_detail"]
            else []
        )
        parameter_snapshot = self._snapshot(
            parameter_snapshot_id,
            "PARAMETER",
            {
                **parameters,
                "formula": "raw_weight_i = utility_value_i / total_utility; normalized to 6 decimals",
            },
            now,
        )
        result_snapshot = self._snapshot(
            result_snapshot_id,
            "RESULT",
            {"task": task, "results": results, "marginal_trace_count": len(traces)},
            now,
        )
        algorithm_audit_snapshot = self._snapshot(
            algorithm_audit_snapshot_id,
            "ALGORITHM_AUDIT",
            {
                "algorithm_mode": task["algorithm_mode"],
                "algorithm_version": task["algorithm_version"],
                "participant_set": participant_set,
                "task_set": task["task_set"],
                "approximation_note": approximation_note,
                "simulation_disclaimer": SIMULATION_DISCLAIMER,
            },
            now,
        )

        self.repository.put_snapshot(parameter_snapshot)
        self.repository.put_snapshot(result_snapshot)
        self.repository.put_snapshot(algorithm_audit_snapshot)
        self.repository.put_algorithm_audit_snapshot(algorithm_audit_snapshot)
        self.repository.put_md_dshap_task(task, results, traces)
        updated_project = self.repository.update_project(
            project_status=ProjectStatus.WEIGHT_CALCULATED.value,
            current_algorithm_task_id=task_id,
        )
        write_audit(
            self.repository,
            module_code="MDS",
            menu_code="NAV_ALLOC_MDS",
            operation_type="RUN_MD_DSHAP",
            object_type="md_dshap_task",
            object_id=task_id,
            status="SUCCESS",
            parameter_snapshot_id=parameter_snapshot_id,
            result_snapshot_id=result_snapshot_id,
            after_value_json={"task": task, "results": results, "marginal_traces": traces},
        )
        return {
            "project_id": updated_project["project_id"],
            "project_status": updated_project["project_status"],
            "task": task,
            "result_count": len(results),
            "algorithm_party_count": len(participants),
            "contract_party_count": self._contract_party_count(excluded_parties),
            "excluded_party_count": len(excluded_parties),
            "excluded_parties": excluded_parties,
            "approximation_note": approximation_note,
            "results": results,
        }

    def task(self, task_id):
        task = self.repository.get_md_dshap_task(task_id)
        if not task:
            raise ApiError("DVAS_NOT_FOUND", "MD-DShap 任务不存在", status=404)
        return task

    def list_tasks(self, payload=None):
        payload = payload or {}
        project_id = payload.get("project_id") or self.repository.get_project()["project_id"]
        items = [
            task
            for task in self.repository.list_md_dshap_tasks()
            if not project_id or task.get("project_id") == project_id
        ]
        return table_page(items)

    def results(self, task_id):
        self.task(task_id)
        return table_page(self.repository.list_md_dshap_results(task_id))

    def marginal_traces(self, task_id):
        self.task(task_id)
        return table_page(self.repository.list_md_dshap_marginal_traces(task_id))

    def _ensure_project_ready(self, project):
        ProjectStateMachine(self.repository).require_md_dshap_allowed()

    def _latest_utility(self):
        utilities = self.repository.list_utility_records()
        if not utilities:
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                "请先完成效用计算",
                field_errors=[{"field": "utility_records", "reason": "请先完成效用计算"}],
            )
        return utilities[-1]

    def _participants(self):
        return self._participant_pool_rows()[0]

    def participant_pool(self):
        included, excluded = self._participant_pool_rows()
        return {
            "project_id": self.repository.get_project()["project_id"],
            "project_status": self.repository.get_project()["project_status"],
            "items": included,
            "excluded_items": excluded,
            "excluded_parties": excluded,
            "total": len(included),
            "algorithm_party_count": len(included),
            "contract_party_count": self._contract_party_count(excluded),
            "excluded_party_count": len(excluded),
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        }

    def _participant_pool_rows(self):
        included = []
        excluded = []
        current_resource_party_ids = self._current_resource_party_ids()
        for party in self.repository.list_parties():
            is_data_provider = self._is_data_provider_party(party)
            is_active = self._is_active_party(party)
            include_in_md_dshap = bool(party.get("include_in_md_dshap"))
            linked_to_current_resources = party.get("party_id") in current_resource_party_ids
            row = {
                **party,
                "is_data_provider": is_data_provider,
                "active_status": "ACTIVE" if is_active else "INACTIVE",
            }
            if (
                is_data_provider
                and is_active
                and include_in_md_dshap
                and linked_to_current_resources
            ):
                included.append(row)
                continue
            reasons = []
            if not is_active:
                reasons.append("参与方未启用")
            if not is_data_provider:
                reasons.append("非数据源主体默认不进入 MD-DShap 权重池")
            if not include_in_md_dshap:
                reasons.append("include_in_md_dshap=false")
            if is_data_provider and not linked_to_current_resources:
                reasons.append("未关联当前数据包有效数据资源")
            excluded.append({**row, "excluded_reason": "；".join(reasons)})
        return included, excluded

    def _current_resource_party_ids(self):
        project = self.repository.get_project()
        package_id = project.get("current_package_id")
        resources = (
            self.repository.list_data_resources(package_id)
            if package_id
            else self.repository.list_data_resources()
        )
        return {
            resource.get("party_id")
            for resource in resources
            if resource.get("party_id")
            and resource.get("status") == "ACTIVE"
            and resource.get("include_in_calculation", True) is not False
        }

    def _contract_party_count(self, excluded_parties):
        return sum(1 for party in excluded_parties if not party.get("is_data_provider"))

    def _is_data_provider_party(self, party):
        return bool(party.get("is_data_provider", party.get("party_type") == "DATA_PROVIDER"))

    def _is_active_party(self, party):
        return party.get("status") in {"ACTIVE", "ENABLED"}

    def _parameters(self, payload, participant_count):
        algorithm_mode = payload.get("algorithm_mode", P0_CONFIG.default_algorithm_mode)
        if algorithm_mode != AlgorithmMode.MD_DSHAP.value:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "MD-DShap 任务算法模式不支持",
                field_errors=[
                    {
                        "field": "algorithm_mode",
                        "reason": "BASELINE_SHAPLEY 仅可作为 baseline_check，不可作为最终权重任务模式",
                    }
                ],
            )
        return {
            "algorithm_mode": algorithm_mode,
            "seed": self._int(
                payload,
                "seed",
                parameter_current_value(self.repository, "DEFAULT_MD_DSHAP_SEED", 42),
            ),
            "sample_rounds": self._int(
                payload,
                "sample_rounds",
                parameter_current_value(self.repository, "DEFAULT_MD_DSHAP_SAMPLE_ROUNDS", 64),
            ),
            "epsilon": self._number(
                payload,
                "epsilon",
                parameter_current_value(self.repository, "DEFAULT_MD_DSHAP_EPSILON", 0.000001),
            ),
            "baseline_enabled": self._bool(
                payload,
                "baseline_enabled",
                parameter_current_value(
                    self.repository,
                    "DEFAULT_MD_DSHAP_BASELINE_ENABLED",
                    participant_count <= 8,
                ),
            ),
            "save_marginal_detail": self._bool(payload, "save_marginal_detail", True),
        }

    def _weights(self, participants, utility_by_party, total_utility):
        if len(participants) == 1:
            return {participants[0]["party_id"]: 1.0}
        raw_weights = {
            party["party_id"]: utility_by_party.get(party["party_id"], 0.0) / total_utility
            for party in participants
        }
        weights = {
            party_id: round(weight, 6)
            for party_id, weight in raw_weights.items()
        }
        delta = round(1.0 - sum(weights.values()), 6)
        if delta:
            largest_party_id = max(raw_weights, key=raw_weights.get)
            weights[largest_party_id] = round(weights[largest_party_id] + delta, 6)
        return weights

    def _baseline_weights(self, participants):
        weight = round(1.0 / len(participants), 6)
        weights = {party["party_id"]: weight for party in participants}
        delta = round(1.0 - sum(weights.values()), 6)
        if delta:
            weights[participants[0]["party_id"]] = round(weights[participants[0]["party_id"]] + delta, 6)
        return weights

    def _results(self, task_id, participants, weights, baseline_weights, approximation_note, now):
        results = []
        for party in participants:
            party_id = party["party_id"]
            normalized_weight = weights[party_id]
            baseline_weight = baseline_weights.get(party_id)
            results.append(
                {
                    "result_id": self.repository.next_id("result"),
                    "task_id": task_id,
                    "party_id": party_id,
                    "party_name": party["party_name"],
                    "participant_weight": normalized_weight,
                    "normalized_weight": normalized_weight,
                    "baseline_weight": baseline_weight,
                    "weight_diff": round(normalized_weight - baseline_weight, 6)
                    if baseline_weight is not None
                    else None,
                    "task_level_weight_json": {self.TASK_KEY: normalized_weight},
                    "approximation_note": approximation_note,
                    "created_at": now,
                    "simulation_disclaimer": SIMULATION_DISCLAIMER,
                }
            )
        return results

    def _marginal_traces(self, task_id, participants, utility_by_party, seed, now):
        traces = []
        coalition = []
        running_value = 0.0
        for index, party in enumerate(participants, start=1):
            utility_value = round(utility_by_party.get(party["party_id"], 0.0), 6)
            trace = {
                "trace_id": self.repository.next_id("trace"),
                "task_id": task_id,
                "party_id": party["party_id"],
                "party_name": party["party_name"],
                "task_key": self.TASK_KEY,
                "iteration_no": index,
                "coalition_before": list(coalition),
                "v_before": round(running_value, 6),
                "v_after": round(running_value + utility_value, 6),
                "marginal_contribution": utility_value,
                "seed": seed,
                "created_at": now,
            }
            traces.append(trace)
            coalition.append(party["party_id"])
            running_value = trace["v_after"]
        return traces

    def _snapshot(self, snapshot_id, snapshot_type, content, now):
        return {
            "snapshot_id": snapshot_id,
            "project_id": self.repository.get_project()["project_id"],
            "snapshot_type": snapshot_type,
            "content_json": copy.deepcopy(content),
            "checksum": stable_checksum(content),
            "created_by": current_operator_id(self.repository),
            "created_at": now,
        }

    def _number(self, payload, field, default):
        try:
            value = float(payload.get(field, default))
        except (TypeError, ValueError) as exc:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "MD-DShap 参数不合法",
                field_errors=[{"field": field, "reason": f"{field} 必须是数字"}],
            ) from exc
        if value < 0:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "MD-DShap 参数不合法",
                field_errors=[{"field": field, "reason": f"{field} 必须大于等于 0"}],
            )
        return round(value, 6)

    def _int(self, payload, field, default):
        try:
            value = int(payload.get(field, default))
        except (TypeError, ValueError) as exc:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "MD-DShap 参数不合法",
                field_errors=[{"field": field, "reason": f"{field} 必须是整数"}],
            ) from exc
        if value < 0:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "MD-DShap 参数不合法",
                field_errors=[{"field": field, "reason": f"{field} 必须大于等于 0"}],
            )
        return value

    def _bool(self, payload, field, default):
        if field not in payload:
            return default
        value = payload[field]
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            if value.lower() in {"true", "1", "yes"}:
                return True
            if value.lower() in {"false", "0", "no"}:
                return False
        raise ApiError(
            "DVAS_FACTOR_INVALID",
            "MD-DShap 参数不合法",
            field_errors=[{"field": field, "reason": f"{field} 必须是布尔值"}],
        )


class ContractConstraintService:
    SUPPORTED_TYPES = set(ContractConstraintType.values())
    RATIO_TYPES = {ContractConstraintType.FIXED_RATIO.value}

    def __init__(self, repository):
        self.repository = repository

    def list(self):
        items = self.repository.list_contract_constraints()
        page = table_page(items)
        active_items = [item for item in items if item["status"] == "ACTIVE"]
        priority_items = [
            item
            for item in active_items
            if item["constraint_type"] == ContractConstraintType.PRIORITY_ALLOCATION.value
        ]
        page["summary"] = {
            "constraint_count": len(items),
            "active_constraint_count": len(active_items),
            "priority_items_count": len(priority_items),
            "ordinary_constraint_count": len(active_items) - len(priority_items),
        }
        page["allocation_priority_items"] = self.repository.list_allocation_priority_items()
        return page

    def create(self, payload):
        now = utc_now()
        constraint = self._build_constraint(
            payload,
            constraint_id=self.repository.next_id("constraint"),
            version_no=1,
            now=now,
        )
        self.repository.put_contract_constraint(constraint)
        self._sync_priority_constraint_item(constraint)
        write_audit(
            self.repository,
            module_code="CONS",
            menu_code="NAV_ALLOC_CONSTRAINT",
            operation_type="CREATE_CONSTRAINT",
            object_type="contract_constraint",
            object_id=constraint["constraint_id"],
            status="SUCCESS",
            after_value_json=constraint,
        )
        return constraint

    def update(self, constraint_id, payload):
        existing = self.repository.get_contract_constraint(constraint_id)
        if not existing:
            raise ApiError("DVAS_NOT_FOUND", "合同约束不存在", status=404)
        now = utc_now()
        merged = {**existing, **payload}
        updated = self._build_constraint(
            merged,
            constraint_id=constraint_id,
            version_no=int(existing["version_no"]) + 1,
            now=now,
            created_at=existing["created_at"],
        )
        self.repository.put_contract_constraint(updated)
        self._sync_priority_constraint_item(updated)
        write_audit(
            self.repository,
            module_code="CONS",
            menu_code="NAV_ALLOC_CONSTRAINT",
            operation_type="UPDATE_CONSTRAINT",
            object_type="contract_constraint",
            object_id=constraint_id,
            status="SUCCESS",
            before_value_json=existing,
            after_value_json=updated,
        )
        return updated

    def set_status(self, constraint_id, payload):
        existing = self.repository.get_contract_constraint(constraint_id)
        if not existing:
            raise ApiError("DVAS_NOT_FOUND", "合同约束不存在", status=404)
        status = payload.get("status")
        if status not in {"ACTIVE", "DISABLED"}:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "合同约束状态不合法",
                field_errors=[{"field": "status", "reason": "status 必须为 ACTIVE 或 DISABLED"}],
            )
        updated = {
            **existing,
            "status": status,
            "description": payload.get("description", existing.get("description")),
            "version_no": int(existing["version_no"]) + 1,
            "updated_at": utc_now(),
        }
        self.repository.put_contract_constraint(updated)
        self._sync_priority_constraint_item(updated)
        write_audit(
            self.repository,
            module_code="CONS",
            menu_code="NAV_ALLOC_CONSTRAINT",
            operation_type="SET_CONSTRAINT_STATUS",
            object_type="contract_constraint",
            object_id=constraint_id,
            status="SUCCESS",
            before_value_json=existing,
            after_value_json=updated,
        )
        return updated

    def _build_constraint(self, payload, constraint_id, version_no, now, created_at=None):
        party_id = payload.get("party_id")
        party = self.repository.get_party(party_id) if party_id else None
        if not party:
            raise ApiError(
                "DVAS_NOT_FOUND",
                "参与方不存在",
                status=404,
                field_errors=[{"field": "party_id", "reason": "参与方不存在"}],
            )
        constraint_type = payload.get("constraint_type", ContractConstraintType.MIN_AMOUNT.value)
        if constraint_type not in self.SUPPORTED_TYPES:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "合同约束类型不支持",
                field_errors=[{"field": "constraint_type", "reason": "不支持的合同约束类型"}],
            )
        value_type = payload.get(
            "value_type",
            "RATIO" if constraint_type in self.RATIO_TYPES else "AMOUNT",
        )
        value = self._constraint_value(payload.get("constraint_value", 0), value_type)
        return {
            "constraint_id": constraint_id,
            "project_id": self.repository.get_project()["project_id"],
            "party_id": party_id,
            "party_name": party["party_name"],
            "constraint_name": payload.get("constraint_name") or constraint_type,
            "constraint_type": constraint_type,
            "value_type": value_type,
            "constraint_value": value,
            "priority": int(payload.get("priority", 100)),
            "status": payload.get("status", "ACTIVE"),
            "description": payload.get("description"),
            "version_no": version_no,
            "created_at": created_at or now,
            "updated_at": now,
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        }

    def _constraint_value(self, raw_value, value_type):
        try:
            value = float(raw_value)
        except (TypeError, ValueError) as exc:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "合同约束值不合法",
                field_errors=[{"field": "constraint_value", "reason": "constraint_value 必须是数字"}],
            ) from exc
        if value_type == "RATIO":
            if value < 0 or value > 1:
                raise ApiError(
                    "DVAS_FACTOR_INVALID",
                    "合同约束值不合法",
                    field_errors=[{"field": "constraint_value", "reason": "比例类约束值必须在 0 到 1 之间"}],
                )
            return round(value, 6)
        if value < 0:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "合同约束值不合法",
                field_errors=[{"field": "constraint_value", "reason": "金额类约束值必须大于等于 0"}],
            )
        return round(value, 2)

    def _sync_priority_constraint_item(self, constraint):
        if constraint["constraint_type"] != ContractConstraintType.PRIORITY_ALLOCATION.value:
            self.repository.put_allocation_priority_items(
                [],
                source_constraint_id=constraint["constraint_id"],
            )
            return
        now = utc_now()
        item = {
            "item_id": f"allocation_priority_item_{constraint['constraint_id']}",
            "allocation_id": None,
            "project_id": constraint["project_id"],
            "party_id": constraint["party_id"],
            "value_type": constraint["value_type"],
            "priority_amount": None
            if constraint["value_type"] == "RATIO"
            else constraint["constraint_value"],
            "priority_ratio": constraint["constraint_value"]
            if constraint["value_type"] == "RATIO"
            else None,
            "cap_amount": None,
            "basis_text": constraint.get("description") or constraint["constraint_name"],
            "priority_order": constraint["priority"],
            "status": "ACTIVE" if constraint["status"] == "ACTIVE" else "DISABLED",
            "source_draft_id": None,
            "source_constraint_id": constraint["constraint_id"],
            "created_at": constraint["created_at"],
            "updated_at": now,
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        }
        self.repository.put_allocation_priority_items(
            [item],
            source_constraint_id=constraint["constraint_id"],
        )


class ContractRatioService:
    RATIO_QUANT = Decimal("0.000001")
    AMOUNT_QUANT = Decimal("0.01")

    def __init__(self, repository):
        self.repository = repository

    def get(self, project_id):
        project = self._project(project_id)
        plan = self.repository.latest_contract_ratio_plan(project["project_id"])
        if not plan:
            total_revenue, currency = self._current_total_revenue()
            blocking_reasons = self._blocking_reasons(None)
            return {
                "configured": False,
                "plan_id": "",
                "project_id": project["project_id"],
                "project_name": project["project_name"],
                "project_status": project["project_status"],
                "status": "EMPTY",
                "total_revenue": self._format_amount(total_revenue) if total_revenue is not None else "",
                "currency": currency,
                "ratio_sum": "0.000000",
                "data_provider_pool_ratio": "",
                "data_provider_revenue_pool": "",
                "items": [],
                "can_simulate": False,
                "blocking_reasons": blocking_reasons,
                "simulation_disclaimer": SIMULATION_DISCLAIMER,
            }
        items = self.repository.list_contract_ratio_items(plan["plan_id"])
        summary = self.summary(project["project_id"])
        return {
            "configured": plan.get("status") in {"SAVED", "LOCKED"},
            "plan_id": plan["plan_id"],
            "project_id": project["project_id"],
            "project_name": project["project_name"],
            "project_status": project["project_status"],
            "status": plan["status"],
            "total_revenue": plan["total_revenue"],
            "currency": plan.get("currency", "CNY"),
            "ratio_sum": plan["ratio_sum"],
            "data_provider_pool_ratio": plan["data_provider_pool_ratio"],
            "data_provider_revenue_pool": plan["data_provider_revenue_pool"],
            "items": items,
            "can_simulate": summary["can_simulate"],
            "blocking_reasons": summary["blocking_reasons"],
            "version_no": plan.get("version_no", 1),
            "created_by": plan.get("created_by"),
            "created_at": plan.get("created_at"),
            "updated_at": plan.get("updated_at"),
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        }

    def save(self, project_id, payload):
        project = self._project(project_id)
        payload = payload or {}
        total_revenue = self._decimal(payload.get("total_revenue"), "total_revenue", scale="amount", required=True)
        if total_revenue < 0:
            raise self._invalid("total_revenue", "total_revenue 必须大于等于 0")
        pool_ratio = self._decimal(
            payload.get("data_provider_pool_ratio"),
            "data_provider_pool_ratio",
            scale="ratio",
            required=True,
        )
        if pool_ratio <= 0 or pool_ratio > Decimal("1"):
            raise self._invalid("data_provider_pool_ratio", "data_provider_pool_ratio 必须大于 0 且小于等于 1")
        items_payload = payload.get("items", [])
        if not isinstance(items_payload, list):
            raise self._invalid("items", "items 必须为数组")

        non_data_items = []
        seen_party_ids = set()
        for index, item in enumerate(items_payload):
            if not isinstance(item, dict):
                raise self._invalid(f"items[{index}]", "合同主体比例项必须是对象")
            bucket_type = item.get("bucket_type", "NON_DATA_PARTY")
            if bucket_type != "NON_DATA_PARTY":
                raise self._invalid(f"items[{index}].bucket_type", "前端只允许提交 NON_DATA_PARTY 比例项")
            party_id = item.get("party_id")
            party = self.repository.get_party(party_id) if party_id else None
            if not party:
                raise ApiError(
                    "DVAS_CONTRACT_RATIO_INVALID",
                    "合同比例方案不合法",
                    field_errors=[{"field": f"items[{index}].party_id", "reason": "NON_DATA_PARTY 的 party_id 必须存在"}],
                )
            if self._is_data_provider_party(party):
                raise ApiError(
                    "DVAS_CONTRACT_RATIO_INVALID",
                    "合同比例方案不合法",
                    field_errors=[{"field": f"items[{index}].party_id", "reason": "NON_DATA_PARTY 的 party_id 不能是数据源主体"}],
                )
            if party_id in seen_party_ids:
                raise ApiError(
                    "DVAS_CONTRACT_RATIO_INVALID",
                    "合同比例方案不合法",
                    field_errors=[{"field": f"items[{index}].party_id", "reason": "同一非数据主体不能重复配置"}],
                )
            seen_party_ids.add(party_id)
            ratio = self._decimal(item.get("ratio"), f"items[{index}].ratio", scale="ratio", required=True)
            if ratio < 0:
                raise self._invalid(f"items[{index}].ratio", "ratio 必须大于等于 0")
            amount = self._amount(total_revenue * ratio)
            non_data_items.append(
                {
                    "party": party,
                    "ratio": ratio,
                    "calculated_amount": amount,
                    "basis_text": item.get("basis_text") or "合同约定",
                }
            )

        ratio_sum = self._ratio(pool_ratio + sum((item["ratio"] for item in non_data_items), Decimal("0")))
        if ratio_sum != Decimal("1.000000"):
            raise ApiError(
                "DVAS_CONTRACT_RATIO_INVALID",
                "合同比例合计必须等于 100.0000%。",
                field_errors=[
                    {
                        "field": "ratio_sum",
                        "reason": f"当前比例合计为 {self._format_ratio(ratio_sum)}",
                    }
                ],
            )

        existing = self.repository.latest_contract_ratio_plan(project["project_id"])
        now = utc_now()
        plan_id = existing["plan_id"] if existing else self.repository.next_id("contract_ratio_plan")
        version_no = int(existing.get("version_no", 0)) + 1 if existing else 1
        pool_amount = self._amount(total_revenue * pool_ratio)
        plan = {
            "plan_id": plan_id,
            "project_id": project["project_id"],
            "total_revenue": self._format_amount(total_revenue),
            "currency": payload.get("currency") or "CNY",
            "data_provider_pool_ratio": self._format_ratio(pool_ratio),
            "ratio_sum": self._format_ratio(ratio_sum),
            "data_provider_revenue_pool": self._format_amount(pool_amount),
            "status": payload.get("status") if payload.get("status") in {"DRAFT", "SAVED", "LOCKED"} else "SAVED",
            "version_no": version_no,
            "created_by": existing.get("created_by") if existing else current_operator_id(self.repository),
            "created_at": existing.get("created_at") if existing else now,
            "updated_at": now,
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        }
        ratio_items = [
            {
                "item_id": f"{plan_id}_pool",
                "plan_id": plan_id,
                "project_id": project["project_id"],
                "bucket_type": "DATA_PROVIDER_POOL",
                "party_id": None,
                "party_name": "数据源收益池",
                "party_type": None,
                "ratio": self._format_ratio(pool_ratio),
                "calculated_amount": self._format_amount(pool_amount),
                "amount_source": "MD_DSHAP_WEIGHT",
                "basis_text": "数据源主体收益池，后续按 MD-DShap 权重分配",
                "sort_no": 1,
            }
        ]
        for index, item in enumerate(non_data_items, start=2):
            party = item["party"]
            ratio_items.append(
                {
                    "item_id": f"{plan_id}_item_{index - 1:03d}",
                    "plan_id": plan_id,
                    "project_id": project["project_id"],
                    "bucket_type": "NON_DATA_PARTY",
                    "party_id": party["party_id"],
                    "party_name": party["party_name"],
                    "party_type": party.get("party_type"),
                    "ratio": self._format_ratio(item["ratio"]),
                    "calculated_amount": self._format_amount(item["calculated_amount"]),
                    "amount_source": "CONTRACT_RATIO",
                    "basis_text": item["basis_text"],
                    "sort_no": index,
                }
            )
        self.repository.put_contract_ratio_plan(plan, ratio_items)
        write_audit(
            self.repository,
            module_code="CONS",
            menu_code="NAV_ALLOC_CONSTRAINT",
            operation_type="SAVE_CONTRACT_RATIO_PLAN",
            object_type="contract_ratio_plan",
            object_id=plan_id,
            status="SUCCESS",
            before_value_json=existing,
            after_value_json={"plan": plan, "items": ratio_items},
        )
        return self.get(project["project_id"])

    def delete(self, project_id):
        project = self._project(project_id)
        removed = self.repository.delete_contract_ratio_plan(project["project_id"])
        write_audit(
            self.repository,
            module_code="CONS",
            menu_code="NAV_ALLOC_CONSTRAINT",
            operation_type="DELETE_CONTRACT_RATIO_PLAN",
            object_type="contract_ratio_plan",
            object_id=removed[-1]["plan_id"] if removed else "",
            status="SUCCESS",
            before_value_json=removed,
        )
        return self.get(project["project_id"])

    def summary(self, project_id):
        project = self._project(project_id)
        plan = self.repository.latest_contract_ratio_plan(project["project_id"])
        md_status = self._md_dshap_status()
        if not plan:
            total_revenue, currency = self._current_total_revenue()
            return {
                "total_revenue": self._format_amount(total_revenue) if total_revenue is not None else "",
                "currency": currency,
                "contract_ratio_configured": False,
                "contract_ratio_sum": "0.000000",
                "data_provider_pool_ratio": "",
                "data_provider_revenue_pool": "",
                "non_data_contract_amount": "0.00",
                "weight_source": "MD_DSHAP",
                "weight_task_id": md_status["latest_success_task_id"],
                "weight_sum": md_status["weight_sum"],
                "data_provider_count": md_status["data_provider_count"],
                "non_data_party_count": self._non_data_party_count(),
                "md_dshap_status": md_status,
                "can_simulate": False,
                "blocking_reasons": ["请先配置并保存合同比例分配方案"],
            }
        total_revenue = self._decimal(plan["total_revenue"], "total_revenue", scale="amount", required=True)
        data_provider_pool = self._decimal(
            plan["data_provider_revenue_pool"],
            "data_provider_revenue_pool",
            scale="amount",
            required=True,
        )
        non_data_amount = self._amount(total_revenue - data_provider_pool)
        blocking_reasons = self._blocking_reasons(plan, md_status=md_status)
        return {
            "total_revenue": plan["total_revenue"],
            "currency": plan.get("currency", "CNY"),
            "contract_ratio_configured": plan.get("status") in {"SAVED", "LOCKED"},
            "contract_ratio_sum": plan["ratio_sum"],
            "data_provider_pool_ratio": plan["data_provider_pool_ratio"],
            "data_provider_revenue_pool": plan["data_provider_revenue_pool"],
            "non_data_contract_amount": self._format_amount(non_data_amount),
            "weight_source": "MD_DSHAP",
            "weight_task_id": md_status["latest_success_task_id"],
            "weight_sum": md_status["weight_sum"],
            "data_provider_count": md_status["data_provider_count"],
            "non_data_party_count": self._non_data_party_count(),
            "md_dshap_status": md_status,
            "can_simulate": not blocking_reasons,
            "blocking_reasons": blocking_reasons,
        }

    def _blocking_reasons(self, plan, md_status=None):
        reasons = []
        if not plan or plan.get("status") not in {"SAVED", "LOCKED"}:
            reasons.append("请先配置并保存合同比例分配方案")
        elif plan.get("ratio_sum") != "1.000000":
            reasons.append("合同比例合计必须等于 100.0000%")
        md_status = md_status or self._md_dshap_status()
        if not md_status["latest_success_task_id"]:
            reasons.append("请先完成 MD-DShap 权重计算")
        elif md_status["weight_sum"] != "1.000000":
            reasons.append("MD-DShap 归一化权重合计必须为 1.000000")
        return reasons

    def _md_dshap_status(self):
        tasks = [
            task for task in self.repository.list_md_dshap_tasks()
            if task.get("status") in {"COMPLETED", "SUCCESS"}
        ]
        task = tasks[-1] if tasks else None
        results = self.repository.list_md_dshap_results(task["task_id"]) if task else []
        weight_sum = self._ratio(
            sum((self._decimal(item.get("normalized_weight"), "normalized_weight", scale="ratio") for item in results), Decimal("0"))
        ) if results else Decimal("0")
        return {
            "latest_success_task_id": task["task_id"] if task else "",
            "weight_sum": self._format_ratio(weight_sum),
            "data_provider_count": len(results),
            "status": "SUCCESS" if task and weight_sum == Decimal("1.000000") else ("MISSING" if not task else "INVALID"),
        }

    def _current_total_revenue(self):
        drafts = self.repository.list_business_drafts("ALLOCATION_REVENUE_POOL")
        if drafts:
            content = drafts[-1].get("content_json") or {}
            total = content.get("total_revenue")
            currency = content.get("currency", "CNY")
            if total is not None and total != "":
                return self._decimal(total, "total_revenue", scale="amount"), currency

        project = self.repository.get_project()
        allocation_id = project.get("current_allocation_id")
        allocation = self.repository.get_allocation_scenario(allocation_id) if allocation_id else None
        if allocation and allocation.get("total_revenue") is not None:
            return self._decimal(allocation["total_revenue"], "total_revenue", scale="amount"), allocation.get("currency", "CNY")

        snapshot_id = project.get("current_input_snapshot_id")
        snapshot = self.repository.get_input_snapshot(snapshot_id) if snapshot_id else None
        content = (snapshot or {}).get("content_json")
        content = content if isinstance(content, dict) else {}
        for field in ("total_revenue", "revenue_pool", "data_provider_revenue_pool"):
            if content.get(field) is not None and content.get(field) != "":
                return self._decimal(content[field], field, scale="amount"), "CNY"
        return None, "CNY"

    def _project(self, project_id):
        project = self.repository.get_project()
        if project_id not in {project.get("project_id"), "current"}:
            raise ApiError("DVAS_NOT_FOUND", "项目不存在", status=404)
        return project

    def _non_data_party_count(self):
        return len([
            party for party in self.repository.list_parties()
            if not self._is_data_provider_party(party)
            and party.get("status") in {"ACTIVE", "ENABLED"}
        ])

    def _is_data_provider_party(self, party):
        return bool(party.get("is_data_provider", party.get("party_type") == "DATA_PROVIDER"))

    def _decimal(self, raw_value, field, scale, required=False):
        if raw_value is None or raw_value == "":
            if required:
                raise self._invalid(field, f"{field} 为必填字段")
            raw_value = "0"
        try:
            value = Decimal(str(raw_value))
        except (InvalidOperation, ValueError) as exc:
            raise self._invalid(field, f"{field} 必须是 Decimal 字符串") from exc
        return self._amount(value) if scale == "amount" else self._ratio(value)

    def _amount(self, value):
        return Decimal(value).quantize(self.AMOUNT_QUANT, rounding=ROUND_HALF_UP)

    def _ratio(self, value):
        return Decimal(value).quantize(self.RATIO_QUANT, rounding=ROUND_HALF_UP)

    def _format_amount(self, value):
        return f"{self._amount(value):.2f}"

    def _format_ratio(self, value):
        return f"{self._ratio(value):.6f}"

    def _invalid(self, field, reason):
        return ApiError(
            "DVAS_CONTRACT_RATIO_INVALID",
            "合同比例方案不合法",
            field_errors=[{"field": field, "reason": reason}],
        )


class AllocationService:
    PRIORITY_CAP_TYPES = {"CAP_AMOUNT", "MAX_AMOUNT"}
    RATIO_QUANT = Decimal("0.000001")
    AMOUNT_QUANT = Decimal("0.01")

    def __init__(self, repository):
        self.repository = repository

    def simulate_contract_ratio(self, project_id):
        ProjectStateMachine(self.repository).require_allocation_allowed()
        project = self.repository.get_project()
        if project_id not in {project.get("project_id"), "current"}:
            raise ApiError("DVAS_NOT_FOUND", "项目不存在", status=404)
        plan = self.repository.latest_contract_ratio_plan(project["project_id"])
        if not plan or plan.get("status") not in {"SAVED", "LOCKED"}:
            raise ApiError(
                "DVAS_CONTRACT_RATIO_REQUIRED",
                "请先配置并保存合同比例分配方案后再执行收益分配模拟。",
                field_errors=[
                    {
                        "field": "contract_ratio_plan",
                        "reason": "请先配置并保存合同比例分配方案",
                    }
                ],
            )
        if plan.get("ratio_sum") != "1.000000":
            raise ApiError(
                "DVAS_CONTRACT_RATIO_INVALID",
                "合同比例合计必须等于 100.0000%。",
                field_errors=[{"field": "ratio_sum", "reason": f"当前比例合计为 {plan.get('ratio_sum')}"}],
            )

        task = self._resolve_weight_task(None, project)
        weight_results = self._weight_results(task["task_id"])
        total_revenue = self._decimal_amount(plan["total_revenue"])
        data_provider_pool = self._decimal_amount(plan["data_provider_revenue_pool"])
        items = self.repository.list_contract_ratio_items(plan["plan_id"])
        non_data_items = [item for item in items if item.get("bucket_type") == "NON_DATA_PARTY"]
        non_data_total = sum(
            (self._decimal_amount(item["calculated_amount"]) for item in non_data_items),
            Decimal("0.00"),
        )

        now = utc_now()
        allocation_id = self.repository.next_id("allocation")
        version_no = 1
        result_snapshot_id = self.repository.next_id("snapshot")
        data_amounts = self._weighted_amounts(data_provider_pool, weight_results)
        final_amount_sum = non_data_total + sum(data_amounts.values(), Decimal("0.00"))
        tail_delta = self._decimal_round_amount(total_revenue - final_amount_sum)
        if tail_delta:
            target = max(weight_results, key=lambda item: Decimal(str(item["normalized_weight"])))
            data_amounts[target["party_id"]] = self._decimal_round_amount(data_amounts[target["party_id"]] + tail_delta)

        allocation = {
            "allocation_id": allocation_id,
            "project_id": project["project_id"],
            "total_revenue": float(total_revenue),
            "currency": plan.get("currency", "CNY"),
            "priority_allocation_amount": float(non_data_total),
            "total_contract_priority_amount": float(non_data_total),
            "non_data_contract_amount": float(non_data_total),
            "data_provider_revenue_pool": float(data_provider_pool),
            "data_provider_pool_ratio": plan["data_provider_pool_ratio"],
            "contract_ratio_plan_id": plan["plan_id"],
            "contract_ratio_sum": plan["ratio_sum"],
            "contract_priority_allocations": [
                {
                    "party_id": item["party_id"],
                    "party_name": item["party_name"],
                    "subject_track": "CONTRACT_RATIO",
                    "value_type": "RATIO",
                    "priority_amount": None,
                    "priority_ratio": float(Decimal(item["ratio"])),
                    "requested_amount": float(self._decimal_amount(item["calculated_amount"])),
                    "cap_amount": float(self._decimal_amount(item["calculated_amount"])),
                    "actual_priority_amount": float(self._decimal_amount(item["calculated_amount"])),
                    "basis_text": item.get("basis_text") or "合同约定",
                    "priority": item.get("sort_no", 0),
                    "status": "APPLIED",
                    "source_draft_id": None,
                    "source_constraint_id": None,
                    "simulation_disclaimer": SIMULATION_DISCLAIMER,
                }
                for item in non_data_items
            ],
            "allocation_mode": AllocationMode.MD_DSHAP_WEIGHT_WITH_CONSTRAINTS.value,
            "weight_task_id": task["task_id"],
            "status": "ALLOCATED",
            "locked_by": None,
            "locked_at": None,
            "version_no": version_no,
            "created_by": current_operator_id(self.repository),
            "created_at": now,
            "updated_at": now,
            "result_snapshot_id": result_snapshot_id,
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        }

        non_data_results = []
        for item in non_data_items:
            party = self.repository.get_party(item["party_id"]) or {}
            amount = self._decimal_amount(item["calculated_amount"])
            non_data_results.append(
                {
                    "result_id": self.repository.next_id("allocation_result"),
                    "allocation_id": allocation_id,
                    "project_id": project["project_id"],
                    "party_id": item["party_id"],
                    "party_name": item["party_name"],
                    "party_type": item.get("party_type") or party.get("party_type", "CONTRACT_PARTY"),
                    "is_data_provider": False,
                    "include_in_md_dshap": False,
                    "subject_track": "CONTRACT_RATIO",
                    "amount_source": "CONTRACT_RATIO",
                    "contract_ratio": float(Decimal(item["ratio"])),
                    "total_revenue": float(total_revenue),
                    "priority_allocation_amount": float(non_data_total),
                    "total_contract_priority_amount": float(non_data_total),
                    "data_provider_revenue_pool": float(data_provider_pool),
                    "base_pool_amount": float(total_revenue),
                    "currency": plan.get("currency", "CNY"),
                    "allocation_mode": allocation["allocation_mode"],
                    "raw_weight": 0.0,
                    "normalized_weight": 0.0,
                    "pre_constraint_amount": float(amount),
                    "post_constraint_amount": float(amount),
                    "final_amount": float(amount),
                    "constraint_adjustment_amount": 0.0,
                    "constraint_adjustment_reason": f"合同比例分配：{item.get('basis_text') or '合同约定'}",
                    "rounding_delta": 0.0,
                    "rounding_note": "按已保存合同比例方案计算金额。",
                    "weight_source": "CONTRACT_RATIO",
                    "version_no": version_no,
                    "result_snapshot_id": result_snapshot_id,
                    "created_at": now,
                    "explanation": "非数据主体按合同比例从总收益中优先确定金额。",
                    "simulation_disclaimer": SIMULATION_DISCLAIMER,
                }
            )

        data_provider_results = []
        for weight in weight_results:
            party_id = weight["party_id"]
            party = self.repository.get_party(party_id) or {}
            final_amount = data_amounts[party_id]
            raw_amount = self._decimal_round_amount(data_provider_pool * Decimal(str(weight["normalized_weight"])))
            rounding_delta = self._decimal_round_amount(final_amount - raw_amount)
            data_provider_results.append(
                {
                    "result_id": self.repository.next_id("allocation_result"),
                    "allocation_id": allocation_id,
                    "project_id": project["project_id"],
                    "party_id": party_id,
                    "party_name": weight["party_name"],
                    "party_type": party.get("party_type", "DATA_PROVIDER"),
                    "is_data_provider": True,
                    "include_in_md_dshap": True,
                    "subject_track": "DATA_PROVIDER_POOL",
                    "amount_source": "MD_DSHAP_WEIGHT",
                    "contract_ratio": None,
                    "total_revenue": float(total_revenue),
                    "priority_allocation_amount": float(non_data_total),
                    "total_contract_priority_amount": float(non_data_total),
                    "data_provider_revenue_pool": float(data_provider_pool),
                    "base_pool_amount": float(data_provider_pool),
                    "currency": plan.get("currency", "CNY"),
                    "allocation_mode": allocation["allocation_mode"],
                    "raw_weight": round(float(weight["participant_weight"]), 6),
                    "normalized_weight": round(float(weight["normalized_weight"]), 6),
                    "pre_constraint_amount": float(final_amount),
                    "post_constraint_amount": float(final_amount),
                    "final_amount": float(final_amount),
                    "constraint_adjustment_amount": 0.0,
                    "constraint_adjustment_reason": "按 MD-DShap 归一化权重分配数据源收益池",
                    "rounding_delta": float(rounding_delta),
                    "rounding_note": "金额保留 0.01 元，尾差写入 rounding_delta。",
                    "weight_source": "MD_DSHAP",
                    "version_no": version_no,
                    "result_snapshot_id": result_snapshot_id,
                    "created_at": now,
                    "explanation": "数据源主体按数据源收益池与 MD-DShap normalized_weight 计算最终金额。",
                    "simulation_disclaimer": SIMULATION_DISCLAIMER,
                }
            )

        final_results = non_data_results + data_provider_results
        snapshot = self._snapshot(
            result_snapshot_id,
            "RESULT",
            {
                "allocation": allocation,
                "contract_ratio_plan": plan,
                "contract_ratio_items": items,
                "results": final_results,
                "data_provider_allocations": data_provider_results,
                "constraint_traces": [],
            },
            now,
        )
        self.repository.put_snapshot(snapshot)
        self.repository.put_allocation_scenario(allocation)
        self.repository.put_allocation_results(final_results, [])
        updated_project = self.repository.update_project(
            project_status=ProjectStatus.ALLOCATED.value,
            current_allocation_id=allocation_id,
        )
        write_audit(
            self.repository,
            module_code="ALLOC",
            menu_code="NAV_ALLOC_SIMULATION",
            operation_type="SIMULATE_CONTRACT_RATIO_ALLOCATION",
            object_type="allocation_scenario",
            object_id=allocation_id,
            status="SUCCESS",
            result_snapshot_id=result_snapshot_id,
            after_value_json={
                "allocation": allocation,
                "contract_ratio_plan": plan,
                "results": final_results,
            },
        )
        return {
            "project_id": updated_project["project_id"],
            "project_status": updated_project["project_status"],
            "summary": self._allocation_summary(allocation),
            "allocation": allocation,
            "contract_ratio_plan": plan,
            "contract_ratio_items": items,
            "contract_priority_allocations": allocation.get("contract_priority_allocations", []),
            "data_provider_allocations": data_provider_results,
            "results": final_results,
            "final_allocations": final_results,
            "constraint_traces": [],
            "constraints": [],
            "rounding_delta": round(sum(item.get("rounding_delta", 0.0) for item in final_results), 2),
            "disclaimer": SIMULATION_DISCLAIMER,
        }

    def run(self, payload):
        ProjectStateMachine(self.repository).require_allocation_allowed()
        payload = payload or {}
        explicit_allocation_id = payload.get("allocation_id")
        has_new_scenario_input = any(
            key in payload
            for key in (
                "total_revenue",
                "priority_allocation_amount",
                "priority_items",
                "allocation_priority_items",
                "contract_priority_allocations",
                "currency",
                "allocation_mode",
            )
        )
        allocation_id = explicit_allocation_id or (
            None
            if has_new_scenario_input
            else self.repository.get_project().get("current_allocation_id")
        )
        if allocation_id:
            return self.simulate(allocation_id)
        allocation = self.create(
            {
                "total_revenue": payload.get("total_revenue", 1000),
                "priority_allocation_amount": payload.get("priority_allocation_amount", 0),
                "priority_items": payload.get("priority_items")
                or payload.get("allocation_priority_items")
                or payload.get("contract_priority_allocations"),
                "currency": payload.get("currency", "CNY"),
                "allocation_mode": payload.get(
                    "allocation_mode",
                    AllocationMode.MD_DSHAP_WEIGHT_WITH_CONSTRAINTS.value,
                ),
            }
        )
        return self.simulate(allocation["allocation_id"])

    def create(self, payload):
        project = self.repository.get_project()
        ProjectStateMachine(self.repository).require_allocation_allowed()
        task = self._resolve_weight_task(payload.get("weight_task_id"), project)
        results = self._weight_results(task["task_id"])
        total_revenue = self._amount(payload, "total_revenue", required=True)
        allocation_mode = payload.get(
            "allocation_mode",
            AllocationMode.MD_DSHAP_WEIGHT_WITH_CONSTRAINTS.value,
        )
        if allocation_mode not in AllocationMode.values():
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "收益分配模式不支持",
                field_errors=[{"field": "allocation_mode", "reason": "不支持的收益分配模式"}],
            )
        constraints = self._active_constraints()
        contract_priority_allocations = self._contract_priority_allocations(
            payload,
            total_revenue,
            constraints,
        )
        priority_amount = round(
            sum(item["actual_priority_amount"] for item in contract_priority_allocations),
            2,
        )
        if priority_amount > total_revenue:
            raise ApiError(
                "DVAS_CONTRACT_PRIORITY_EXCEEDS_TOTAL_REVENUE",
                "优先分配金额不能超过总收益",
                field_errors=[{"field": "priority_allocation_amount", "reason": "优先分配金额不能超过总收益"}],
            )
        data_provider_revenue_pool = round(total_revenue - priority_amount, 2)
        if data_provider_revenue_pool < 0:
            raise ApiError(
                "DVAS_DATA_PROVIDER_REVENUE_POOL_NEGATIVE",
                "数据源主体收益池不能为负",
                field_errors=[{"field": "data_provider_revenue_pool", "reason": "数据源主体收益池不能为负"}],
            )
        now = utc_now()
        allocation = {
            "allocation_id": self.repository.next_id("allocation"),
            "project_id": project["project_id"],
            "total_revenue": total_revenue,
            "currency": payload.get("currency", "CNY"),
            "priority_allocation_amount": priority_amount,
            "total_contract_priority_amount": priority_amount,
            "data_provider_revenue_pool": data_provider_revenue_pool,
            "contract_priority_allocations": contract_priority_allocations,
            "allocation_mode": allocation_mode,
            "weight_task_id": task["task_id"],
            "status": "DRAFT",
            "locked_by": None,
            "locked_at": None,
            "version_no": 0,
            "created_by": current_operator_id(self.repository),
            "created_at": now,
            "updated_at": now,
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        }
        self.repository.put_allocation_scenario(allocation)
        self._persist_allocation_priority_items(allocation, contract_priority_allocations)
        write_audit(
            self.repository,
            module_code="ALLOC",
            menu_code="NAV_ALLOC_SIMULATION",
            operation_type="CREATE_ALLOCATION_SCENARIO",
            object_type="allocation_scenario",
            object_id=allocation["allocation_id"],
            status="SUCCESS",
            after_value_json={"allocation": allocation, "weights": results},
        )
        return allocation

    def simulate(self, allocation_id):
        ProjectStateMachine(self.repository).require_allocation_allowed()
        allocation = self._allocation(allocation_id)
        task = self._resolve_weight_task(allocation["weight_task_id"], self.repository.get_project())
        weight_results = self._weight_results(task["task_id"])
        pool = float(allocation["data_provider_revenue_pool"])
        constraints = [
            item
            for item in self.repository.list_contract_constraints()
            if item["status"] == "ACTIVE"
            and item["constraint_type"] != ContractConstraintType.PRIORITY_ALLOCATION.value
        ]
        next_version = int(allocation["version_no"]) + 1
        amounts = {
            result["party_id"]: pool * float(result["normalized_weight"])
            for result in weight_results
        }
        adjustment_reasons = {result["party_id"]: [] for result in weight_results}
        traces, locked_upper, locked_lower, locked_exact = self._apply_constraints(
            allocation_id,
            next_version,
            amounts,
            constraints,
            pool,
            adjustment_reasons,
        )
        self._rebalance(amounts, pool, weight_results, locked_upper, locked_lower, locked_exact)
        rounded_amounts, rounding_delta_by_party = self._round_amounts(
            amounts,
            pool,
            weight_results,
            locked_upper,
            locked_lower,
            locked_exact,
        )
        now = utc_now()
        result_snapshot_id = self.repository.next_id("snapshot")
        data_provider_results = []
        for weight in weight_results:
            party_id = weight["party_id"]
            party = self.repository.get_party(party_id) or {}
            reason = "；".join(adjustment_reasons[party_id]) or "无约束调整"
            rounding_delta = rounding_delta_by_party.get(party_id, 0.0)
            if rounding_delta:
                reason = f"{reason}；四舍五入差额调整"
            pre_constraint_amount = round(pool * float(weight["normalized_weight"]), 2)
            post_constraint_amount = rounded_amounts[party_id]
            data_provider_results.append(
                {
                    "result_id": self.repository.next_id("allocation_result"),
                    "allocation_id": allocation_id,
                    "project_id": allocation["project_id"],
                    "party_id": party_id,
                    "party_name": weight["party_name"],
                    "party_type": party.get("party_type", "DATA_PROVIDER"),
                    "is_data_provider": True,
                    "include_in_md_dshap": True,
                    "subject_track": "DATA_PROVIDER_POOL",
                    "amount_source": "MD_DSHAP_RESIDUAL_POOL",
                    "total_revenue": allocation["total_revenue"],
                    "priority_allocation_amount": allocation["priority_allocation_amount"],
                    "total_contract_priority_amount": allocation.get(
                        "total_contract_priority_amount",
                        allocation["priority_allocation_amount"],
                    ),
                    "data_provider_revenue_pool": allocation["data_provider_revenue_pool"],
                    "currency": allocation["currency"],
                    "allocation_mode": allocation["allocation_mode"],
                    "raw_weight": round(float(weight["participant_weight"]), 6),
                    "normalized_weight": round(float(weight["normalized_weight"]), 6),
                    "pre_constraint_amount": pre_constraint_amount,
                    "post_constraint_amount": post_constraint_amount,
                    "final_amount": post_constraint_amount,
                    "constraint_adjustment_amount": round(post_constraint_amount - pre_constraint_amount, 2),
                    "constraint_adjustment_reason": reason,
                    "rounding_delta": rounding_delta,
                    "rounding_note": "四舍五入到 0.01 元，尾差计入 rounding_delta。",
                    "weight_source": "MD-DShap",
                    "version_no": next_version,
                    "result_snapshot_id": result_snapshot_id,
                    "created_at": now,
                    "simulation_disclaimer": SIMULATION_DISCLAIMER,
                }
            )
        priority_results = self._contract_priority_result_rows(
            allocation,
            next_version,
            result_snapshot_id,
            now,
        )
        final_results = priority_results + data_provider_results
        snapshot = self._snapshot(
            result_snapshot_id,
            "RESULT",
            {
                "allocation": allocation,
                "results": final_results,
                "data_provider_allocations": data_provider_results,
                "contract_priority_allocations": allocation.get("contract_priority_allocations", []),
                "constraint_traces": traces,
            },
            now,
        )
        updated_allocation = {
            **allocation,
            "status": "ALLOCATED",
            "version_no": next_version,
            "updated_at": now,
            "result_snapshot_id": result_snapshot_id,
        }
        self.repository.put_snapshot(snapshot)
        self.repository.put_allocation_scenario(updated_allocation)
        self.repository.put_allocation_results(final_results, traces)
        updated_project = self.repository.update_project(
            project_status=ProjectStatus.ALLOCATED.value,
            current_allocation_id=allocation_id,
        )
        write_audit(
            self.repository,
            module_code="ALLOC",
            menu_code="NAV_ALLOC_SIMULATION",
            operation_type="SIMULATE_ALLOCATION",
            object_type="allocation_scenario",
            object_id=allocation_id,
            status="SUCCESS",
            result_snapshot_id=result_snapshot_id,
            after_value_json={
                "allocation": updated_allocation,
                "results": final_results,
                "data_provider_allocations": data_provider_results,
                "constraint_traces": traces,
            },
        )
        return {
            "project_id": updated_project["project_id"],
            "project_status": updated_project["project_status"],
            "summary": self._allocation_summary(updated_allocation),
            "allocation": updated_allocation,
            "contract_priority_allocations": updated_allocation.get("contract_priority_allocations", []),
            "data_provider_allocations": data_provider_results,
            "results": final_results,
            "final_allocations": final_results,
            "constraint_traces": traces,
            "constraints": constraints,
            "rounding_delta": round(sum(item.get("rounding_delta", 0.0) for item in final_results), 2),
            "disclaimer": SIMULATION_DISCLAIMER,
        }

    def lock(self, allocation_id):
        allocation = self._allocation(allocation_id)
        if allocation["status"] != "ALLOCATED":
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                "只能锁定已完成模拟的参考方案",
                field_errors=[{"field": "allocation_id", "reason": "只能锁定已完成模拟的参考方案"}],
            )
        updated = {
            **allocation,
            "status": "CONFIRMED",
            "locked_by": LOCAL_OPERATOR,
            "locked_at": utc_now(),
            "updated_at": utc_now(),
        }
        self.repository.put_allocation_scenario(updated)
        updated_project = self.repository.update_project(project_status=ProjectStatus.CONFIRMED.value)
        write_audit(
            self.repository,
            module_code="ALLOC",
            menu_code="NAV_ALLOC_SIMULATION",
            operation_type="LOCK_ALLOCATION",
            object_type="allocation_scenario",
            object_id=allocation_id,
            status="SUCCESS",
            before_value_json=allocation,
            after_value_json=updated,
        )
        return {
            "project_id": updated_project["project_id"],
            "project_status": updated_project["project_status"],
            "allocation": updated,
            "message": "已锁定模拟参考方案；不构成法律结算或付款指令。",
        }

    def results(self, allocation_id):
        allocation = self._allocation(allocation_id)
        rows = self.repository.list_allocation_results(allocation_id)
        data_provider_rows = [item for item in rows if item.get("subject_track") == "DATA_PROVIDER_POOL"]
        constraint_traces = self._latest_version_rows(
            self.repository.list_constraint_apply_traces(allocation_id)
        )
        page = table_page(rows)
        page.update(
            {
                "allocation": allocation,
                "summary": self._allocation_summary(allocation),
                "contract_priority_allocations": allocation.get("contract_priority_allocations", []),
                "data_provider_allocations": data_provider_rows,
                "final_allocations": rows,
                "constraints": self._active_constraints(),
                "constraint_traces": constraint_traces,
                "constraint_apply_trace": constraint_traces,
                "rounding_delta": round(sum(item.get("rounding_delta", 0.0) for item in rows), 2),
                "disclaimer": SIMULATION_DISCLAIMER,
            }
        )
        return page

    def _allocation(self, allocation_id):
        allocation = self.repository.get_allocation_scenario(allocation_id)
        if not allocation:
            raise ApiError("DVAS_NOT_FOUND", "收益分配模拟方案不存在", status=404)
        return allocation

    def _resolve_weight_task(self, weight_task_id, project):
        ProjectStateMachine(self.repository).require_allocation_allowed()
        task = self.repository.get_md_dshap_task(weight_task_id) if weight_task_id else None
        if not task:
            tasks = self.repository.list_md_dshap_tasks()
            task = tasks[-1] if tasks else None
        if not task:
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                "请先完成 MD-DShap 权重计算",
                field_errors=[{"field": "weight_task_id", "reason": "请先完成 MD-DShap 权重计算"}],
            )
        return task

    def _weight_results(self, task_id):
        results = self.repository.list_md_dshap_results(task_id)
        if not results:
            raise ApiError(
                "DVAS_NO_DATA_PROVIDER_WEIGHT_RESULT",
                "MD-DShap 权重结果不存在",
                field_errors=[{"field": "weight_task_id", "reason": "MD-DShap 权重结果不存在"}],
            )
        total_weight = round(sum(float(item["normalized_weight"]) for item in results), 6)
        if abs(total_weight - 1.0) > P0_CONFIG.weight_normalization_tolerance:
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                "MD-DShap 归一化权重不等于 1",
                field_errors=[{"field": "normalized_weight", "reason": "归一化权重之和必须为 1.000000"}],
            )
        return results

    def _active_constraints(self):
        return [
            item
            for item in self.repository.list_contract_constraints()
            if item["status"] == "ACTIVE"
        ]

    def _allocation_summary(self, allocation):
        return {
            "total_revenue": allocation["total_revenue"],
            "total_contract_priority_amount": allocation.get(
                "total_contract_priority_amount",
                allocation.get("priority_allocation_amount", 0),
            ),
            "priority_allocation_amount": allocation.get("priority_allocation_amount", 0),
            "data_provider_revenue_pool": allocation["data_provider_revenue_pool"],
            "contract_ratio_plan_id": allocation.get("contract_ratio_plan_id"),
            "contract_ratio_sum": allocation.get("contract_ratio_sum"),
            "data_provider_pool_ratio": allocation.get("data_provider_pool_ratio"),
            "non_data_contract_amount": allocation.get(
                "non_data_contract_amount",
                allocation.get("total_contract_priority_amount", allocation.get("priority_allocation_amount", 0)),
            ),
            "currency": allocation.get("currency", "CNY"),
            "weight_source": "MD-DShap",
            "priority_items_count": len(allocation.get("contract_priority_allocations", [])),
        }

    def _contract_priority_result_rows(self, allocation, version_no, result_snapshot_id, now):
        rows = []
        priority_by_party = {
            priority["party_id"]: priority
            for priority in allocation.get("contract_priority_allocations", [])
        }
        non_data_parties = [
            party
            for party in self.repository.list_parties()
            if not self._is_data_provider_party(party)
            and party.get("status") in {"ACTIVE", "ENABLED"}
        ]
        for party in non_data_parties:
            priority = priority_by_party.get(
                party["party_id"],
                {
                    "party_id": party["party_id"],
                    "party_name": party["party_name"],
                    "actual_priority_amount": 0,
                    "basis_text": "未配置合同优先分配，金额为 0",
                },
            )
            amount = round(float(priority["actual_priority_amount"]), 2)
            rows.append(
                {
                    "result_id": self.repository.next_id("allocation_result"),
                    "allocation_id": allocation["allocation_id"],
                    "project_id": allocation["project_id"],
                    "party_id": priority["party_id"],
                    "party_name": priority["party_name"],
                    "party_type": party.get("party_type", "CONTRACT_PARTY"),
                    "is_data_provider": False,
                    "include_in_md_dshap": False,
                    "subject_track": "CONTRACT_PRIORITY",
                    "amount_source": "CONTRACT_PRIORITY",
                    "total_revenue": allocation["total_revenue"],
                    "priority_allocation_amount": allocation["priority_allocation_amount"],
                    "total_contract_priority_amount": allocation.get(
                        "total_contract_priority_amount",
                        allocation["priority_allocation_amount"],
                    ),
                    "data_provider_revenue_pool": allocation["data_provider_revenue_pool"],
                    "currency": allocation["currency"],
                    "allocation_mode": allocation["allocation_mode"],
                    "raw_weight": 0.0,
                    "normalized_weight": 0.0,
                    "pre_constraint_amount": amount,
                    "post_constraint_amount": amount,
                    "final_amount": amount,
                    "constraint_adjustment_amount": 0.0,
                    "constraint_adjustment_reason": f"合同优先分配：{priority.get('basis_text') or '合同约定'}",
                    "rounding_delta": 0.0,
                    "rounding_note": "合同优先金额先于数据源收益池扣除。",
                    "weight_source": "CONTRACT_PRIORITY",
                    "version_no": version_no,
                    "result_snapshot_id": result_snapshot_id,
                    "created_at": now,
                    "simulation_disclaimer": SIMULATION_DISCLAIMER,
                }
            )
        return rows

    def _persist_allocation_priority_items(self, allocation, priority_allocations):
        now = utc_now()
        items = []
        for index, priority in enumerate(priority_allocations):
            items.append(
                {
                    "item_id": self.repository.next_id("allocation_priority_item"),
                    "allocation_id": allocation["allocation_id"],
                    "project_id": allocation["project_id"],
                    "party_id": priority["party_id"],
                    "value_type": priority["value_type"],
                    "priority_amount": priority.get("priority_amount"),
                    "priority_ratio": priority.get("priority_ratio"),
                    "requested_amount": priority["requested_amount"],
                    "cap_amount": priority["cap_amount"],
                    "actual_priority_amount": priority["actual_priority_amount"],
                    "basis_text": priority.get("basis_text"),
                    "priority_order": priority.get("priority", index + 1),
                    "status": priority.get("status", "APPLIED"),
                    "source_draft_id": priority.get("source_draft_id"),
                    "source_constraint_id": priority.get("source_constraint_id"),
                    "created_at": now,
                    "updated_at": now,
                    "simulation_disclaimer": SIMULATION_DISCLAIMER,
                }
            )
        self.repository.put_allocation_priority_items(
            items,
            allocation_id=allocation["allocation_id"],
        )
        return items

    def _contract_priority_allocations(self, payload, total_revenue, constraints):
        raw_items = self._priority_items(payload)
        if raw_items is None:
            raw_items = self._priority_items_from_constraints(constraints)
        if raw_items is None:
            raw_items = self._latest_priority_draft_items()
        if raw_items is None:
            legacy_amount = self._amount(payload, "priority_allocation_amount", default=0)
            if legacy_amount <= 0:
                return []
            raw_items = [self._legacy_priority_item(legacy_amount)]

        allocations = []
        for index, item in enumerate(raw_items):
            party_id = item.get("party_id")
            party = self.repository.get_party(party_id) if party_id else None
            if not party:
                raise ApiError(
                    "DVAS_NOT_FOUND",
                    "合同优先分配主体不存在",
                    status=404,
                    field_errors=[{"field": f"priority_items[{index}].party_id", "reason": "参与方不存在"}],
                )
            if self._is_data_provider_party(party):
                raise ApiError(
                    "DVAS_PRECONDITION_NOT_MET",
                    "合同优先分配仅适用于非数据源主体",
                    field_errors=[
                        {
                            "field": f"priority_items[{index}].party_id",
                            "reason": "数据源主体应进入数据源收益池分配，不应作为非数据源合同优先分配项",
                        }
                    ],
                )
            requested_amount = self._requested_priority_amount(item, total_revenue, index)
            cap_amount = self._priority_cap_amount(item, party_id, requested_amount, constraints, index)
            actual_amount = round(min(requested_amount, cap_amount), 2)
            allocations.append(
                {
                    "party_id": party_id,
                    "party_name": party["party_name"],
                    "subject_track": "CONTRACT_PRIORITY",
                    "value_type": item.get("value_type", "AMOUNT"),
                    "priority_amount": requested_amount
                    if item.get("value_type", "AMOUNT") == "AMOUNT"
                    else None,
                    "priority_ratio": item.get("priority_ratio")
                    if item.get("value_type", "AMOUNT") == "RATIO"
                    else None,
                    "requested_amount": requested_amount,
                    "cap_amount": cap_amount,
                    "actual_priority_amount": actual_amount,
                    "basis_text": item.get("basis_text") or "合同优先分配",
                    "priority": int(item.get("priority", item.get("priority_order", index + 1))),
                    "status": "APPLIED",
                    "source_draft_id": item.get("source_draft_id"),
                    "source_constraint_id": item.get("source_constraint_id"),
                    "simulation_disclaimer": SIMULATION_DISCLAIMER,
                }
            )
        total_priority = round(sum(item["actual_priority_amount"] for item in allocations), 2)
        if total_priority > total_revenue:
            raise ApiError(
                "DVAS_CONTRACT_PRIORITY_EXCEEDS_TOTAL_REVENUE",
                "优先分配金额不能超过总收益",
                field_errors=[{"field": "contract_priority_allocations", "reason": "合同优先分配合计不能超过总收益"}],
            )
        return sorted(allocations, key=lambda item: (item["priority"], item["party_id"]))

    def _priority_items(self, payload):
        for key in ("priority_items", "allocation_priority_items", "contract_priority_allocations"):
            value = payload.get(key)
            if value is not None:
                if not isinstance(value, list):
                    raise ApiError(
                        "DVAS_REQUIRED_FIELD_MISSING",
                        "合同优先分配项必须为数组",
                        field_errors=[{"field": key, "reason": f"{key} 必须为数组"}],
                    )
                return value
        return None

    def _latest_priority_draft_items(self):
        drafts = self.repository.list_business_drafts("ALLOCATION_PRIORITY_ITEMS")
        if not drafts:
            return None
        latest = drafts[-1]
        content = latest.get("content_json")
        return content if isinstance(content, list) else None

    def _priority_items_from_constraints(self, constraints):
        priority_constraints = [
            item
            for item in constraints
            if item["constraint_type"] == ContractConstraintType.PRIORITY_ALLOCATION.value
        ]
        if not priority_constraints:
            return None
        items = []
        for constraint in sorted(priority_constraints, key=lambda item: (item["priority"], item["constraint_id"])):
            value_type = constraint.get("value_type", "AMOUNT")
            item = {
                "party_id": constraint["party_id"],
                "value_type": value_type,
                "basis_text": constraint.get("description") or constraint["constraint_name"],
                "priority": constraint.get("priority", 1),
                "source_constraint_id": constraint["constraint_id"],
            }
            if value_type == "RATIO":
                item["priority_ratio"] = constraint["constraint_value"]
            else:
                item["priority_amount"] = constraint["constraint_value"]
            items.append(item)
        return items

    def _legacy_priority_item(self, amount):
        non_data_party = next(
            (
                party
                for party in self.repository.list_parties()
                if not self._is_data_provider_party(party)
                and party.get("status") in {"ACTIVE", "ENABLED"}
            ),
            None,
        )
        if not non_data_party:
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                "缺少可执行合同优先分配的非数据源主体",
                field_errors=[{"field": "priority_allocation_amount", "reason": "请先维护非数据源合同主体"}],
            )
        return {
            "party_id": non_data_party["party_id"],
            "value_type": "AMOUNT",
            "priority_amount": amount,
            "basis_text": "兼容旧版 priority_allocation_amount 输入",
            "priority": 1,
        }

    def _requested_priority_amount(self, item, total_revenue, index):
        value_type = item.get("value_type", "AMOUNT")
        if value_type == "RATIO":
            ratio = self._ratio(item.get("priority_ratio"), f"priority_items[{index}].priority_ratio")
            return round(total_revenue * ratio, 2)
        if value_type != "AMOUNT":
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "合同优先分配值类型不支持",
                field_errors=[{"field": f"priority_items[{index}].value_type", "reason": "value_type 必须为 AMOUNT 或 RATIO"}],
            )
        return self._number(item.get("priority_amount", 0), f"priority_items[{index}].priority_amount")

    def _priority_cap_amount(self, item, party_id, requested_amount, constraints, index):
        if item.get("cap_amount") is not None:
            cap_amount = self._number(item.get("cap_amount"), f"priority_items[{index}].cap_amount")
        else:
            caps = [
                float(constraint["constraint_value"])
                for constraint in constraints
                if constraint["party_id"] == party_id
                and constraint["constraint_type"] in self.PRIORITY_CAP_TYPES
            ]
            cap_amount = round(min(caps), 2) if caps else requested_amount
        if cap_amount < 0:
            raise ApiError(
                "DVAS_CONTRACT_CAP_INVALID",
                "合同优先分配上限不合法",
                field_errors=[{"field": f"priority_items[{index}].cap_amount", "reason": "cap_amount 必须大于等于 0"}],
            )
        return round(cap_amount, 2)

    def _ratio(self, raw_value, field):
        try:
            value = float(raw_value)
        except (TypeError, ValueError) as exc:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "合同优先分配比例不合法",
                field_errors=[{"field": field, "reason": f"{field} 必须是数字"}],
            ) from exc
        if value < 0 or value > 1:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "合同优先分配比例不合法",
                field_errors=[{"field": field, "reason": f"{field} 必须在 0 到 1 之间"}],
            )
        return round(value, 6)

    def _number(self, raw_value, field):
        try:
            value = float(raw_value)
        except (TypeError, ValueError) as exc:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "合同优先分配金额不合法",
                field_errors=[{"field": field, "reason": f"{field} 必须是数字"}],
            ) from exc
        if value < 0:
            raise ApiError(
                "DVAS_CONTRACT_CAP_INVALID" if field.endswith(".cap_amount") else "DVAS_FACTOR_INVALID",
                "合同优先分配金额不合法",
                field_errors=[{"field": field, "reason": f"{field} 必须大于等于 0"}],
            )
        return round(value, 2)

    def _is_data_provider_party(self, party):
        return bool(party.get("is_data_provider", party.get("party_type") == "DATA_PROVIDER"))

    def _apply_constraints(
        self,
        allocation_id,
        version_no,
        amounts,
        constraints,
        pool,
        adjustment_reasons,
    ):
        traces = []
        locked_upper = set()
        locked_lower = set()
        locked_exact = set()
        for constraint in constraints:
            if constraint["constraint_type"] == ContractConstraintType.PRIORITY_ALLOCATION.value:
                continue
            party_id = constraint["party_id"]
            if party_id not in amounts:
                continue
            before = amounts[party_id]
            after = before
            value = float(constraint["constraint_value"])
            constraint_type = constraint["constraint_type"]
            if constraint_type in {"MAX_AMOUNT", "CAP_AMOUNT"}:
                after = min(before, value)
                locked_upper.add(party_id)
            elif constraint_type in {"MIN_AMOUNT", "FLOOR_AMOUNT"}:
                after = max(before, value)
                locked_lower.add(party_id)
            elif constraint_type == "FIXED_RATIO":
                after = pool * value
                locked_exact.add(party_id)
            elif constraint_type == "PRIORITY_ALLOCATION":
                after = before + value
                locked_lower.add(party_id)
            if round(after - before, 2) == 0:
                continue
            amounts[party_id] = after
            adjustment_reasons[party_id].append(f"应用约束 {constraint['constraint_name']}({constraint_type})")
            traces.append(
                {
                    "trace_id": self.repository.next_id("constraint_trace"),
                    "allocation_id": allocation_id,
                    "constraint_id": constraint["constraint_id"],
                    "constraint_name": constraint["constraint_name"],
                    "constraint_type": constraint_type,
                    "party_id": party_id,
                    "party_name": self.repository.get_party(party_id)["party_name"],
                    "before_amount": round(before, 2),
                    "after_amount": round(after, 2),
                    "adjustment_amount": round(after - before, 2),
                    "constraint_adjustment_amount": round(after - before, 2),
                    "reason": f"{constraint_type}: {constraint['constraint_name']}",
                    "adjustment_reason": f"{constraint_type}: {constraint['constraint_name']}",
                    "version_no": version_no,
                    "created_at": utc_now(),
                }
            )
        return traces, locked_upper, locked_lower, locked_exact

    def _rebalance(self, amounts, pool, weight_results, locked_upper, locked_lower, locked_exact):
        delta = round(pool - sum(amounts.values()), 6)
        if abs(delta) < 0.000001:
            return
        if delta > 0:
            candidates = [
                item for item in weight_results if item["party_id"] not in locked_upper | locked_exact
            ]
        else:
            candidates = [
                item for item in weight_results if item["party_id"] not in locked_lower | locked_exact
            ]
        if not candidates:
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                "合同约束组合不可行",
                field_errors=[{"field": "contract_constraints", "reason": "合同约束组合不可行"}],
            )
        target = max(candidates, key=lambda item: float(item["normalized_weight"]))
        target_party_id = target["party_id"]
        if amounts[target_party_id] + delta < -0.000001:
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                "合同约束组合不可行",
                field_errors=[{"field": "contract_constraints", "reason": "合同约束组合不可行"}],
            )
        amounts[target_party_id] = amounts[target_party_id] + delta

    def _round_amounts(
        self,
        amounts,
        pool,
        weight_results,
        locked_upper,
        locked_lower,
        locked_exact,
    ):
        rounded = {party_id: round(amount, 2) for party_id, amount in amounts.items()}
        delta = round(pool - sum(rounded.values()), 2)
        rounding_delta_by_party = {party_id: 0.0 for party_id in rounded}
        if delta:
            if delta > 0:
                candidates = [
                    item for item in weight_results if item["party_id"] not in locked_upper | locked_exact
                ]
            else:
                candidates = [
                    item for item in weight_results if item["party_id"] not in locked_lower | locked_exact
                ]
            if not candidates:
                candidates = weight_results
            target = max(candidates, key=lambda item: float(item["normalized_weight"]))
            target_party_id = target["party_id"]
            rounded[target_party_id] = round(rounded[target_party_id] + delta, 2)
            rounding_delta_by_party[target_party_id] = delta
        return rounded, rounding_delta_by_party

    def _amount(self, payload, field, default=None, required=False):
        if required and field not in payload:
            raise ApiError(
                "DVAS_REQUIRED_FIELD_MISSING",
                "收益分配参数缺失",
                field_errors=[{"field": field, "reason": f"{field} 为必填字段"}],
            )
        try:
            value = float(payload.get(field, default))
        except (TypeError, ValueError) as exc:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "收益分配参数不合法",
                field_errors=[{"field": field, "reason": f"{field} 必须是数字"}],
            ) from exc
        if value < 0:
            raise ApiError(
                "DVAS_FACTOR_INVALID",
                "收益分配参数不合法",
                field_errors=[{"field": field, "reason": f"{field} 必须大于等于 0"}],
            )
        return round(value, 2)

    def _decimal_amount(self, value):
        return Decimal(str(value)).quantize(self.AMOUNT_QUANT, rounding=ROUND_HALF_UP)

    def _decimal_round_amount(self, value):
        return Decimal(str(value)).quantize(self.AMOUNT_QUANT, rounding=ROUND_HALF_UP)

    def _weighted_amounts(self, pool, weight_results):
        amounts = {
            item["party_id"]: self._decimal_round_amount(pool * Decimal(str(item["normalized_weight"])))
            for item in weight_results
        }
        delta = self._decimal_round_amount(pool - sum(amounts.values(), Decimal("0.00")))
        if delta:
            target = max(weight_results, key=lambda item: Decimal(str(item["normalized_weight"])))
            amounts[target["party_id"]] = self._decimal_round_amount(amounts[target["party_id"]] + delta)
        return amounts

    def _latest_version_rows(self, rows):
        if not rows:
            return []
        latest_version = max(int(row.get("version_no", 0)) for row in rows)
        return [row for row in rows if int(row.get("version_no", 0)) == latest_version]

    def _snapshot(self, snapshot_id, snapshot_type, content, now):
        return {
            "snapshot_id": snapshot_id,
            "project_id": self.repository.get_project()["project_id"],
            "snapshot_type": snapshot_type,
            "content_json": copy.deepcopy(content),
            "checksum": stable_checksum(content),
            "created_by": current_operator_id(self.repository),
            "created_at": now,
        }


class ReportService:
    EXTENDED_DISCLAIMER = (
        "系统输出仅为模拟参考，非法律结算 / 非法定结算结果，不构成付款指令、资产评估报告或正式审计报告。"
    )

    def __init__(self, repository):
        self.repository = repository

    def list(self):
        return table_page(self.repository.list_report_records())

    def preview(self):
        context = self._optional_export_context()
        return {
            "project_id": context["project"]["project_id"],
            "project_status": context["project"]["project_status"],
            "preview_markdown": self._markdown_content(context),
            "report_count": len(self.repository.list_report_records()),
            "allocation_ready": bool(context["allocation"] and context["allocation_results"]),
            "simulation_disclaimer": self.EXTENDED_DISCLAIMER,
        }

    def generate_markdown(self):
        context = self._final_export_context()
        context["project"] = self.repository.update_project(project_status=ProjectStatus.EXPORTED.value)
        content = self._markdown_content(context)
        return self._persist_report(
            report_type="P0_MARKDOWN_REPORT",
            primary_file_name="allocation_summary.md",
            file_format=ReportFormat.MARKDOWN.value,
            files=[("allocation_summary.md", content)],
            context=context,
            operation_type="GENERATE_MARKDOWN_REPORT",
        )

    def generate_csv(self):
        context = self._final_export_context()
        context["project"] = self.repository.update_project(project_status=ProjectStatus.EXPORTED.value)
        files = self._csv_files(context)
        return self._persist_report(
            report_type="P0_CSV_EXPORT",
            primary_file_name="source_level_allocation.csv",
            file_format=ReportFormat.CSV.value,
            files=files,
            context=context,
            operation_type="GENERATE_CSV_EXPORT",
        )

    def generate_json(self):
        context = self._final_export_context()
        context["project"] = self.repository.update_project(project_status=ProjectStatus.EXPORTED.value)
        payload = self._json_payload(context)
        content = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True)
        return self._persist_report(
            report_type="P0_JSON_EXPORT",
            primary_file_name="allocation_result.json",
            file_format=ReportFormat.JSON.value,
            files=[("allocation_result.json", content)],
            context=context,
            operation_type="GENERATE_JSON_EXPORT",
        )

    def generate_pdf(self):
        context = self._final_export_context()
        context["project"] = self.repository.update_project(project_status=ProjectStatus.EXPORTED.value)
        markdown = self._markdown_content(context)
        pdf_content = self._pdf_bytes(markdown)
        result = self._persist_report(
            report_type="P1_PDF_REPORT",
            primary_file_name="p1_simulation_reference_report.pdf",
            file_format="PDF",
            files=[("p1_simulation_reference_report.pdf", pdf_content)],
            context=context,
            operation_type="GENERATE_PDF_REPORT",
        )
        manifest = self._persist_report_manifest(result["report"], result["export_files"], context)
        return {**result, "manifest": manifest}

    def detail(self, report_id):
        report = self.repository.get_report_record(report_id)
        if not report:
            raise ApiError("DVAS_NOT_FOUND", "报告不存在", status=404)
        return {
            "report": report,
            "export_files": self.repository.list_export_files(report_id),
            "manifest": self.repository.get_report_manifest(report_id),
        }

    def files(self, report_id):
        if not self.repository.get_report_record(report_id):
            raise ApiError("DVAS_NOT_FOUND", "报告不存在", status=404)
        return table_page(self.repository.list_export_files(report_id))

    def manifest(self, report_id):
        manifest = self.repository.get_report_manifest(report_id)
        if not manifest:
            report = self.repository.get_report_record(report_id)
            if not report:
                raise ApiError("DVAS_NOT_FOUND", "报告不存在", status=404)
            manifest = self._persist_report_manifest(
                report,
                self.repository.list_export_files(report_id),
                self._optional_export_context(),
            )
        return manifest

    def download(self, report_id, file_id=None):
        report = self.repository.get_report_record(report_id)
        if not report:
            raise ApiError("DVAS_NOT_FOUND", "报告不存在", status=404)
        export_files = self.repository.list_export_files(report_id)
        if file_id:
            export_files = [item for item in export_files if item["export_file_id"] == file_id]
        if not export_files:
            raise ApiError("DVAS_NOT_FOUND", "报告文件不存在", status=404)
        export_file = export_files[0]
        file_path = Path(export_file["file_path"])
        if not file_path.exists():
            raise ApiError(
                "DVAS_NOT_FOUND",
                "报告文件不存在",
                status=404,
                field_errors=[{"field": "file_path", "reason": "本地文件缺失"}],
            )
        raw_content = file_path.read_bytes()
        checksum = hashlib.sha256(raw_content).hexdigest()
        return {
            "report_id": report_id,
            "export_file_id": export_file["export_file_id"],
            "file_name": export_file["file_name"],
            "file_format": export_file["file_format"],
            "byte_size": len(raw_content),
            "checksum": checksum,
            "checksum_verified": checksum == export_file["checksum"],
            "content_base64": base64.b64encode(raw_content).decode("ascii"),
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        }

    def archive(self, report_id, payload=None):
        report = self.repository.update_report_record(report_id, status="ARCHIVED", archived_at=utc_now())
        if not report:
            raise ApiError("DVAS_NOT_FOUND", "报告不存在", status=404)
        write_audit(
            self.repository,
            module_code="REP",
            menu_code="NAV_REPORT_EXPORT",
            operation_type="ARCHIVE_REPORT",
            object_type="report_record",
            object_id=report_id,
            status="SUCCESS",
            after_value_json={"report_id": report_id, "status": "ARCHIVED"},
        )
        return report

    def export_audit_log(self):
        audit_logs = self.repository.list_audit_logs()
        if not audit_logs:
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                "暂无审计日志可导出",
                field_errors=[{"field": "audit_log", "reason": "暂无审计日志可导出"}],
            )
        context = self._optional_export_context()
        if context["allocation"] and context["allocation_results"]:
            context["project"] = self.repository.update_project(project_status=ProjectStatus.EXPORTED.value)
        lines = [
            json.dumps(record, ensure_ascii=False, sort_keys=True)
            for record in self._audit_jsonl_records(audit_logs)
        ]
        content = "\n".join(lines) + "\n"
        return self._persist_report(
            report_type="P0_AUDIT_LOG_EXPORT",
            primary_file_name="audit_log.jsonl",
            file_format=ReportFormat.JSONL.value,
            files=[("audit_log.jsonl", content)],
            context=context,
            operation_type="EXPORT_AUDIT_LOG",
        )

    def generate_md_dshap_audit(
        self,
        task_id=None,
        audit_module_code="REP",
        audit_menu_code="NAV_REPORT_EXPORT",
    ):
        context = self._optional_export_context()
        task = self._resolve_md_dshap_task(context, task_id)
        results = self.repository.list_md_dshap_results(task["task_id"])
        traces = self.repository.list_md_dshap_marginal_traces(task["task_id"])
        if not results:
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                "MD-DShap 任务尚无权重结果",
                field_errors=[{"field": "task_id", "reason": "请先完成 MD-DShap 权重计算"}],
            )
        context["project"] = self.repository.update_project(project_status=ProjectStatus.EXPORTED.value)
        payload = self._md_dshap_audit_payload(context, task, results, traces)
        markdown = self._md_dshap_audit_markdown(payload)
        json_content = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True)
        return self._persist_report(
            report_type="MD_DSHAP_AUDIT_REPORT",
            primary_file_name="md_dshap_audit_report.md",
            file_format=ReportFormat.MARKDOWN.value,
            files=[
                ("md_dshap_audit_report.md", markdown),
                ("md_dshap_audit_report.json", json_content),
            ],
            context=context,
            operation_type="EXPORT_MD_DSHAP_AUDIT",
            audit_module_code=audit_module_code,
            audit_menu_code=audit_menu_code,
        )

    def _final_export_context(self):
        ProjectStateMachine(self.repository).require_report_export_allowed()
        context = self._optional_export_context()
        project = context["project"]
        if not context["allocation"] or not context["allocation_results"]:
            raise self._allocation_precondition_error()
        return context

    def _optional_export_context(self):
        project = self.repository.get_project()
        packages = self.repository.list_data_packages()
        resources = self.repository.list_data_resources()
        parties = self.repository.list_parties()
        quality = self._latest(self.repository.list_quality_assessments())
        metering = self._latest(self.repository.list_shuyuan_meterings())
        utility = self._latest(self.repository.list_utility_records())
        md_task = self._latest_md_task(project)
        allocation = self._latest_allocation(project)
        allocation_results = self._latest_version_rows(
            self.repository.list_allocation_results(allocation["allocation_id"])
            if allocation
            else []
        )
        data_provider_allocations = [
            item for item in allocation_results if item.get("subject_track") == "DATA_PROVIDER_POOL"
        ]
        constraint_traces = self._latest_version_rows(
            self.repository.list_constraint_apply_traces(allocation["allocation_id"])
            if allocation
            else []
        )
        contract_ratio_plan = (
            self.repository.get_contract_ratio_plan(allocation.get("contract_ratio_plan_id"))
            if allocation and allocation.get("contract_ratio_plan_id")
            else None
        )
        contract_ratio_items = (
            self.repository.list_contract_ratio_items(contract_ratio_plan["plan_id"])
            if contract_ratio_plan
            else []
        )
        return {
            "project": project,
            "packages": packages,
            "resources": resources,
            "parties": parties,
            "quality": quality,
            "quality_details": self.repository.get_quality_details(quality["assessment_id"])
            if quality
            else [],
            "metering": metering,
            "metering_details": self.repository.get_shuyuan_metering_details(metering["metering_id"])
            if metering
            else [],
            "contribution_records": self._latest_contribution_records(),
            "utility": utility,
            "utility_traces": self.repository.get_utility_traces(utility["utility_id"]) if utility else [],
            "md_task": md_task,
            "md_results": self.repository.list_md_dshap_results(md_task["task_id"]) if md_task else [],
            "allocation": allocation,
            "contract_ratio_plan": contract_ratio_plan,
            "contract_ratio_items": contract_ratio_items,
            "contract_priority_allocations": (allocation or {}).get("contract_priority_allocations", []),
            "allocation_priority_items": self.repository.list_allocation_priority_items(
                allocation["allocation_id"] if allocation else None
            ),
            "allocation_results": allocation_results,
            "data_provider_allocations": data_provider_allocations,
            "constraints": self.repository.list_contract_constraints(),
            "constraint_traces": constraint_traces,
            "snapshots": self.repository.list_snapshots(),
        }

    def _allocation_precondition_error(self):
        return ApiError(
            "DVAS_PRECONDITION_NOT_MET",
            "请先完成收益分配模拟",
            field_errors=[{"field": "allocation_result", "reason": "请先完成收益分配模拟"}],
        )

    def _persist_report(
        self,
        report_type,
        primary_file_name,
        file_format,
        files,
        context,
        operation_type,
        audit_module_code="REP",
        audit_menu_code="NAV_REPORT_EXPORT",
    ):
        now = utc_now()
        operator_id = current_operator_id(self.repository)
        project = context["project"]
        report_id = self.repository.next_id("report")
        report_dir = self._prepare_report_dir(report_id)
        export_files = []
        for file_name, content in files:
            file_path = report_dir / file_name
            file_path.parent.mkdir(parents=True, exist_ok=True)
            raw_content = content if isinstance(content, bytes) else content.encode("utf-8")
            file_path.write_bytes(raw_content)
            export_files.append(
                {
                    "export_file_id": self.repository.next_id("export_file"),
                    "report_id": report_id,
                    "project_id": project["project_id"],
                    "file_name": file_name,
                    "file_format": self._format_for_file(file_name, file_format),
                    "file_path": str(file_path),
                    "checksum": hashlib.sha256(raw_content).hexdigest(),
                    "byte_size": len(raw_content),
                    "created_by": operator_id,
                    "created_at": now,
                    "simulation_disclaimer": SIMULATION_DISCLAIMER,
                }
            )
        primary = next(item for item in export_files if item["file_name"] == primary_file_name)
        source_snapshot_id = self._source_snapshot_id(context)
        report_snapshot_id = self.repository.next_id("snapshot")
        report_snapshot = self._snapshot(
            report_snapshot_id,
            "REPORT",
            {
                "report_id": report_id,
                "report_type": report_type,
                "file_names": [item["file_name"] for item in export_files],
                "source_snapshot_id": source_snapshot_id,
            },
            now,
        )
        report = {
            "report_id": report_id,
            "project_id": project["project_id"],
            "report_type": report_type,
            "file_name": primary["file_name"],
            "file_format": file_format,
            "file_path": primary["file_path"],
            "checksum": primary["checksum"],
            "created_by": operator_id,
            "created_at": now,
            "source_snapshot_id": source_snapshot_id,
            "report_snapshot_id": report_snapshot_id,
            "export_file_ids": [item["export_file_id"] for item in export_files],
            "status": "ACTIVE",
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        }
        self.repository.put_snapshot(report_snapshot)
        self.repository.put_report_record(report)
        self.repository.put_export_files(export_files)
        write_audit(
            self.repository,
            module_code=audit_module_code,
            menu_code=audit_menu_code,
            operation_type=operation_type,
            object_type="report_record",
            object_id=report_id,
            status="SUCCESS",
            input_snapshot_id=context["project"].get("current_input_snapshot_id"),
            result_snapshot_id=report_snapshot_id,
            after_value_json={"report": report, "export_files": export_files},
        )
        return {
            "project_id": project["project_id"],
            "project_status": project["project_status"],
            "report": report,
            "export_files": export_files,
        }

    def _persist_report_manifest(self, report, export_files, context):
        manifest = {
            "report_id": report["report_id"],
            "project_id": report["project_id"],
            "report_type": report["report_type"],
            "file_format": report["file_format"],
            "status": report.get("status", "ACTIVE"),
            "created_at": report["created_at"],
            "source_snapshot_id": report.get("source_snapshot_id"),
            "report_snapshot_id": report.get("report_snapshot_id"),
            "export_files": [
                {
                    "export_file_id": item["export_file_id"],
                    "file_name": item["file_name"],
                    "file_format": item["file_format"],
                    "checksum": item["checksum"],
                    "byte_size": item["byte_size"],
                }
                for item in export_files
            ],
            "allocation_id": (context.get("allocation") or {}).get("allocation_id"),
            "algorithm_task_id": (context.get("md_task") or {}).get("task_id"),
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        }
        return self.repository.put_report_manifest(manifest)

    def _resolve_md_dshap_task(self, context, task_id=None):
        resolved_task_id = task_id or context["project"].get("current_algorithm_task_id")
        if not resolved_task_id:
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                "请先完成 MD-DShap 权重计算",
                field_errors=[{"field": "task_id", "reason": "缺少 current_algorithm_task_id"}],
            )
        task = self.repository.get_md_dshap_task(resolved_task_id)
        if not task:
            raise ApiError("DVAS_NOT_FOUND", "MD-DShap 任务不存在", status=404)
        return task

    def _md_dshap_audit_payload(self, context, task, results, traces):
        return {
            "report_type": "MD_DSHAP_AUDIT_REPORT",
            "project": {
                "project_id": context["project"]["project_id"],
                "project_name": context["project"]["project_name"],
                "project_status": context["project"]["project_status"],
            },
            "algorithm_mode": task["algorithm_mode"],
            "algorithm_version": task["algorithm_version"],
            "participant_set": task["participant_set"],
            "task_set": task["task_set"],
            "utility_function_source": {
                "source": "utility_records + utility_traces",
                "utility_id": (context["utility"] or {}).get("utility_id"),
                "trace_count": len(context["utility_traces"]),
                "description": "效用值来自质量、数元计量、贡献度和场景信号的 P0 确定性模拟链路。",
            },
            "parameters": {
                "seed": task["seed"],
                "sample_rounds": task["sample_rounds"],
                "epsilon": task["epsilon"],
                "baseline_enabled": task["baseline_enabled"],
            },
            "approximation_note": task["approximation_note"],
            "participant_weight": [
                {
                    "party_id": result["party_id"],
                    "party_name": result["party_name"],
                    "participant_weight": self._weight_text(result["participant_weight"]),
                    "normalized_weight": self._weight_text(result["normalized_weight"]),
                    "baseline_weight": self._optional_weight_text(result.get("baseline_weight")),
                    "weight_diff": self._optional_weight_text(result.get("weight_diff")),
                }
                for result in results
            ],
            "marginal_trace_summary": {
                "trace_count": len(traces),
                "sample_rows": traces[:10],
            },
            "snapshot_refs": {
                "parameter_snapshot_id": task.get("parameter_snapshot_id"),
                "result_snapshot_id": task.get("result_snapshot_id"),
                "algorithm_audit_snapshot_id": task.get("algorithm_audit_snapshot_id"),
            },
            "checksum_note": "校验值由 export_files.checksum 记录，随 report_id 一起返回。",
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        }

    def _md_dshap_audit_markdown(self, payload):
        lines = [
            "# MD-DShap 算法审计说明",
            "",
            "## 模拟参考声明",
            f"- {payload['simulation_disclaimer']}",
            "",
            "## 算法信息",
            f"- algorithm_mode: {payload['algorithm_mode']}",
            f"- algorithm_version: {payload['algorithm_version']}",
            f"- task_set: {', '.join(payload['task_set'])}",
            f"- approximation_note: {payload['approximation_note']}",
            "",
            "## 参数",
        ]
        for key, value in payload["parameters"].items():
            lines.append(f"- {key}: {value}")
        lines.extend(
            [
                "",
                "## 效用函数来源",
                f"- source: {payload['utility_function_source']['source']}",
                f"- utility_id: {payload['utility_function_source']['utility_id']}",
                f"- trace_count: {payload['utility_function_source']['trace_count']}",
                f"- description: {payload['utility_function_source']['description']}",
                "",
                "## 参与方集合",
            ]
        )
        for participant in payload["participant_set"]:
            lines.append(
                f"- {participant['party_id']} / {participant['party_name']} / {participant['party_type']}"
            )
        lines.append("")
        lines.append("## 参与方权重")
        for row in payload["participant_weight"]:
            lines.append(
                f"- {row['party_id']} / {row['party_name']}: "
                f"participant_weight={row['participant_weight']}, "
                f"normalized_weight={row['normalized_weight']}, "
                f"baseline_weight={row['baseline_weight']}, "
                f"weight_diff={row['weight_diff']}"
            )
        lines.extend(
            [
                "",
                "## 边际贡献轨迹摘要",
                f"- trace_count: {payload['marginal_trace_summary']['trace_count']}",
                "",
                "## 快照引用",
            ]
        )
        for key, value in payload["snapshot_refs"].items():
            lines.append(f"- {key}: {value}")
        lines.extend(
            [
                "",
                "## 报告与校验",
                f"- {payload['checksum_note']}",
                "",
            ]
        )
        return "\n".join(lines)

    def _markdown_content(self, context):
        project = context["project"]
        package_count = len(context["packages"])
        resource_count = len(context["resources"])
        party_count = len(context["parties"])
        quality = context["quality"] or {}
        metering = context["metering"] or {}
        utility = context["utility"] or {}
        md_task = context["md_task"] or {}
        allocation = context["allocation"] or {}
        contract_ratio_plan = context["contract_ratio_plan"] or {}
        contract_ratio_items = context["contract_ratio_items"]
        lines = [
            "# 数据收益分配系统 P0 模拟参考报告",
            "",
            "## 项目概览",
            f"- 项目ID: {project['project_id']}",
            f"- 项目名称: {project['project_name']}",
            f"- 当前状态: {project['project_status']}",
            "",
            "## 模拟参考声明",
            f"- {self.EXTENDED_DISCLAIMER}",
            "",
            "## 数据包与资源摘要",
            f"- 数据包数量: {package_count}",
            f"- 数据资源数量: {resource_count}",
            f"- 参与方数量: {party_count}",
            "",
            "## 质量评估摘要",
            f"- 质量评分: {quality.get('quality_score', 'N/A')}",
            f"- 质量等级: {quality.get('quality_level', 'N/A')}",
            f"- 质量因子: {quality.get('quality_factor', 'N/A')}",
            "",
            "## 数元计量摘要",
            f"- 数元计量ID: {metering.get('metering_id', 'N/A')}",
            f"- 计量金额: {self._amount_text(metering.get('metering_amount'))}",
            "",
            "## 贡献度与效用摘要",
            f"- 贡献记录数: {len(context['contribution_records'])}",
            f"- 效用ID: {utility.get('utility_id', 'N/A')}",
            f"- 效用值: {utility.get('utility_value', 'N/A')}",
            "",
            "## MD-DShap 权重摘要",
            f"- 任务ID: {md_task.get('task_id', 'N/A')}",
            f"- 算法版本: {md_task.get('algorithm_version', 'N/A')}",
            "- 权重来源: MD-DShap，用于数据源主体收益池分配；非数据源主体不进入权重池。",
        ]
        for result in context["md_results"]:
            lines.append(
                f"- {result['party_name']}: {float(result['normalized_weight']):.6f}"
            )
        lines.extend(
            [
                "",
                "## 收益分配模拟结果摘要",
                f"- 模拟方案ID: {allocation.get('allocation_id', 'N/A')}",
                f"- 总收益: {self._amount_text(allocation.get('total_revenue'))}",
            ]
        )
        if contract_ratio_plan:
            lines.extend(
                [
                    "- 分配顺序: 总收益先按已保存合同比例方案划分非数据主体合同金额与数据源收益池；数据源收益池再按 MD-DShap 归一化权重分配给数据源主体。",
                    f"- 合同比例方案ID: {contract_ratio_plan.get('plan_id', 'N/A')}",
                    f"- 合同比例合计: {contract_ratio_plan.get('ratio_sum', 'N/A')}",
                    f"- 数据源收益池比例: {contract_ratio_plan.get('data_provider_pool_ratio', 'N/A')}",
                    f"- 非数据主体合同金额: {self._amount_text(allocation.get('non_data_contract_amount', allocation.get('priority_allocation_amount')))}",
                    f"- 数据源收益池: {self._amount_text(allocation.get('data_provider_revenue_pool'))}",
                ]
            )
            for item in contract_ratio_items:
                lines.append(
                    f"- 合同比例/{item['party_name']}: ratio={item['ratio']}, "
                    f"amount={self._amount_text(item['calculated_amount'])}, amount_source={item['amount_source']}"
                )
        else:
            lines.extend(
                [
                    "- 分配顺序: 总收益先按合同约定向非数据源主体执行优先分配并受上限约束；扣除后形成数据源主体收益池，再按 MD-DShap 权重对数据源主体分配。",
                    f"- 非数据源主体合同优先分配合计: {self._amount_text(allocation.get('priority_allocation_amount'))}",
                    f"- 数据源收益池: {self._amount_text(allocation.get('data_provider_revenue_pool'))}",
                    f"- 普通合同约束调整记录数: {len(context['constraint_traces'])}",
                ]
            )
            for priority in context["contract_priority_allocations"]:
                lines.append(
                    f"- 合同优先/{priority['party_name']}: requested={self._amount_text(priority['requested_amount'])}, "
                    f"cap={self._amount_text(priority['cap_amount'])}, actual={self._amount_text(priority['actual_priority_amount'])}"
                )
        for result in context["allocation_results"]:
            lines.append(
                f"- {result['party_name']}: {float(result['post_constraint_amount']):.2f}"
            )
        if contract_ratio_plan:
            lines.extend(
                [
                    "",
                    "## 合同分配规则追踪摘要",
                    "- 合同分配规则路径不生成 constraint_apply_trace；金额来源以 allocation_result.amount_source 标识。",
                    f"- 后端约束调整记录数: {len(context['constraint_traces'])}",
                ]
            )
        else:
            lines.extend(
                [
                    "",
                    "## 合同约束调整追踪摘要",
                    f"- 约束调整记录数: {len(context['constraint_traces'])}",
                ]
            )
            for trace in context["constraint_traces"]:
                lines.append(
                    f"- {trace['party_id']}: {trace['reason']}，调整 {float(trace['adjustment_amount']):.2f}"
                )
        lines.extend(
            [
                "",
                "## 假设与审计说明",
                "- P0 报告基于本地 JSON 状态、输入快照、参数快照、结果快照与审计日志生成。",
                "- 历史报告与导出文件不会静默覆盖；每次导出生成新的 report_id 与 checksum。",
                f"- 生成时间: {utc_now()}",
                "",
            ]
        )
        return "\n".join(lines)

    def _csv_files(self, context):
        allocation_headers = [
            "allocation_id",
            "project_id",
            "scenario_id",
            "party_id",
            "party_name",
            "party_type",
            "is_data_provider",
            "raw_weight",
            "normalized_weight",
            "contract_ratio",
            "base_pool_amount",
            "pre_constraint_amount",
            "post_constraint_amount",
            "final_amount",
            "amount_source",
            "constraint_adjustment_reason",
        ]
        allocation_rows = [
            {
                "allocation_id": row["allocation_id"],
                "project_id": row["project_id"],
                "scenario_id": row["allocation_id"],
                "party_id": row["party_id"],
                "party_name": row["party_name"],
                "party_type": row.get("party_type", ""),
                "is_data_provider": str(bool(row.get("is_data_provider"))).lower(),
                "raw_weight": self._weight_text(row["raw_weight"]),
                "normalized_weight": self._weight_text(row["normalized_weight"]),
                "contract_ratio": self._optional_weight_text(row.get("contract_ratio")),
                "base_pool_amount": self._amount_text(row.get("base_pool_amount")),
                "pre_constraint_amount": self._amount_text(row["pre_constraint_amount"]),
                "post_constraint_amount": self._amount_text(row["post_constraint_amount"]),
                "final_amount": self._amount_text(row.get("final_amount", row["post_constraint_amount"])),
                "amount_source": row.get("amount_source", ""),
                "constraint_adjustment_reason": row["constraint_adjustment_reason"],
            }
            for row in context["allocation_results"]
        ]
        files = [
            (
                "source_level_allocation.csv",
                self._csv_content(allocation_headers, allocation_rows),
            ),
            (
                "allocation_result.csv",
                self._csv_content(allocation_headers, allocation_rows),
            ),
        ]
        if context["quality"]:
            files.append(
                (
                    "quality_assessment_summary.csv",
                    self._csv_content(
                        [
                            "assessment_id",
                            "quality_score",
                            "quality_level",
                            "quality_factor",
                            "output_snapshot_id",
                        ],
                        [
                            {
                                "assessment_id": context["quality"]["assessment_id"],
                                "quality_score": self._amount_text(context["quality"]["quality_score"]),
                                "quality_level": context["quality"]["quality_level"],
                                "quality_factor": self._weight_text(context["quality"]["quality_factor"]),
                                "output_snapshot_id": context["quality"]["output_snapshot_id"],
                            }
                        ],
                    ),
                )
            )
        if context["metering_details"]:
            files.append(
                (
                    "shuyuan_metering_detail.csv",
                    self._csv_content(
                        [
                            "metering_id",
                            "resource_id",
                            "party_id",
                            "party_name",
                            "valid_units",
                            "metering_amount",
                        ],
                        [
                            {
                                "metering_id": context["metering"]["metering_id"],
                                "resource_id": row["resource_id"],
                                "party_id": row["party_id"],
                                "party_name": row["party_name"],
                                "valid_units": row["valid_units"],
                                "metering_amount": self._amount_text(row["metering_amount"]),
                            }
                            for row in context["metering_details"]
                        ],
                    ),
                )
            )
        if context["md_results"]:
            files.append(
                (
                    "md_dshap_weights.csv",
                    self._csv_content(
                        [
                            "task_id",
                            "party_id",
                            "party_name",
                            "participant_weight",
                            "normalized_weight",
                            "baseline_weight",
                            "weight_diff",
                        ],
                        [
                            {
                                "task_id": row["task_id"],
                                "party_id": row["party_id"],
                                "party_name": row["party_name"],
                                "participant_weight": self._weight_text(row["participant_weight"]),
                                "normalized_weight": self._weight_text(row["normalized_weight"]),
                                "baseline_weight": self._optional_weight_text(row["baseline_weight"]),
                                "weight_diff": self._optional_weight_text(row["weight_diff"]),
                            }
                            for row in context["md_results"]
                        ],
                    ),
                )
            )
        if context["constraint_traces"]:
            files.append(
                (
                    "constraint_apply_trace.csv",
                    self._csv_content(
                        [
                            "allocation_id",
                            "constraint_id",
                            "party_id",
                            "before_amount",
                            "after_amount",
                            "adjustment_amount",
                            "reason",
                            "version_no",
                        ],
                        [
                            {
                                "allocation_id": row["allocation_id"],
                                "constraint_id": row["constraint_id"],
                                "party_id": row["party_id"],
                                "before_amount": self._amount_text(row["before_amount"]),
                                "after_amount": self._amount_text(row["after_amount"]),
                                "adjustment_amount": self._amount_text(row["adjustment_amount"]),
                                "reason": row["reason"],
                                "version_no": row["version_no"],
                            }
                            for row in context["constraint_traces"]
                        ],
                    ),
                )
            )
        return files

    def _json_payload(self, context):
        project = context["project"]
        allocation = context["allocation"]
        return {
            "project_id": project["project_id"],
            "scenario_id": allocation["allocation_id"] if allocation else None,
            "allocation_id": allocation["allocation_id"] if allocation else None,
            "generated_at": utc_now(),
            "project_status": project["project_status"],
            "total_revenue": allocation["total_revenue"] if allocation else None,
            "contract_ratio_plan": context["contract_ratio_plan"],
            "contract_ratio_items": context["contract_ratio_items"],
            "priority_allocation": context["contract_priority_allocations"],
            "priority_allocation_amount": allocation.get("priority_allocation_amount") if allocation else None,
            "non_data_contract_amount": allocation.get("non_data_contract_amount") if allocation else None,
            "data_provider_revenue_pool": allocation["data_provider_revenue_pool"] if allocation else None,
            "allocation_mode": allocation.get("allocation_mode") if allocation else None,
            "weight_source": "MD-DShap",
            "results": context["allocation_results"],
            "constraints": context["constraints"],
            "rounding_note": "金额保留 2 位小数；尾差写入 result.rounding_delta。",
            "input_snapshot_refs": self._snapshot_refs(context, {"INPUT"}),
            "parameter_snapshot_refs": self._snapshot_refs(context, {"PARAMETER"}),
            "result_snapshot_refs": self._snapshot_refs(
                context,
                {"RESULT", "ALGORITHM_AUDIT", "REPORT"},
            ),
            "quality_result": {
                "assessment": context["quality"],
                "details": context["quality_details"],
            },
            "metering_result": {
                "metering": context["metering"],
                "details": context["metering_details"],
            },
            "utility_result": {
                "utility": context["utility"],
                "trace": context["utility_traces"],
            },
            "md_dshap_result": {
                "task": context["md_task"],
                "results": context["md_results"],
            },
            "allocation_summary": {
                "total_revenue": allocation["total_revenue"] if allocation else None,
                "priority_allocation_amount": allocation.get("priority_allocation_amount") if allocation else None,
                "total_contract_priority_amount": allocation.get("priority_allocation_amount") if allocation else None,
                "contract_ratio_plan_id": allocation.get("contract_ratio_plan_id") if allocation else None,
                "contract_ratio_sum": allocation.get("contract_ratio_sum") if allocation else None,
                "data_provider_pool_ratio": allocation.get("data_provider_pool_ratio") if allocation else None,
                "non_data_contract_amount": allocation.get("non_data_contract_amount") if allocation else None,
                "data_provider_revenue_pool": allocation["data_provider_revenue_pool"] if allocation else None,
                "weight_source": "MD-DShap",
                "currency": allocation.get("currency") if allocation else None,
            },
            "contract_priority_allocations": context["contract_priority_allocations"],
            "allocation_priority_items": context["allocation_priority_items"],
            "data_provider_allocations": context["data_provider_allocations"],
            "allocation_result": context["allocation_results"],
            "constraint_trace": context["constraint_traces"],
            "assumptions": [
                "P0 本地演示使用确定性骨架公式和本地 JSON 状态。",
                "合同分配规则路径下，非数据主体金额与数据源收益池来自已保存合同比例方案。",
                "MD-DShap 为数据源主体权重层输出，不直接处理非数据源合同主体或总收益金额。",
            ],
            "disclaimer": self.EXTENDED_DISCLAIMER,
        }

    def _audit_jsonl_records(self, audit_logs):
        records = []
        for audit_log in audit_logs:
            records.append({"record_type": "audit_log", **audit_log})
        for report in self.repository.list_report_records():
            records.append({"record_type": "report_record", **report})
        for export_file in self.repository.list_export_files():
            records.append({"record_type": "export_file", **export_file})
        return records

    def _csv_content(self, headers, rows):
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=headers)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
        return output.getvalue()

    def _pdf_bytes(self, markdown):
        lines = [
            "DVAS P1 Simulation Reference Report",
            "Simulation reference only; not legal settlement or payment instruction.",
            "Chinese disclaimer is embedded in the PDF metadata/comment for audit trace.",
            self.EXTENDED_DISCLAIMER,
            "",
        ]
        for line in markdown.splitlines():
            normalized = line.replace("#", "").replace("*", "").strip()
            if normalized:
                lines.append(normalized)
            if len(lines) >= 36:
                break
        text = "\n".join(lines)
        safe_lines = [
            line.encode("latin-1", errors="ignore").decode("latin-1") or "DVAS simulation reference"
            for line in text.splitlines()
        ]
        content_lines = ["BT", "/F1 10 Tf", "72 760 Td"]
        for index, line in enumerate(safe_lines[:42]):
            escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            if index:
                content_lines.append("0 -16 Td")
            content_lines.append(f"({escaped}) Tj")
        content_lines.append("ET")
        stream = "\n".join(content_lines).encode("latin-1")
        chinese_comment = f"% {self.EXTENDED_DISCLAIMER}\n".encode("utf-8")
        objects = [
            b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
            b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
            b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n",
            b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
            b"5 0 obj << /Length " + str(len(stream)).encode("ascii") + b" >> stream\n" + stream + b"\nendstream endobj\n",
        ]
        output = io.BytesIO()
        output.write(b"%PDF-1.4\n")
        output.write(chinese_comment)
        offsets = [0]
        for obj in objects:
            offsets.append(output.tell())
            output.write(obj)
        xref_pos = output.tell()
        output.write(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
        output.write(b"0000000000 65535 f \n")
        for offset in offsets[1:]:
            output.write(f"{offset:010d} 00000 n \n".encode("ascii"))
        output.write(
            (
                f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\n"
                f"startxref\n{xref_pos}\n%%EOF\n"
            ).encode("ascii")
        )
        return output.getvalue()

    def _latest(self, items):
        return items[-1] if items else None

    def _latest_md_task(self, project):
        task_id = project.get("current_algorithm_task_id")
        task = self.repository.get_md_dshap_task(task_id) if task_id else None
        if task:
            return task
        return self._latest(self.repository.list_md_dshap_tasks())

    def _latest_allocation(self, project):
        allocation_id = project.get("current_allocation_id")
        allocation = self.repository.get_allocation_scenario(allocation_id) if allocation_id else None
        if allocation:
            return allocation
        return self._latest(self.repository.list_allocation_scenarios())

    def _latest_contribution_records(self):
        records = self.repository.list_contribution_records()
        if not records:
            return []
        latest_run_id = records[-1]["contribution_run_id"]
        return [item for item in records if item["contribution_run_id"] == latest_run_id]

    def _latest_version_rows(self, rows):
        if not rows:
            return []
        latest_version = max(int(row.get("version_no", 0)) for row in rows)
        return [row for row in rows if int(row.get("version_no", 0)) == latest_version]

    def _source_snapshot_id(self, context):
        allocation = context.get("allocation") or {}
        return (
            allocation.get("result_snapshot_id")
            or context["project"].get("current_input_snapshot_id")
            or self.repository.next_id("snapshot")
        )

    def _snapshot_refs(self, context, snapshot_types):
        refs = []
        seen = set()
        for snapshot in context["snapshots"]:
            if snapshot["snapshot_type"] not in snapshot_types:
                continue
            snapshot_id = snapshot["snapshot_id"]
            if snapshot_id in seen:
                continue
            seen.add(snapshot_id)
            refs.append(
                {
                    "snapshot_id": snapshot_id,
                    "snapshot_type": snapshot["snapshot_type"],
                    "checksum": snapshot["checksum"],
                    "created_at": snapshot["created_at"],
                }
            )
        return refs

    def _snapshot(self, snapshot_id, snapshot_type, content, now):
        return {
            "snapshot_id": snapshot_id,
            "project_id": self.repository.get_project()["project_id"],
            "snapshot_type": snapshot_type,
            "content_json": copy.deepcopy(content),
            "checksum": stable_checksum(content),
            "created_by": current_operator_id(self.repository),
            "created_at": now,
        }

    def _export_root(self):
        return Path(getattr(self.repository, "runtime_dir", "backend/runtime")) / P0_CONFIG.default_export_dir

    def _prepare_report_dir(self, report_id):
        export_root = self._export_root()
        report_dir = export_root / report_id
        suffix = 1
        while True:
            try:
                report_dir.mkdir(parents=True, exist_ok=False)
                return report_dir
            except FileExistsError:
                suffix += 1
                report_dir = export_root / f"{report_id}_{suffix}"

    def _format_for_file(self, file_name, default):
        suffix = Path(file_name).suffix.lower()
        if suffix == ".md":
            return ReportFormat.MARKDOWN.value
        if suffix == ".csv":
            return ReportFormat.CSV.value
        if suffix == ".json":
            return ReportFormat.JSON.value
        if suffix == ".jsonl":
            return ReportFormat.JSONL.value
        if suffix == ".pdf":
            return "PDF"
        return default

    def _amount_text(self, value):
        if value is None:
            return "N/A"
        return f"{float(value):.2f}"

    def _weight_text(self, value):
        return f"{float(value):.6f}"

    def _optional_weight_text(self, value):
        if value is None:
            return ""
        return self._weight_text(value)
