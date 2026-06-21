export type ProjectStatus =
  | "DRAFT"
  | "INGESTED"
  | "ASSESSED"
  | "METERED"
  | "UTILITY_CALCULATED"
  | "WEIGHT_CALCULATED"
  | "ALLOCATED"
  | "CONFIRMED"
  | "EXPORTED";

export interface TablePage<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface ProjectListItem {
  project_id: string;
  project_name: string;
  scenario_name: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface DbHealth {
  status: "ok";
  database: string;
  current_user: string;
  schema: string;
  schema_exists: boolean;
  core_table_count: number;
}

export interface ProjectStatusSummary {
  project: ProjectListItem;
  current_package_id?: string | null;
  current_algorithm_task_id?: string | null;
  current_allocation_id?: string | null;
  data_package?: {
    package_id: string;
    package_name: string;
    status: string;
    source_type: string;
    version_no: number;
    created_at: string;
    updated_at: string;
  } | null;
  upload_validation_latest?: {
    validation_result_id: string;
    package_id?: string | null;
    is_valid: boolean;
    error_field?: string | null;
    error_type?: string | null;
    error_message?: string | null;
    detail_json?: Record<string, unknown>;
    created_at: string;
  } | null;
  quality_assessment_latest?: {
    assessment_id: string;
    package_id: string;
    assessment_version_no: number;
    quality_score: string;
    quality_level: string;
    quality_factor: string;
    status: string;
    generated_at: string;
  } | null;
  shuyuan_metering_latest?: {
    metering_id: string;
    assessment_id: string;
    metering_version_no: number;
    call_count_total: number;
    total_amount: string;
    status: string;
    generated_at: string;
  } | null;
  utility_record_count: number;
  md_dshap_task?: MdDshapTask | null;
  md_dshap_result: {
    weight_sum: string;
    result_count: number;
  };
  allocation_scenario?: {
    allocation_id: string;
    scenario_name: string;
    total_revenue: string;
    data_revenue_pool: string;
    status: string;
    created_at: string;
    updated_at: string;
  } | null;
  allocation_result: {
    post_constraint_amount_sum: string;
    result_count: number;
  };
  counts: Record<
    | "input_snapshot"
    | "data_package"
    | "data_resource"
    | "party"
    | "quality_assessment"
    | "shuyuan_metering"
    | "contribution_record"
    | "utility_record"
    | "md_dshap_task"
    | "allocation_result"
    | "report_record"
    | "export_file"
    | "audit_log"
    | "snapshot_store",
    number
  >;
}

export interface AuditLogItem {
  log_id: string;
  project_id: string;
  module_code: string;
  menu_code: string;
  operation_type: string;
  object_type?: string;
  object_id: string;
  operator_id?: string;
  status: string;
  failure_reason?: string | null;
  input_snapshot_id?: string | null;
  parameter_snapshot_id?: string | null;
  result_snapshot_id?: string | null;
  checksum?: string | null;
  created_at: string;
}

export interface ExportFileItem {
  file_id: string;
  report_id: string;
  project_id: string;
  file_name: string;
  file_type: string;
  file_format: string;
  file_path: string;
  checksum: string;
  created_at: string;
}

export interface ReportItem {
  report_id: string;
  project_id: string;
  report_type: string;
  file_path: string;
  checksum: string;
  created_at: string;
  export_files: ExportFileItem[];
}

export interface ResourceFieldItem {
  field_id: string;
  field_name: string;
  field_type?: string | null;
  is_sensitive: boolean;
  missing_rate: string;
  distinct_count?: number | null;
}

export interface ResourceProviderPartyItem {
  relation_id: string;
  party_id: string;
  party_name: string;
  party_type: string;
  split_ratio: string;
  is_primary_provider: boolean;
  include_in_md_dshap: boolean;
  status: string;
}

export interface ResourceItem {
  resource_id: string;
  project_id: string;
  package_id: string;
  resource_name: string;
  modality: string;
  field_count: number;
  actual_field_count: number;
  sample_count: number;
  missing_rate: string;
  include_in_calculation: boolean;
  status: string;
  created_at: string;
  updated_at: string;
  sensitive_field_count: number;
  fields: ResourceFieldItem[];
  provider_parties: ResourceProviderPartyItem[];
}

export interface PartyItem {
  party_id: string;
  project_id: string;
  party_name: string;
  party_type: string;
  include_in_md_dshap: boolean;
  status: string;
  created_at: string;
  updated_at: string;
  linked_resource_count: number;
  linked_split_ratio_sum: string;
  allocation_result?: {
    raw_weight: string;
    pre_constraint_amount: string;
    post_constraint_amount: string;
    adjustment_amount: string;
    constraint_adjustment_reason?: string | null;
  } | null;
  md_dshap_weight?: {
    participant_weight: string;
    normalized_weight: string;
    baseline_weight?: string | null;
    weight_diff?: string | null;
  } | null;
}

export interface QualitySummary {
  project_id: string;
  status: string;
  assessment?: {
    assessment_id: string;
    package_id: string;
    assessment_version_no: number;
    quality_score: string;
    quality_level: string;
    quality_factor: string;
    dimension_scores?: Record<string, unknown>;
    evidence_summary?: string | null;
    status: string;
    generated_at: string;
  } | null;
  details: Array<{
    detail_id: string;
    metric_code: string;
    dimension_code: string;
    metric_name: string;
    weight: string;
    score: string;
    weighted_score: string;
    evidence_json?: Record<string, unknown>;
    created_at: string;
  }>;
}

export interface ShuyuanSummary {
  project_id: string;
  status: string;
  metering?: {
    metering_id: string;
    assessment_id: string;
    metering_version_no: number;
    base_shuyuan_price: string;
    scenario_coefficient: string;
    quality_coefficient: string;
    technology_coefficient: string;
    expert_coefficient: string;
    development_coefficient: string;
    call_count_total: number;
    total_amount: string;
    status: string;
    generated_at: string;
  } | null;
  details: Array<{
    detail_id: string;
    resource_id: string;
    resource_name: string;
    party_id: string;
    party_name: string;
    party_type: string;
    call_count: number;
    effective_units: string;
    metering_amount: string;
    formula_json?: Record<string, unknown>;
    created_at: string;
  }>;
}

export interface UtilitySummary {
  project_id: string;
  status: string;
  utility_function?: {
    snapshot_id: string;
    utility_source: string;
    formula_text: string;
    version_no: number;
    created_at: string;
  } | null;
  records: Array<{
    party_id: string;
    party_name: string;
    party_type: string;
    contribution_id?: string | null;
    valid_units: string;
    usage_weight: string;
    coverage_weight: string;
    scarcity_weight: string;
    contribution_score: string;
    normalized_contribution: string;
    utility_id?: string | null;
    task_key?: string | null;
    quality_factor?: string | null;
    usage_factor?: string | null;
    scenario_factor?: string | null;
    utility_value?: string | null;
    trace_count: number;
    created_at: string;
  }>;
  traces: Array<{
    trace_id: string;
    utility_id: string;
    party_id: string;
    party_name: string;
    task_key: string;
    formula_text: string;
    input_summary?: Record<string, unknown>;
    output_summary?: Record<string, unknown>;
    created_at: string;
  }>;
}

export interface ConstraintsSummary {
  project_id: string;
  status: string;
  allocation?: {
    allocation_id: string;
    scenario_name: string;
    total_revenue: string;
    priority_allocation_amount: string;
    data_revenue_pool: string;
    allocation_mode: string;
    status: string;
    created_at: string;
    updated_at: string;
  } | null;
  priority_items: Array<{
    item_id: string;
    party_id: string;
    party_name: string;
    party_type: string;
    priority_amount: string;
    priority_ratio?: string | null;
    basis_text: string;
    priority_order: number;
    status: string;
    created_at: string;
  }>;
  constraints: Array<{
    constraint_id: string;
    party_id: string;
    party_name: string;
    party_type: string;
    constraint_type: string;
    constraint_value: string;
    priority: number;
    basis_text?: string | null;
    status: string;
    created_at: string;
    updated_at: string;
  }>;
  traces: Array<{
    trace_id: string;
    constraint_id?: string | null;
    party_id: string;
    party_name: string;
    party_type: string;
    constraint_type?: string | null;
    before_amount: string;
    after_amount: string;
    adjustment_amount: string;
    reason: string;
    step_no: number;
    created_at: string;
  }>;
  allocation_results: Array<{
    result_id: string;
    party_id: string;
    party_name: string;
    party_type: string;
    raw_weight: string;
    normalized_weight: string;
    pre_constraint_amount: string;
    post_constraint_amount: string;
    adjustment_amount: string;
    constraint_adjustment_reason?: string | null;
  }>;
}

export interface AllocationItem {
  party_id: string;
  party_name: string;
  party_type: string;
  raw_weight: string;
  pre_constraint_amount: string;
  post_constraint_amount: string;
}

export interface AllocationSummary {
  project_id: string;
  allocation_id: string;
  scenario_name: string;
  status: string;
  total_revenue: string;
  data_revenue_pool: string;
  post_constraint_amount_sum: string;
  allocations: AllocationItem[];
}

export interface MdDshapTask {
  task_id: string;
  algorithm_mode: string;
  status: string;
  algorithm_version: string;
  sample_rounds: number;
  epsilon: string;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
}

export interface MdDshapParticipantWeight {
  party_id: string;
  party_name: string;
  party_type: string;
  participant_weight: string;
  normalized_weight: string;
  baseline_weight: string;
  weight_diff: string;
}

export interface MdDshapSummary {
  project_id: string;
  task_id: string;
  algorithm_mode: string;
  status: string;
  algorithm_version: string;
  sample_rounds: number;
  epsilon: string;
  weight_sum: string;
  audit_snapshot_exists: boolean;
  participant_weight: MdDshapParticipantWeight[];
}

export interface WriteResult {
  project_id: string;
  project_status: ProjectStatus;
  package_id?: string;
  input_snapshot_id?: string;
  allocation_id?: string;
  task_id?: string;
  report_id?: string;
  checksum?: string;
  file_formats?: string[];
  status_flow?: ProjectStatus[];
  algorithm_mode?: string;
}
