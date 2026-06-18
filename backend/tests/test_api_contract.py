import json
import unittest
from pathlib import Path

from backend.dvas.app import DvasApplication
from backend.dvas.repository import InMemoryRepository


class DvasApiContractTests(unittest.TestCase):
    def setUp(self):
        self.repository = InMemoryRepository()
        self.app = DvasApplication(self.repository)

    def request(self, method, path, body=None):
        return self.app.handle(method, path, body)

    def assert_ok(self, response):
        self.assertTrue(response["success"], response)
        self.assertEqual("OK", response["code"])
        self.assertIn("trace_id", response)
        self.assertIn("data", response)
        return response["data"]

    def test_current_project_starts_as_draft_with_stable_envelope(self):
        data = self.assert_ok(self.request("GET", "/api/v1/projects/current"))

        self.assertEqual("DRAFT", data["project_status"])
        self.assertEqual("local_operator", data["operator_id"])
        self.assertEqual("系统结果仅为模拟参考，非法律结算 / 非法定结算结果。", data["simulation_disclaimer"])

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

        data = self.assert_ok(self.request("GET", "/api/v1/dashboard/overview"))

        self.assertEqual("INGESTED", data["project_status"])
        self.assertEqual(1, data["metrics"]["data_package_count"])
        self.assertGreaterEqual(data["metrics"]["resource_count"], 2)
        self.assertEqual("启动质量评估", data["next_step"]["label"])
        self.assertEqual("QUAL-003", data["next_step"]["button_code"])

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

    def test_upload_json_validation_failure_returns_field_errors_and_failure_detail(self):
        response = self.request("POST", "/api/v1/data-packages/upload", {"resources": []})

        self.assertFalse(response["success"])
        self.assertEqual("DVAS_REQUIRED_FIELD_MISSING", response["code"])
        self.assertEqual("上传 JSON 校验失败", response["message"])
        self.assertEqual(
            [{"field": "package_name", "reason": "package_name 为必填字段"}],
            response["field_errors"],
        )

        packages = self.assert_ok(self.request("GET", "/api/v1/data-packages"))["items"]
        self.assertEqual(1, len(packages))
        package_id = packages[0]["package_id"]
        validation = self.assert_ok(
            self.request("GET", f"/api/v1/data-packages/{package_id}/validation-result")
        )

        self.assertEqual("INVALID", validation["status"])
        self.assertEqual("DVAS_REQUIRED_FIELD_MISSING", validation["code"])
        self.assertEqual(package_id, validation["package_id"])

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
            "/dashboard/overview",
            "/dashboard/preconditions",
            "/data-packages",
            "/data-resources",
            "/data-resources/resource_000001/party-relations",
            "/parties",
            "/quality-assessments/latest",
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
        self.assertIn("/dashboard/preconditions", path_lines)
        self.assertIn("/data-resources/{resource_id}/party-relations", path_lines)
        self.assertIn("/quality-assessments/{assessment_id}/details", path_lines)

    def test_quick_run_skeleton_returns_explainable_precondition_failure(self):
        response = self.request("POST", "/api/v1/dashboard/quick-run")

        self.assertFalse(response["success"])
        self.assertEqual("DVAS_PRECONDITION_NOT_MET", response["code"])
        self.assertEqual(
            [{"field": "data_package", "reason": "请先完成数据接入"}],
            response["field_errors"],
        )

    def test_http_adapter_serializes_json_response(self):
        status, headers, raw_body = self.app.handle_http("GET", "/api/v1/projects/current", b"")

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
        self.assertEqual("DVAS_QUALITY_SKELETON_V0", assessment["assessment"]["algorithm_version"])
        self.assertTrue(assessment["assessment"]["output_snapshot_id"].startswith("snapshot_"))
        self.assertGreaterEqual(len(assessment["details"]), 3)

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

    def test_quality_assessment_requires_ingested_package(self):
        response = self.request("POST", "/api/v1/quality-assessments/run", {})

        self.assertFalse(response["success"])
        self.assertEqual("DVAS_PRECONDITION_NOT_MET", response["code"])
        self.assertEqual(
            [{"field": "package_id", "reason": "请先完成数据接入"}],
            response["field_errors"],
        )


if __name__ == "__main__":
    unittest.main()
