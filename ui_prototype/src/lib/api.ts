import {
  apiErrorFromEnvelope,
  DvasApiError,
  type ApiErrorEnvelope,
} from "./errors";
import type {
  AllocationSummary,
  AuditLogItem,
  DbHealth,
  MdDshapSummary,
  ProjectListItem,
  ProjectStatusSummary,
  ReportItem,
  TablePage,
  WriteResult,
} from "./types";

interface ApiEnvelope<T> extends ApiErrorEnvelope {
  success: boolean;
  data?: T;
}

interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  bodyJson?: unknown;
}

const DEFAULT_API_BASE_URL = "http://localhost:8000";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function readEnvString(name: string) {
  return String(import.meta.env[name] ?? "").trim();
}

export function getApiBaseUrl() {
  return trimTrailingSlash(readEnvString("VITE_API_BASE_URL") || DEFAULT_API_BASE_URL);
}

function joinUrl(endpoint: string) {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${getApiBaseUrl()}${normalizedEndpoint}`;
}

async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { bodyJson, headers, ...requestOptions } = options;
  let response: Response;
  try {
    response = await fetch(joinUrl(endpoint), {
      ...requestOptions,
      body: bodyJson === undefined ? undefined : JSON.stringify(bodyJson),
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    });
  } catch (error) {
    throw error;
  }

  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !envelope.success) {
    throw new DvasApiError(apiErrorFromEnvelope(envelope, response.status));
  }
  if (envelope.data === undefined) {
    throw new DvasApiError(
      apiErrorFromEnvelope(
        {
          success: false,
          code: "DVAS_EMPTY_RESPONSE",
          message: "后端响应缺少 data 字段",
        },
        response.status,
        envelope,
      ),
    );
  }
  return envelope.data;
}

export const p0Api = {
  healthDb: () => apiRequest<DbHealth>("/health/db"),
  listProjects: () => apiRequest<TablePage<ProjectListItem>>("/api/projects"),
  getProjectStatus: (projectId: string) =>
    apiRequest<ProjectStatusSummary>(`/api/projects/${encodeURIComponent(projectId)}/status`),
  listAuditLogs: (projectId: string, limit = 50) =>
    apiRequest<TablePage<AuditLogItem>>(
      `/api/audit/logs?project_id=${encodeURIComponent(projectId)}&limit=${limit}`,
    ),
  listReports: (projectId: string) =>
    apiRequest<TablePage<ReportItem>>(`/api/reports?project_id=${encodeURIComponent(projectId)}`),
  getAllocationSummary: (projectId: string) =>
    apiRequest<AllocationSummary>(
      `/api/projects/${encodeURIComponent(projectId)}/allocation-summary`,
    ),
  getMdDshapSummary: (projectId: string) =>
    apiRequest<MdDshapSummary>(
      `/api/projects/${encodeURIComponent(projectId)}/md-dshap-summary`,
    ),
  loadDemoCase: () =>
    apiRequest<WriteResult>("/api/demo-cases/load", {
      method: "POST",
      bodyJson: {},
    }),
  uploadJson: (payload: unknown = defaultUploadPayload) =>
    apiRequest<WriteResult>("/api/data/upload-json", {
      method: "POST",
      bodyJson: payload,
    }),
  runPipeline: (projectId: string) =>
    apiRequest<WriteResult>(`/api/projects/${encodeURIComponent(projectId)}/pipeline/run`, {
      method: "POST",
      bodyJson: {},
    }),
  confirmAllocation: (projectId: string) =>
    apiRequest<WriteResult>(
      `/api/projects/${encodeURIComponent(projectId)}/allocation/confirm`,
      {
        method: "POST",
        bodyJson: {},
      },
    ),
  generateReport: (projectId: string) =>
    apiRequest<WriteResult>(`/api/projects/${encodeURIComponent(projectId)}/reports/generate`, {
      method: "POST",
      bodyJson: {},
    }),
};

const defaultUploadPayload = {
  project_name: "Phase 2C 前端 JSON 上传项目",
  scenario_name: "Phase 2C 真实 API 接入校验",
  package_name: "phase_2c_frontend_upload.json",
  file_name: "phase_2c_frontend_upload.json",
  revenue_pool: {
    total_revenue: "1000000.00",
  },
  participants: [
    {
      party_name: "前端联调数据源主体A",
      party_type: "DATA_PROVIDER",
      include_in_md_dshap: true,
    },
    {
      party_name: "前端联调数据源主体B",
      party_type: "DATA_PROVIDER",
      include_in_md_dshap: true,
    },
    {
      party_name: "前端联调运营服务方",
      party_type: "OPERATOR",
      include_in_md_dshap: false,
    },
  ],
  resources: [
    {
      resource_name: "frontend_feature_table",
      provider_party_name: "前端联调数据源主体A",
      modality: "TABLE",
      field_count: 6,
      sample_count: 360,
      missing_rate: "0.020000",
      fields: [
        { field_name: "record_id", field_type: "STRING", is_sensitive: false },
        { field_name: "feature_bucket", field_type: "STRING", is_sensitive: false },
      ],
    },
    {
      resource_name: "frontend_followup_stats",
      provider_party_name: "前端联调数据源主体B",
      modality: "TABLE",
      field_count: 5,
      sample_count: 240,
      missing_rate: "0.030000",
      fields: [
        { field_name: "record_id", field_type: "STRING", is_sensitive: false },
        { field_name: "usage_count", field_type: "INTEGER", is_sensitive: false },
      ],
    },
  ],
};
