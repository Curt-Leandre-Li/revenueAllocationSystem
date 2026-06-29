import json
import tempfile
import unittest
import base64
import csv
import hashlib
import io
from pathlib import Path

from backend.dvas.app import DvasApplication
from backend.dvas.contracts import ApiError
from backend.dvas.constants import (
    AllocationMode,
    AlgorithmMode,
    ContractConstraintType,
    ProjectStatus,
    ReportFormat,
    SnapshotType,
)
from backend.dvas.persistence_mapping import (
    assert_runtime_enums_mapped,
    assert_sql_enums_mapped,
    runtime_to_sql_enum,
    sql_to_runtime_enum,
)
from backend.dvas.repository import (
    InMemoryRepository,
    QUALITY_PRIMARY_METRICS,
    QUALITY_SECONDARY_METRICS,
)


class DvasApiContractTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.repository = InMemoryRepository()
        self.repository.runtime_dir = Path(self.temp_dir.name)
        self.app = DvasApplication(self.repository)

    def tearDown(self):
        self.temp_dir.cleanup()

    def request(self, method, path, body=None):
        return self.app.handle(method, path, body)

    def http_json(self, method, path, body=None, token=None):
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        status, _headers, raw_body = self.app.handle_http(
            method,
            path,
            json.dumps(body or {}).encode("utf-8") if body is not None else b"",
            headers,
        )
        response = json.loads(raw_body.decode("utf-8"))
        response["_http_status"] = status
        return response

    def multipart_upload(self, path, filename, content, token=None):
        boundary = "----DVASTestBoundary"
        raw_body = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
            "Content-Type: application/json\r\n\r\n"
        ).encode("utf-8") + content + f"\r\n--{boundary}--\r\n".encode("utf-8")
        status, _headers, body = self.app.handle_http(
            "POST",
            path,
            raw_body,
            {
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                **({"Authorization": f"Bearer {token}"} if token else {}),
            },
        )
        response = json.loads(body.decode("utf-8"))
        response["_http_status"] = status
        return response

    def assert_ok(self, response):
        self.assertTrue(response["success"], response)
        self.assertEqual("OK", response["code"])
        self.assertIn("trace_id", response)
        self.assertIn("data", response)
        return response["data"]

    def assert_no_sensitive_password_fields(self, value):
        sensitive = {
            "password",
            "password_hash",
            "initial_password",
            "temporary_password",
            "current_password",
            "new_password",
            "confirm_password",
            "one_time_initial_password",
            "one_time_temporary_password",
        }
        if isinstance(value, dict):
            for key, item in value.items():
                self.assertNotIn(key, sensitive)
                self.assert_no_sensitive_password_fields(item)
        elif isinstance(value, list):
            for item in value:
                self.assert_no_sensitive_password_fields(item)

    def login_token(self, username="admin", password="admin123"):
        data = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/auth/login",
                {"username": username, "password": password},
            )
        )
        return data["token"]

    def test_p1_dev_accounts_seed_roles_and_permissions(self):
        expected_accounts = {
            "admin": "SYSTEM_ADMIN",
            "biz_admin": "BUSINESS_ADMIN",
            "algo_reviewer": "ALGORITHM_REVIEWER",
            "contract_reviewer": "CONTRACT_REVIEWER",
            "auditor": "AUDITOR",
            "viewer": "VIEWER",
        }

        for username, role_id in expected_accounts.items():
            user = self.repository.get_user_account(username)
            self.assertIsNotNone(user, username)
            self.assertEqual([role_id], self.repository.user_role_ids(user["user_id"]))
            self.assertTrue(self.repository.get_role(role_id))
            self.assertTrue(self.repository.get_role_permission_codes(role_id))

    def test_p1_auth_me_requires_login_and_system_users_requires_admin_permission(self):
        me_without_token = self.request("GET", "/api/v1/auth/me")
        self.assertFalse(me_without_token["success"])
        self.assertEqual("DVAS_AUTH_REQUIRED", me_without_token["code"])

        viewer_token = self.login_token("viewer", "viewer123")
        viewer_users = self.request(
            "GET",
            "/api/v1/system/users",
            {"_auth_token": viewer_token},
        )
        self.assertFalse(viewer_users["success"])
        self.assertEqual("DVAS_PERMISSION_DENIED", viewer_users["code"])

        viewer_parameters = self.request(
            "GET",
            "/api/v1/system/parameters",
            {"_auth_token": viewer_token},
        )
        self.assertFalse(viewer_parameters["success"])
        self.assertEqual("DVAS_PERMISSION_DENIED", viewer_parameters["code"])

        admin_token = self.login_token("admin", "admin123")
        admin_users = self.assert_ok(
            self.request(
                "GET",
                "/api/v1/system/users",
                {"_auth_token": admin_token},
            )
        )
        self.assertTrue(any(item["username"] == "viewer" for item in admin_users["items"]))

    def test_p1_upload_and_audit_use_current_login_user(self):
        token = self.login_token("biz_admin", "biz123")
        upload = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/data-packages/upload",
                {
                    "_auth_token": token,
                    "package_name": "biz admin upload",
                    "resources": [
                        {
                            "resource_name": "resource owned by biz admin",
                            "provider_party_name": "数据源主体 A",
                            "field_count": 3,
                            "sample_count": 20,
                        }
                    ],
                    "parties": [
                        {
                            "party_name": "数据源主体 A",
                            "party_type": "DATA_PROVIDER",
                            "is_data_provider": True,
                            "include_in_md_dshap": True,
                        }
                    ],
                },
            )
        )

        self.assertEqual("biz_admin", upload["package"]["created_by"])
        mine = self.assert_ok(
            self.request("GET", "/api/v1/my/uploads", {"_auth_token": token})
        )
        self.assertTrue(
            any(item["package_id"] == upload["package"]["package_id"] for item in mine["items"])
        )
        latest_audit = self.repository.list_audit_logs()[-1]
        self.assertEqual("biz_admin", latest_audit["operator_id"])

    def test_p1_http_business_api_requires_login_and_login_failure_is_audited(self):
        unauth_upload = self.http_json(
            "POST",
            "/api/v1/data-packages/upload",
            {"package_name": "blocked"},
        )
        self.assertFalse(unauth_upload["success"])
        self.assertEqual(401, unauth_upload["_http_status"])
        self.assertEqual("DVAS_AUTH_REQUIRED", unauth_upload["code"])

        failed_login = self.http_json(
            "POST",
            "/api/v1/auth/login",
            {"username": "admin", "password": "wrong-password"},
        )
        self.assertFalse(failed_login["success"])
        self.assertEqual(401, failed_login["_http_status"])
        self.assertEqual("DVAS_AUTH_FAILED", failed_login["code"])

        login_fail_audits = [
            item
            for item in self.repository.list_audit_logs()
            if item["operation_type"] == "LOGIN" and item["status"] == "FAILED"
        ]
        self.assertTrue(login_fail_audits)
        self.assertEqual("***REDACTED***", login_fail_audits[-1]["before_value_json"]["request"]["password"])

    def test_p1_forbidden_action_writes_audit_and_uses_standard_error(self):
        auditor_token = self.login_token("auditor", "audit123")
        forbidden_upload = self.http_json(
            "POST",
            "/api/v1/data-packages/upload",
            {"package_name": "auditor should not upload"},
            token=auditor_token,
        )

        self.assertFalse(forbidden_upload["success"])
        self.assertEqual(403, forbidden_upload["_http_status"])
        self.assertEqual("DVAS_PERMISSION_DENIED", forbidden_upload["code"])
        self.assertIn("error", forbidden_upload)
        latest_audit = self.repository.list_audit_logs()[-1]
        self.assertEqual("auditor", latest_audit["operator_id"])
        self.assertEqual("FAILED", latest_audit["status"])
        self.assertEqual("DVAS_PERMISSION_DENIED", latest_audit["error_code"])

    def test_p1_auth_me_and_my_content_filter_by_current_user(self):
        biz_token = self.login_token("biz_admin", "biz123")
        admin_token = self.login_token("admin", "admin123")
        viewer_token = self.login_token("viewer", "viewer123")

        me = self.assert_ok(self.request("GET", "/api/v1/auth/me", {"_auth_token": biz_token}))
        self.assertEqual("biz_admin", me["user"]["user_id"])
        self.assertEqual(["BUSINESS_ADMIN"], me["roles"])
        self.assertIn("NAV_DATA_PACKAGE", me["permissions"]["menu_codes"])

        biz_upload = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/data-packages/upload",
                {
                    "_auth_token": biz_token,
                    "package_name": "biz owned package",
                    "resources": [
                        {
                            "resource_name": "biz resource",
                            "provider_party_name": "Biz Provider",
                            "field_count": 2,
                            "sample_count": 10,
                        }
                    ],
                    "parties": [
                        {
                            "party_name": "Biz Provider",
                            "party_type": "DATA_PROVIDER",
                            "is_data_provider": True,
                            "include_in_md_dshap": True,
                        }
                    ],
                },
            )
        )
        admin_upload = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/data-packages/upload",
                {
                    "_auth_token": admin_token,
                    "package_name": "admin owned package",
                    "resources": [
                        {
                            "resource_name": "admin resource",
                            "provider_party_name": "Admin Provider",
                            "field_count": 2,
                            "sample_count": 10,
                        }
                    ],
                    "parties": [
                        {
                            "party_name": "Admin Provider",
                            "party_type": "DATA_PROVIDER",
                            "is_data_provider": True,
                            "include_in_md_dshap": True,
                        }
                    ],
                },
            )
        )
        self.assertEqual("admin", self.repository.get_project()["created_by"])
        self.assertEqual("biz_admin", biz_upload["package"]["created_by"])
        self.assertEqual("admin", admin_upload["package"]["created_by"])

        now = "2026-06-26T00:00:00Z"
        self.repository.put_data_package(
            {
                "package_id": "package_viewer_owned",
                "project_id": self.repository.get_project()["project_id"],
                "package_name": "viewer package",
                "source_type": "UPLOAD",
                "file_name": "viewer.json",
                "file_size": 10,
                "status": "VALIDATED",
                "input_snapshot_id": None,
                "validation_result_id": None,
                "checksum": "viewer_checksum",
                "created_by": "viewer",
                "created_at": now,
            }
        )
        self.repository.put_async_job(
            {
                "job_id": "job_viewer_owned",
                "project_id": self.repository.get_project()["project_id"],
                "job_type": "MD_DSHAP",
                "job_name": "viewer job",
                "status": "SUCCESS",
                "progress": 100,
                "can_cancel": False,
                "subject_id": "task_viewer_owned",
                "requested_by": "viewer",
                "created_by": "viewer",
                "created_at": now,
                "started_at": now,
                "completed_at": now,
                "cancelled_at": None,
                "failure_reason": None,
                "error_code": None,
                "result_json": {},
            }
        )
        self.repository.put_report_record(
            {
                "report_id": "report_viewer_owned",
                "project_id": self.repository.get_project()["project_id"],
                "report_type": "P0_JSON_EXPORT",
                "file_name": "viewer.json",
                "file_format": "JSON",
                "file_path": "viewer.json",
                "checksum": "viewer_report_checksum",
                "created_by": "viewer",
                "created_at": now,
                "source_snapshot_id": None,
                "report_snapshot_id": None,
                "export_file_ids": [],
                "status": "ACTIVE",
            }
        )

        viewer_uploads = self.assert_ok(self.request("GET", "/api/v1/my/uploads", {"_auth_token": viewer_token}))
        viewer_jobs = self.assert_ok(self.request("GET", "/api/v1/my/jobs", {"_auth_token": viewer_token}))
        viewer_reports = self.assert_ok(self.request("GET", "/api/v1/my/reports", {"_auth_token": viewer_token}))
        viewer_workbench = self.assert_ok(self.request("GET", "/api/v1/my/workbench", {"_auth_token": viewer_token}))

        self.assertEqual(["package_viewer_owned"], [item["package_id"] for item in viewer_uploads["items"]])
        self.assertEqual(["job_viewer_owned"], [item["job_id"] for item in viewer_jobs["items"]])
        self.assertEqual(["report_viewer_owned"], [item["report_id"] for item in viewer_reports["items"]])
        self.assertEqual(viewer_uploads["total"], viewer_workbench["summary"]["upload_count"])
        self.assertEqual(viewer_jobs["total"], viewer_workbench["summary"]["job_count"])
        self.assertEqual(viewer_reports["total"], viewer_workbench["summary"]["report_count"])

        admin_uploads = self.assert_ok(self.request("GET", "/api/v1/my/uploads", {"_auth_token": admin_token}))
        self.assertTrue(any(item["package_id"] == biz_upload["package"]["package_id"] for item in admin_uploads["items"]))
        self.assertTrue(any(item["package_id"] == admin_upload["package"]["package_id"] for item in admin_uploads["items"]))

    def test_p1_jobs_and_reports_created_by_current_user(self):
        biz_token = self.login_token("biz_admin", "biz123")
        admin_token = self.login_token("admin", "admin123")

        self.assert_ok(
            self.request(
                "POST",
                "/api/v1/data-packages/upload",
                {
                    "_auth_token": biz_token,
                    "package_name": "biz job package",
                    "resources": [
                        {
                            "resource_name": "biz job resource",
                            "provider_party_name": "Biz Job Provider",
                            "field_count": 2,
                            "sample_count": 10,
                        }
                    ],
                    "parties": [
                        {
                            "party_name": "Biz Job Provider",
                            "party_type": "DATA_PROVIDER",
                            "is_data_provider": True,
                            "include_in_md_dshap": True,
                        }
                    ],
                },
            )
        )
        project_id = self.repository.get_project()["project_id"]
        self.assert_ok(
            self.request(
                "PUT",
                f"/api/v1/projects/{project_id}/allocation/contract-ratio",
                {
                    "_auth_token": biz_token,
                    "total_revenue": "1000.00",
                    "currency": "CNY",
                    "data_provider_pool_ratio": "1.000000",
                    "items": [],
                },
            )
        )
        biz_job = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/projects/project_demo_001/jobs",
                {"_auth_token": biz_token},
            )
        )
        biz_report = self.assert_ok(
            self.request("POST", "/api/v1/reports/json", {"_auth_token": biz_token})
        )

        self.assert_ok(
            self.request(
                "POST",
                "/api/v1/projects/project_demo_001/jobs",
                {"_auth_token": admin_token},
            )
        )
        admin_report = self.assert_ok(
            self.request("POST", "/api/v1/reports/json", {"_auth_token": admin_token})
        )

        self.assertEqual("biz_admin", biz_job["job"]["requested_by"])
        self.assertEqual("biz_admin", biz_report["report"]["created_by"])
        self.assertEqual("admin", admin_report["report"]["created_by"])

        biz_mine_jobs = self.assert_ok(
            self.request("GET", "/api/v1/my/jobs?scope=mine", {"_auth_token": biz_token})
        )
        admin_mine_jobs = self.assert_ok(
            self.request("GET", "/api/v1/my/jobs?scope=mine", {"_auth_token": admin_token})
        )
        biz_mine_uploads = self.assert_ok(
            self.request("GET", "/api/v1/my/uploads?scope=mine", {"_auth_token": biz_token})
        )
        admin_mine_uploads = self.assert_ok(
            self.request("GET", "/api/v1/my/uploads?scope=mine", {"_auth_token": admin_token})
        )
        biz_mine_reports = self.assert_ok(
            self.request("GET", "/api/v1/my/reports?scope=mine", {"_auth_token": biz_token})
        )
        admin_mine_reports = self.assert_ok(
            self.request("GET", "/api/v1/my/reports?scope=mine", {"_auth_token": admin_token})
        )
        self.assertTrue(all(item.get("created_by") == "biz_admin" for item in biz_mine_uploads["items"]))
        self.assertTrue(all(item.get("created_by") == "admin" for item in admin_mine_uploads["items"]))
        self.assertTrue(all(item.get("requested_by") == "biz_admin" for item in biz_mine_jobs["items"]))
        self.assertTrue(all(item.get("requested_by") == "admin" for item in admin_mine_jobs["items"]))
        self.assertTrue(all(item.get("created_by") == "biz_admin" for item in biz_mine_reports["items"]))
        self.assertTrue(all(item.get("created_by") == "admin" for item in admin_mine_reports["items"]))
        md_tasks = self.repository.list_md_dshap_tasks()
        self.assertTrue(any(task.get("requested_by") == "biz_admin" for task in md_tasks))
        self.assertTrue(any(task.get("requested_by") == "admin" for task in md_tasks))

    def test_p1_admin_user_management_actions_are_backend_writes(self):
        admin_token = self.login_token("admin", "admin123")

        created = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/system/users",
                {
                    "_auth_token": admin_token,
                    "username": "validation_viewer",
                    "display_name": "Validation Viewer",
                    "email": "validation@example.test",
                    "initial_password": "Initial123",
                    "roles": ["VIEWER"],
                },
            )
        )
        user_id = created["user_id"]
        self.assertEqual(["VIEWER"], created["roles"])
        self.assertEqual("Initial123", created["one_time_initial_password"])
        self.assertNotIn("password_hash", created)
        self.assertNotIn("password", created)
        raw_user = self.repository.get_user_account(user_id)
        self.assertIn("password_hash", raw_user)
        self.assertNotIn("initial_password", raw_user)
        self.assertNotIn("password", raw_user)

        updated = self.assert_ok(
            self.request(
                "PATCH",
                f"/api/v1/system/users/{user_id}",
                {
                    "_auth_token": admin_token,
                    "display_name": "Validation Viewer Edited",
                    "roles": ["AUDITOR"],
                },
            )
        )
        self.assertEqual("Validation Viewer Edited", updated["display_name"])
        self.assertEqual(["AUDITOR"], self.repository.user_role_ids(user_id))

        reset = self.assert_ok(
            self.request(
                "POST",
                f"/api/v1/system/users/{user_id}/reset-password",
                {"_auth_token": admin_token, "temporary_password": "Reset123"},
            )
        )
        self.assertEqual("Reset123", reset["one_time_temporary_password"])
        self.assertNotIn("temporary_password", reset)
        self.assert_ok(
            self.request(
                "POST",
                "/api/v1/auth/login",
                {"username": "validation_viewer", "password": "Reset123"},
            )
        )

        disabled = self.assert_ok(
            self.request(
                "POST",
                f"/api/v1/system/users/{user_id}/disable",
                {"_auth_token": admin_token},
            )
        )
        self.assertEqual("DISABLED", disabled["status"])
        self.assertEqual("admin", disabled["disabled_by"])
        disable_audit = self.latest_audit("DISABLE")
        self.assertEqual("USER", disable_audit["module_code"])
        self.assertEqual("NAV_SYSTEM_USER", disable_audit["menu_code"])
        self.assertEqual(user_id, disable_audit["object_id"])
        self.assert_no_sensitive_password_fields(disable_audit.get("before_value_json"))
        self.assert_no_sensitive_password_fields(disable_audit.get("after_value_json"))
        disabled_login = self.request(
            "POST",
            "/api/v1/auth/login",
            {"username": "validation_viewer", "password": "Reset123"},
        )
        self.assertEqual("DVAS_AUTH_FAILED", disabled_login["code"])

        roles = self.assert_ok(self.request("GET", "/api/v1/system/roles", {"_auth_token": admin_token}))
        permissions = self.assert_ok(self.request("GET", "/api/v1/system/permissions", {"_auth_token": admin_token}))
        self.assertTrue(any(role["role_id"] == "VIEWER" for role in roles["items"]))
        self.assertTrue(any(permission["permission_code"] == "BTN_USER-002" for permission in permissions["items"]))
        next_permissions = sorted(
            set(self.repository.get_role_permission_codes("VIEWER")) | {"BTN_REP-001"}
        )
        role_update = self.assert_ok(
            self.request(
                "PUT",
                "/api/v1/system/roles/VIEWER/permissions",
                {"_auth_token": admin_token, "permission_codes": next_permissions},
            )
        )
        self.assertIn("BTN_REP-001", role_update["permission_codes"])

    def test_p1_user_password_security_backend_guards(self):
        admin_token = self.login_token("admin", "admin123")
        viewer_token = self.login_token("viewer", "viewer123")
        created = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/users",
                {
                    "_auth_token": admin_token,
                    "username": "guarded_viewer",
                    "display_name": "Guarded Viewer",
                    "email": "guarded@example.test",
                    "initial_password": "Guarded123",
                    "roles": ["VIEWER"],
                },
            )
        )
        user_id = created["user_id"]

        forbidden_disable = self.request(
            "POST",
            f"/api/v1/users/{user_id}/disable",
            {"_auth_token": viewer_token},
        )
        self.assertEqual("DVAS_PERMISSION_DENIED", forbidden_disable["code"])
        self.assertEqual("ENABLED", self.repository.get_user_account(user_id)["status"])

        forbidden_reset = self.request(
            "POST",
            f"/api/v1/users/{user_id}/reset-password",
            {"_auth_token": viewer_token, "temporary_password": "ViewerTry123"},
        )
        self.assertEqual("DVAS_PERMISSION_DENIED", forbidden_reset["code"])
        self.assertEqual("Guarded123", created["one_time_initial_password"])

        forbidden_create = self.request(
            "POST",
            "/api/v1/users",
            {
                "_auth_token": viewer_token,
                "username": "viewer_created",
                "initial_password": "ViewerCreate123",
                "roles": ["VIEWER"],
            },
        )
        self.assertEqual("DVAS_PERMISSION_DENIED", forbidden_create["code"])

        self_disable = self.request(
            "POST",
            "/api/v1/users/admin/disable",
            {"_auth_token": admin_token},
        )
        self.assertEqual("DVAS_PRECONDITION_NOT_MET", self_disable["code"])
        self.assertEqual("ENABLED", self.repository.get_user_account("admin")["status"])

        self.assert_ok(
            self.request(
                "POST",
                "/api/v1/users/local_operator/disable",
                {"_auth_token": admin_token},
            )
        )
        now = "2026-06-29T00:00:00Z"
        self.repository.state["roles"]["USER_MANAGER"] = {
            "role_id": "USER_MANAGER",
            "role_code": "USER_MANAGER",
            "role_name": "用户管理员",
            "description": "仅用于测试显式用户权限",
            "status": "ENABLED",
            "created_at": now,
            "updated_at": now,
        }
        manager = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/users",
                {
                    "_auth_token": admin_token,
                    "username": "user_manager",
                    "initial_password": "Manager123",
                    "roles": ["VIEWER"],
                },
            )
        )
        self.repository.set_user_roles(manager["user_id"], ["USER_MANAGER"])
        self.repository.set_role_permission_codes("USER_MANAGER", ["USER_DISABLE", "USER_CHANGE_OWN_PASSWORD"])
        manager_token = self.login_token("user_manager", "Manager123")
        last_admin_disable = self.request(
            "POST",
            "/api/v1/users/admin/disable",
            {"_auth_token": manager_token},
        )
        self.assertEqual("DVAS_PRECONDITION_NOT_MET", last_admin_disable["code"])
        self.assertEqual("ENABLED", self.repository.get_user_account("admin")["status"])

        guarded_token = self.login_token("guarded_viewer", "Guarded123")
        disabled = self.assert_ok(
            self.request(
                "POST",
                f"/api/v1/users/{user_id}/disable",
                {"_auth_token": admin_token},
            )
        )
        self.assertEqual("DISABLED", disabled["status"])
        disabled_me = self.request("GET", "/api/v1/auth/me", {"_auth_token": guarded_token})
        self.assertEqual("DVAS_AUTH_REQUIRED", disabled_me["code"])
        disabled_login = self.request(
            "POST",
            "/api/v1/auth/login",
            {"username": "guarded_viewer", "password": "Guarded123"},
        )
        self.assertEqual("DVAS_AUTH_FAILED", disabled_login["code"])

        users = self.assert_ok(self.request("GET", "/api/v1/users", {"_auth_token": admin_token}))
        detail = self.assert_ok(self.request("GET", f"/api/v1/users/{user_id}", {"_auth_token": admin_token}))
        me = self.assert_ok(self.request("GET", "/api/v1/users/me", {"_auth_token": admin_token}))
        self.assert_no_sensitive_password_fields(users)
        self.assert_no_sensitive_password_fields(detail)
        self.assert_no_sensitive_password_fields(me)

    def test_p1_user_change_own_password_and_audit_redaction(self):
        admin_token = self.login_token("admin", "admin123")
        created = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/users",
                {
                    "_auth_token": admin_token,
                    "username": "password_owner",
                    "initial_password": "OwnerOld123",
                    "roles": ["VIEWER"],
                },
            )
        )
        owner_token = self.login_token("password_owner", "OwnerOld123")

        wrong_old = self.request(
            "PUT",
            "/api/v1/users/me/password",
            {
                "_auth_token": owner_token,
                "current_password": "WrongOld123",
                "new_password": "OwnerNew123",
                "confirm_password": "OwnerNew123",
            },
        )
        self.assertEqual("DVAS_AUTH_FAILED", wrong_old["code"])

        same_password = self.request(
            "PUT",
            "/api/v1/users/me/password",
            {
                "_auth_token": owner_token,
                "current_password": "OwnerOld123",
                "new_password": "OwnerOld123",
                "confirm_password": "OwnerOld123",
            },
        )
        self.assertEqual("DVAS_PRECONDITION_NOT_MET", same_password["code"])

        mismatch = self.request(
            "PUT",
            "/api/v1/users/me/password",
            {
                "_auth_token": owner_token,
                "current_password": "OwnerOld123",
                "new_password": "OwnerNew123",
                "confirm_password": "OwnerNew999",
            },
        )
        self.assertEqual("DVAS_PASSWORD_CONFIRM_MISMATCH", mismatch["code"])

        weak = self.request(
            "PUT",
            "/api/v1/users/me/password",
            {
                "_auth_token": owner_token,
                "current_password": "OwnerOld123",
                "new_password": "short7",
                "confirm_password": "short7",
            },
        )
        self.assertEqual("DVAS_PASSWORD_WEAK", weak["code"])

        changed = self.assert_ok(
            self.request(
                "PUT",
                "/api/v1/users/me/password",
                {
                    "_auth_token": owner_token,
                    "current_password": "OwnerOld123",
                    "new_password": "OwnerNew123",
                    "confirm_password": "OwnerNew123",
                },
            )
        )
        self.assertEqual(created["user_id"], changed["user_id"])
        self.assertFalse(changed["must_change_password"])
        old_login = self.request(
            "POST",
            "/api/v1/auth/login",
            {"username": "password_owner", "password": "OwnerOld123"},
        )
        self.assertEqual("DVAS_AUTH_FAILED", old_login["code"])
        self.assert_ok(
            self.request(
                "POST",
                "/api/v1/auth/login",
                {"username": "password_owner", "password": "OwnerNew123"},
            )
        )

        audit = self.latest_audit("UPDATE")
        self.assertEqual("USER", audit["module_code"])
        self.assertEqual(created["user_id"], audit["object_id"])
        self.assert_no_sensitive_password_fields(audit.get("before_value_json"))
        self.assert_no_sensitive_password_fields(audit.get("after_value_json"))

    def test_p1_role_permission_matrix_blocks_direct_api_bypass(self):
        admin_token = self.login_token("admin", "admin123")
        biz_token = self.login_token("biz_admin", "biz123")
        algo_token = self.login_token("algo_reviewer", "algo123")
        contract_token = self.login_token("contract_reviewer", "contract123")
        auditor_token = self.login_token("auditor", "audit123")
        viewer_token = self.login_token("viewer", "viewer123")

        admin_me = self.assert_ok(self.http_json("GET", "/api/v1/auth/me", token=admin_token))
        self.assertIn("NAV_SYSTEM_USER", admin_me["permissions"]["menu_codes"])
        self.assertIn("USER-002", admin_me["permissions"]["button_codes"])
        self.assertIn("PARAM-004", admin_me["permissions"]["button_codes"])
        self.assertEqual(200, self.http_json("GET", "/api/v1/system/users", token=admin_token)["_http_status"])

        biz_me = self.assert_ok(self.http_json("GET", "/api/v1/auth/me", token=biz_token))
        self.assertIn("NAV_DATA_PACKAGE", biz_me["permissions"]["menu_codes"])
        self.assertIn("NAV_ALLOC_SIMULATION", biz_me["permissions"]["menu_codes"])
        self.assertIn("NAV_REPORT_EXPORT", biz_me["permissions"]["menu_codes"])
        self.assertNotIn("NAV_SYSTEM_USER", biz_me["permissions"]["menu_codes"])
        self.assertEqual(403, self.http_json("GET", "/api/v1/system/users", token=biz_token)["_http_status"])

        algo_me = self.assert_ok(self.http_json("GET", "/api/v1/auth/me", token=algo_token))
        self.assertIn("NAV_MEASURE_QUALITY", algo_me["permissions"]["menu_codes"])
        self.assertIn("NAV_MEASURE_UTILITY", algo_me["permissions"]["menu_codes"])
        self.assertIn("NAV_ALLOC_MDS", algo_me["permissions"]["menu_codes"])
        self.assertNotIn("NAV_ALLOC_CONSTRAINT", algo_me["permissions"]["menu_codes"])
        self.assertEqual(403, self.http_json("POST", "/api/v1/allocation/constraints", {}, token=algo_token)["_http_status"])
        self.assertEqual(
            403,
            self.http_json(
                "PUT",
                "/api/v1/allocation/md-dshap/config",
                {"sample_rounds": 96},
                token=algo_token,
            )["_http_status"],
        )

        contract_me = self.assert_ok(self.http_json("GET", "/api/v1/auth/me", token=contract_token))
        self.assertIn("NAV_ALLOC_CONSTRAINT", contract_me["permissions"]["menu_codes"])
        self.assertIn("NAV_ALLOC_SIMULATION", contract_me["permissions"]["menu_codes"])
        self.assertEqual(200, self.http_json("GET", "/api/v1/allocation/constraints", token=contract_token)["_http_status"])
        self.assertEqual(403, self.http_json("GET", "/api/v1/system/users", token=contract_token)["_http_status"])
        self.assertEqual(
            403,
            self.http_json(
                "PUT",
                "/api/v1/allocation/md-dshap/config",
                {"sample_rounds": 96},
                token=contract_token,
            )["_http_status"],
        )

        self.assertEqual(200, self.http_json("GET", "/api/v1/audit/logs", token=auditor_token)["_http_status"])
        self.assertEqual(200, self.http_json("POST", "/api/v1/audit/export", {}, token=auditor_token)["_http_status"])
        self.assertEqual(403, self.http_json("POST", "/api/v1/data-packages/upload", {"package_name": "blocked"}, token=auditor_token)["_http_status"])
        self.assertEqual(403, self.http_json("POST", "/api/v1/dashboard/actions/quick-run", {}, token=auditor_token)["_http_status"])
        self.assertEqual(403, self.http_json("GET", "/api/v1/system/parameters", token=auditor_token)["_http_status"])

        viewer_me = self.assert_ok(self.http_json("GET", "/api/v1/auth/me", token=viewer_token))
        self.assertIn("NAV_REPORT_EXPORT", viewer_me["permissions"]["menu_codes"])
        self.assertNotIn("NAV_SYSTEM_AUDIT", viewer_me["permissions"]["menu_codes"])
        self.assertEqual(403, self.http_json("GET", "/api/v1/audit/logs", token=viewer_token)["_http_status"])
        self.assertEqual(403, self.http_json("GET", "/api/v1/system/users", token=viewer_token)["_http_status"])
        self.assertEqual(403, self.http_json("POST", "/api/v1/data-packages/upload", {"package_name": "blocked"}, token=viewer_token)["_http_status"])
        self.assertEqual(403, self.http_json("POST", "/api/v1/reports/json", {}, token=viewer_token)["_http_status"])

    def test_cors_preflight_allows_delete_for_browser_package_deletion(self):
        status, headers, body = self.app.handle_http(
            "OPTIONS",
            "/api/v1/data/packages/package_000001",
            b"",
            {
                "Origin": "http://127.0.0.1:5173",
                "Access-Control-Request-Method": "DELETE",
            },
        )

        self.assertEqual(204, status)
        self.assertEqual(b"", body)
        self.assertIn("DELETE", headers["Access-Control-Allow-Methods"])

    def run_demo_to_utility(self):
        self.request("POST", "/api/v1/demo-cases/lung_screening_demo/initialize")
        self.request("POST", "/api/v1/quality-assessments/run", {})
        self.request("POST", "/api/v1/shuyuan-meterings/run", {})
        self.request("POST", "/api/v1/contributions/run", {})
        return self.assert_ok(self.request("POST", "/api/v1/utilities/run", {}))

    def run_single_provider_to_utility(self):
        self.assert_ok(
            self.request(
                "POST",
                "/api/v1/data-packages/upload",
                {
                    "package_name": "single provider sample",
                    "resources": [
                        {
                            "resource_name": "single_provider_resource",
                            "provider_party_name": "唯一数据源主体",
                            "field_count": 6,
                            "sample_count": 100,
                        }
                    ],
                    "parties": [
                        {
                            "party_name": "唯一数据源主体",
                            "party_type": "DATA_PROVIDER",
                            "include_in_md_dshap": True,
                        },
                        {
                            "party_name": "非数据运营方",
                            "party_type": "OPERATOR",
                            "include_in_md_dshap": False,
                        },
                    ],
                },
            )
        )
        self.request("POST", "/api/v1/quality-assessments/run", {})
        self.request("POST", "/api/v1/shuyuan-meterings/run", {})
        self.request("POST", "/api/v1/contributions/run", {})
        return self.assert_ok(self.request("POST", "/api/v1/utilities/run", {}))

    def run_demo_to_weights(self):
        self.run_demo_to_utility()
        return self.assert_ok(self.request("POST", "/api/v1/md-dshap/tasks", {}))

    def run_demo_to_allocated(self):
        self.run_demo_to_weights()
        scenario = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/allocation-scenarios",
                {"total_revenue": 1000, "priority_allocation_amount": 100},
            )
        )
        simulated = self.assert_ok(
            self.request(
                "POST",
                f"/api/v1/allocation-scenarios/{scenario['allocation_id']}/simulate",
                {},
            )
        )
        return scenario, simulated

    def run_six_provider_two_contract_to_weights(self):
        upload_body = {
            "project_name": "肺癌早筛六科室测试包_简化版",
            "source_note": "模拟脱敏测试数据",
            "revenue_pool": 1200000,
            "participants": [
                {
                    "party_id": "HOSP_DEPT_RESP",
                    "party_name": "示范医院呼吸与危重症医学科",
                    "party_type": "DATA_PROVIDER",
                    "is_data_provider": True,
                    "include_in_md_dshap": True,
                },
                {
                    "party_id": "HOSP_DEPT_RAD",
                    "party_name": "示范医院医学影像科",
                    "party_type": "DATA_PROVIDER",
                    "is_data_provider": True,
                    "include_in_md_dshap": True,
                },
                {
                    "party_id": "HOSP_DEPT_PATH",
                    "party_name": "示范医院病理科",
                    "party_type": "DATA_PROVIDER",
                    "is_data_provider": True,
                    "include_in_md_dshap": True,
                },
                {
                    "party_id": "HOSP_DEPT_LAB",
                    "party_name": "示范医院检验科",
                    "party_type": "DATA_PROVIDER",
                    "is_data_provider": True,
                    "include_in_md_dshap": True,
                },
                {
                    "party_id": "HOSP_DEPT_ONC",
                    "party_name": "示范医院肿瘤内科",
                    "party_type": "DATA_PROVIDER",
                    "is_data_provider": True,
                    "include_in_md_dshap": True,
                },
                {
                    "party_id": "HOSP_DEPT_FOLLOW",
                    "party_name": "示范医院随访管理中心",
                    "party_type": "DATA_PROVIDER",
                    "is_data_provider": True,
                    "include_in_md_dshap": True,
                },
                {
                    "party_id": "COMP_LLM",
                    "party_name": "京算医疗大模型科技有限公司",
                    "party_type": "TECH_SERVICE",
                    "is_data_provider": False,
                    "include_in_md_dshap": False,
                },
                {
                    "party_id": "COMP_DATAOPS",
                    "party_name": "数安可信数据运营有限公司",
                    "party_type": "OPERATOR",
                    "is_data_provider": False,
                    "include_in_md_dshap": False,
                },
            ],
            "data_units": [
                {
                    "resource_id": f"RES_{index:02d}",
                    "resource_name": f"六科室测试数据资源{index}",
                    "party_id": party_id,
                    "modality": "STRUCTURED",
                    "sample_count": sample_count,
                    "field_count": 30 + index,
                }
                for index, (party_id, sample_count) in enumerate(
                    [
                        ("HOSP_DEPT_RESP", 30000),
                        ("HOSP_DEPT_RAD", 28000),
                        ("HOSP_DEPT_PATH", 18000),
                        ("HOSP_DEPT_LAB", 24000),
                        ("HOSP_DEPT_ONC", 21000),
                        ("HOSP_DEPT_FOLLOW", 15000),
                    ],
                    start=1,
                )
            ],
        }
        upload = self.assert_ok(self.request("POST", "/api/v1/data-packages/upload", upload_body))
        self.assert_ok(self.request("POST", "/api/v1/quality-assessments/run", {}))
        self.assert_ok(self.request("POST", "/api/v1/shuyuan-meterings/run", {}))
        self.assert_ok(self.request("POST", "/api/v1/contributions/run", {}))
        self.assert_ok(self.request("POST", "/api/v1/utilities/run", {}))
        weights = self.assert_ok(self.request("POST", "/api/v1/md-dshap/tasks", {}))
        parties = self.assert_ok(self.request("GET", "/api/v1/parties"))["items"]
        return {
            "upload": upload,
            "weights": weights,
            "parties": parties,
            "data_parties": [party for party in parties if party["party_type"] == "DATA_PROVIDER"],
            "non_data_parties": [party for party in parties if party["party_type"] != "DATA_PROVIDER"],
        }

    def run_priority_ratio_runtime_scenario(self):
        context = self.run_six_provider_two_contract_to_weights()
        non_data_party = context["non_data_parties"][0]
        payload = {
            "party_id": non_data_party["party_id"],
            "constraint_name": "10% 合同优先",
            "constraint_type": "PRIORITY_ALLOCATION",
            "value_type": "RATIO",
            "constraint_value": 0.10,
            "priority": 1,
        }
        constraint = self.assert_ok(self.request("POST", "/api/v1/allocation/constraints", payload))
        constraints_summary = self.assert_ok(self.request("GET", "/api/v1/allocation/constraints"))
        simulated = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/allocation/simulation/run",
                {
                    "total_revenue": 1200000,
                    "allocation_mode": "MD_DSHAP_WEIGHT_WITH_CONSTRAINTS",
                },
            )
        )
        result_page = self.assert_ok(
            self.request(
                "GET",
                f"/api/v1/allocation-scenarios/{simulated['allocation']['allocation_id']}/results",
            )
        )
        return {
            **context,
            "priority_payload": payload,
            "priority_constraint": constraint,
            "constraints_summary": constraints_summary,
            "simulated": simulated,
            "result_page": result_page,
        }

    def contract_ratio_payload(
        self,
        total_revenue="1000.00",
        pool_ratio="0.900000",
        item_ratio="0.100000",
        basis_text="测试合同比例",
    ):
        parties = self.assert_ok(self.request("GET", "/api/v1/parties"))["items"]
        non_data_party = next(item for item in parties if item["party_type"] != "DATA_PROVIDER")
        return {
            "total_revenue": total_revenue,
            "currency": "CNY",
            "data_provider_pool_ratio": pool_ratio,
            "items": [
                {
                    "bucket_type": "NON_DATA_PARTY",
                    "party_id": non_data_party["party_id"],
                    "ratio": item_ratio,
                    "basis_text": basis_text,
                }
            ],
        }

    def pipeline_artifact_counts(self):
        return {
            "quality": len(self.repository.list_quality_assessments()),
            "shuyuan": len(self.repository.list_shuyuan_meterings()),
            "contribution": len(self.repository.list_contribution_records()),
            "utility": len(self.repository.list_utility_records()),
            "md_dshap": len(self.repository.list_md_dshap_tasks()),
            "allocation": len(self.repository.list_allocation_scenarios()),
        }

    def assert_error_envelope(self, response, expected_code):
        self.assertFalse(response["success"], response)
        self.assertEqual(expected_code, response["code"])
        self.assertIn("message", response)
        self.assertIn("trace_id", response)
        self.assertIn("field_errors", response)
        self.assertIsInstance(response["field_errors"], list)

    def read_csv_rows(self, file_path):
        return list(csv.DictReader(io.StringIO(Path(file_path).read_text(encoding="utf-8"))))

    def latest_audit(self, operation_type):
        logs = [
            item
            for item in self.repository.list_audit_logs()
            if item["operation_type"] == operation_type
        ]
        self.assertTrue(logs, operation_type)
        return logs[-1]

    def current_quality_weight_items(self):
        weights = self.assert_ok(self.request("GET", "/api/v1/metering/quality/weights"))
        return [
            {"metric_code": item["metric_code"], "weight": item["weight"]}
            for item in weights["items"]
        ]

    def upload_ten_resource_quality_sample(self):
        provider_names = ["示例医院A", "示例医院B", "示例区域筛查平台"]
        resources = []
        for index in range(10):
            resources.append(
                {
                    "resource_name": f"资源级质量评分样本{index + 1:02d}",
                    "provider_party_name": provider_names[index % len(provider_names)],
                    "modality": ["CLINICAL_TABLE", "LAB_TABLE", "FOLLOWUP_TABLE"][index % 3],
                    "field_count": 12 + index * 3,
                    "sample_count": 1200 + index * 850,
                    "missing_rate": round(index * 0.006, 4),
                    "include_in_calculation": True,
                }
            )
        return self.assert_ok(
            self.request(
                "POST",
                "/api/v1/data-packages/upload",
                {
                    "package_name": "资源级质量评分十资源样本",
                    "resources": resources,
                    "parties": [
                        {
                            "party_name": "示例医院A",
                            "party_type": "DATA_PROVIDER",
                            "include_in_md_dshap": True,
                        },
                        {
                            "party_name": "示例医院B",
                            "party_type": "DATA_PROVIDER",
                            "include_in_md_dshap": True,
                        },
                        {
                            "party_name": "示例区域筛查平台",
                            "party_type": "DATA_PROVIDER",
                            "include_in_md_dshap": True,
                        },
                        {
                            "party_name": "示例运营服务方",
                            "party_type": "OPERATOR",
                            "include_in_md_dshap": False,
                        },
                        {
                            "party_name": "示例技术服务方",
                            "party_type": "TECH_SERVICE",
                            "include_in_md_dshap": False,
                        },
                        {
                            "party_name": "示例专家评审方",
                            "party_type": "EXPERT",
                            "include_in_md_dshap": False,
                        },
                    ],
                },
            )
        )

    def test_backend_canonical_enums_map_to_sql_schema_values(self):
        mapped_runtime = assert_runtime_enums_mapped()
        mapped_sql = assert_sql_enums_mapped()

        self.assertEqual(ProjectStatus.EXPORTED.value, mapped_runtime["project_status"][-1])
        self.assertEqual("VALID", runtime_to_sql_enum("data_package_status", "VALIDATED"))
        self.assertEqual("VALIDATED", sql_to_runtime_enum("data_package_status", "VALID"))
        self.assertEqual("SUCCESS", runtime_to_sql_enum("md_dshap_task_status", "COMPLETED"))
        self.assertEqual("COMPLETED", sql_to_runtime_enum("md_dshap_task_status", "SUCCESS"))
        self.assertEqual("BASIC_SHAPLEY", runtime_to_sql_enum("algorithm_mode", AlgorithmMode.BASELINE_SHAPLEY.value))
        self.assertEqual(AlgorithmMode.BASELINE_SHAPLEY.value, sql_to_runtime_enum("algorithm_mode", "BASIC_SHAPLEY"))
        self.assertEqual("ALGORITHM", runtime_to_sql_enum("snapshot_type", SnapshotType.ALGORITHM_AUDIT.value))
        self.assertEqual("MD", runtime_to_sql_enum("report_format", ReportFormat.MARKDOWN.value))
        self.assertEqual(ReportFormat.MARKDOWN.value, sql_to_runtime_enum("report_format", "MD"))
        self.assertEqual(
            "MD_DSHAP_WEIGHT",
            runtime_to_sql_enum("allocation_mode", AllocationMode.MD_DSHAP_WEIGHT_WITH_CONSTRAINTS.value),
        )
        self.assertEqual(
            AllocationMode.MD_DSHAP_WEIGHT_WITH_CONSTRAINTS.value,
            sql_to_runtime_enum("allocation_mode", "MD_DSHAP_WEIGHT"),
        )
        self.assertEqual(
            "PRIORITY_AMOUNT",
            runtime_to_sql_enum("contract_constraint_type", ContractConstraintType.PRIORITY_ALLOCATION.value),
        )
        self.assertEqual(
            ContractConstraintType.PRIORITY_ALLOCATION.value,
            sql_to_runtime_enum("contract_constraint_type", "PRIORITY_AMOUNT"),
        )
        self.assertEqual("file_id", runtime_to_sql_enum("export_file_id_field", "export_file_id"))
        self.assertEqual("export_file_id", sql_to_runtime_enum("export_file_id_field", "file_id"))
        self.assertEqual("P1_DISABLED", next(item for item in mapped_sql["report_format"] if item["sql"] == "PDF")["runtime"])
        with self.assertRaises(ApiError) as cm:
            sql_to_runtime_enum("report_format", "PDF")
        self.assertEqual("DVAS_P1_CAPABILITY_NOT_ENABLED", cm.exception.code)

    def test_state_machine_blocking_writes_failed_audit(self):
        response = self.request("POST", "/api/v1/quality-assessments/run", {})

        self.assert_error_envelope(response, "DVAS_PRECONDITION_NOT_MET")
        audit = self.latest_audit("RUN_QUALITY_ASSESSMENT")
        self.assertEqual("FAILED", audit["status"])
        self.assertEqual("DVAS_PRECONDITION_NOT_MET", audit["error_code"])
        self.assertEqual("local_operator", audit["created_by"])
        self.assertEqual("QUAL", audit["module_code"])

    def test_parameter_validation_failure_writes_failed_audit(self):
        self.request("POST", "/api/v1/demo-cases/lung_screening_demo/initialize")
        self.request("POST", "/api/v1/quality-assessments/run", {})

        response = self.request("POST", "/api/v1/shuyuan-meterings/run", {"base_price": "bad"})

        self.assert_error_envelope(response, "DVAS_FACTOR_INVALID")
        audit = self.latest_audit("RUN_SHUYUAN_METERING")
        self.assertEqual("FAILED", audit["status"])
        self.assertEqual("DVAS_FACTOR_INVALID", audit["error_code"])
        self.assertEqual("DU", audit["module_code"])

    def test_report_export_failure_writes_failed_audit(self):
        response = self.request("POST", "/api/v1/reports/markdown", {})

        self.assert_error_envelope(response, "DVAS_PRECONDITION_NOT_MET")
        audit = self.latest_audit("GENERATE_MARKDOWN_REPORT")
        self.assertEqual("FAILED", audit["status"])
        self.assertEqual("DVAS_PRECONDITION_NOT_MET", audit["error_code"])
        self.assertEqual("REP", audit["module_code"])

    def test_draft_endpoints_persist_parameters_or_runtime_drafts(self):
        quality_weights = self.assert_ok(
            self.request(
                "PUT",
                "/api/v1/metering/quality/weights",
                {"items": self.current_quality_weight_items()},
            )
        )
        self.assertEqual(7, quality_weights["primary_metric_count"])
        self.assertEqual(17, quality_weights["secondary_metric_count"])
        self.assertEqual(24, len(quality_weights["updated_parameters"]))
        self.assertEqual(0.15, self.repository.get_system_parameter("QUALITY_WEIGHT_NORM")["current_value"])

        shuyuan_params = self.assert_ok(
            self.request("PUT", "/api/v1/metering/shuyuan/parameters", {"base_price": 3.5})
        )
        self.assertEqual(3.5, shuyuan_params["shuyuan_parameters"]["base_price"])
        current_shuyuan_params = self.assert_ok(
            self.request("GET", "/api/v1/metering/shuyuan/parameters")
        )
        self.assertEqual(3.5, current_shuyuan_params["shuyuan_parameters"]["base_price"])

        contribution_factors = self.assert_ok(
            self.request(
                "PUT",
                "/api/v1/metering/utility/contribution-factors",
                {"usage_weight": 1.2, "coverage_weight": 1.1},
            )
        )
        self.assertEqual(1.2, contribution_factors["contribution_factors"]["usage_weight"])

        md_config = self.assert_ok(
            self.request(
                "PUT",
                "/api/v1/allocation/md-dshap/config",
                {"algorithm_mode": "MD_DSHAP", "sample_rounds": 96},
            )
        )
        self.assertEqual("MD_DSHAP", md_config["algorithm_mode"])
        self.assertEqual(96, md_config["sample_rounds"])

        self.assert_ok(
            self.request("PUT", "/api/v1/metering/shuyuan/call-counts", {"RES_A": 10})
        )
        self.assert_ok(
            self.request(
                "PUT",
                "/api/v1/metering/utility/function",
                {"formula": "normalized_contribution * quality_factor"},
            )
        )
        utility_function = self.assert_ok(
            self.request("GET", "/api/v1/metering/utility/function")
        )
        self.assertEqual(
            "normalized_contribution * quality_factor",
            utility_function["utility_function"]["formula"],
        )
        self.assert_ok(
            self.request(
                "PUT",
                "/api/v1/allocation/simulation/revenue-pool",
                {"total_revenue": 1000, "priority_allocation_amount": 100},
            )
        )
        self.assert_ok(
            self.request(
                "PUT",
                "/api/v1/allocation/simulation/priority-items",
                {"items": [{"party_id": "party_a", "priority_amount": 10}]},
            )
        )
        self.assert_ok(
            self.request(
                "PUT",
                "/api/v1/allocation/simulation/mode",
                {"allocation_mode": "MD_DSHAP_WEIGHT_WITH_CONSTRAINTS"},
            )
        )

        draft_types = {draft["draft_type"] for draft in self.repository.list_business_drafts()}
        self.assertEqual(
            {
                "SHUYUAN_CALL_COUNTS",
                "UTILITY_FUNCTION",
                "ALLOCATION_REVENUE_POOL",
                "ALLOCATION_PRIORITY_ITEMS",
                "ALLOCATION_MODE",
            },
            draft_types,
        )
        self.assertTrue(all(draft["snapshot_id"].startswith("snapshot_") for draft in self.repository.list_business_drafts()))
        self.assertGreaterEqual(len(self.repository.list_parameter_versions()), 7)

    def test_md_dshap_rejects_baseline_shapley_as_final_algorithm_mode(self):
        self.run_demo_to_utility()

        response = self.request("POST", "/api/v1/md-dshap/tasks", {"algorithm_mode": "BASELINE_SHAPLEY"})

        self.assert_error_envelope(response, "DVAS_FACTOR_INVALID")
        audit = self.latest_audit("RUN_MD_DSHAP")
        self.assertEqual("FAILED", audit["status"])
        self.assertEqual("DVAS_FACTOR_INVALID", audit["error_code"])

    def test_current_project_starts_as_draft_with_stable_envelope(self):
        data = self.assert_ok(self.request("GET", "/api/v1/projects/current"))

        self.assertEqual("DRAFT", data["project_status"])
        self.assertEqual("local_operator", data["operator_id"])
        self.assertEqual("系统结果仅为模拟参考，非法律结算 / 非法定结算结果。", data["simulation_disclaimer"])

    def test_navigation_menu_tree_keeps_system_home_as_single_first_level_node(self):
        data = self.assert_ok(self.request("GET", "/api/v1/navigation/menu-tree"))

        menu_by_code = {item["menu_code"]: item for item in data["items"]}
        system_home = menu_by_code["NAV_SYS_HOME"]
        forbidden_codes = {
            "NAV_SYS_OVERVIEW",
            "NAV_SYS_PROCESS",
            "NAV_SYS_RISK",
            "NAV_SYS_ONE_CLICK",
        }

        self.assertEqual(
            {
                "menu_code": "NAV_SYS_HOME",
                "menu_name": "系统首页",
                "module_code": "SYS",
                "route_path": "/dashboard",
                "children": [],
            },
            {
                "menu_code": system_home["menu_code"],
                "menu_name": system_home["menu_name"],
                "module_code": system_home["module_code"],
                "route_path": system_home["route_path"],
                "children": system_home["children"],
            },
        )
        self.assertEqual(1, system_home["menu_level"])
        self.assertEqual(set(), forbidden_codes & set(menu_by_code))

    def test_system_home_button_permissions_bind_to_nav_sys_home(self):
        data = self.assert_ok(self.request("GET", "/api/v1/navigation/button-permissions"))

        permissions = {item["button_code"]: item for item in data["items"]}
        for button_code in ["SYS-002", "SYS-004", "SYS-005"]:
            with self.subTest(button_code=button_code):
                self.assertEqual("NAV_SYS_HOME", permissions[button_code]["menu_code"])
                self.assertEqual("MENU_SYS_HOME", permissions[button_code]["menu_id"])
                self.assertEqual("SYS", permissions[button_code]["module_code"])

    def test_initialize_demo_case_moves_project_to_ingested_and_seeds_data(self):
        data = self.assert_ok(
            self.request("POST", "/api/v1/demo-cases/lung_screening_demo/initialize")
        )

        self.assertEqual("INGESTED", data["project_status"])
        self.assertEqual("DEMO", data["package"]["source_type"])
        self.assertEqual("VALIDATED", data["package"]["status"])
        self.assertTrue(data["input_snapshot"]["snapshot_id"].startswith("snapshot_"))
        self.assertGreaterEqual(len(data["resources"]), 2)
        self.assertGreaterEqual(len(data["parties"]), 2)

        packages = self.assert_ok(self.request("GET", "/api/v1/data-packages"))["items"]
        resources = self.assert_ok(self.request("GET", "/api/v1/data-resources"))["items"]
        parties = self.assert_ok(self.request("GET", "/api/v1/parties"))["items"]

        self.assertEqual(1, len(packages))
        self.assertEqual(len(data["resources"]), len(resources))
        self.assertEqual(len(data["parties"]), len(parties))

        audit_logs = self.repository.list_audit_logs()
        initialize_log = next(item for item in audit_logs if item["operation_type"] == "INITIALIZE_DEMO")
        self.assertEqual("SYS", initialize_log["module_code"])
        self.assertEqual("NAV_SYS_HOME", initialize_log["menu_code"])

    def test_dashboard_preconditions_enable_quality_after_ingestion(self):
        before = self.assert_ok(self.request("GET", "/api/v1/dashboard/preconditions"))
        self.assertEqual("DRAFT", before["project_status"])
        self.assertIn("SYS-002", before["available_actions"])
        self.assertIn("DATA-002", before["available_actions"])
        self.assertIn("DATA-003", before["available_actions"])
        self.assertIn(
            {"button_code": "QUAL-003", "reason": "请先完成数据接入"},
            before["disabled_actions"],
        )

        self.request("POST", "/api/v1/demo-cases/lung_screening_demo/initialize")
        after = self.assert_ok(self.request("GET", "/api/v1/dashboard/preconditions"))

        self.assertEqual("INGESTED", after["project_status"])
        self.assertIn("QUAL-003", after["available_actions"])
        self.assertEqual(
            {"code": "HAS_VALID_DATA_PACKAGE", "passed": True, "message": "已完成数据接入"},
            after["preconditions"][0],
        )

    def test_dashboard_overview_reports_counts_and_next_step(self):
        self.request("POST", "/api/v1/demo-cases/lung_screening_demo/initialize")

        data = self.assert_ok(self.request("GET", "/api/v1/dashboard"))

        self.assertEqual("INGESTED", data["project_status"])
        self.assertEqual(1, data["metrics"]["data_package_count"])
        self.assertGreaterEqual(data["metrics"]["resource_count"], 2)
        self.assertEqual("启动质量评估", data["next_step"]["label"])
        self.assertEqual("QUAL-003", data["next_step"]["button_code"])

    def test_dashboard_counts_current_package_snapshot_not_stale_global_parties(self):
        self.assert_ok(
            self.request(
                "POST",
                "/api/v1/data-packages/upload",
                {
                    "package_name": "old package",
                    "resources": [
                        {
                            "resource_name": "old resource",
                            "provider_party_name": "历史数据源主体",
                        }
                    ],
                    "parties": [
                        {
                            "party_id": "OLD_PROVIDER",
                            "party_name": "历史数据源主体",
                            "party_type": "DATA_PROVIDER",
                            "include_in_md_dshap": True,
                        }
                    ],
                },
            )
        )
        self.assert_ok(
            self.request(
                "POST",
                "/api/v1/data-packages/upload",
                {
                    "project_name": "current package",
                    "package_name": "current package",
                    "revenue_pool": 500000,
                    "participants": [
                        {
                            "party_id": "NEW_PROVIDER",
                            "party_name": "当前数据源主体",
                            "party_type": "DATA_PROVIDER",
                            "is_data_provider": True,
                            "include_in_md_dshap": True,
                        },
                        {
                            "party_id": "NEW_OPERATOR",
                            "party_name": "当前非数据运营方",
                            "party_type": "OPERATOR",
                            "is_data_provider": False,
                            "include_in_md_dshap": False,
                        },
                    ],
                    "data_units": [
                        {
                            "resource_id": "CURRENT_RES_01",
                            "resource_name": "当前数据资源",
                            "party_id": "NEW_PROVIDER",
                            "modality": "STRUCTURED",
                            "sample_count": 100,
                            "field_count": 10,
                        }
                    ],
                },
            )
        )

        parties = self.assert_ok(self.request("GET", "/api/v1/data/parties"))["items"]
        data = self.assert_ok(self.request("GET", "/api/v1/dashboard"))

        self.assertEqual(3, len(parties))
        self.assertEqual(2, data["metrics"]["data_package_count"])
        self.assertEqual(1, data["metrics"]["resource_count"])
        self.assertEqual(2, data["metrics"]["party_count"])
        self.assertEqual(500000, data["metrics"]["current_revenue_pool"])

    def test_upload_json_success_creates_snapshot_package_resources_and_parties(self):
        upload_body = {
            "package_name": "uploaded sample",
            "resources": [
                {
                    "resource_name": "customer_orders",
                    "modality": "TABULAR",
                    "field_count": 8,
                    "sample_count": 120,
                    "provider_party_name": "数据源主体A",
                }
            ],
            "parties": [
                {
                    "party_name": "数据源主体A",
                    "party_type": "DATA_PROVIDER",
                    "include_in_md_dshap": True,
                },
                {
                    "party_name": "运营服务方",
                    "party_type": "OPERATOR",
                    "include_in_md_dshap": False,
                },
            ],
        }

        data = self.assert_ok(self.request("POST", "/api/v1/data-packages/upload", upload_body))

        self.assertEqual("INGESTED", data["project_status"])
        self.assertEqual("UPLOAD", data["package"]["source_type"])
        self.assertEqual("VALIDATED", data["validation_result"]["status"])
        self.assertEqual([], data["validation_result"]["field_errors"])
        self.assertEqual(1, len(data["resources"]))
        self.assertEqual(2, len(data["parties"]))

    def test_data_package_search_filters_by_package_name_filename_and_status(self):
        self.assert_ok(
            self.request(
                "POST",
                "/api/v1/data-packages/upload",
                {
                    "package_name": "alpha search sample",
                    "file_name": "alpha_upload.json",
                    "resources": [
                        {
                            "resource_name": "alpha_resource",
                            "provider_party_name": "Alpha 数据源",
                            "field_count": 3,
                            "sample_count": 10,
                        }
                    ],
                    "parties": [
                        {
                            "party_name": "Alpha 数据源",
                            "party_type": "DATA_PROVIDER",
                            "include_in_md_dshap": True,
                        }
                    ],
                },
            )
        )
        self.assert_ok(
            self.request(
                "POST",
                "/api/v1/data-packages/upload",
                {
                    "package_name": "beta delete sample",
                    "file_name": "beta_upload.json",
                    "resources": [
                        {
                            "resource_name": "beta_resource",
                            "provider_party_name": "Beta 数据源",
                            "field_count": 4,
                            "sample_count": 20,
                        }
                    ],
                    "parties": [
                        {
                            "party_name": "Beta 数据源",
                            "party_type": "DATA_PROVIDER",
                            "include_in_md_dshap": True,
                        }
                    ],
                },
            )
        )

        beta = self.assert_ok(self.request("GET", "/api/v1/data-packages?q=beta"))["items"]
        alpha_file = self.assert_ok(self.request("GET", "/api/v1/data/packages?search=alpha_upload"))["items"]
        validated = self.assert_ok(self.request("GET", "/api/v1/data-packages?q=validated"))["items"]

        self.assertEqual(["beta delete sample"], [item["package_name"] for item in beta])
        self.assertEqual(["alpha search sample"], [item["package_name"] for item in alpha_file])
        self.assertEqual(2, len(validated))

    def test_delete_current_data_package_removes_ingestion_artifacts_and_resets_project(self):
        upload = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/data-packages/upload",
                {
                    "package_name": "delete current sample",
                    "resources": [
                        {
                            "resource_name": "delete_resource",
                            "provider_party_name": "删除测试数据源",
                            "field_count": 3,
                            "sample_count": 10,
                        }
                    ],
                    "parties": [
                        {
                            "party_name": "删除测试数据源",
                            "party_type": "DATA_PROVIDER",
                            "include_in_md_dshap": True,
                        }
                    ],
                },
            )
        )
        package_id = upload["package"]["package_id"]
        self.assert_ok(self.request("POST", "/api/v1/quality-assessments/run", {}))

        deleted = self.assert_ok(self.request("DELETE", f"/api/v1/data/packages/{package_id}"))

        self.assertTrue(deleted["deleted"])
        self.assertEqual(package_id, deleted["package_id"])
        self.assertEqual(1, deleted["deleted_resource_count"])
        self.assertIsNone(deleted["current_package_id"])
        self.assertEqual("DRAFT", deleted["project_status"])
        self.assertEqual([], self.assert_ok(self.request("GET", "/api/v1/data-packages"))["items"])
        self.assertEqual([], self.assert_ok(self.request("GET", "/api/v1/data-resources"))["items"])
        self.assertFalse(self.request("GET", f"/api/v1/data-packages/{package_id}")["success"])
        self.assertFalse(
            self.request("GET", f"/api/v1/data-packages/{package_id}/validation-result")["success"]
        )
        self.assertFalse(self.request("GET", "/api/v1/quality-assessments/latest")["success"])
        delete_log = next(
            item
            for item in self.repository.list_audit_logs()
            if item["operation_type"] == "DELETE_DATA_PACKAGE"
        )
        self.assertEqual("DATA", delete_log["module_code"])
        self.assertEqual(package_id, delete_log["object_id"])

    def test_upload_json_validation_failure_returns_field_errors_and_failure_detail(self):
        response = self.request("POST", "/api/v1/data-packages/upload", {"resources": []})

        self.assertFalse(response["success"])
        self.assertEqual("DVAS_REQUIRED_FIELD_MISSING", response["code"])
        self.assertEqual("DVAS_REQUIRED_FIELD_MISSING", response["error_code"])
        self.assertEqual("package_name", response["error_field"])
        self.assertEqual("package_name 为必填字段", response["error_message"])
        self.assertEqual("上传 JSON 校验失败", response["message"])
        self.assertEqual(
            [{"field": "package_name", "reason": "package_name 为必填字段"}],
            response["field_errors"],
        )
        self.assertEqual(response["field_errors"], response["detail_json"]["field_errors"])

        packages = self.assert_ok(self.request("GET", "/api/v1/data-packages"))["items"]
        self.assertEqual(1, len(packages))
        package_id = packages[0]["package_id"]
        validation = self.assert_ok(
            self.request("GET", f"/api/v1/data-packages/{package_id}/validation-result")
        )

        self.assertEqual("INVALID", validation["status"])
        self.assertEqual("DVAS_REQUIRED_FIELD_MISSING", validation["code"])
        self.assertEqual("DVAS_REQUIRED_FIELD_MISSING", validation["error_code"])
        self.assertEqual("package_name", validation["error_field"])
        self.assertEqual("package_name 为必填字段", validation["error_message"])
        self.assertEqual(response["detail_json"], validation["detail_json"])
        self.assertEqual(package_id, validation["package_id"])

    def test_multipart_upload_current_schema_generates_eight_parties_and_six_md_participants(self):
        upload_body = {
            "project_name": "肺癌早筛六科室测试包_简化版",
            "source_note": "模拟脱敏测试数据",
            "revenue_pool": 1200000,
            "participants": [
                {
                    "party_id": "HOSP_DEPT_RESP",
                    "party_name": "示范医院呼吸与危重症医学科",
                    "party_type": "DATA_PROVIDER",
                    "is_data_provider": True,
                    "include_in_md_dshap": True,
                },
                {
                    "party_id": "HOSP_DEPT_RAD",
                    "party_name": "示范医院医学影像科",
                    "party_type": "DATA_PROVIDER",
                    "is_data_provider": True,
                    "include_in_md_dshap": True,
                },
                {
                    "party_id": "HOSP_DEPT_PATH",
                    "party_name": "示范医院病理科",
                    "party_type": "DATA_PROVIDER",
                    "is_data_provider": True,
                    "include_in_md_dshap": True,
                },
                {
                    "party_id": "HOSP_DEPT_LAB",
                    "party_name": "示范医院检验科",
                    "party_type": "DATA_PROVIDER",
                    "is_data_provider": True,
                    "include_in_md_dshap": True,
                },
                {
                    "party_id": "HOSP_DEPT_ONC",
                    "party_name": "示范医院肿瘤内科",
                    "party_type": "DATA_PROVIDER",
                    "is_data_provider": True,
                    "include_in_md_dshap": True,
                },
                {
                    "party_id": "HOSP_DEPT_FOLLOW",
                    "party_name": "示范医院随访管理中心",
                    "party_type": "DATA_PROVIDER",
                    "is_data_provider": True,
                    "include_in_md_dshap": True,
                },
                {
                    "party_id": "COMP_LLM",
                    "party_name": "京算医疗大模型科技有限公司",
                    "party_type": "TECH_SERVICE",
                    "is_data_provider": False,
                    "include_in_md_dshap": False,
                },
                {
                    "party_id": "COMP_DATAOPS",
                    "party_name": "数安可信数据运营有限公司",
                    "party_type": "OPERATOR",
                    "is_data_provider": False,
                    "include_in_md_dshap": False,
                },
            ],
            "data_units": [
                {
                    "resource_id": f"RES_{index:02d}",
                    "resource_name": f"六科室测试数据资源{index}",
                    "party_id": party_id,
                    "modality": "STRUCTURED",
                    "sample_count": sample_count,
                    "field_count": 30 + index,
                }
                for index, (party_id, sample_count) in enumerate(
                    [
                        ("HOSP_DEPT_RESP", 30000),
                        ("HOSP_DEPT_RAD", 28000),
                        ("HOSP_DEPT_PATH", 18000),
                        ("HOSP_DEPT_LAB", 24000),
                        ("HOSP_DEPT_ONC", 21000),
                        ("HOSP_DEPT_FOLLOW", 15000),
                    ],
                    start=1,
                )
            ],
        }
        content = json.dumps(upload_body, ensure_ascii=False).encode("utf-8")

        token = self.login_token()
        response = self.multipart_upload(
            "/api/v1/data-packages/upload",
            "dvas_6_depts_2_companies_simple_upload.json",
            content,
            token=token,
        )
        data = self.assert_ok(response)

        diagnostics = data["upload_diagnostics"]
        self.assertEqual("dvas_6_depts_2_companies_simple_upload.json", diagnostics["filename"])
        self.assertEqual(len(content), diagnostics["content_length"])
        self.assertEqual(hashlib.sha256(content).hexdigest(), diagnostics["sha256"])
        self.assertEqual(
            ["data_units", "participants", "project_name", "revenue_pool", "source_note"],
            diagnostics["json_keys"],
        )
        self.assertEqual("肺癌早筛六科室测试包_简化版", data["package"]["package_name"])
        self.assertEqual("dvas_6_depts_2_companies_simple_upload.json", data["package"]["file_name"])
        self.assertEqual(len(content), data["package"]["file_size"])
        self.assertEqual(hashlib.sha256(content).hexdigest(), data["package"]["checksum"])
        self.assertEqual(6, len(data["resources"]))
        self.assertEqual(8, len(data["parties"]))

        parties = self.assert_ok(self.request("GET", "/api/v1/data/parties"))["items"]
        self.assertEqual(8, len(parties))
        self.assertEqual(
            6,
            len(
                [
                    party
                    for party in parties
                    if party["party_type"] == "DATA_PROVIDER" and party["include_in_md_dshap"]
                ]
            ),
        )
        self.assertEqual(
            2,
            len([party for party in parties if not party["include_in_md_dshap"]]),
        )

        self.request("POST", "/api/v1/quality-assessments/run", {})
        self.request("POST", "/api/v1/shuyuan-meterings/run", {})
        self.request("POST", "/api/v1/contributions/run", {})
        self.assert_ok(self.request("POST", "/api/v1/utilities/run", {}))
        md_data = self.assert_ok(self.request("POST", "/api/v1/md-dshap/tasks", {}))
        participant_names = [item["party_name"] for item in md_data["task"]["participant_set"]]

        self.assertEqual(6, md_data["algorithm_party_count"])
        self.assertEqual(2, md_data["contract_party_count"])
        self.assertEqual(6, len(md_data["task"]["participant_set"]))
        self.assertNotIn("京算医疗大模型科技有限公司", participant_names)
        self.assertNotIn("数安可信数据运营有限公司", participant_names)

        overview = self.assert_ok(self.request("GET", "/api/v1/dashboard"))
        self.assertEqual(8, overview["metrics"]["party_count"])
        self.assertEqual(1200000, overview["metrics"]["current_revenue_pool"])

    def test_data_package_detail_and_missing_route_errors_are_structured(self):
        upload = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/data-packages/upload",
                {
                    "package_name": "minimal",
                    "resources": [{"resource_name": "r1", "provider_party_name": "p1"}],
                    "parties": [{"party_name": "p1", "party_type": "DATA_PROVIDER"}],
                },
            )
        )

        package_id = upload["package"]["package_id"]
        detail = self.assert_ok(self.request("GET", f"/api/v1/data-packages/{package_id}"))
        self.assertEqual(package_id, detail["package"]["package_id"])
        self.assertEqual(1, len(detail["resources"]))

        missing = self.request("GET", "/api/v1/data-packages/package_missing")
        self.assertFalse(missing["success"])
        self.assertEqual("DVAS_NOT_FOUND", missing["code"])

    def test_public_routes_require_api_v1_prefix(self):
        public_paths = [
            "/projects/current",
            "/navigation/menu-tree",
            "/navigation/button-permissions",
            "/dashboard",
            "/dashboard/preconditions",
            "/dashboard/actions/quick-run",
            "/data-packages",
            "/data-resources",
            "/data-resources/resource_000001/party-relations",
            "/parties",
            "/quality-assessments/latest",
            "/shuyuan-meterings/latest",
            "/shuyuan-meterings/metering_000001/details",
            "/utilities/latest",
            "/utilities/utility_000001/trace",
            "/md-dshap/tasks",
            "/md-dshap/tasks/task_000001",
            "/md-dshap/tasks/task_000001/results",
            "/md-dshap/tasks/task_000001/marginal-traces",
            "/contract-constraints",
            "/allocation-scenarios",
            "/allocation-scenarios/allocation_000001/results",
            "/reports",
            "/reports/markdown",
            "/reports/csv",
            "/reports/json",
            "/reports/audit-log",
            "/system/parameters",
            "/system/parameters/DEFAULT_SHUYUAN_BASE_PRICE",
            "/system/parameters/DEFAULT_SHUYUAN_BASE_PRICE/restore-default",
            "/audit-logs",
            "/audit-logs/audit_000001",
        ]

        for path in public_paths:
            with self.subTest(path=path):
                response = self.request("GET", path)
                self.assertFalse(response["success"])
                self.assertEqual("DVAS_NOT_FOUND", response["code"])

    def test_openapi_uses_api_v1_server_base_and_relative_paths(self):
        openapi_text = Path("backend/openapi.yaml").read_text(encoding="utf-8")
        path_lines = [
            line.strip().rstrip(":")
            for line in openapi_text.splitlines()
            if line.startswith("  /")
        ]

        self.assertIn("url: http://127.0.0.1:8000/api/v1", openapi_text)
        self.assertTrue(path_lines)
        self.assertFalse(any(path.startswith("/api/v1") for path in path_lines))
        self.assertIn("/navigation/menu-tree", path_lines)
        self.assertIn("/navigation/button-permissions", path_lines)
        self.assertIn("/dashboard", path_lines)
        self.assertIn("/dashboard/preconditions", path_lines)
        self.assertIn("/dashboard/actions/quick-run", path_lines)
        self.assertIn("/data-resources/{resource_id}/party-relations", path_lines)
        self.assertIn("/quality-assessments/{assessment_id}/details", path_lines)
        self.assertIn("/quality-assessments/{assessment_id}/resource-results", path_lines)
        self.assertIn("/metering/quality/resource-results", path_lines)
        self.assertIn("/metering/quality/resource-results/{resource_id}", path_lines)
        self.assertIn("/shuyuan-meterings/{metering_id}/details", path_lines)
        self.assertIn("/utilities/{utility_id}/trace", path_lines)
        self.assertIn("/md-dshap/tasks", path_lines)
        self.assertIn("/md-dshap/tasks/{task_id}", path_lines)
        self.assertIn("/md-dshap/tasks/{task_id}/results", path_lines)
        self.assertIn("/md-dshap/tasks/{task_id}/marginal-traces", path_lines)
        self.assertIn("/contract-constraints", path_lines)
        self.assertIn("/contract-constraints/{constraint_id}", path_lines)
        self.assertIn("/contract-constraints/{constraint_id}/status", path_lines)
        self.assertIn("/allocation-scenarios", path_lines)
        self.assertIn("/allocation-scenarios/{allocation_id}/simulate", path_lines)
        self.assertIn("/allocation-scenarios/{allocation_id}/lock", path_lines)
        self.assertIn("/allocation-scenarios/{allocation_id}/results", path_lines)
        self.assertIn("/reports", path_lines)
        self.assertIn("/reports/markdown", path_lines)
        self.assertIn("/reports/csv", path_lines)
        self.assertIn("/reports/json", path_lines)
        self.assertIn("/reports/audit-log", path_lines)
        self.assertIn("/system/parameters", path_lines)
        self.assertIn("/system/parameters/{parameter_code}", path_lines)
        self.assertIn("/system/parameters/{parameter_code}/restore-default", path_lines)
        self.assertIn("/audit-logs", path_lines)
        self.assertIn("/audit-logs/{log_id}", path_lines)
        self.assertNotIn("/reports/pdf", path_lines)
        self.assertNotIn("/reports/{report_id}/pdf", path_lines)

    def test_quick_run_skeleton_returns_explainable_precondition_failure(self):
        response = self.request("POST", "/api/v1/dashboard/actions/quick-run")

        self.assertFalse(response["success"])
        self.assertEqual("DVAS_PRECONDITION_NOT_MET", response["code"])
        self.assertEqual(
            [{"field": "data_package", "reason": "请先完成数据接入"}],
            response["field_errors"],
        )

    def test_http_adapter_serializes_json_response(self):
        status, headers, raw_body = self.app.handle_http("GET", "/api/v1/projects/current", b"")

        self.assertEqual(401, status)
        parsed = json.loads(raw_body.decode("utf-8"))
        self.assertEqual("DVAS_AUTH_REQUIRED", parsed["code"])

        token = self.login_token()
        status, headers, raw_body = self.app.handle_http(
            "GET",
            "/api/v1/projects/current",
            b"",
            {"Authorization": f"Bearer {token}"},
        )

        self.assertEqual(200, status)
        self.assertEqual("application/json; charset=utf-8", headers["Content-Type"])
        self.assertEqual("*", headers["Access-Control-Allow-Origin"])
        parsed = json.loads(raw_body.decode("utf-8"))
        self.assertEqual("OK", parsed["code"])

    def test_http_adapter_supports_cors_preflight_for_frontend(self):
        status, headers, raw_body = self.app.handle_http("OPTIONS", "/api/v1/projects/current", b"")

        self.assertEqual(204, status)
        self.assertEqual("*", headers["Access-Control-Allow-Origin"])
        self.assertIn("GET", headers["Access-Control-Allow-Methods"])
        self.assertEqual(b"", raw_body)

    def test_json_file_repository_persists_state_between_instances(self):
        import tempfile
        from pathlib import Path

        from backend.dvas.repository import JsonFileRepository

        with tempfile.TemporaryDirectory() as temp_dir:
            state_path = Path(temp_dir) / "state.json"
            first = JsonFileRepository(state_path)
            app = DvasApplication(first)

            app.handle("POST", "/api/v1/demo-cases/lung_screening_demo/initialize")

            second = JsonFileRepository(state_path)
            restored = DvasApplication(second)
            data = self.assert_ok(restored.handle("GET", "/api/v1/projects/current"))
            packages = self.assert_ok(restored.handle("GET", "/api/v1/data-packages"))

            self.assertEqual("INGESTED", data["project_status"])
            self.assertEqual(1, packages["total"])

    def test_bind_resource_party_relation_updates_resource_and_audit_log(self):
        initialized = self.assert_ok(
            self.request("POST", "/api/v1/demo-cases/lung_screening_demo/initialize")
        )
        resource_id = initialized["resources"][0]["resource_id"]
        party_id = initialized["parties"][1]["party_id"]

        data = self.assert_ok(
            self.request(
                "PUT",
                f"/api/v1/data-resources/{resource_id}/party-relations",
                {
                    "relations": [
                        {
                            "party_id": party_id,
                            "split_ratio": 1,
                            "is_primary_provider": True,
                        }
                    ]
                },
            )
        )

        self.assertEqual(resource_id, data["resource_id"])
        self.assertEqual(party_id, data["party_id"])
        self.assertEqual("示例数据源主体B", data["provider_party_name"])
        self.assertEqual(
            [{"party_id": party_id, "split_ratio": 1.0, "is_primary_provider": True}],
            data["party_relations"],
        )

    def test_bind_resource_party_relation_rejects_invalid_split_ratio(self):
        initialized = self.assert_ok(
            self.request("POST", "/api/v1/demo-cases/lung_screening_demo/initialize")
        )
        resource_id = initialized["resources"][0]["resource_id"]
        party_id = initialized["parties"][0]["party_id"]

        response = self.request(
            "PUT",
            f"/api/v1/data-resources/{resource_id}/party-relations",
            {"relations": [{"party_id": party_id, "split_ratio": "bad"}]},
        )

        self.assertFalse(response["success"])
        self.assertEqual("DVAS_FACTOR_INVALID", response["code"])
        self.assertEqual(
            [
                {
                    "field": "relations[0].split_ratio",
                    "reason": "split_ratio 必须是 0 到 1 之间的数字",
                }
            ],
            response["field_errors"],
        )

    def test_party_create_update_and_disable_are_versioned_write_operations(self):
        self.request("POST", "/api/v1/demo-cases/lung_screening_demo/initialize")

        created = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/parties",
                {
                    "party_name": "新增运营主体",
                    "party_type": "OPERATOR",
                    "description": "合同优先分配主体",
                },
            )
        )
        self.assertEqual("OPERATOR", created["party_type"])
        self.assertFalse(created["include_in_md_dshap"])
        self.assertEqual("ENABLED", created["status"])

        updated = self.assert_ok(
            self.request(
                "PUT",
                f"/api/v1/parties/{created['party_id']}",
                {
                    "party_name": "新增运营主体-已更新",
                    "party_type": "TECH_SERVICE",
                    "include_in_md_dshap": False,
                },
            )
        )
        self.assertEqual("新增运营主体-已更新", updated["party_name"])
        self.assertEqual("TECH_SERVICE", updated["party_type"])

        disabled = self.assert_ok(
            self.request(
                "PATCH",
                f"/api/v1/parties/{created['party_id']}/status",
                {"status": "DISABLED", "reason": "P0 联调停用"},
            )
        )
        self.assertEqual("DISABLED", disabled["status"])

    def test_quality_assessment_run_latest_and_details_progress_project_to_assessed(self):
        initialized = self.assert_ok(
            self.request("POST", "/api/v1/demo-cases/lung_screening_demo/initialize")
        )
        package_id = initialized["package"]["package_id"]

        assessment = self.assert_ok(
            self.request("POST", "/api/v1/quality-assessments/run", {"package_id": package_id})
        )

        self.assertEqual("ASSESSED", assessment["project_status"])
        self.assertTrue(assessment["assessment"]["assessment_id"].startswith("assessment_"))
        self.assertGreater(assessment["assessment"]["quality_score"], 0)
        self.assertEqual("DVAS_QUALITY_7P17S_V1", assessment["assessment"]["algorithm_version"])
        self.assertTrue(assessment["assessment"]["output_snapshot_id"].startswith("snapshot_"))
        self.assertEqual(7, assessment["assessment"]["primary_metric_count"])
        self.assertEqual(17, assessment["assessment"]["secondary_metric_count"])
        self.assertEqual(24, len(assessment["details"]))
        self.assertEqual(assessment["details"], assessment["assessment"]["quality_score_detail"])
        self.assertEqual(assessment["details"], assessment["quality_score_detail"])
        primary_details = [item for item in assessment["details"] if item["metric_level"] == 1]
        secondary_details = [item for item in assessment["details"] if item["metric_level"] == 2]
        self.assertEqual(7, len(primary_details))
        self.assertEqual(17, len(secondary_details))
        self.assertEqual(
            {metric_name for _, metric_name, _, _ in QUALITY_PRIMARY_METRICS},
            {item["metric_name"] for item in primary_details},
        )
        self.assertEqual(
            {metric_name for _, metric_name, _, _, _ in QUALITY_SECONDARY_METRICS},
            {item["metric_name"] for item in secondary_details},
        )
        self.assertNotIn("可用性", {item["metric_name"] for item in primary_details})
        self.assertEqual(
            round(sum(item["weighted_score"] for item in primary_details), 2),
            assessment["assessment"]["quality_score"],
        )
        for parent_metric_code, _, _, _ in QUALITY_PRIMARY_METRICS:
            child_weight_sum = round(
                sum(
                    item["weight"]
                    for item in secondary_details
                    if item["parent_metric_code"] == parent_metric_code
                ),
                6,
            )
            self.assertEqual(1.0, child_weight_sum)

        latest = self.assert_ok(self.request("GET", "/api/v1/quality-assessments/latest"))
        self.assertEqual(assessment["assessment"]["assessment_id"], latest["assessment_id"])

        details = self.assert_ok(
            self.request(
                "GET",
                f"/api/v1/quality-assessments/{assessment['assessment']['assessment_id']}/details",
            )
        )
        self.assertEqual(assessment["assessment"]["assessment_id"], details["assessment_id"])
        self.assertEqual(assessment["details"], details["details"])

    def test_quality_resource_results_generate_resource_scores_and_heatmap(self):
        uploaded = self.upload_ten_resource_quality_sample()
        package_id = uploaded["package"]["package_id"]
        assessment = self.assert_ok(
            self.request("POST", "/api/v1/quality-assessments/run", {"package_id": package_id})
        )

        resource_results = self.assert_ok(
            self.request(
                "GET",
                "/api/v1/metering/quality/resource-results?assessment_id=latest",
            )
        )

        self.assertEqual(assessment["assessment"]["assessment_id"], resource_results["assessment_id"])
        self.assertEqual(10, resource_results["assessed_resource_count"])
        self.assertIsInstance(resource_results["average_resource_score"], (int, float))
        self.assertIsInstance(resource_results["low_score_resource_count"], int)
        self.assertEqual(0, resource_results["low_score_resource_count"])
        self.assertEqual(7, len(resource_results["dimensions"]))
        self.assertEqual(10, len(resource_results["resources"]))
        self.assertEqual(10, len(resource_results["heatmap"]["rows"]))
        self.assertEqual(10, len(resource_results["heatmap"]["values"]))
        self.assertEqual(
            len(resource_results["resources"]),
            len(resource_results["heatmap"]["rows"]),
        )
        for values in resource_results["heatmap"]["values"]:
            self.assertEqual(7, len(values))
            self.assertTrue(all(isinstance(value, (int, float)) for value in values))

        for resource in resource_results["resources"]:
            self.assertGreaterEqual(resource["total_score"], 0)
            self.assertLessEqual(resource["total_score"], 100)
            self.assertTrue(resource["lowest_dimension_code"])
            self.assertTrue(resource["lowest_dimension_name"])
            self.assertEqual(7, len(resource["dimension_scores"]))
            self.assertEqual(
                {metric_code for metric_code, _, _, _ in QUALITY_PRIMARY_METRICS},
                set(resource["dimension_scores"]),
            )

        stored_assessments = self.repository.list_quality_resource_assessments(
            assessment_id=resource_results["assessment_id"]
        )
        stored_details = self.repository.list_quality_resource_score_details(
            assessment_id=resource_results["assessment_id"]
        )
        self.assertEqual(10, len(stored_assessments))
        self.assertEqual(10 * 24, len(stored_details))

        selected_resource = resource_results["resources"][0]
        resource_detail = self.assert_ok(
            self.request(
                "GET",
                (
                    "/api/v1/metering/quality/resource-results/"
                    f"{selected_resource['resource_id']}?assessment_id=latest"
                ),
            )
        )
        self.assertEqual(resource_results["assessment_id"], resource_detail["assessment_id"])
        self.assertEqual(selected_resource["resource_id"], resource_detail["resource_id"])
        self.assertEqual(selected_resource["resource_id"], resource_detail["resource"]["resource_id"])
        self.assertEqual(7, resource_detail["primary_metric_count"])
        self.assertEqual(17, resource_detail["secondary_metric_count"])
        self.assertEqual(24, len(resource_detail["details"]))
        self.assertEqual(
            {metric_code for metric_code, _, _, _ in QUALITY_PRIMARY_METRICS},
            {item["metric_code"] for item in resource_detail["primary_details"]},
        )
        self.assertEqual(
            {metric_code for metric_code, _, _, _, _ in QUALITY_SECONDARY_METRICS},
            {item["metric_code"] for item in resource_detail["secondary_details"]},
        )
        for detail in resource_detail["details"]:
            self.assertIn("score", detail)
            self.assertIn("weight", detail)
            self.assertIn("evidence_text", detail)

    def test_quality_resource_results_backfills_once_for_existing_assessment(self):
        uploaded = self.upload_ten_resource_quality_sample()
        quality = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/quality-assessments/run",
                {"package_id": uploaded["package"]["package_id"]},
            )
        )
        assessment_id = quality["assessment"]["assessment_id"]
        self.repository.state["quality_resource_assessments"] = {}
        self.repository.state["quality_resource_score_details"] = {}

        first = self.assert_ok(
            self.request(
                "GET",
                f"/api/v1/metering/quality/resource-results?assessment_id={assessment_id}",
            )
        )
        stored_count_after_first = len(
            self.repository.list_quality_resource_assessments(assessment_id=assessment_id)
        )
        detail_count_after_first = len(
            self.repository.list_quality_resource_score_details(assessment_id=assessment_id)
        )
        second = self.assert_ok(
            self.request(
                "GET",
                f"/api/v1/quality-assessments/{assessment_id}/resource-results",
            )
        )

        self.assertEqual(10, first["assessed_resource_count"])
        self.assertEqual(first["resources"], second["resources"])
        self.assertEqual(
            stored_count_after_first,
            len(self.repository.list_quality_resource_assessments(assessment_id=assessment_id)),
        )
        self.assertEqual(
            detail_count_after_first,
            len(self.repository.list_quality_resource_score_details(assessment_id=assessment_id)),
        )

    def test_quality_assessment_requires_ingested_package(self):
        response = self.request("POST", "/api/v1/quality-assessments/run", {})

        self.assertFalse(response["success"])
        self.assertEqual("DVAS_PRECONDITION_NOT_MET", response["code"])
        self.assertEqual(
            [{"field": "package_id", "reason": "请先完成数据接入"}],
            response["field_errors"],
        )

    def test_shuyuan_metering_requires_quality_assessment(self):
        self.request("POST", "/api/v1/demo-cases/lung_screening_demo/initialize")

        response = self.request("POST", "/api/v1/shuyuan-meterings/run", {})

        self.assertFalse(response["success"])
        self.assertEqual("DVAS_PRECONDITION_NOT_MET", response["code"])
        self.assertEqual(
            [{"field": "quality_assessment", "reason": "请先完成质量评估"}],
            response["field_errors"],
        )

    def test_shuyuan_metering_run_latest_and_details_progress_project_to_metered(self):
        self.request("POST", "/api/v1/demo-cases/lung_screening_demo/initialize")
        quality = self.assert_ok(self.request("POST", "/api/v1/quality-assessments/run", {}))

        result = self.assert_ok(self.request("POST", "/api/v1/shuyuan-meterings/run", {}))

        metering = result["metering"]
        parameters = metering["parameter_snapshot_json"]
        resource_quality_factors = {
            item["resource_id"]: item["quality_factor"]
            for item in quality["resource_quality"]["resources"]
        }
        expected_amount = round(sum(item["metering_amount"] for item in result["details"]), 2)
        self.assertEqual("METERED", result["project_status"])
        self.assertTrue(metering["metering_id"].startswith("metering_"))
        self.assertEqual(quality["assessment"]["assessment_id"], metering["assessment_id"])
        self.assertEqual(expected_amount, metering["metering_amount"])
        self.assertEqual("DVAS_SHUYUAN_METERING_RESOURCE_QUALITY_V1", metering["algorithm_version"])
        self.assertTrue(metering["parameter_snapshot_id"].startswith("snapshot_"))
        self.assertTrue(metering["output_snapshot_id"].startswith("snapshot_"))
        self.assertGreaterEqual(len(result["details"]), 2)
        self.assertEqual(expected_amount, round(sum(item["metering_amount"] for item in result["details"]), 2))
        for detail in result["details"]:
            self.assertEqual(resource_quality_factors[detail["resource_id"]], detail["resource_quality_factor"])
            self.assertEqual(detail["resource_quality_factor"], detail["quality_coefficient"])
            self.assertEqual("RESOURCE_QUALITY_ASSESSMENT", detail["quality_factor_source"])
            detail_amount = round(
                parameters["base_price"]
                * parameters["scenario_coefficient"]
                * detail["quality_coefficient"]
                * parameters["technology_coefficient"]
                * parameters["expert_coefficient"]
                * parameters["development_coefficient"]
                * detail["call_count"],
                2,
            )
            self.assertEqual(detail_amount, detail["metering_amount"])

        latest = self.assert_ok(self.request("GET", "/api/v1/shuyuan-meterings/latest"))
        self.assertEqual(metering["metering_id"], latest["metering_id"])

        details = self.assert_ok(
            self.request("GET", f"/api/v1/shuyuan-meterings/{metering['metering_id']}/details")
        )
        self.assertEqual(metering["metering_id"], details["metering_id"])
        self.assertEqual(result["details"], details["details"])

    def test_contribution_and_utility_flow_progresses_to_utility_calculated(self):
        self.request("POST", "/api/v1/demo-cases/lung_screening_demo/initialize")
        self.request("POST", "/api/v1/quality-assessments/run", {})
        self.request("POST", "/api/v1/shuyuan-meterings/run", {})
        metering = self.repository.list_shuyuan_meterings()[-1]
        metering_details = self.repository.get_shuyuan_metering_details(metering["metering_id"])

        contribution = self.assert_ok(self.request("POST", "/api/v1/contributions/run", {}))

        self.assertEqual("METERED", contribution["project_status"])
        self.assertGreaterEqual(len(contribution["records"]), 1)
        normalized_total = round(
            sum(item["normalized_contribution"] for item in contribution["records"]),
            6,
        )
        self.assertEqual(1.0, normalized_total)
        for record in contribution["records"]:
            expected_score = round(
                record["valid_units"]
                * record["usage_weight"]
                * record["coverage_weight"]
                * record["scarcity_weight"],
                6,
            )
            self.assertEqual(expected_score, record["contribution_score"])

        utility = self.assert_ok(self.request("POST", "/api/v1/utilities/run", {}))
        self.assertEqual("UTILITY_CALCULATED", utility["project_status"])
        self.assertTrue(utility["utility"]["utility_id"].startswith("utility_"))
        self.assertEqual("DVAS_UTILITY_PARTY_QUALITY_V1", utility["utility"]["algorithm_version"])
        self.assertGreaterEqual(len(utility["trace"]), 1)
        expected_quality_by_party = self.weighted_quality_factor_by_party(metering_details)
        for trace in utility["trace"]:
            self.assertEqual(expected_quality_by_party[trace["party_id"]], trace["quality_factor"])
            self.assertEqual("SHUYUAN_RESOURCE_WEIGHTED_AVERAGE", trace["quality_factor_source"])
            expected_value = round(
                trace["normalized_contribution"]
                * trace["quality_factor"]
                * trace["usage_factor"]
                * trace["scenario_factor"],
                6,
            )
            self.assertEqual(expected_value, trace["utility_value"])

        latest = self.assert_ok(self.request("GET", "/api/v1/utilities/latest"))
        self.assertEqual(utility["utility"]["utility_id"], latest["utility_id"])

        trace = self.assert_ok(
            self.request("GET", f"/api/v1/utilities/{utility['utility']['utility_id']}/trace")
        )
        self.assertEqual(utility["utility"]["utility_id"], trace["utility_id"])
        self.assertEqual(utility["trace"], trace["trace"])

        preconditions = self.assert_ok(self.request("GET", "/api/v1/dashboard/preconditions"))
        self.assertEqual("UTILITY_CALCULATED", preconditions["project_status"])
        self.assertIn("MDS-011", preconditions["available_actions"])

    def weighted_quality_factor_by_party(self, metering_details):
        grouped = {}
        for detail in metering_details:
            party_id = detail["party_id"]
            weight = detail.get("valid_units") or detail.get("call_count") or 1
            bucket = grouped.setdefault(party_id, {"weighted": 0.0, "weight": 0.0})
            bucket["weighted"] += detail["resource_quality_factor"] * weight
            bucket["weight"] += weight
        return {
            party_id: round(bucket["weighted"] / bucket["weight"], 6)
            for party_id, bucket in grouped.items()
        }

    def test_utility_requires_contribution_records(self):
        self.request("POST", "/api/v1/demo-cases/lung_screening_demo/initialize")
        self.request("POST", "/api/v1/quality-assessments/run", {})
        self.request("POST", "/api/v1/shuyuan-meterings/run", {})

        response = self.request("POST", "/api/v1/utilities/run", {})

        self.assertFalse(response["success"])
        self.assertEqual("DVAS_PRECONDITION_NOT_MET", response["code"])
        self.assertEqual(
            [{"field": "contribution_records", "reason": "请先完成贡献度计算"}],
            response["field_errors"],
        )

    def test_dashboard_preconditions_progress_quality_metering_utility_actions(self):
        self.request("POST", "/api/v1/demo-cases/lung_screening_demo/initialize")

        ingested = self.assert_ok(self.request("GET", "/api/v1/dashboard/preconditions"))
        self.assertIn({"button_code": "DU-009", "reason": "请先完成质量评估"}, ingested["disabled_actions"])
        self.assertIn({"button_code": "UTIL-006", "reason": "请先完成数元计量"}, ingested["disabled_actions"])
        self.assertIn({"button_code": "UTIL-008", "reason": "请先完成贡献度计算"}, ingested["disabled_actions"])
        self.assertIn({"button_code": "MDS-011", "reason": "请先完成效用计算"}, ingested["disabled_actions"])

        self.request("POST", "/api/v1/quality-assessments/run", {})
        assessed = self.assert_ok(self.request("GET", "/api/v1/dashboard/preconditions"))
        self.assertIn("DU-009", assessed["available_actions"])
        self.assertIn({"button_code": "UTIL-006", "reason": "请先完成数元计量"}, assessed["disabled_actions"])

        self.request("POST", "/api/v1/shuyuan-meterings/run", {})
        metered = self.assert_ok(self.request("GET", "/api/v1/dashboard/preconditions"))
        self.assertIn("UTIL-006", metered["available_actions"])
        self.assertIn({"button_code": "UTIL-008", "reason": "请先完成贡献度计算"}, metered["disabled_actions"])

        self.request("POST", "/api/v1/contributions/run", {})
        contributed = self.assert_ok(self.request("GET", "/api/v1/dashboard/preconditions"))
        self.assertIn("UTIL-008", contributed["available_actions"])
        self.assertIn({"button_code": "MDS-011", "reason": "请先完成效用计算"}, contributed["disabled_actions"])

    def test_md_dshap_requires_utility_calculation(self):
        self.request("POST", "/api/v1/demo-cases/lung_screening_demo/initialize")

        response = self.request("POST", "/api/v1/md-dshap/tasks", {})

        self.assertFalse(response["success"])
        self.assertEqual("DVAS_PRECONDITION_NOT_MET", response["code"])
        self.assertEqual(
            [{"field": "project_status", "reason": "请先完成效用计算"}],
            response["field_errors"],
        )

    def test_md_dshap_single_provider_simplifies_to_weight_one_and_updates_project(self):
        self.run_single_provider_to_utility()

        data = self.assert_ok(self.request("POST", "/api/v1/md-dshap/tasks", {}))

        task = data["task"]
        results = data["results"]
        self.assertEqual("WEIGHT_CALCULATED", data["project_status"])
        self.assertEqual("MD_DSHAP", task["algorithm_mode"])
        self.assertEqual("COMPLETED", task["status"])
        self.assertEqual(1, data["result_count"])
        self.assertEqual(1, data["algorithm_party_count"])
        self.assertEqual(1, data["contract_party_count"])
        self.assertEqual(1, task["algorithm_party_count"])
        self.assertEqual(1, task["contract_party_count"])
        self.assertEqual(1, len(results))
        self.assertEqual(1, len(task["participant_set"]))
        self.assertEqual(1.0, results[0]["participant_weight"])
        self.assertEqual(1.0, results[0]["normalized_weight"])
        self.assertIn("single-data-provider", data["approximation_note"])

        project = self.assert_ok(self.request("GET", "/api/v1/projects/current"))
        self.assertEqual(task["task_id"], project["current_algorithm_task_id"])

    def test_md_dshap_multiple_providers_sum_to_one_and_exclude_non_data_parties(self):
        self.run_demo_to_utility()

        data = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/md-dshap/tasks",
                {"seed": 20260618, "sample_rounds": 16, "epsilon": 0.0001},
            )
        )

        task = data["task"]
        results = data["results"]
        self.assertEqual("WEIGHT_CALCULATED", data["project_status"])
        self.assertEqual(2, len(task["participant_set"]))
        self.assertNotIn("示例运营服务方", [item["party_name"] for item in task["participant_set"]])
        self.assertEqual(2, data["algorithm_party_count"])
        self.assertEqual(1, data["contract_party_count"])
        self.assertEqual(2, task["algorithm_party_count"])
        self.assertEqual(1, task["contract_party_count"])
        self.assertIn("示例运营服务方", [item["party_name"] for item in task["excluded_parties"]])
        self.assertEqual(2, data["result_count"])
        self.assertAlmostEqual(1.0, sum(item["normalized_weight"] for item in results), places=6)
        for result in results:
            self.assertEqual(round(result["normalized_weight"], 6), result["normalized_weight"])
            self.assertIn("baseline_weight", result)
            self.assertIn("weight_diff", result)
            self.assertIn("P0_DETERMINISTIC_UTILITY", result["task_level_weight_json"])
            self.assertIn("weight-layer reference", result["approximation_note"])

    def test_md_dshap_task_results_and_marginal_trace_endpoints_return_rows(self):
        self.run_demo_to_utility()
        created = self.assert_ok(self.request("POST", "/api/v1/md-dshap/tasks", {}))
        task_id = created["task"]["task_id"]

        task = self.assert_ok(self.request("GET", f"/api/v1/md-dshap/tasks/{task_id}"))
        task_list = self.assert_ok(self.request("GET", "/api/v1/allocation/md-dshap/tasks"))
        legacy_task_list = self.assert_ok(self.request("GET", "/api/v1/md-dshap/tasks"))
        results = self.assert_ok(self.request("GET", f"/api/v1/md-dshap/tasks/{task_id}/results"))
        traces = self.assert_ok(
            self.request("GET", f"/api/v1/md-dshap/tasks/{task_id}/marginal-traces")
        )

        self.assertEqual(task_id, task["task_id"])
        self.assertTrue(any(item["task_id"] == task_id for item in task_list["items"]))
        self.assertTrue(any(item["task_id"] == task_id for item in legacy_task_list["items"]))
        self.assertTrue(task["parameter_snapshot_id"].startswith("snapshot_"))
        self.assertTrue(task["algorithm_audit_snapshot_id"].startswith("snapshot_"))
        self.assertEqual(created["results"], results["items"])
        self.assertGreaterEqual(len(traces["items"]), len(created["results"]))
        first_trace = traces["items"][0]
        self.assertEqual(task_id, first_trace["task_id"])
        self.assertIn("coalition_before", first_trace)
        self.assertIn("marginal_contribution", first_trace)

    def test_md_dshap_rerun_creates_new_task_and_preserves_previous_results(self):
        self.run_demo_to_utility()
        first = self.assert_ok(self.request("POST", "/api/v1/md-dshap/tasks", {}))
        second = self.assert_ok(self.request("POST", "/api/v1/md-dshap/tasks", {"seed": 99}))

        self.assertNotEqual(first["task"]["task_id"], second["task"]["task_id"])
        first_results = self.assert_ok(
            self.request("GET", f"/api/v1/md-dshap/tasks/{first['task']['task_id']}/results")
        )
        second_results = self.assert_ok(
            self.request("GET", f"/api/v1/md-dshap/tasks/{second['task']['task_id']}/results")
        )

        self.assertEqual(first["results"], first_results["items"])
        self.assertEqual(second["results"], second_results["items"])

    def test_dashboard_preconditions_report_mds_weight_result_after_run(self):
        self.run_demo_to_utility()
        ready = self.assert_ok(self.request("GET", "/api/v1/dashboard/preconditions"))
        self.assertIn("MDS-011", ready["available_actions"])

        self.request("POST", "/api/v1/md-dshap/tasks", {})
        weighted = self.assert_ok(self.request("GET", "/api/v1/dashboard/preconditions"))

        self.assertIn(
            {"code": "HAS_MDS_WEIGHT_RESULT", "passed": True, "message": "已完成 MD-DShap 权重计算"},
            weighted["preconditions"],
        )
        self.assertIn("MDS-011", weighted["available_actions"])

    def test_allocation_scenario_requires_md_dshap_weight_result(self):
        self.run_demo_to_utility()

        response = self.request(
            "POST",
            "/api/v1/allocation-scenarios",
            {"total_revenue": 1000, "priority_allocation_amount": 0},
        )

        self.assertFalse(response["success"])
        self.assertEqual("DVAS_PRECONDITION_NOT_MET", response["code"])
        self.assertEqual(
            [{"field": "weight_task_id", "reason": "请先完成 MD-DShap 权重计算"}],
            response["field_errors"],
        )

    def test_create_allocation_scenario_after_weight_calculated(self):
        weight = self.run_demo_to_weights()

        scenario = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/allocation-scenarios",
                {"total_revenue": 1000, "priority_allocation_amount": 100},
            )
        )

        self.assertTrue(scenario["allocation_id"].startswith("allocation_"))
        self.assertEqual(weight["task"]["task_id"], scenario["weight_task_id"])
        self.assertEqual(1000.0, scenario["total_revenue"])
        self.assertEqual(100.0, scenario["priority_allocation_amount"])
        self.assertEqual(900.0, scenario["data_provider_revenue_pool"])
        self.assertEqual("DRAFT", scenario["status"])

    def test_allocation_simulation_creates_results_and_allocated_status(self):
        self.run_demo_to_weights()
        scenario = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/allocation-scenarios",
                {"total_revenue": 1000, "priority_allocation_amount": 100},
            )
        )

        simulated = self.assert_ok(
            self.request("POST", f"/api/v1/allocation-scenarios/{scenario['allocation_id']}/simulate", {})
        )

        self.assertEqual("ALLOCATED", simulated["project_status"])
        self.assertEqual("ALLOCATED", simulated["allocation"]["status"])
        self.assertEqual(scenario["allocation_id"], simulated["allocation"]["allocation_id"])
        self.assertGreaterEqual(len(simulated["results"]), 3)
        self.assertEqual(
            1000.0,
            round(sum(item["post_constraint_amount"] for item in simulated["results"]), 2),
        )
        self.assertEqual(
            900.0,
            round(sum(item["post_constraint_amount"] for item in simulated["data_provider_allocations"]), 2),
        )
        project = self.assert_ok(self.request("GET", "/api/v1/projects/current"))
        self.assertEqual(scenario["allocation_id"], project["current_allocation_id"])

    def test_allocation_priority_amount_cannot_exceed_total_revenue(self):
        self.run_demo_to_weights()

        response = self.request(
            "POST",
            "/api/v1/allocation-scenarios",
            {"total_revenue": 100, "priority_allocation_amount": 120},
        )

        self.assertFalse(response["success"])
        self.assertEqual("DVAS_CONTRACT_PRIORITY_EXCEEDS_TOTAL_REVENUE", response["code"])
        self.assertEqual(
            [{"field": "contract_priority_allocations", "reason": "合同优先分配合计不能超过总收益"}],
            response["field_errors"],
        )

    def test_non_data_contract_priority_is_capped_before_data_provider_pool(self):
        self.run_demo_to_weights()
        parties = self.assert_ok(self.request("GET", "/api/v1/parties"))["items"]
        non_data_party = next(item for item in parties if item["party_type"] != "DATA_PROVIDER")

        scenario = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/allocation-scenarios",
                {
                    "total_revenue": 1000,
                    "priority_items": [
                        {
                            "party_id": non_data_party["party_id"],
                            "value_type": "AMOUNT",
                            "priority_amount": 300,
                            "cap_amount": 120,
                            "basis_text": "运营服务合同上限",
                        }
                    ],
                },
            )
        )
        simulated = self.assert_ok(
            self.request("POST", f"/api/v1/allocation-scenarios/{scenario['allocation_id']}/simulate", {})
        )

        priority_rows = simulated["contract_priority_allocations"]
        self.assertEqual(120.0, simulated["summary"]["total_contract_priority_amount"])
        self.assertEqual(1000.0, simulated["summary"]["total_revenue"])
        self.assertEqual(880.0, simulated["summary"]["data_provider_revenue_pool"])
        self.assertIn("data_provider_allocations", simulated)
        self.assertIn("constraints", simulated)
        self.assertEqual(1, len(priority_rows))
        self.assertEqual(non_data_party["party_id"], priority_rows[0]["party_id"])
        self.assertEqual(300.0, priority_rows[0]["requested_amount"])
        self.assertEqual(120.0, priority_rows[0]["cap_amount"])
        self.assertEqual(120.0, priority_rows[0]["actual_priority_amount"])
        self.assertEqual("CONTRACT_PRIORITY", priority_rows[0]["subject_track"])
        priority_result = next(item for item in simulated["results"] if item["party_id"] == non_data_party["party_id"])
        self.assertEqual("CONTRACT_PRIORITY", priority_result["subject_track"])
        self.assertEqual("CONTRACT_PRIORITY", priority_result["amount_source"])
        self.assertTrue(all(item["subject_track"] == "DATA_PROVIDER_POOL" for item in simulated["data_provider_allocations"]))
        self.assertTrue(
            all(item["subject_track"] in {"DATA_PROVIDER_POOL", "CONTRACT_PRIORITY"} for item in simulated["results"])
        )
        self.assertEqual(
            880.0,
            round(sum(item["post_constraint_amount"] for item in simulated["data_provider_allocations"]), 2),
        )
        self.assertEqual(
            1000.0,
            round(sum(item["post_constraint_amount"] for item in simulated["results"]), 2),
        )

        result_page = self.assert_ok(
            self.request("GET", f"/api/v1/allocation-scenarios/{scenario['allocation_id']}/results")
        )
        self.assertEqual(simulated["summary"], result_page["summary"])
        self.assertEqual(priority_rows, result_page["contract_priority_allocations"])
        self.assertIn("constraints", result_page)

    def test_allocation_simulation_run_payload_creates_new_scenario_when_current_exists(self):
        self.run_demo_to_weights()
        parties = self.assert_ok(self.request("GET", "/api/v1/parties"))["items"]
        non_data_party = next(item for item in parties if item["party_type"] != "DATA_PROVIDER")
        old_scenario = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/allocation-scenarios",
                {"total_revenue": 1000, "priority_allocation_amount": 100},
            )
        )
        self.assert_ok(
            self.request("POST", f"/api/v1/allocation-scenarios/{old_scenario['allocation_id']}/simulate", {})
        )

        simulated = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/allocation/simulation/run",
                {
                    "total_revenue": 1000,
                    "priority_items": [
                        {
                            "party_id": non_data_party["party_id"],
                            "value_type": "AMOUNT",
                            "priority_amount": 300,
                            "cap_amount": 120,
                        }
                    ],
                },
            )
        )

        self.assertNotEqual(old_scenario["allocation_id"], simulated["allocation"]["allocation_id"])
        self.assertEqual(120.0, simulated["summary"]["total_contract_priority_amount"])
        self.assertEqual(880.0, simulated["summary"]["data_provider_revenue_pool"])
        self.assertEqual(1, len(simulated["contract_priority_allocations"]))
        self.assertEqual(non_data_party["party_id"], simulated["contract_priority_allocations"][0]["party_id"])

    def test_contract_ratio_api_returns_empty_state_before_save(self):
        project_id = self.repository.get_project()["project_id"]

        data = self.assert_ok(
            self.request("GET", f"/api/v1/projects/{project_id}/allocation/contract-ratio")
        )
        summary = self.assert_ok(
            self.request("GET", f"/api/v1/projects/{project_id}/allocation/summary")
        )

        self.assertFalse(data["configured"])
        self.assertEqual("EMPTY", data["status"])
        self.assertEqual([], data["items"])
        self.assertFalse(data["can_simulate"])
        self.assertFalse(summary["contract_ratio_configured"])
        self.assertEqual(["请先配置并保存合同比例分配方案"], summary["blocking_reasons"])

    def test_contract_ratio_empty_state_reads_demo_total_revenue(self):
        self.assert_ok(self.request("POST", "/api/v1/demo-cases/lung_screening_demo/select", {}))
        project_id = self.repository.get_project()["project_id"]

        data = self.assert_ok(
            self.request("GET", f"/api/v1/projects/{project_id}/allocation/contract-ratio")
        )
        summary = self.assert_ok(
            self.request("GET", f"/api/v1/projects/{project_id}/allocation/summary")
        )

        self.assertFalse(data["configured"])
        self.assertEqual("EMPTY", data["status"])
        self.assertEqual("1200000.00", data["total_revenue"])
        self.assertEqual("1200000.00", summary["total_revenue"])
        self.assertEqual(["请先配置并保存合同比例分配方案"], summary["blocking_reasons"])

    def test_contract_ratio_rejects_invalid_sum_and_data_provider_party(self):
        self.run_demo_to_weights()
        project_id = self.repository.get_project()["project_id"]
        parties = self.assert_ok(self.request("GET", "/api/v1/parties"))["items"]
        data_provider = next(item for item in parties if item["party_type"] == "DATA_PROVIDER")

        invalid_sum = self.request(
            "PUT",
            f"/api/v1/projects/{project_id}/allocation/contract-ratio",
            self.contract_ratio_payload(pool_ratio="0.800000", item_ratio="0.100000"),
        )
        invalid_party = self.request(
            "PUT",
            f"/api/v1/projects/{project_id}/allocation/contract-ratio",
            {
                "total_revenue": "1000.00",
                "currency": "CNY",
                "data_provider_pool_ratio": "0.900000",
                "items": [
                    {
                        "bucket_type": "NON_DATA_PARTY",
                        "party_id": data_provider["party_id"],
                        "ratio": "0.100000",
                    }
                ],
            },
        )

        self.assertEqual("DVAS_CONTRACT_RATIO_INVALID", invalid_sum["code"])
        self.assertEqual("ratio_sum", invalid_sum["field_errors"][0]["field"])
        self.assertEqual("DVAS_CONTRACT_RATIO_INVALID", invalid_party["code"])
        self.assertEqual("items[0].party_id", invalid_party["field_errors"][0]["field"])

    def test_contract_ratio_save_summary_and_project_simulation(self):
        self.run_demo_to_weights()
        project_id = self.repository.get_project()["project_id"]

        saved = self.assert_ok(
            self.request(
                "PUT",
                f"/api/v1/projects/{project_id}/allocation/contract-ratio",
                self.contract_ratio_payload(),
            )
        )
        reloaded = self.assert_ok(
            self.request("GET", f"/api/v1/projects/{project_id}/allocation/contract-ratio")
        )
        summary = self.assert_ok(
            self.request("GET", f"/api/v1/projects/{project_id}/allocation/summary")
        )
        simulated = self.assert_ok(
            self.request("POST", f"/api/v1/projects/{project_id}/allocation/simulate", {})
        )

        self.assertTrue(saved["configured"])
        self.assertEqual("1.000000", saved["ratio_sum"])
        self.assertEqual("0.900000", saved["data_provider_pool_ratio"])
        self.assertEqual("900.00", saved["data_provider_revenue_pool"])
        self.assertEqual(saved["items"], reloaded["items"])
        self.assertTrue(summary["can_simulate"])
        self.assertEqual("100.00", summary["non_data_contract_amount"])
        self.assertEqual("ALLOCATED", simulated["project_status"])
        self.assertEqual([], simulated["constraint_traces"])
        self.assertEqual([], simulated["constraints"])
        self.assertEqual("1.000000", simulated["summary"]["contract_ratio_sum"])
        self.assertEqual(900.0, simulated["summary"]["data_provider_revenue_pool"])
        self.assertEqual(100.0, simulated["summary"]["non_data_contract_amount"])

        non_data_rows = [item for item in simulated["results"] if item["amount_source"] == "CONTRACT_RATIO"]
        data_provider_rows = [item for item in simulated["results"] if item["amount_source"] == "MD_DSHAP_WEIGHT"]
        self.assertEqual(1, len(non_data_rows))
        self.assertGreaterEqual(len(data_provider_rows), 1)
        self.assertEqual(0.1, non_data_rows[0]["contract_ratio"])
        self.assertAlmostEqual(
            1000.0,
            round(sum(item["final_amount"] for item in simulated["results"]), 2),
            delta=0.01,
        )
        self.assertAlmostEqual(
            900.0,
            round(sum(item["final_amount"] for item in data_provider_rows), 2),
            delta=0.01,
        )

    def test_contract_ratio_project_simulation_requires_saved_plan(self):
        self.run_demo_to_weights()
        project_id = self.repository.get_project()["project_id"]

        response = self.request("POST", f"/api/v1/projects/{project_id}/allocation/simulate", {})

        self.assertFalse(response["success"])
        self.assertEqual("DVAS_CONTRACT_RATIO_REQUIRED", response["code"])
        self.assertEqual("contract_ratio_plan", response["field_errors"][0]["field"])

    def test_contract_ratio_report_exports_include_plan_and_result_fields(self):
        self.run_demo_to_weights()
        project_id = self.repository.get_project()["project_id"]
        self.assert_ok(
            self.request(
                "PUT",
                f"/api/v1/projects/{project_id}/allocation/contract-ratio",
                self.contract_ratio_payload(),
            )
        )
        simulated = self.assert_ok(
            self.request("POST", f"/api/v1/projects/{project_id}/allocation/simulate", {})
        )

        json_export = self.assert_ok(self.request("POST", "/api/v1/reports/json", {}))
        csv_export = self.assert_ok(self.request("POST", "/api/v1/reports/csv", {}))
        markdown_export = self.assert_ok(self.request("POST", "/api/v1/reports/markdown", {}))

        json_payload = json.loads(Path(json_export["report"]["file_path"]).read_text(encoding="utf-8"))
        self.assertEqual(simulated["contract_ratio_plan"], json_payload["contract_ratio_plan"])
        self.assertEqual(simulated["contract_ratio_items"], json_payload["contract_ratio_items"])
        self.assertEqual("1.000000", json_payload["allocation_summary"]["contract_ratio_sum"])
        self.assertEqual(100.0, json_payload["allocation_summary"]["non_data_contract_amount"])
        self.assertEqual(simulated["results"], json_payload["results"])

        csv_files = {item["file_name"]: item for item in csv_export["export_files"]}
        self.assertIn("source_level_allocation.csv", csv_files)
        self.assertNotIn("constraint_apply_trace.csv", csv_files)
        source_rows = self.read_csv_rows(csv_files["source_level_allocation.csv"]["file_path"])
        for field in ["contract_ratio", "base_pool_amount", "amount_source", "final_amount"]:
            self.assertIn(field, source_rows[0])

        markdown = Path(markdown_export["report"]["file_path"]).read_text(encoding="utf-8")
        self.assertIn("合同比例方案ID", markdown)
        self.assertIn("非数据主体合同金额", markdown)
        self.assertIn("合同分配规则追踪摘要", markdown)

    def test_contract_cap_constraint_limits_priority_item_without_schema_change(self):
        self.run_demo_to_weights()
        parties = self.assert_ok(self.request("GET", "/api/v1/parties"))["items"]
        non_data_party = next(item for item in parties if item["party_type"] != "DATA_PROVIDER")
        self.assert_ok(
            self.request(
                "POST",
                "/api/v1/contract-constraints",
                {
                    "party_id": non_data_party["party_id"],
                    "constraint_name": "非数据源合同上限",
                    "constraint_type": "CAP_AMOUNT",
                    "value_type": "AMOUNT",
                    "constraint_value": 80,
                    "priority": 1,
                },
            )
        )

        scenario = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/allocation-scenarios",
                {
                    "total_revenue": 1000,
                    "priority_items": [
                        {
                            "party_id": non_data_party["party_id"],
                            "value_type": "AMOUNT",
                            "priority_amount": 300,
                        }
                    ],
                },
            )
        )

        self.assertEqual(80.0, scenario["priority_allocation_amount"])
        self.assertEqual(920.0, scenario["data_provider_revenue_pool"])
        self.assertEqual(80.0, scenario["contract_priority_allocations"][0]["cap_amount"])

    def test_contract_priority_total_exceeding_revenue_is_blocked(self):
        self.run_demo_to_weights()
        parties = self.assert_ok(self.request("GET", "/api/v1/parties"))["items"]
        non_data_party = next(item for item in parties if item["party_type"] != "DATA_PROVIDER")

        response = self.request(
            "POST",
            "/api/v1/allocation-scenarios",
            {
                "total_revenue": 100,
                "priority_items": [
                    {
                        "party_id": non_data_party["party_id"],
                        "value_type": "AMOUNT",
                        "priority_amount": 120,
                        "cap_amount": 120,
                    }
                ],
            },
        )

        self.assertFalse(response["success"])
        self.assertEqual("DVAS_CONTRACT_PRIORITY_EXCEEDS_TOTAL_REVENUE", response["code"])
        self.assertEqual(
            [{"field": "contract_priority_allocations", "reason": "合同优先分配合计不能超过总收益"}],
            response["field_errors"],
        )

    def test_contract_priority_rejects_data_provider_party(self):
        self.run_demo_to_weights()
        parties = self.assert_ok(self.request("GET", "/api/v1/parties"))["items"]
        data_provider = next(item for item in parties if item["party_type"] == "DATA_PROVIDER")

        response = self.request(
            "POST",
            "/api/v1/allocation-scenarios",
            {
                "total_revenue": 1000,
                "priority_items": [
                    {
                        "party_id": data_provider["party_id"],
                        "value_type": "AMOUNT",
                        "priority_amount": 100,
                    }
                ],
            },
        )

        self.assertFalse(response["success"])
        self.assertEqual("DVAS_PRECONDITION_NOT_MET", response["code"])
        self.assertEqual(
            [
                {
                    "field": "priority_items[0].party_id",
                    "reason": "数据源主体应进入数据源收益池分配，不应作为非数据源合同优先分配项",
                }
            ],
            response["field_errors"],
        )

    def test_contract_constraint_validation_rejects_invalid_amount_and_ratio(self):
        self.run_demo_to_weights()
        party_id = self.assert_ok(self.request("GET", "/api/v1/parties"))["items"][0]["party_id"]

        negative = self.request(
            "POST",
            "/api/v1/contract-constraints",
            {
                "party_id": party_id,
                "constraint_name": "负数下限",
                "constraint_type": "MIN_AMOUNT",
                "value_type": "AMOUNT",
                "constraint_value": -1,
            },
        )
        invalid_ratio = self.request(
            "POST",
            "/api/v1/contract-constraints",
            {
                "party_id": party_id,
                "constraint_name": "超额比例",
                "constraint_type": "FIXED_RATIO",
                "value_type": "RATIO",
                "constraint_value": 1.2,
            },
        )

        self.assertEqual("DVAS_FACTOR_INVALID", negative["code"])
        self.assertEqual(
            [{"field": "constraint_value", "reason": "金额类约束值必须大于等于 0"}],
            negative["field_errors"],
        )
        self.assertEqual("DVAS_FACTOR_INVALID", invalid_ratio["code"])
        self.assertEqual(
            [{"field": "constraint_value", "reason": "比例类约束值必须在 0 到 1 之间"}],
            invalid_ratio["field_errors"],
        )

    def test_disabled_constraints_do_not_affect_allocation_simulation(self):
        self.run_demo_to_weights()
        party_id = self.assert_ok(self.request("GET", "/api/v1/parties"))["items"][0]["party_id"]
        constraint = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/contract-constraints",
                {
                    "party_id": party_id,
                    "constraint_name": "停用上限",
                    "constraint_type": "MAX_AMOUNT",
                    "value_type": "AMOUNT",
                    "constraint_value": 1,
                    "status": "DISABLED",
                },
            )
        )
        scenario = self.assert_ok(
            self.request("POST", "/api/v1/allocation-scenarios", {"total_revenue": 1000})
        )

        simulated = self.assert_ok(
            self.request("POST", f"/api/v1/allocation-scenarios/{scenario['allocation_id']}/simulate", {})
        )

        self.assertEqual("DISABLED", constraint["status"])
        self.assertEqual([], simulated["constraint_traces"])
        self.assertGreater(
            next(item for item in simulated["results"] if item["party_id"] == party_id)[
                "post_constraint_amount"
            ],
            1,
        )

    def test_active_constraint_application_writes_trace_rows(self):
        self.run_demo_to_weights()
        parties = self.assert_ok(self.request("GET", "/api/v1/parties"))["items"]
        target_party_id = parties[0]["party_id"]
        self.assert_ok(
            self.request(
                "POST",
                "/api/v1/contract-constraints",
                {
                    "party_id": target_party_id,
                    "constraint_name": "上限测试",
                    "constraint_type": "MAX_AMOUNT",
                    "value_type": "AMOUNT",
                    "constraint_value": 400,
                    "priority": 1,
                },
            )
        )
        scenario = self.assert_ok(
            self.request("POST", "/api/v1/allocation-scenarios", {"total_revenue": 1000})
        )

        simulated = self.assert_ok(
            self.request("POST", f"/api/v1/allocation-scenarios/{scenario['allocation_id']}/simulate", {})
        )

        self.assertGreaterEqual(len(simulated["constraint_traces"]), 1)
        trace = simulated["constraint_traces"][0]
        self.assertEqual(target_party_id, trace["party_id"])
        self.assertEqual(400.0, trace["after_amount"])
        self.assertIn("MAX_AMOUNT", trace["reason"])
        self.assertIn("constraint_name", trace)
        self.assertIn("constraint_adjustment_amount", trace)

        result_page = self.assert_ok(
            self.request("GET", f"/api/v1/allocation-scenarios/{scenario['allocation_id']}/results")
        )
        self.assertEqual(simulated["constraint_traces"], result_page["constraint_traces"])
        self.assertEqual(simulated["constraint_traces"], result_page["constraint_apply_trace"])

    def test_floor_cap_and_fixed_ratio_constraints_adjust_allocation_results(self):
        weights = self.run_demo_to_weights()["results"]
        low_weight = min(weights, key=lambda item: item["normalized_weight"])
        high_weight = max(weights, key=lambda item: item["normalized_weight"])

        floor_pre_amount = 1000 * low_weight["normalized_weight"]
        floor_value = round(floor_pre_amount + 50, 2)
        self.assert_ok(
            self.request(
                "POST",
                "/api/v1/contract-constraints",
                {
                    "party_id": low_weight["party_id"],
                    "constraint_name": "回归保底约束",
                    "constraint_type": "FLOOR_AMOUNT",
                    "value_type": "AMOUNT",
                    "constraint_value": floor_value,
                    "priority": 1,
                },
            )
        )
        floor_scenario = self.assert_ok(
            self.request("POST", "/api/v1/allocation-scenarios", {"total_revenue": 1000})
        )
        floor_simulated = self.assert_ok(
            self.request("POST", f"/api/v1/allocation-scenarios/{floor_scenario['allocation_id']}/simulate", {})
        )
        floor_result = next(item for item in floor_simulated["results"] if item["party_id"] == low_weight["party_id"])
        self.assertEqual(floor_value, floor_result["post_constraint_amount"])
        self.assertIn("FLOOR_AMOUNT", floor_result["constraint_adjustment_reason"])
        self.assertTrue(any(trace["constraint_type"] == "FLOOR_AMOUNT" for trace in floor_simulated["constraint_traces"]))

        cap_value = round(1000 * high_weight["normalized_weight"] - 50, 2)
        self.assert_ok(
            self.request(
                "POST",
                "/api/v1/contract-constraints",
                {
                    "party_id": high_weight["party_id"],
                    "constraint_name": "回归封顶约束",
                    "constraint_type": "CAP_AMOUNT",
                    "value_type": "AMOUNT",
                    "constraint_value": cap_value,
                    "priority": 1,
                },
            )
        )
        cap_scenario = self.assert_ok(
            self.request("POST", "/api/v1/allocation-scenarios", {"total_revenue": 1000})
        )
        cap_simulated = self.assert_ok(
            self.request("POST", f"/api/v1/allocation-scenarios/{cap_scenario['allocation_id']}/simulate", {})
        )
        cap_result = next(item for item in cap_simulated["results"] if item["party_id"] == high_weight["party_id"])
        self.assertLessEqual(cap_result["post_constraint_amount"], cap_value)
        self.assertIn("CAP_AMOUNT", cap_result["constraint_adjustment_reason"])
        self.assertTrue(any(trace["constraint_type"] == "CAP_AMOUNT" for trace in cap_simulated["constraint_traces"]))

        fixed_ratio = 0.05
        self.assert_ok(
            self.request(
                "POST",
                "/api/v1/contract-constraints",
                {
                    "party_id": high_weight["party_id"],
                    "constraint_name": "回归固定比例约束",
                    "constraint_type": "FIXED_RATIO",
                    "value_type": "RATIO",
                    "constraint_value": fixed_ratio,
                    "priority": 1,
                },
            )
        )
        fixed_scenario = self.assert_ok(
            self.request("POST", "/api/v1/allocation-scenarios", {"total_revenue": 1000})
        )
        fixed_simulated = self.assert_ok(
            self.request("POST", f"/api/v1/allocation-scenarios/{fixed_scenario['allocation_id']}/simulate", {})
        )
        fixed_result = next(item for item in fixed_simulated["results"] if item["party_id"] == high_weight["party_id"])
        self.assertEqual(50.0, fixed_result["post_constraint_amount"])
        self.assertIn("FIXED_RATIO", fixed_result["constraint_adjustment_reason"])
        self.assertTrue(any(trace["constraint_type"] == "FIXED_RATIO" for trace in fixed_simulated["constraint_traces"]))

    def test_priority_allocation_constraint_creates_contract_priority_before_provider_pool(self):
        self.run_demo_to_weights()
        parties = self.assert_ok(self.request("GET", "/api/v1/parties"))["items"]
        non_data_party = next(item for item in parties if item["party_type"] != "DATA_PROVIDER")
        self.assert_ok(
            self.request(
                "POST",
                "/api/v1/contract-constraints",
                {
                    "party_id": non_data_party["party_id"],
                    "constraint_name": "回归合同优先约束",
                    "constraint_type": "PRIORITY_ALLOCATION",
                    "value_type": "AMOUNT",
                    "constraint_value": 120,
                    "priority": 1,
                },
            )
        )

        scenario = self.assert_ok(
            self.request("POST", "/api/v1/allocation-scenarios", {"total_revenue": 1000})
        )

        self.assertEqual(120.0, scenario["total_contract_priority_amount"])
        self.assertEqual(880.0, scenario["data_provider_revenue_pool"])
        self.assertEqual(1, len(scenario["contract_priority_allocations"]))
        self.assertEqual(non_data_party["party_id"], scenario["contract_priority_allocations"][0]["party_id"])

    def test_priority_constraint_takes_precedence_over_stale_priority_draft(self):
        self.run_demo_to_weights()
        parties = self.assert_ok(self.request("GET", "/api/v1/parties"))["items"]
        non_data_party = next(item for item in parties if item["party_type"] != "DATA_PROVIDER")

        self.assert_ok(
            self.request(
                "PUT",
                "/api/v1/allocation/simulation/priority-items",
                {
                    "items": [
                        {
                            "party_id": non_data_party["party_id"],
                            "value_type": "AMOUNT",
                            "priority_amount": 20,
                            "priority_order": 1,
                        }
                    ]
                },
            )
        )
        self.assert_ok(
            self.request(
                "POST",
                "/api/v1/contract-constraints",
                {
                    "party_id": non_data_party["party_id"],
                    "constraint_name": "页面保存的合同优先约束",
                    "constraint_type": "PRIORITY_ALLOCATION",
                    "value_type": "AMOUNT",
                    "constraint_value": 120,
                    "priority": 1,
                },
            )
        )

        simulated = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/allocation/simulation/run",
                {"total_revenue": 1000, "priority_allocation_amount": 0},
            )
        )

        allocation = simulated["allocation"]
        self.assertEqual(120.0, simulated["summary"]["total_contract_priority_amount"])
        self.assertEqual(880.0, simulated["summary"]["data_provider_revenue_pool"])
        self.assertEqual(120.0, allocation["contract_priority_allocations"][0]["requested_amount"])

    def test_priority_ratio_saved_as_ratio_not_zero_amount(self):
        runtime = self.run_priority_ratio_runtime_scenario()

        constraint = runtime["priority_constraint"]
        priority_items = [
            item
            for item in self.repository.list_allocation_priority_items()
            if item.get("source_constraint_id") == constraint["constraint_id"]
        ]

        self.assertEqual("RATIO", constraint["value_type"])
        self.assertEqual(0.1, constraint["constraint_value"])
        self.assertTrue(priority_items)
        self.assertTrue(all(item["value_type"] == "RATIO" for item in priority_items))
        self.assertTrue(all(item["priority_ratio"] == 0.1 for item in priority_items))
        self.assertTrue(all(item["priority_amount"] is None for item in priority_items))
        applied_item = next(item for item in priority_items if item.get("allocation_id"))
        self.assertEqual(120000.0, applied_item["actual_priority_amount"])

    def test_priority_ratio_pre_deduction(self):
        runtime = self.run_priority_ratio_runtime_scenario()
        summary = runtime["simulated"]["summary"]

        self.assertEqual(1200000.0, summary["total_revenue"])
        self.assertEqual(120000.0, summary["priority_allocation_amount"])
        self.assertEqual(120000.0, summary["total_contract_priority_amount"])
        self.assertEqual(1080000.0, summary["data_provider_revenue_pool"])

    def test_priority_item_count_refresh_after_save(self):
        runtime = self.run_priority_ratio_runtime_scenario()

        summary = runtime["constraints_summary"]["summary"]

        self.assertEqual(1, summary["priority_items_count"])
        self.assertEqual(1, summary["active_constraint_count"])

    def test_md_dshap_weights_apply_to_residual_pool(self):
        runtime = self.run_priority_ratio_runtime_scenario()
        simulated = runtime["simulated"]
        pool = simulated["summary"]["data_provider_revenue_pool"]

        weights_by_party = {
            item["party_id"]: item["normalized_weight"]
            for item in runtime["weights"]["results"]
        }

        for row in simulated["data_provider_allocations"]:
            expected = round(pool * weights_by_party[row["party_id"]], 2)
            self.assertEqual(expected, row["pre_constraint_amount"])
            self.assertEqual(expected, row["post_constraint_amount"])
            self.assertEqual("MD_DSHAP_RESIDUAL_POOL", row["amount_source"])

    def test_non_data_party_in_final_result_not_in_md_dshap(self):
        runtime = self.run_priority_ratio_runtime_scenario()

        participant_ids = {
            item["party_id"]
            for item in runtime["weights"]["task"]["participant_set"]
        }
        non_data_ids = {party["party_id"] for party in runtime["non_data_parties"]}
        final_by_party = {
            item["party_id"]: item
            for item in runtime["simulated"]["results"]
        }

        self.assertTrue(non_data_ids.isdisjoint(participant_ids))
        self.assertTrue(non_data_ids.issubset(final_by_party))
        for party_id in non_data_ids:
            row = final_by_party[party_id]
            self.assertFalse(row["is_data_provider"])
            self.assertFalse(row["include_in_md_dshap"])
            self.assertEqual("CONTRACT_PRIORITY", row["amount_source"])
            self.assertEqual(0.0, row["normalized_weight"])

    def test_allocation_total_closes_to_total_revenue(self):
        runtime = self.run_priority_ratio_runtime_scenario()
        simulated = runtime["simulated"]

        all_final_amount = round(sum(item["final_amount"] for item in simulated["results"]), 2)

        self.assertAlmostEqual(
            simulated["summary"]["total_revenue"],
            all_final_amount,
            delta=0.01,
        )

    def test_data_provider_allocations_close_to_residual_pool(self):
        runtime = self.run_priority_ratio_runtime_scenario()
        simulated = runtime["simulated"]

        data_provider_pre_amount = round(
            sum(item["pre_constraint_amount"] for item in simulated["data_provider_allocations"]),
            2,
        )
        data_provider_post_amount = round(
            sum(item["post_constraint_amount"] for item in simulated["data_provider_allocations"]),
            2,
        )

        self.assertAlmostEqual(
            simulated["summary"]["data_provider_revenue_pool"],
            data_provider_pre_amount,
            delta=0.01,
        )
        self.assertAlmostEqual(
            simulated["summary"]["data_provider_revenue_pool"],
            data_provider_post_amount,
            delta=0.01,
        )

    def test_export_contains_priority_and_residual_pool(self):
        runtime = self.run_priority_ratio_runtime_scenario()

        json_export = self.assert_ok(self.request("POST", "/api/v1/reports/json", {}))
        csv_export = self.assert_ok(self.request("POST", "/api/v1/reports/csv", {}))
        markdown_export = self.assert_ok(self.request("POST", "/api/v1/reports/markdown", {}))

        json_payload = json.loads(Path(json_export["report"]["file_path"]).read_text(encoding="utf-8"))
        self.assertEqual("allocation_result.json", json_export["report"]["file_name"])
        for field in [
            "total_revenue",
            "priority_allocation",
            "priority_allocation_amount",
            "data_provider_revenue_pool",
            "weight_source",
            "results",
            "constraints",
            "rounding_note",
            "disclaimer",
        ]:
            self.assertIn(field, json_payload)
        self.assertEqual(120000.0, json_payload["priority_allocation_amount"])
        self.assertEqual(1080000.0, json_payload["data_provider_revenue_pool"])
        self.assertEqual(runtime["simulated"]["results"], json_payload["results"])

        csv_files = {item["file_name"]: item for item in csv_export["export_files"]}
        self.assertIn("source_level_allocation.csv", csv_files)
        self.assertIn("allocation_result.csv", csv_files)
        source_rows = self.read_csv_rows(csv_files["source_level_allocation.csv"]["file_path"])
        for field in [
            "party_id",
            "party_name",
            "party_type",
            "is_data_provider",
            "raw_weight",
            "normalized_weight",
            "pre_constraint_amount",
            "post_constraint_amount",
            "constraint_adjustment_reason",
        ]:
            self.assertIn(field, source_rows[0])
        self.assertEqual(8, len(source_rows))

        markdown = Path(markdown_export["report"]["file_path"]).read_text(encoding="utf-8")
        self.assertEqual("allocation_summary.md", markdown_export["report"]["file_name"])
        for term in ["合同优先", "数据源收益池", "MD-DShap", "普通合同约束", "模拟参考", "非法律结算"]:
            self.assertIn(term, markdown)

    def test_lock_allocation_confirms_simulation_reference(self):
        self.run_demo_to_weights()
        scenario = self.assert_ok(
            self.request("POST", "/api/v1/allocation-scenarios", {"total_revenue": 1000})
        )
        self.request("POST", f"/api/v1/allocation-scenarios/{scenario['allocation_id']}/simulate", {})

        locked = self.assert_ok(
            self.request("POST", f"/api/v1/allocation-scenarios/{scenario['allocation_id']}/lock", {})
        )

        self.assertEqual("CONFIRMED", locked["project_status"])
        self.assertEqual("CONFIRMED", locked["allocation"]["status"])
        self.assertEqual("local_operator", locked["allocation"]["locked_by"])
        self.assertIn("模拟参考", locked["allocation"]["simulation_disclaimer"])

    def test_allocation_resimulation_creates_new_result_version_without_overwrite(self):
        self.run_demo_to_weights()
        scenario = self.assert_ok(
            self.request("POST", "/api/v1/allocation-scenarios", {"total_revenue": 1000})
        )
        first = self.assert_ok(
            self.request("POST", f"/api/v1/allocation-scenarios/{scenario['allocation_id']}/simulate", {})
        )
        second = self.assert_ok(
            self.request("POST", f"/api/v1/allocation-scenarios/{scenario['allocation_id']}/simulate", {})
        )

        all_results = self.assert_ok(
            self.request("GET", f"/api/v1/allocation-scenarios/{scenario['allocation_id']}/results")
        )

        self.assertEqual(1, first["allocation"]["version_no"])
        self.assertEqual(2, second["allocation"]["version_no"])
        self.assertEqual(len(first["results"]) + len(second["results"]), all_results["total"])
        self.assertNotEqual(first["results"][0]["result_id"], second["results"][0]["result_id"])

    def test_report_markdown_requires_allocation_result(self):
        self.run_demo_to_weights()

        response = self.request("POST", "/api/v1/reports/markdown", {})

        self.assertFalse(response["success"])
        self.assertEqual("DVAS_PRECONDITION_NOT_MET", response["code"])
        self.assertEqual(
            [{"field": "allocation_result", "reason": "请先完成收益分配模拟"}],
            response["field_errors"],
        )

    def test_markdown_report_generation_creates_record_file_and_checksum(self):
        self.run_demo_to_allocated()

        data = self.assert_ok(self.request("POST", "/api/v1/reports/markdown", {}))

        report = data["report"]
        self.assertTrue(report["report_id"].startswith("report_"))
        self.assertEqual("MARKDOWN", report["file_format"])
        self.assertEqual(64, len(report["checksum"]))
        self.assertTrue(Path(report["file_path"]).exists())
        markdown = Path(report["file_path"]).read_text(encoding="utf-8")
        self.assertIn("# 数据收益分配系统 P0 模拟参考报告", markdown)
        self.assertIn("非法律结算", markdown)
        self.assertIn("项目概览", markdown)
        self.assertIn("收益分配模拟结果摘要", markdown)

        reports = self.assert_ok(self.request("GET", "/api/v1/reports"))
        self.assertEqual(1, reports["total"])
        self.assertEqual(report["report_id"], reports["items"][0]["report_id"])
        self.assertEqual(report["checksum"], data["export_files"][0]["checksum"])

    def test_csv_export_creates_source_level_allocation_with_formatting(self):
        self.run_demo_to_allocated()

        data = self.assert_ok(self.request("POST", "/api/v1/reports/csv", {}))

        export_by_name = {Path(item["file_name"]).name: item for item in data["export_files"]}
        self.assertIn("source_level_allocation.csv", export_by_name)
        source_file = Path(export_by_name["source_level_allocation.csv"]["file_path"])
        rows = source_file.read_text(encoding="utf-8").splitlines()
        self.assertGreaterEqual(len(rows), 2)
        header = rows[0].split(",")
        first_row = dict(zip(header, rows[1].split(",")))
        self.assertEqual("post_constraint_amount", header[header.index("post_constraint_amount")])
        self.assertRegex(first_row["post_constraint_amount"], r"^-?\d+\.\d{2}$")
        self.assertRegex(first_row["normalized_weight"], r"^-?\d+\.\d{6}$")

    def test_json_export_is_parseable_and_includes_snapshots_and_results(self):
        scenario, simulated = self.run_demo_to_allocated()

        data = self.assert_ok(self.request("POST", "/api/v1/reports/json", {}))
        export_file = Path(data["report"]["file_path"])
        payload = json.loads(export_file.read_text(encoding="utf-8"))

        self.assertEqual(self.repository.get_project()["project_id"], payload["project_id"])
        self.assertEqual(scenario["allocation_id"], payload["allocation_id"])
        self.assertEqual("EXPORTED", payload["project_status"])
        self.assertIn("input_snapshot_refs", payload)
        self.assertIn("parameter_snapshot_refs", payload)
        self.assertIn("result_snapshot_refs", payload)
        self.assertEqual(simulated["results"], payload["allocation_result"])
        self.assertIn("非法律结算", payload["disclaimer"])

    def test_audit_log_export_creates_jsonl_records(self):
        self.run_demo_to_allocated()

        data = self.assert_ok(self.request("POST", "/api/v1/reports/audit-log", {}))

        lines = Path(data["report"]["file_path"]).read_text(encoding="utf-8").splitlines()
        self.assertGreater(len(lines), 0)
        records = [json.loads(line) for line in lines]
        self.assertTrue(all(isinstance(record, dict) for record in records))
        self.assertTrue(any(record.get("record_type") == "audit_log" for record in records))
        self.assertTrue(any(record.get("module_code") == "ALLOC" for record in records))
        self.assertTrue(all("status" in record for record in records if record.get("record_type") == "audit_log"))

    def test_md_dshap_audit_report_export_is_not_audit_log_jsonl(self):
        weights = self.run_demo_to_weights()
        task_id = weights["task"]["task_id"]

        data = self.assert_ok(
            self.request(
                "POST",
                f"/api/v1/allocation/md-dshap/tasks/{task_id}/audit-export",
                {},
            )
        )

        self.assertEqual("MD_DSHAP_AUDIT_REPORT", data["report"]["report_type"])
        self.assertEqual("md_dshap_audit_report.md", data["report"]["file_name"])
        self.assertEqual("MARKDOWN", data["report"]["file_format"])
        self.assertNotEqual("audit_log.jsonl", data["report"]["file_name"])
        self.assertEqual(64, len(data["report"]["checksum"]))
        export_files = {item["file_name"]: item for item in data["export_files"]}
        self.assertIn("md_dshap_audit_report.md", export_files)
        self.assertIn("md_dshap_audit_report.json", export_files)

        markdown = Path(data["report"]["file_path"]).read_text(encoding="utf-8")
        self.assertIn("algorithm_mode: MD_DSHAP", markdown)
        self.assertIn("algorithm_version", markdown)
        self.assertIn("participant_weight", markdown)
        self.assertIn("非法律结算", markdown)

        audit_json = json.loads(
            Path(export_files["md_dshap_audit_report.json"]["file_path"]).read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual("MD_DSHAP_AUDIT_REPORT", audit_json["report_type"])
        self.assertEqual("MD_DSHAP", audit_json["algorithm_mode"])
        self.assertIn("participant_set", audit_json)
        self.assertIn("utility_function_source", audit_json)
        self.assertIn("parameters", audit_json)
        self.assertIn("marginal_trace_summary", audit_json)
        self.assertEqual(2, len(audit_json["participant_weight"]))

        report_route = self.assert_ok(self.request("POST", "/api/v1/reports/md-dshap-audit", {}))
        self.assertEqual("MD_DSHAP_AUDIT_REPORT", report_route["report"]["report_type"])

    def test_report_reexport_creates_new_report_without_overwriting_history(self):
        self.run_demo_to_allocated()

        first = self.assert_ok(self.request("POST", "/api/v1/reports/markdown", {}))
        second = self.assert_ok(self.request("POST", "/api/v1/reports/markdown", {}))

        self.assertNotEqual(first["report"]["report_id"], second["report"]["report_id"])
        self.assertNotEqual(first["report"]["file_path"], second["report"]["file_path"])
        self.assertTrue(Path(first["report"]["file_path"]).exists())
        self.assertTrue(Path(second["report"]["file_path"]).exists())
        reports = self.assert_ok(self.request("GET", "/api/v1/reports"))
        self.assertEqual(2, reports["total"])

    def test_successful_export_transitions_project_and_dashboard_preconditions(self):
        self.run_demo_to_allocated()

        self.assert_ok(self.request("POST", "/api/v1/reports/csv", {}))

        project = self.assert_ok(self.request("GET", "/api/v1/projects/current"))
        preconditions = self.assert_ok(self.request("GET", "/api/v1/dashboard/preconditions"))
        self.assertEqual("EXPORTED", project["project_status"])
        self.assertIn(
            {"code": "HAS_REPORT_RECORD", "passed": True, "message": "已生成报告记录"},
            preconditions["preconditions"],
        )
        self.assertIn(
            {"code": "HAS_EXPORT_FILE", "passed": True, "message": "已生成导出文件"},
            preconditions["preconditions"],
        )

    def test_reports_list_returns_generated_report_records(self):
        self.run_demo_to_allocated()
        generated = self.assert_ok(self.request("POST", "/api/v1/reports/json", {}))

        reports = self.assert_ok(self.request("GET", "/api/v1/reports"))

        self.assertEqual(1, reports["total"])
        record = reports["items"][0]
        self.assertEqual(generated["report"]["report_id"], record["report_id"])
        self.assertEqual("JSON", record["file_format"])
        self.assertTrue(record["source_snapshot_id"].startswith("snapshot_"))

    def test_system_parameters_returns_default_p0_parameters(self):
        data = self.assert_ok(self.request("GET", "/api/v1/system/parameters"))

        codes = {item["parameter_code"] for item in data["items"]}
        self.assertIn("RISK_DISCLAIMER_TEXT", codes)
        self.assertIn("DEFAULT_SHUYUAN_BASE_PRICE", codes)
        self.assertIn("DEFAULT_MD_DSHAP_SAMPLE_ROUNDS", codes)
        self.assertIn("DEFAULT_MD_DSHAP_BASELINE_ENABLED", codes)
        self.assertIn("AMOUNT_DISPLAY_PRECISION", codes)
        parameter = next(
            item for item in data["items"] if item["parameter_code"] == "DEFAULT_SHUYUAN_BASE_PRICE"
        )
        self.assertEqual("默认数元基础价格", parameter["parameter_name"])
        self.assertEqual("NUMBER", parameter["parameter_type"])
        self.assertEqual(2.0, parameter["default_value"])
        self.assertEqual(2.0, parameter["current_value"])
        self.assertEqual("P0_LOCAL", parameter["scope"])
        self.assertTrue(parameter["editable"])
        self.assertEqual(1, parameter["version_no"])
        self.assertIn("updated_at", parameter)

        baseline = next(
            item
            for item in data["items"]
            if item["parameter_code"] == "DEFAULT_MD_DSHAP_BASELINE_ENABLED"
        )
        self.assertEqual("BOOLEAN", baseline["parameter_type"])
        self.assertTrue(baseline["default_value"])
        self.assertTrue(baseline["current_value"])

        detail = self.assert_ok(
            self.request("GET", "/api/v1/system/parameters/DEFAULT_SHUYUAN_BASE_PRICE")
        )
        self.assertEqual(parameter["parameter_code"], detail["parameter_code"])

    def test_system_parameter_update_validates_positive_numeric_rules(self):
        invalid = self.request(
            "PUT",
            "/api/v1/system/parameters/DEFAULT_SCENARIO_COEFFICIENT",
            {"current_value": 0},
        )
        self.assert_error_envelope(invalid, "DVAS_FACTOR_INVALID")
        self.assertEqual(
            [{"field": "current_value", "reason": "DEFAULT_SCENARIO_COEFFICIENT 必须大于 0"}],
            invalid["field_errors"],
        )

        updated = self.assert_ok(
            self.request(
                "PUT",
                "/api/v1/system/parameters/DEFAULT_SCENARIO_COEFFICIENT",
                {"current_value": 1.25},
            )
        )

        self.assertEqual(1.25, updated["current_value"])
        self.assertEqual(2, updated["version_no"])
        self.assertTrue(updated["latest_version_id"].startswith("parameter_version_"))
        versions = self.repository.list_parameter_versions("DEFAULT_SCENARIO_COEFFICIENT")
        self.assertEqual(1, len(versions))
        self.assertEqual(1.25, versions[0]["current_value"])
        self.assertTrue(versions[0]["snapshot_id"].startswith("snapshot_"))

    def test_system_parameter_update_rejects_non_editable_and_unknown_parameters(self):
        non_editable = self.request(
            "PUT",
            "/api/v1/system/parameters/AMOUNT_DISPLAY_PRECISION",
            {"current_value": 3},
        )
        missing = self.request(
            "PUT",
            "/api/v1/system/parameters/UNKNOWN_PARAMETER",
            {"current_value": 1},
        )

        self.assert_error_envelope(non_editable, "DVAS_FACTOR_INVALID")
        self.assertEqual(
            [{"field": "parameter_code", "reason": "该参数不可编辑"}],
            non_editable["field_errors"],
        )
        self.assert_error_envelope(missing, "DVAS_NOT_FOUND")

    def test_system_parameter_restore_default_creates_new_version(self):
        self.assert_ok(
            self.request(
                "PUT",
                "/api/v1/system/parameters/DEFAULT_MD_DSHAP_SAMPLE_ROUNDS",
                {"current_value": 128},
            )
        )

        restored = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/system/parameters/DEFAULT_MD_DSHAP_SAMPLE_ROUNDS/restore-default",
                {},
            )
        )

        self.assertEqual(restored["default_value"], restored["current_value"])
        self.assertEqual(3, restored["version_no"])
        versions = self.repository.list_parameter_versions("DEFAULT_MD_DSHAP_SAMPLE_ROUNDS")
        self.assertEqual(2, len(versions))
        self.assertEqual("RESTORE_DEFAULT", versions[-1]["operation_type"])

    def test_system_parameter_updates_do_not_mutate_historical_results(self):
        scenario, simulated = self.run_demo_to_allocated()
        report = self.assert_ok(self.request("POST", "/api/v1/reports/json", {}))
        before_results = self.assert_ok(
            self.request(
                "GET",
                f"/api/v1/allocation-scenarios/{scenario['allocation_id']}/results",
            )
        )["items"]
        before_report_record = self.assert_ok(self.request("GET", "/api/v1/reports"))["items"][0]

        self.assert_ok(
            self.request(
                "PUT",
                "/api/v1/system/parameters/DEFAULT_SHUYUAN_BASE_PRICE",
                {"current_value": 9.5},
            )
        )

        after_results = self.assert_ok(
            self.request(
                "GET",
                f"/api/v1/allocation-scenarios/{scenario['allocation_id']}/results",
            )
        )["items"]
        after_report_record = self.assert_ok(self.request("GET", "/api/v1/reports"))["items"][0]

        self.assertEqual(simulated["results"], before_results)
        self.assertEqual(before_results, after_results)
        self.assertEqual(report["report"]["checksum"], after_report_record["checksum"])
        self.assertEqual(before_report_record, after_report_record)

    def test_audit_logs_list_and_detail_after_p0_chain_include_snapshots(self):
        self.run_demo_to_allocated()
        self.assert_ok(self.request("POST", "/api/v1/reports/json", {}))

        logs = self.assert_ok(self.request("GET", "/api/v1/audit-logs"))

        self.assertGreater(logs["total"], 0)
        self.assertTrue(any(item["module_code"] == "ALLOC" for item in logs["items"]))
        self.assertTrue(any(item["module_code"] == "REP" for item in logs["items"]))
        result_log = next(item for item in logs["items"] if item.get("result_snapshot_id"))
        detail = self.assert_ok(self.request("GET", f"/api/v1/audit-logs/{result_log['log_id']}"))

        self.assertEqual(result_log["log_id"], detail["audit_log"]["log_id"])
        self.assertIn("snapshot_refs", detail)
        self.assertIn("snapshots", detail)
        self.assertTrue(any(snapshot["snapshot_id"] == result_log["result_snapshot_id"] for snapshot in detail["snapshot_refs"]))
        self.assertIn(result_log["result_snapshot_id"], detail["snapshots"])

    def test_audit_log_detail_not_found_uses_standard_error_envelope(self):
        response = self.request("GET", "/api/v1/audit-logs/audit_missing")

        self.assert_error_envelope(response, "DVAS_NOT_FOUND")

    def test_audit_log_query_filters_are_read_only(self):
        self.run_demo_to_allocated()
        self.assert_ok(self.request("POST", "/api/v1/reports/json", {}))
        before_status = self.assert_ok(self.request("GET", "/api/v1/projects/current"))[
            "project_status"
        ]

        allocation_logs = self.assert_ok(
            self.request("GET", "/api/v1/audit-logs?module_code=ALLOC")
        )
        export_logs = self.assert_ok(
            self.request("GET", "/api/v1/audit-logs?operation_type=GENERATE_JSON_EXPORT")
        )
        limited_logs = self.assert_ok(self.request("GET", "/api/v1/audit-logs?limit=1"))
        after_status = self.assert_ok(self.request("GET", "/api/v1/projects/current"))[
            "project_status"
        ]

        self.assertGreater(allocation_logs["total"], 0)
        self.assertTrue(all(item["module_code"] == "ALLOC" for item in allocation_logs["items"]))
        self.assertEqual(1, export_logs["total"])
        self.assertEqual("GENERATE_JSON_EXPORT", export_logs["items"][0]["operation_type"])
        self.assertEqual(1, limited_logs["total"])
        self.assertEqual(before_status, after_status)

    def test_system_management_openapi_documents_p1_local_routes_and_forbidden_production_routes(self):
        openapi_text = Path("backend/openapi.yaml").read_text(encoding="utf-8").lower()
        path_lines = [
            line.strip().rstrip(":")
            for line in openapi_text.splitlines()
            if line.startswith("  /")
        ]

        for expected_path in [
            "/system/parameters",
            "/system/parameters/{parameter_code}",
            "/system/parameters/{parameter_code}/restore-default",
            "/audit-logs",
            "/audit-logs/{log_id}",
            "/auth/login",
            "/auth/logout",
            "/auth/me",
            "/auth/permissions",
            "/my/projects",
            "/my/uploads",
            "/my/jobs",
            "/my/reports",
            "/my/workbench",
            "/system/users",
            "/system/users/{user_id}",
            "/system/users/{user_id}/disable",
            "/system/users/{user_id}/reset-password",
            "/users",
            "/users/me",
            "/users/me/password",
            "/users/{user_id}",
            "/users/{user_id}/disable",
            "/users/{user_id}/reset-password",
            "/system/roles",
            "/system/roles/{role_id}/permissions",
            "/system/permissions",
            "/import-templates/csv",
            "/import-templates/xlsx",
            "/projects/{project_id}/data-packages/import/csv",
            "/projects/{project_id}/data-packages/import/xlsx",
            "/projects/{project_id}/jobs",
            "/jobs/{job_id}",
            "/jobs/{job_id}/cancel",
            "/projects/{project_id}/md-dshap/tasks",
            "/projects/{project_id}/md-dshap/tasks/{task_id}/progress",
            "/projects/{project_id}/allocation/summary",
            "/projects/{project_id}/allocation/simulate",
            "/projects/{project_id}/allocation/contract-ratio",
            "/projects/{project_id}/reports/pdf",
            "/projects/{project_id}/reports",
            "/reports/{report_id}",
            "/reports/{report_id}/files",
            "/reports/{report_id}/manifest",
            "/reports/{report_id}/download",
            "/reports/{report_id}/archive",
            "/audit/logs",
            "/audit/logs/{log_id}",
            "/audit/snapshots/{snapshot_id}",
            "/audit/export",
        ]:
            self.assertIn(expected_path, path_lines)
        for forbidden_path in [
            "/rbac/roles",
            "/tenants",
        ]:
            with self.subTest(forbidden=forbidden_path):
                self.assertNotIn(forbidden_path, path_lines)

    def test_openapi_path_responses_reference_standard_envelopes(self):
        openapi_text = Path("backend/openapi.yaml").read_text(encoding="utf-8")

        for expected in [
            "/navigation/menus:",
            "/projects/current/status:",
            "/dashboard:",
            "/demo-cases/{demo_case_id}/select:",
            "/projects/{project_id}/pipeline/run:",
            "/data/packages:",
            "/data/resources:",
            "/data/parties:",
            "/metering/quality/evaluate:",
            "/metering/quality/resource-results:",
            "/metering/quality/resource-results/{resource_id}:",
            "/metering/shuyuan/calculate:",
            "/metering/utility/calculate:",
            "/allocation/md-dshap/tasks:",
            "/allocation/md-dshap/tasks/{task_id}/results:",
            "/allocation/md-dshap/tasks/{task_id}/audit-export:",
            "/allocation/simulation/run:",
            "/allocation/constraints:",
            "/system/parameters:",
            "/reports/markdown:",
            "/reports/csv:",
            "/reports/json:",
            "/reports/audit-log:",
            "/reports/md-dshap-audit:",
            "/system/audit/logs:",
        ]:
            with self.subTest(path=expected):
                self.assertIn(expected, openapi_text)

        self.assertIn('StandardSuccess:', openapi_text)
        self.assertIn('StandardError:', openapi_text)
        self.assertGreaterEqual(openapi_text.count('#/components/responses/StandardSuccess'), 20)
        self.assertGreaterEqual(openapi_text.count('#/components/responses/StandardError'), 10)
        self.assertIn('error:', openapi_text)
        self.assertIn('field:', openapi_text)
        self.assertIn('message:', openapi_text)
        self.assertIn('detail:', openapi_text)

    def test_p0_backend_complete_chain_reaches_exported_with_all_exports(self):
        start = self.assert_ok(self.request("GET", "/api/v1/projects/current"))
        self.assertEqual("DRAFT", start["project_status"])

        initialized = self.assert_ok(
            self.request("POST", "/api/v1/demo-cases/lung_screening_demo/initialize")
        )
        quality = self.assert_ok(self.request("POST", "/api/v1/quality-assessments/run", {}))
        metering = self.assert_ok(self.request("POST", "/api/v1/shuyuan-meterings/run", {}))
        contribution = self.assert_ok(self.request("POST", "/api/v1/contributions/run", {}))
        utility = self.assert_ok(self.request("POST", "/api/v1/utilities/run", {}))
        weights = self.assert_ok(self.request("POST", "/api/v1/md-dshap/tasks", {}))
        scenario = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/allocation-scenarios",
                {"total_revenue": 1000, "priority_allocation_amount": 100},
            )
        )
        simulated = self.assert_ok(
            self.request(
                "POST",
                f"/api/v1/allocation-scenarios/{scenario['allocation_id']}/simulate",
                {},
            )
        )
        locked = self.assert_ok(
            self.request(
                "POST",
                f"/api/v1/allocation-scenarios/{scenario['allocation_id']}/lock",
                {},
            )
        )
        markdown = self.assert_ok(self.request("POST", "/api/v1/reports/markdown", {}))
        csv_export = self.assert_ok(self.request("POST", "/api/v1/reports/csv", {}))
        json_export = self.assert_ok(self.request("POST", "/api/v1/reports/json", {}))
        audit_export = self.assert_ok(self.request("POST", "/api/v1/reports/audit-log", {}))

        self.assertEqual("INGESTED", initialized["project_status"])
        self.assertEqual("ASSESSED", quality["project_status"])
        self.assertEqual("METERED", metering["project_status"])
        self.assertEqual("METERED", contribution["project_status"])
        self.assertEqual("UTILITY_CALCULATED", utility["project_status"])
        self.assertEqual("WEIGHT_CALCULATED", weights["project_status"])
        self.assertEqual("DRAFT", scenario["status"])
        self.assertEqual("ALLOCATED", simulated["project_status"])
        self.assertEqual("CONFIRMED", locked["project_status"])

        normalized_weight_sum = round(
            sum(result["normalized_weight"] for result in weights["results"]),
            6,
        )
        self.assertEqual(1.0, normalized_weight_sum)
        allocation_total = round(
            sum(result["post_constraint_amount"] for result in simulated["results"]),
            2,
        )
        data_provider_total = round(
            sum(result["post_constraint_amount"] for result in simulated["data_provider_allocations"]),
            2,
        )
        self.assertEqual(simulated["allocation"]["total_revenue"], allocation_total)
        self.assertEqual(simulated["allocation"]["data_provider_revenue_pool"], data_provider_total)

        final_project = self.assert_ok(self.request("GET", "/api/v1/projects/current"))
        self.assertEqual("EXPORTED", final_project["project_status"])
        reports = self.assert_ok(self.request("GET", "/api/v1/reports"))
        self.assertEqual(4, reports["total"])
        self.assertEqual(4, len({report["report_id"] for report in reports["items"]}))

        for export in [markdown, csv_export, json_export, audit_export]:
            self.assertEqual("EXPORTED", export["project_status"])
            self.assertEqual(64, len(export["report"]["checksum"]))
            self.assertTrue(Path(export["report"]["file_path"]).exists())

        json_payload = json.loads(Path(json_export["report"]["file_path"]).read_text(encoding="utf-8"))
        self.assertEqual("EXPORTED", json_payload["project_status"])
        self.assertEqual(simulated["results"], json_payload["allocation_result"])

        csv_files = {item["file_name"]: item for item in csv_export["export_files"]}
        source_rows = self.read_csv_rows(csv_files["source_level_allocation.csv"]["file_path"])
        self.assertEqual(len(simulated["results"]), len(source_rows))
        csv_allocation_total = round(
            sum(float(row["final_amount"]) for row in source_rows),
            2,
        )
        self.assertEqual(simulated["allocation"]["total_revenue"], csv_allocation_total)
        for row in source_rows:
            self.assertRegex(row["post_constraint_amount"], r"^-?\d+\.\d{2}$")
            self.assertRegex(row["normalized_weight"], r"^-?\d+\.\d{6}$")

    def test_acceptance_success_and_failure_use_standard_response_envelope(self):
        success = self.request("GET", "/api/v1/projects/current")
        self.assertTrue(success["success"])
        self.assertEqual("OK", success["code"])
        self.assertIn("message", success)
        self.assertIn("trace_id", success)
        self.assertIn("data", success)

        failure = self.request("POST", "/api/v1/reports/markdown", {})
        self.assert_error_envelope(failure, "DVAS_PRECONDITION_NOT_MET")

    def test_acceptance_recalculation_and_export_do_not_overwrite_history(self):
        scenario, first_simulation = self.run_demo_to_allocated()
        second_simulation = self.assert_ok(
            self.request(
                "POST",
                f"/api/v1/allocation-scenarios/{scenario['allocation_id']}/simulate",
                {},
            )
        )

        all_results = self.assert_ok(
            self.request(
                "GET",
                f"/api/v1/allocation-scenarios/{scenario['allocation_id']}/results",
            )
        )
        first_export = self.assert_ok(self.request("POST", "/api/v1/reports/json", {}))
        second_export = self.assert_ok(self.request("POST", "/api/v1/reports/json", {}))

        self.assertEqual(1, first_simulation["allocation"]["version_no"])
        self.assertEqual(2, second_simulation["allocation"]["version_no"])
        self.assertEqual(
            len(first_simulation["results"]) + len(second_simulation["results"]),
            all_results["total"],
        )
        self.assertNotEqual(
            first_simulation["results"][0]["result_id"],
            second_simulation["results"][0]["result_id"],
        )
        self.assertNotEqual(first_export["report"]["report_id"], second_export["report"]["report_id"])
        self.assertNotEqual(first_export["report"]["file_path"], second_export["report"]["file_path"])
        reports = self.assert_ok(self.request("GET", "/api/v1/reports"))
        self.assertEqual(2, reports["total"])

    def test_acceptance_p1_auth_enabled_and_unscoped_legacy_routes_remain_absent(self):
        login = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/auth/login",
                {"username": "admin", "password": "admin123"},
            )
        )
        self.assertTrue(login["token"].startswith("session_"))
        self.assertIn("USER-002", login["permissions"]["button_codes"])

        forbidden_routes = [
            ("POST", "/api/v1/login"),
            ("GET", "/api/v1/rbac/roles"),
            ("GET", "/api/v1/tenants"),
        ]
        for method, path in forbidden_routes:
            with self.subTest(path=path):
                self.assert_error_envelope(
                    self.request(method, path, {}),
                    "DVAS_NOT_FOUND",
                )
        self.assert_error_envelope(
            self.request("GET", "/api/v1/users", {}),
            "DVAS_AUTH_REQUIRED",
        )
        self.assert_error_envelope(
            self.request("GET", "/api/v1/users/me", {}),
            "DVAS_AUTH_REQUIRED",
        )
        self.assert_error_envelope(
            self.request("PUT", "/api/v1/users/me/password", {}),
            "DVAS_AUTH_REQUIRED",
        )

        openapi_text = Path("backend/openapi.yaml").read_text(encoding="utf-8").lower()
        path_lines = [
            line.strip().rstrip(":")
            for line in openapi_text.splitlines()
            if line.startswith("  /")
        ]
        self.assertNotIn("/rbac/roles", path_lines)
        self.assertNotIn("/tenants", path_lines)
        self.assertIn("/users", path_lines)
        self.assertIn("/users/me", path_lines)
        self.assertIn("/users/me/password", path_lines)

    def test_acceptance_backend_tests_do_not_import_frontend_workspace(self):
        frontend_package = "ui_" + "prototype"
        backend_test_text = "\n".join(
            path.read_text(encoding="utf-8") for path in Path("backend/tests").glob("*.py")
        )
        forbidden_patterns = [
            f"from {frontend_package}",
            f"import {frontend_package}",
            f"{frontend_package}/src",
        ]
        for pattern in forbidden_patterns:
            with self.subTest(pattern=pattern):
                self.assertNotIn(pattern, backend_test_text)

    def test_reports_pdf_endpoints_not_implemented_in_be08(self):
        for method, path in [
            ("POST", "/api/v1/reports/export"),
            ("POST", "/api/v1/reports/pdf"),
            ("GET", "/api/v1/reports/report_000001/pdf"),
        ]:
            with self.subTest(path=path):
                response = self.request(method, path, {})
                self.assertFalse(response["success"])
                self.assertEqual("DVAS_NOT_FOUND", response["code"])

    def test_phase2c_navigation_and_status_aliases_preserve_system_home_contract(self):
        menus = self.assert_ok(self.request("GET", "/api/v1/navigation/menus"))
        status = self.assert_ok(self.request("GET", "/api/v1/projects/current/status"))
        flow = self.assert_ok(self.request("GET", "/api/v1/projects/project_p0_local_demo/flow"))
        home = self.assert_ok(self.request("GET", "/api/v1/sys/home?project_id=project_p0_local_demo"))

        system_home = next(item for item in menus["items"] if item["menu_code"] == "NAV_SYS_HOME")
        self.assertEqual([], system_home["children"])
        self.assertEqual("/dashboard", system_home["route_path"])
        self.assertEqual("DRAFT", status["project_status"])
        self.assertEqual("DRAFT", flow["project_status"])
        self.assertEqual("DRAFT", home["project_status"])

        forbidden_text = json.dumps(menus, ensure_ascii=False)
        for forbidden in [
            "NAV_SYS_OVERVIEW",
            "NAV_SYS_PROCESS",
            "NAV_SYS_RISK",
            "NAV_SYS_ONE_CLICK",
        ]:
            self.assertNotIn(forbidden, forbidden_text)

    def test_phase2c_pipeline_run_executes_real_complete_chain_and_writes_sys004_audit(self):
        self.assert_ok(self.request("POST", "/api/v1/demo-cases/lung_screening_demo/select", {}))
        project_id = self.repository.get_project()["project_id"]
        saved_plan = self.assert_ok(
            self.request(
                "PUT",
                f"/api/v1/projects/{project_id}/allocation/contract-ratio",
                self.contract_ratio_payload(
                    total_revenue="1200000.00",
                    pool_ratio="0.900000",
                    item_ratio="0.100000",
                    basis_text="完整链路联调合同比例",
                ),
            )
        )

        result = self.assert_ok(
            self.request("POST", "/api/v1/projects/project_p0_local_demo/pipeline/run", {})
        )

        self.assertEqual("COMPLETED", result["pipeline_status"])
        self.assertEqual("ALLOCATED", result["project_status"])
        self.assertEqual(saved_plan["plan_id"], result["contract_ratio_plan_id"])
        self.assertEqual("1.000000", result["contract_ratio_sum"])
        self.assertEqual(saved_plan["plan_id"], result["steps"]["contract_ratio"]["plan_id"])
        self.assertTrue(result["steps"]["quality"]["assessment"]["assessment_id"].startswith("assessment_"))
        self.assertTrue(result["steps"]["shuyuan"]["metering"]["metering_id"].startswith("metering_"))
        self.assertTrue(result["steps"]["utility"]["utility"]["utility_id"].startswith("utility_"))
        self.assertTrue(result["steps"]["md_dshap"]["task"]["task_id"].startswith("task_"))
        allocation = result["steps"]["allocation"]
        self.assertEqual(saved_plan["plan_id"], allocation["allocation"]["contract_ratio_plan_id"])
        self.assertEqual("1.000000", allocation["summary"]["contract_ratio_sum"])
        self.assertEqual(1080000.0, allocation["summary"]["data_provider_revenue_pool"])
        self.assertEqual(120000.0, allocation["summary"]["non_data_contract_amount"])
        amount_sources = {item["amount_source"] for item in allocation["results"]}
        self.assertEqual({"CONTRACT_RATIO", "MD_DSHAP_WEIGHT"}, amount_sources)
        self.assertFalse(any(item.get("priority_allocation_amount") == 0 for item in allocation["results"]))

        logs = self.repository.list_audit_logs()
        pipeline_log = next(item for item in logs if item["operation_type"] == "RUN_FULL_PIPELINE")
        self.assertEqual("SYS", pipeline_log["module_code"])
        self.assertEqual("NAV_SYS_HOME", pipeline_log["menu_code"])
        self.assertEqual("SYS-004", pipeline_log["button_code"])
        self.assertEqual(saved_plan["plan_id"], pipeline_log["after_value_json"]["contract_ratio_plan_id"])

    def test_phase2c_pipeline_run_requires_saved_contract_ratio_before_stage_work(self):
        self.assert_ok(self.request("POST", "/api/v1/demo-cases/lung_screening_demo/select", {}))
        before_counts = self.pipeline_artifact_counts()

        response = self.request("POST", "/api/v1/projects/project_p0_local_demo/pipeline/run", {})

        self.assertFalse(response["success"])
        self.assertEqual("DVAS_CONTRACT_RATIO_REQUIRED", response["code"])
        self.assertEqual("contract_ratio_plan", response["field_errors"][0]["field"])
        self.assertEqual(before_counts, self.pipeline_artifact_counts())
        self.assertEqual("INGESTED", self.repository.get_project()["project_status"])

    def test_phase2c_md_dshap_participant_pool_explains_non_data_exclusions(self):
        self.run_demo_to_utility()
        project = self.repository.get_project()
        self.repository.put_party(
            {
                "party_id": self.repository.next_id("party"),
                "project_id": project["project_id"],
                "party_name": "Codex探针数据源",
                "party_type": "DATA_PROVIDER",
                "is_data_provider": True,
                "include_in_md_dshap": True,
                "status": "ENABLED",
                "created_at": "2026-06-25T00:00:00Z",
                "updated_at": "2026-06-25T00:00:00Z",
            }
        )

        pool = self.assert_ok(self.request("GET", "/api/v1/allocation/md-dshap/participant-pool"))

        included_names = {item["party_name"] for item in pool["items"]}
        excluded_by_name = {item["party_name"]: item for item in pool["excluded_items"]}
        self.assertIn("示例数据源主体A", included_names)
        self.assertIn("示例数据源主体B", included_names)
        self.assertNotIn("Codex探针数据源", included_names)
        self.assertIn("示例运营服务方", excluded_by_name)
        self.assertIn("Codex探针数据源", excluded_by_name)
        self.assertIn("非数据源主体", excluded_by_name["示例运营服务方"]["excluded_reason"])
        self.assertIn("未关联当前数据包有效数据资源", excluded_by_name["Codex探针数据源"]["excluded_reason"])
        self.assertEqual(2, pool["algorithm_party_count"])
        self.assertEqual(1, pool["contract_party_count"])
        self.assertEqual(pool["excluded_items"], pool["excluded_parties"])

        task_data = self.assert_ok(self.request("POST", "/api/v1/md-dshap/tasks", {}))
        task_participant_names = {item["party_name"] for item in task_data["task"]["participant_set"]}
        self.assertEqual(2, task_data["algorithm_party_count"])
        self.assertNotIn("Codex探针数据源", task_participant_names)

    def test_phase2c_error_envelope_includes_nested_error_and_trace_id(self):
        response = self.request("POST", "/api/v1/metering/shuyuan/calculate", {})

        self.assertFalse(response["success"])
        self.assertEqual("DVAS_PRECONDITION_NOT_MET", response["code"])
        self.assertIn("trace_id", response)
        self.assertEqual("DVAS_PRECONDITION_NOT_MET", response["error"]["code"])
        self.assertEqual("quality_assessment", response["error"]["field"])
        self.assertEqual("请先完成质量评估", response["error"]["message"])

    def test_p1_login_rbac_and_user_permission_matrix(self):
        token = self.login_token()
        me = self.assert_ok(self.request("GET", "/api/v1/auth/me", {"_auth_token": token}))

        self.assertEqual("admin", me["user"]["username"])
        self.assertIn("SYSTEM_ADMIN", me["roles"])
        self.assertIn("USER-002", me["permissions"]["button_codes"])
        self.assertIn("NAV_SYSTEM_USER", me["permissions"]["menu_codes"])

        users = self.assert_ok(self.request("GET", "/api/v1/system/users", {"_auth_token": token}))
        roles = self.assert_ok(self.request("GET", "/api/v1/system/roles", {"_auth_token": token}))
        permissions = self.assert_ok(self.request("GET", "/api/v1/system/permissions", {"_auth_token": token}))

        self.assertGreaterEqual(users["total"], 1)
        self.assertGreaterEqual(roles["total"], 1)
        self.assertTrue(any(item["permission_type"] == "API" for item in permissions["items"]))

    def test_p1_csv_template_import_generates_package_snapshot_and_parties(self):
        token = self.login_token()
        template = self.assert_ok(
            self.request("GET", "/api/v1/import-templates/csv", {"_auth_token": token})
        )
        content = base64.b64decode(template["content_base64"])

        result = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/projects/project_demo_001/data-packages/import/csv",
                {
                    "_auth_token": token,
                    "_multipart_files": {
                        "file": {
                            "filename": "template.csv",
                            "content": content,
                            "content_type": "text/csv",
                        }
                    },
                },
            )
        )

        self.assertEqual("CSV_UPLOAD", result["package"]["source_type"])
        self.assertEqual("VALIDATED", result["validation_result"]["status"])
        self.assertTrue(result["input_snapshot"]["snapshot_id"].startswith("snapshot_"))
        self.assertEqual(1, len(result["parties"]))
        self.assertEqual(1, len(result["resources"]))

    def test_p1_async_job_pdf_report_history_download_and_archive(self):
        token = self.login_token()
        self.assert_ok(
            self.request(
                "POST",
                "/api/v1/demo-cases/lung_screening_demo/select",
                {"_auth_token": token},
            )
        )
        project_id = self.repository.get_project()["project_id"]
        self.assert_ok(
            self.request(
                "PUT",
                f"/api/v1/projects/{project_id}/allocation/contract-ratio",
                {
                    **self.contract_ratio_payload(),
                    "_auth_token": token,
                },
            )
        )
        job = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/projects/project_demo_001/jobs",
                {"_auth_token": token},
            )
        )

        self.assertEqual("SUCCESS", job["job"]["status"])
        self.assertEqual(100, job["job"]["progress"])
        self.assertIn("allocation", job["result"]["steps"])

        pdf = self.assert_ok(
            self.request(
                "POST",
                "/api/v1/projects/project_demo_001/reports/pdf",
                {"_auth_token": token},
            )
        )
        report_id = pdf["report"]["report_id"]
        self.assertEqual("PDF", pdf["report"]["file_format"])
        self.assertEqual("P1_PDF_REPORT", pdf["report"]["report_type"])
        self.assertEqual(report_id, pdf["manifest"]["report_id"])

        reports = self.assert_ok(
            self.request(
                "GET",
                "/api/v1/projects/project_demo_001/reports",
                {"_auth_token": token},
            )
        )
        self.assertTrue(any(item["report_id"] == report_id for item in reports["items"]))

        download = self.assert_ok(
            self.request(
                "GET",
                f"/api/v1/reports/{report_id}/download",
                {"_auth_token": token},
            )
        )
        self.assertTrue(download["checksum_verified"])
        self.assertGreater(download["byte_size"], 0)
        self.assertTrue(base64.b64decode(download["content_base64"]).startswith(b"%PDF-"))

        archived = self.assert_ok(
            self.request(
                "PATCH",
                f"/api/v1/reports/{report_id}/archive",
                {"_auth_token": token},
            )
        )
        self.assertEqual("ARCHIVED", archived["status"])


if __name__ == "__main__":
    unittest.main()
