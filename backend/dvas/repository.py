import copy
import json
from pathlib import Path

from .contracts import LOCAL_OPERATOR, SIMULATION_DISCLAIMER, utc_now


def initial_state():
    now = utc_now()
    return {
        "counters": {},
        "project": {
            "project_id": "project_p0_local_demo",
            "project_name": "数据收益分配系统 P0 本地演示项目",
            "scenario_name": "P0 本地演示闭环",
            "project_status": "DRAFT",
            "operator_id": LOCAL_OPERATOR,
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
        "allocation_scenarios": {},
        "allocation_results": {},
        "constraint_apply_traces": {},
        "report_records": {},
        "export_files": {},
        "snapshots": {},
        "audit_logs": {},
    }


class InMemoryRepository:
    def __init__(self, state=None, runtime_dir="backend/runtime"):
        self.runtime_dir = Path(runtime_dir)
        self.state = copy.deepcopy(state) if state is not None else initial_state()
        self.state.setdefault("quality_assessments", {})
        self.state.setdefault("quality_details", {})
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
        self.state.setdefault("allocation_scenarios", {})
        self.state.setdefault("allocation_results", {})
        self.state.setdefault("constraint_apply_traces", {})
        self.state.setdefault("report_records", {})
        self.state.setdefault("export_files", {})
        self.state.setdefault("snapshots", {})
        self.state["project"].setdefault("current_algorithm_task_id", None)
        self.state["project"].setdefault("current_allocation_id", None)

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

    def put_input_snapshot(self, snapshot):
        self.state["input_snapshots"][snapshot["snapshot_id"]] = copy.deepcopy(snapshot)
        self.save()
        return copy.deepcopy(snapshot)

    def get_input_snapshot(self, snapshot_id):
        snapshot = self.state["input_snapshots"].get(snapshot_id)
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
        return sorted(items, key=lambda item: (item["version_no"], item["result_id"]))

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

    def put_audit_log(self, audit_log):
        self.state["audit_logs"][audit_log["log_id"]] = copy.deepcopy(audit_log)
        self.save()
        return copy.deepcopy(audit_log)

    def list_audit_logs(self):
        return sorted(
            [copy.deepcopy(item) for item in self.state["audit_logs"].values()],
            key=lambda item: item["created_at"],
        )

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
