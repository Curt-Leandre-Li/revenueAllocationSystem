import { endpoints } from "./endpoints";
import { apiRequest, type TablePage } from "./httpClient";
import type {
  BackendAuditLogDetailDto,
  BackendAuditLogDto,
  BackendDashboardSummaryDto,
  BackendDataPackageDto,
  BackendDataResourceDto,
  BackendPartyDto,
  BackendProjectDto,
  BackendReportRecordDto,
  BackendUploadValidationResultDto,
} from "./dtoMappers";

const demoUploadPayload = {
  package_name: "前端联调 JSON 上传示例",
  file_name: "frontend-upload-demo.json",
  resources: [
    {
      resource_name: "联调结构化数据表",
      modality: "TABULAR",
      field_count: 12,
      sample_count: 240,
      provider_party_name: "前端联调数据源主体",
    },
  ],
  parties: [
    {
      party_name: "前端联调数据源主体",
      party_type: "DATA_PROVIDER",
      include_in_md_dshap: true,
    },
  ],
};

export const dvasApi = {
  getProject: () => apiRequest<BackendProjectDto>(endpoints.projectCurrent),
  getDashboardOverview: () =>
    apiRequest<BackendDashboardSummaryDto>(endpoints.dashboardOverview),
  getDashboardPreconditions: () =>
    apiRequest<{
      project_id: string;
      project_status: string;
      preconditions: BackendDashboardSummaryDto["preconditions"];
      available_actions: string[];
      disabled_actions: BackendDashboardSummaryDto["disabled_actions"];
    }>(endpoints.dashboardPreconditions),
  initializeDemoCase: (demoCaseId = "lung_screening_demo") =>
    apiRequest<unknown>(endpoints.initializeDemoCase(demoCaseId), {
      method: "POST",
      bodyJson: {},
    }),
  uploadJson: (payload: unknown = demoUploadPayload) =>
    apiRequest<unknown>(endpoints.uploadDataPackage, {
      method: "POST",
      bodyJson: payload,
    }),
  listDataPackages: () =>
    apiRequest<TablePage<BackendDataPackageDto>>(endpoints.dataPackages),
  getDataPackageDetail: (packageId: string) =>
    apiRequest<unknown>(endpoints.dataPackageDetail(packageId)),
  getUploadValidationResult: (packageId: string) =>
    apiRequest<BackendUploadValidationResultDto>(
      endpoints.uploadValidationResult(packageId),
    ),
  listDataResources: () =>
    apiRequest<TablePage<BackendDataResourceDto>>(endpoints.dataResources),
  getDataResourceDetail: (resourceId: string) =>
    apiRequest<BackendDataResourceDto>(endpoints.dataResourceDetail(resourceId)),
  listParties: () => apiRequest<TablePage<BackendPartyDto>>(endpoints.parties),
  listReports: () => apiRequest<TablePage<BackendReportRecordDto>>(endpoints.reports),
  listAuditLogs: (limit = 50) =>
    apiRequest<TablePage<BackendAuditLogDto>>(`${endpoints.auditLogs}?limit=${limit}`),
  getAuditLogDetail: (logId: string) =>
    apiRequest<BackendAuditLogDetailDto>(endpoints.auditLogDetail(logId)),
};

export * from "./config";
export * from "./dtoMappers";
export * from "./endpoints";
export * from "./errors";
export * from "./httpClient";
