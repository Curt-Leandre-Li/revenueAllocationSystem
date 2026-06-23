from .constants import (
    AllocationMode,
    AlgorithmMode,
    ContractConstraintType,
    ProjectStatus,
    ReportFormat,
    SnapshotType,
)
from .contracts import ApiError


SQL_ENUM_VALUES = {
    "project_status": set(ProjectStatus.values()) | {"DISABLED"},
    "data_package_status": {"DRAFT", "VALID", "INVALID", "ARCHIVED"},
    "md_dshap_task_status": {"PENDING", "RUNNING", "SUCCESS", "FAILED", "CANCELLED"},
    "algorithm_mode": {"MD_DSHAP", "BASIC_SHAPLEY"},
    "snapshot_type": {"INPUT", "PARAMETER", "RESULT", "REPORT", "ALGORITHM", "ALLOCATION", "ASSUMPTION", "OTHER"},
    "report_format": {"MD", "CSV", "JSON", "JSONL", "ZIP", "PDF"},
    "allocation_mode": {"MD_DSHAP_WEIGHT", "CONTRIBUTION", "UTILITY", "MANUAL"},
    "contract_constraint_type": {
        "MIN_AMOUNT",
        "MAX_AMOUNT",
        "CAP_AMOUNT",
        "FLOOR_AMOUNT",
        "FIXED_RATIO",
        "PRIORITY_AMOUNT",
    },
    "export_file_id_field": {"file_id"},
}


RUNTIME_TO_SQL = {
    "project_status": {value: value for value in ProjectStatus.values()},
    "data_package_status": {"VALIDATED": "VALID", "INVALID": "INVALID"},
    "md_dshap_task_status": {"COMPLETED": "SUCCESS", "FAILED": "FAILED"},
    "algorithm_mode": {
        AlgorithmMode.MD_DSHAP.value: "MD_DSHAP",
        AlgorithmMode.BASELINE_SHAPLEY.value: "BASIC_SHAPLEY",
    },
    "snapshot_type": {
        SnapshotType.INPUT.value: "INPUT",
        SnapshotType.PARAMETER.value: "PARAMETER",
        SnapshotType.RESULT.value: "RESULT",
        SnapshotType.REPORT.value: "REPORT",
        SnapshotType.ALGORITHM.value: "ALGORITHM",
        SnapshotType.ALGORITHM_AUDIT.value: "ALGORITHM",
        SnapshotType.ALLOCATION.value: "ALLOCATION",
        SnapshotType.ASSUMPTION.value: "ASSUMPTION",
        SnapshotType.OTHER.value: "OTHER",
    },
    "report_format": {
        ReportFormat.MARKDOWN.value: "MD",
        ReportFormat.CSV.value: "CSV",
        ReportFormat.JSON.value: "JSON",
        ReportFormat.JSONL.value: "JSONL",
    },
    "allocation_mode": {
        AllocationMode.MD_DSHAP_WEIGHT_WITH_CONSTRAINTS.value: "MD_DSHAP_WEIGHT",
        AllocationMode.CONTRIBUTION.value: "CONTRIBUTION",
        AllocationMode.UTILITY.value: "UTILITY",
        AllocationMode.MANUAL.value: "MANUAL",
    },
    "contract_constraint_type": {
        ContractConstraintType.MIN_AMOUNT.value: "MIN_AMOUNT",
        ContractConstraintType.MAX_AMOUNT.value: "MAX_AMOUNT",
        ContractConstraintType.CAP_AMOUNT.value: "CAP_AMOUNT",
        ContractConstraintType.FLOOR_AMOUNT.value: "FLOOR_AMOUNT",
        ContractConstraintType.FIXED_RATIO.value: "FIXED_RATIO",
        ContractConstraintType.PRIORITY_ALLOCATION.value: "PRIORITY_AMOUNT",
    },
    "export_file_id_field": {"export_file_id": "file_id"},
}


SQL_TO_RUNTIME = {
    domain: {sql_value: runtime_value for runtime_value, sql_value in mapping.items()}
    for domain, mapping in RUNTIME_TO_SQL.items()
}

SQL_TO_RUNTIME["snapshot_type"]["ALGORITHM"] = SnapshotType.ALGORITHM.value
SQL_TO_RUNTIME["report_format"].update({"PDF": "P1_REPORT_FORMAT_PDF", "ZIP": "P1_REPORT_FORMAT_ZIP"})
SQL_TO_RUNTIME["data_package_status"].update({"DRAFT": "DRAFT", "ARCHIVED": "ARCHIVED"})
SQL_TO_RUNTIME["md_dshap_task_status"].update(
    {"PENDING": "PENDING", "RUNNING": "RUNNING", "CANCELLED": "CANCELLED"}
)


def runtime_to_sql_enum(domain, value):
    try:
        return RUNTIME_TO_SQL[domain][value]
    except KeyError as exc:
        raise ApiError(
            "DVAS_UNMAPPED_ENUM_VALUE",
            "运行时枚举未建立 SQL 映射",
            field_errors=[{"field": domain, "reason": str(value)}],
        ) from exc


def sql_to_runtime_enum(domain, value):
    try:
        mapped = SQL_TO_RUNTIME[domain][value]
    except KeyError as exc:
        raise ApiError(
            "DVAS_UNMAPPED_ENUM_VALUE",
            "SQL 枚举未建立运行时映射",
            field_errors=[{"field": domain, "reason": str(value)}],
        ) from exc
    if str(mapped).startswith("P1_REPORT_FORMAT_"):
        raise ApiError(
            "DVAS_P1_CAPABILITY_NOT_ENABLED",
            "该报告格式属于 P1 能力，P0 不提供假实现",
            field_errors=[{"field": domain, "reason": str(value)}],
        )
    return mapped


def assert_runtime_enums_mapped():
    domains = {
        "project_status": ProjectStatus.values(),
        "algorithm_mode": AlgorithmMode.values(),
        "snapshot_type": SnapshotType.values(),
        "report_format": ReportFormat.values(),
        "allocation_mode": AllocationMode.values(),
        "contract_constraint_type": ContractConstraintType.values(),
        "data_package_status": ["VALIDATED", "INVALID"],
        "md_dshap_task_status": ["COMPLETED", "FAILED"],
        "export_file_id_field": ["export_file_id"],
    }
    return {
        domain: [runtime_to_sql_enum(domain, value) for value in values]
        for domain, values in domains.items()
    }


def assert_sql_enums_mapped():
    checked = {}
    for domain, values in SQL_ENUM_VALUES.items():
        checked[domain] = []
        for value in sorted(values):
            if domain == "report_format" and value in {"PDF", "ZIP"}:
                checked[domain].append({"sql": value, "runtime": "P1_DISABLED"})
                continue
            if domain == "snapshot_type" and value == "ALGORITHM":
                checked[domain].append({"sql": value, "runtime": SnapshotType.ALGORITHM.value})
                continue
            if domain == "project_status" and value == "DISABLED":
                checked[domain].append({"sql": value, "runtime": "P1_DISABLED"})
                continue
            checked[domain].append({"sql": value, "runtime": sql_to_runtime_enum(domain, value)})
    return checked
