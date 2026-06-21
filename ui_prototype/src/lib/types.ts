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
  object_id: string;
  status: string;
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
