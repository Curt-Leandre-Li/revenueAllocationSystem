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
            "created_at": now,
            "updated_at": now,
            "simulation_disclaimer": SIMULATION_DISCLAIMER,
        },
        "data_packages": {},
        "input_snapshots": {},
        "validation_results": {},
        "data_resources": {},
        "parties": {},
        "audit_logs": {},
    }


class InMemoryRepository:
    def __init__(self, state=None):
        self.state = copy.deepcopy(state) if state is not None else initial_state()

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

    def list_parties(self):
        return sorted(
            [copy.deepcopy(item) for item in self.state["parties"].values()],
            key=lambda item: item["party_id"],
        )

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
        super().__init__(state)

    def save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(
            json.dumps(self.state, ensure_ascii=False, indent=2, sort_keys=True),
            encoding="utf-8",
        )
