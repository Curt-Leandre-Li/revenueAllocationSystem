import inspect
import unittest
from pathlib import Path

from backend.dvas.app import DvasApplication
from backend.dvas.contracts import ApiError
from backend.dvas.pipeline_write_service import (
    PostgresPipelineWriteService,
    validate_upload_payload,
)


class FakePipelineWriteService:
    def __init__(self):
        self.calls = []

    def load_demo_case(self, body):
        self.calls.append(("load_demo_case", body))
        return {"project_id": "PRJ_TEST", "project_status": "INGESTED"}

    def upload_json(self, body):
        self.calls.append(("upload_json", body))
        return {"project_id": "PRJ_TEST", "project_status": "INGESTED"}

    def run_pipeline(self, project_id, body):
        self.calls.append(("run_pipeline", project_id, body))
        return {"project_id": project_id, "project_status": "ALLOCATED"}

    def generate_report(self, project_id, body):
        self.calls.append(("generate_report", project_id, body))
        return {"project_id": project_id, "project_status": "EXPORTED"}

    def confirm_allocation(self, project_id, body):
        self.calls.append(("confirm_allocation", project_id, body))
        return {"project_id": project_id, "project_status": "CONFIRMED"}


class PipelineWriteContractTests(unittest.TestCase):
    def assert_ok(self, response):
        self.assertTrue(response["success"], response)
        self.assertEqual("OK", response["code"])
        return response["data"]

    def test_plain_api_write_routes_dispatch_to_postgres_write_service(self):
        app = DvasApplication()
        fake_service = FakePipelineWriteService()
        app.postgres_write_service = fake_service

        self.assert_ok(app.handle("POST", "/api/demo-cases/load", {"case_code": "p0_demo"}))
        self.assert_ok(app.handle("POST", "/api/data/upload-json", {"project_name": "uploaded"}))
        self.assert_ok(app.handle("POST", "/api/projects/PRJ_TEST/pipeline/run", {}))
        self.assert_ok(app.handle("POST", "/api/projects/PRJ_TEST/reports/generate", {}))
        self.assert_ok(app.handle("POST", "/api/projects/PRJ_TEST/allocation/confirm", {}))

        self.assertEqual(
            [
                ("load_demo_case", {"case_code": "p0_demo"}),
                ("upload_json", {"project_name": "uploaded"}),
                ("run_pipeline", "PRJ_TEST", {}),
                ("generate_report", "PRJ_TEST", {}),
                ("confirm_allocation", "PRJ_TEST", {}),
            ],
            fake_service.calls,
        )

    def test_upload_validation_rejects_negative_revenue_and_duplicate_parties(self):
        with self.assertRaises(ApiError) as raised:
            validate_upload_payload(
                {
                    "project_name": "bad upload",
                    "scenario_name": "duplicate party",
                    "revenue_pool": {"total_revenue": "-1"},
                    "participants": [
                        {"party_name": "数据方A", "party_type": "DATA_PROVIDER"},
                        {"party_name": "数据方A", "party_type": "DATA_PROVIDER"},
                    ],
                    "resources": [
                        {
                            "resource_name": "resource_a",
                            "provider_party_name": "数据方A",
                            "field_count": 1,
                            "sample_count": 1,
                        }
                    ],
                }
            )

        error = raised.exception
        self.assertEqual("DVAS_INPUT_FORMAT_ERROR", error.code)
        fields = {item["field"] for item in error.field_errors}
        self.assertIn("revenue_pool.total_revenue", fields)
        self.assertIn("participants[1].party_name", fields)

    def test_pipeline_write_source_uses_required_tables_decimal_and_no_json_mock(self):
        import backend.dvas.pipeline_write_service as pipeline_write_service
        import backend.dvas.postgres_write_model as postgres_write_model

        source = inspect.getsource(pipeline_write_service) + inspect.getsource(postgres_write_model)
        required_tables = [
            "dvas.allocation_project",
            "dvas.input_snapshot",
            "dvas.data_package",
            "dvas.upload_validation_result",
            "dvas.data_resource",
            "dvas.data_resource_field",
            "dvas.party",
            "dvas.data_resource_party_relation",
            "dvas.snapshot_store",
            "dvas.audit_log",
            "dvas.quality_assessment",
            "dvas.quality_score_detail",
            "dvas.shuyuan_metering",
            "dvas.shuyuan_metering_detail",
            "dvas.contribution_record",
            "dvas.utility_function_snapshot",
            "dvas.utility_record",
            "dvas.utility_trace",
            "dvas.md_dshap_task",
            "dvas.md_dshap_result",
            "dvas.md_dshap_marginal_trace",
            "dvas.algorithm_audit_snapshot",
            "dvas.allocation_scenario",
            "dvas.allocation_priority_item",
            "dvas.contract_constraint",
            "dvas.allocation_result",
            "dvas.constraint_apply_trace",
            "dvas.report_record",
            "dvas.export_file",
        ]
        for table in required_tables:
            with self.subTest(table=table):
                self.assertIn(table, source)

        self.assertIn("Decimal", source)
        self.assertIn("quantize", source)
        self.assertNotIn("float(", source)
        self.assertNotIn("JsonFileRepository", source)
        self.assertNotIn("dvas_state.json", source)

    def test_phase_2b_smoke_does_not_depend_on_sql_demo_data(self):
        script_path = Path("scripts/pipeline_db_write_smoke_test.py")
        workflow_path = Path(".github/workflows/phase-2b-pipeline-write-db.yml")
        self.assertTrue(script_path.exists(), "Phase 2B smoke script must exist")
        self.assertTrue(workflow_path.exists(), "Phase 2B workflow must exist")

        script_text = script_path.read_text(encoding="utf-8")
        workflow_text = workflow_path.read_text(encoding="utf-8")
        combined = script_text + workflow_text

        self.assertNotIn("dvas_p0_03_demo_data.sql", combined)
        self.assertIn("/api/demo-cases/load", script_text)
        self.assertIn("/api/projects/{project_id}/pipeline/run", script_text)
        self.assertIn("/api/projects/{project_id}/reports/generate", script_text)


class PipelineWriteServiceContractTests(unittest.TestCase):
    def test_service_can_be_constructed_without_database_url(self):
        service = PostgresPipelineWriteService(client=None)
        self.assertIsNotNone(service)


if __name__ == "__main__":
    unittest.main()
