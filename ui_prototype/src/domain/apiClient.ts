import type { ActionId, StatusCode } from "./types";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000/api/v1";

export interface ApiEnvelope<T> {
  success: boolean;
  code: string;
  message: string;
  trace_id: string | null;
  data?: T;
  field_errors?: Array<{ field: string; reason: string }>;
}

export class ApiClientError extends Error {
  code: string;
  fieldErrors: Array<{ field: string; reason: string }>;
  status: number;

  constructor(envelope: ApiEnvelope<unknown>, status: number) {
    super(envelope.message || envelope.code);
    this.name = "ApiClientError";
    this.code = envelope.code;
    this.fieldErrors = envelope.field_errors ?? [];
    this.status = status;
  }
}

export interface BackendProject {
  project_id: string;
  project_name: string;
  scenario_name: string;
  project_status: StatusCode;
  operator_id: string;
  current_package_id: string | null;
  current_input_snapshot_id: string | null;
  updated_at: string;
  simulation_disclaimer: string;
}

export interface BackendDashboardOverview extends BackendProject {
  metrics: {
    data_package_count: number;
    resource_count: number;
    party_count: number;
    audit_log_count: number;
  };
  risk_notices: string[];
  next_step: { label: string; button_code: string };
  preconditions: BackendPrecondition[];
  available_actions: string[];
  disabled_actions: BackendDisabledAction[];
}

export interface BackendPreconditions {
  project_id: string;
  project_status: StatusCode;
  preconditions: BackendPrecondition[];
  available_actions: string[];
  disabled_actions: BackendDisabledAction[];
}

export interface BackendPrecondition {
  code: string;
  passed: boolean;
  message: string;
}

export interface BackendDisabledAction {
  button_code: string;
  reason: string;
}

export interface TablePage<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface BackendDataPackage {
  package_id: string;
  package_name: string;
  source_type: "DEMO" | "UPLOAD" | string;
  file_name?: string | null;
  status: string;
  input_snapshot_id?: string | null;
  checksum?: string;
  created_at: string;
}

export interface BackendDataResource {
  resource_id: string;
  package_id: string;
  resource_name: string;
  modality: string;
  field_count: number;
  sample_count: number;
  party_id?: string | null;
  provider_party_name?: string | null;
  party_relations?: Array<{
    party_id: string;
    split_ratio: number;
    is_primary_provider: boolean;
  }>;
  status: string;
  updated_at: string;
}

export interface BackendParty {
  party_id: string;
  party_name: string;
  party_type: string;
  include_in_md_dshap: boolean;
  status: string;
  description?: string | null;
  updated_at: string;
}

export interface BackendQualityAssessment {
  assessment_id: string;
  package_id: string;
  version_no: number;
  quality_score: number;
  quality_level: string;
  quality_factor: number;
  dimension_scores: Record<string, number>;
  evidence_summary: string;
  algorithm_version: string;
  input_snapshot_id?: string | null;
  parameter_snapshot_id?: string | null;
  output_snapshot_id: string;
  created_at: string;
}

export interface BackendQualityDetail {
  detail_id: string;
  dimension_name: string;
  dimension_code: string;
  weight: number;
  score: number;
  evidence: string;
}

export interface BackendQualityDetails {
  assessment_id: string;
  assessment: BackendQualityAssessment;
  details: BackendQualityDetail[];
}

export interface QualityRunResponse {
  project_id: string;
  project_status: StatusCode;
  assessment: BackendQualityAssessment;
  details: BackendQualityDetail[];
}

export function getApiBaseUrl() {
  return (
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_DVAS_API_BASE_URL ||
    DEFAULT_API_BASE_URL
  ).replace(/\/+$/, "");
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const contentType = response.headers.get("content-type") ?? "";
  const responseText = await response.text();
  if (isHtmlResponse(contentType, responseText)) {
    throw new ApiClientError(
      {
        success: false,
        code: "DVAS_API_BASE_MISCONFIGURED",
        message:
          "当前 API 请求返回 HTML，可能是 API Base 指向了前端开发服务器。请检查 .env.local 或 Vite proxy。",
        trace_id: null,
        field_errors: [
          {
            field: "API Base",
            reason: `当前 API Base: ${getApiBaseUrl()}`,
          },
        ],
      },
      response.status,
    );
  }
  let envelope: ApiEnvelope<T>;
  try {
    envelope = JSON.parse(responseText) as ApiEnvelope<T>;
  } catch (error) {
    throw new ApiClientError(
      {
        success: false,
        code: "DVAS_INVALID_JSON_RESPONSE",
        message: "后端响应不是标准 JSON 信封",
        trace_id: null,
        field_errors: [
          {
            field: "response",
            reason: error instanceof Error ? error.message : String(error),
          },
        ],
      },
      response.status,
    );
  }
  if (!response.ok || !envelope.success) {
    throw new ApiClientError(envelope, response.status);
  }
  if (envelope.data === undefined) {
    throw new Error("后端响应缺少 data 字段");
  }
  return envelope.data;
}

function isHtmlResponse(contentType: string, body: string) {
  const normalizedType = contentType.toLowerCase();
  const trimmedBody = body.trimStart().toLowerCase();
  return (
    normalizedType.includes("text/html") ||
    trimmedBody.startsWith("<!doctype") ||
    trimmedBody.startsWith("<html")
  );
}

export const dvasApi = {
  baseUrl: getApiBaseUrl,
  getProject: () => request<BackendProject>("/projects/current"),
  getDashboardOverview: () =>
    request<BackendDashboardOverview>("/dashboard"),
  getDashboardPreconditions: () =>
    request<BackendPreconditions>("/dashboard/preconditions"),
  initializeDemoCase: () =>
    request<unknown>("/demo-cases/lung_screening_demo/initialize", {
      method: "POST",
      body: "{}",
    }),
  uploadJson: (payload: unknown) =>
    request<unknown>("/data-packages/upload", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listPackages: () => request<TablePage<BackendDataPackage>>("/data-packages"),
  listResources: () => request<TablePage<BackendDataResource>>("/data-resources"),
  listParties: () => request<TablePage<BackendParty>>("/parties"),
  runQualityAssessment: () =>
    request<QualityRunResponse>("/quality-assessments/run", {
      method: "POST",
      body: "{}",
    }),
  getLatestQualityAssessment: () =>
    request<BackendQualityAssessment>("/quality-assessments/latest"),
  getQualityDetails: (assessmentId: string) =>
    request<BackendQualityDetails>(
      `/quality-assessments/${encodeURIComponent(assessmentId)}/details`,
    ),
};

export function isBackendActionId(value: string): value is ActionId {
  return /^[A-Z]+-\d{3}$/.test(value);
}
