from dataclasses import dataclass
from enum import Enum


class CanonicalStrEnum(str, Enum):
    @classmethod
    def values(cls):
        return [item.value for item in cls]


class ProjectStatus(CanonicalStrEnum):
    DRAFT = "DRAFT"
    INGESTED = "INGESTED"
    ASSESSED = "ASSESSED"
    METERED = "METERED"
    UTILITY_CALCULATED = "UTILITY_CALCULATED"
    WEIGHT_CALCULATED = "WEIGHT_CALCULATED"
    ALLOCATED = "ALLOCATED"
    CONFIRMED = "CONFIRMED"
    EXPORTED = "EXPORTED"


class AlgorithmMode(CanonicalStrEnum):
    MD_DSHAP = "MD_DSHAP"
    BASELINE_SHAPLEY = "BASELINE_SHAPLEY"


class SnapshotType(CanonicalStrEnum):
    INPUT = "INPUT"
    PARAMETER = "PARAMETER"
    RESULT = "RESULT"
    REPORT = "REPORT"
    ALGORITHM = "ALGORITHM"
    ALGORITHM_AUDIT = "ALGORITHM_AUDIT"
    ALLOCATION = "ALLOCATION"
    ASSUMPTION = "ASSUMPTION"
    OTHER = "OTHER"


class ReportFormat(CanonicalStrEnum):
    MARKDOWN = "MARKDOWN"
    CSV = "CSV"
    JSON = "JSON"
    JSONL = "JSONL"


class AllocationMode(CanonicalStrEnum):
    MD_DSHAP_WEIGHT_WITH_CONSTRAINTS = "MD_DSHAP_WEIGHT_WITH_CONSTRAINTS"
    CONTRIBUTION = "CONTRIBUTION"
    UTILITY = "UTILITY"
    MANUAL = "MANUAL"


class ContractConstraintType(CanonicalStrEnum):
    MIN_AMOUNT = "MIN_AMOUNT"
    MAX_AMOUNT = "MAX_AMOUNT"
    CAP_AMOUNT = "CAP_AMOUNT"
    FLOOR_AMOUNT = "FLOOR_AMOUNT"
    FIXED_RATIO = "FIXED_RATIO"
    PRIORITY_ALLOCATION = "PRIORITY_ALLOCATION"


@dataclass(frozen=True)
class P0RuntimeConfig:
    local_operator: str = "local_operator"
    default_demo_project_id: str = "project_p0_local_demo"
    default_export_dir: str = "exports"
    amount_precision: int = 2
    weight_precision: int = 6
    weight_normalization_tolerance: float = 0.000001
    simulation_disclaimer: str = "系统结果仅为模拟参考，非法律结算 / 非法定结算结果。"
    default_algorithm_mode: str = AlgorithmMode.MD_DSHAP.value


P0_CONFIG = P0RuntimeConfig()
