from .constants import ProjectStatus
from .contracts import ApiError


STATUS_ORDER = {status: index for index, status in enumerate(ProjectStatus.values())}


class ProjectStateMachine:
    def __init__(self, repository):
        self.repository = repository

    def require_quality_allowed(self):
        self._require_at_least(
            ProjectStatus.INGESTED.value,
            "请先完成数据接入",
            "package_id",
        )

    def require_metering_allowed(self):
        self._require_at_least(
            ProjectStatus.ASSESSED.value,
            "请先完成质量评估",
            "quality_assessment",
        )

    def require_contribution_allowed(self):
        self._require_at_least(
            ProjectStatus.METERED.value,
            "请先完成数元计量",
            "shuyuan_metering",
        )

    def require_utility_allowed(self):
        self._require_at_least(
            ProjectStatus.METERED.value,
            "请先完成数元计量",
            "shuyuan_metering",
        )

    def require_md_dshap_allowed(self):
        self._require_at_least(
            ProjectStatus.UTILITY_CALCULATED.value,
            "请先完成效用计算",
            "project_status",
        )

    def require_allocation_allowed(self):
        self._require_at_least(
            ProjectStatus.WEIGHT_CALCULATED.value,
            "请先完成 MD-DShap 权重计算",
            "weight_task_id",
        )

    def require_report_export_allowed(self):
        status = self.repository.get_project()["project_status"]
        if status not in {
            ProjectStatus.ALLOCATED.value,
            ProjectStatus.CONFIRMED.value,
            ProjectStatus.EXPORTED.value,
        }:
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                "请先完成收益分配模拟",
                field_errors=[{"field": "allocation_result", "reason": "请先完成收益分配模拟"}],
            )

    def require_final_report_export_allowed(self):
        status = self.repository.get_project()["project_status"]
        if status not in {ProjectStatus.CONFIRMED.value, ProjectStatus.EXPORTED.value}:
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                "请先锁定确认模拟参考方案",
                field_errors=[{"field": "project_status", "reason": "最终确认类报告必须先锁定方案"}],
            )

    def _require_at_least(self, required_status, message, field):
        status = self.repository.get_project()["project_status"]
        if STATUS_ORDER.get(status, -1) < STATUS_ORDER[required_status]:
            raise ApiError(
                "DVAS_PRECONDITION_NOT_MET",
                message,
                field_errors=[{"field": field, "reason": message}],
            )
