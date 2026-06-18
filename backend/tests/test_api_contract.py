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
        expected_amount = round(
            parameters["base_price"]
            * parameters["scenario_coefficient"]
            * parameters["quality_coefficient"]
            * parameters["technology_coefficient"]
            * parameters["expert_coefficient"]
            * parameters["development_coefficient"]
            * parameters["call_count"],
            2,
        )
        self.assertEqual("METERED", result["project_status"])
        self.assertTrue(metering["metering_id"].startswith("metering_"))
        self.assertEqual(quality["assessment"]["assessment_id"], metering["assessment_id"])
        self.assertEqual(expected_amount, metering["metering_amount"])
        self.assertEqual("DVAS_SHUYUAN_METERING_SKELETON_V0", metering["algorithm_version"])
        self.assertTrue(metering["parameter_snapshot_id"].startswith("snapshot_"))
        self.assertTrue(metering["output_snapshot_id"].startswith("snapshot_"))
        self.assertGreaterEqual(len(result["details"]), 2)
        self.assertEqual(expected_amount, round(sum(item["metering_amount"] for item in result["details"]), 2))

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
        self.assertEqual("DVAS_UTILITY_SKELETON_V0", utility["utility"]["algorithm_version"])
        self.assertGreaterEqual(len(utility["trace"]), 1)
        for trace in utility["trace"]:
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
        results = self.assert_ok(self.request("GET", f"/api/v1/md-dshap/tasks/{task_id}/results"))
        traces = self.assert_ok(
            self.request("GET", f"/api/v1/md-dshap/tasks/{task_id}/marginal-traces")
        )

        self.assertEqual(task_id, task["task_id"])
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
        self.assertGreaterEqual(len(simulated["results"]), 2)
        self.assertEqual(
            900.0,
            round(sum(item["post_constraint_amount"] for item in simulated["results"]), 2),
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
        self.assertEqual("DVAS_PRECONDITION_NOT_MET", response["code"])
        self.assertEqual(
            [{"field": "priority_allocation_amount", "reason": "优先分配金额不能超过总收益"}],
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

    def test_reports_export_pdf_endpoints_not_implemented_in_be07(self):
        for method, path in [
            ("GET", "/api/v1/reports"),
            ("POST", "/api/v1/reports/export"),
            ("GET", "/api/v1/reports/report_000001/pdf"),
        ]:
            with self.subTest(path=path):
                response = self.request(method, path, {})
                self.assertFalse(response["success"])
                self.assertEqual("DVAS_NOT_FOUND", response["code"])


if __name__ == "__main__":
    unittest.main()
