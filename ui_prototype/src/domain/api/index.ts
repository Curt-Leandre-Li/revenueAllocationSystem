import { endpoints } from "./endpoints";
import {
  apiRequest,
  clearStoredAuthToken,
  setStoredAuthToken,
  type TablePage,
} from "./httpClient";
import type {
  BackendAuditLogDetailDto,
  BackendAuditLogDto,
  BackendConstraintDto,
  BackendDashboardSummaryDto,
  BackendDataPackageDto,
  BackendDataResourceDto,
  BackendNavigationMenuDto,
  BackendPartyDto,
  BackendProjectDto,
  BackendReportRecordDto,
  BackendSystemParameterDto,
  BackendUploadValidationResultDto,
} from "./dtoMappers";

export const dvasApi = {
  login: async (username: string, password: string) => {
    const response = await apiRequest<{
      token: string;
      user: Record<string, unknown>;
      roles: string[];
      permissions: Record<string, unknown>;
    }>(endpoints.authLogin, {
      method: "POST",
      bodyJson: { username, password },
    });
    setStoredAuthToken(response.token);
    return response;
  },
  logout: async () => {
    const response = await apiRequest<unknown>(endpoints.authLogout, {
      method: "POST",
      bodyJson: {},
    });
    clearStoredAuthToken();
    return response;
  },
  getCurrentUser: () =>
    apiRequest<{
      user: Record<string, unknown>;
      roles: string[];
      permissions: {
        permission_codes: string[];
        menu_codes: string[];
        button_codes: string[];
        api_permissions: Array<Record<string, unknown>>;
        export_permissions: string[];
      };
    }>(endpoints.authMe),
  getAuthPermissions: () => apiRequest<Record<string, unknown>>(endpoints.authPermissions),
  listMyProjects: (scope?: "mine") =>
    apiRequest<TablePage<Record<string, unknown>>>(
      scope ? `${endpoints.myProjects}?scope=${encodeURIComponent(scope)}` : endpoints.myProjects,
    ),
  listMyUploads: (scope?: "mine") =>
    apiRequest<TablePage<BackendDataPackageDto>>(
      scope ? `${endpoints.myUploads}?scope=${encodeURIComponent(scope)}` : endpoints.myUploads,
    ),
  listMyJobs: (scope?: "mine") =>
    apiRequest<TablePage<Record<string, unknown>>>(
      scope ? `${endpoints.myJobs}?scope=${encodeURIComponent(scope)}` : endpoints.myJobs,
    ),
  listMyReports: (scope?: "mine") =>
    apiRequest<TablePage<BackendReportRecordDto>>(
      scope ? `${endpoints.myReports}?scope=${encodeURIComponent(scope)}` : endpoints.myReports,
    ),
  getMyWorkbench: () => apiRequest<Record<string, unknown>>(endpoints.myWorkbench),
  getProject: () => apiRequest<BackendProjectDto>(endpoints.projectCurrentStatus),
  getNavigationMenus: () =>
    apiRequest<{ items: BackendNavigationMenuDto[] }>(endpoints.navigationMenus),
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
  runPipeline: async () => {
    const project = await apiRequest<BackendProjectDto>(endpoints.projectCurrent);
    return apiRequest<unknown>(endpoints.pipelineRun(project.project_id), {
      method: "POST",
      bodyJson: {},
    });
  },
  uploadJson: (payload: unknown) =>
    apiRequest<unknown>(endpoints.uploadDataPackage, {
      method: "POST",
      bodyJson: payload,
    }),
  uploadDataPackageFile: (file: File) => {
    const formData = new FormData();
    formData.append("file", file, file.name);
    return apiRequest<unknown>(endpoints.uploadDataPackage, {
      method: "POST",
      body: formData,
    });
  },
  downloadCsvTemplate: () => apiRequest<BackendDownloadDto>(endpoints.csvImportTemplate),
  downloadXlsxTemplate: () => apiRequest<BackendDownloadDto>(endpoints.xlsxImportTemplate),
  importCsvPackage: async (file: File) => {
    const project = await apiRequest<BackendProjectDto>(endpoints.projectCurrent);
    const formData = new FormData();
    formData.append("file", file, file.name);
    return apiRequest<unknown>(endpoints.importCsvPackage(project.project_id), {
      method: "POST",
      body: formData,
    });
  },
  importXlsxPackage: async (file: File) => {
    const project = await apiRequest<BackendProjectDto>(endpoints.projectCurrent);
    const formData = new FormData();
    formData.append("file", file, file.name);
    return apiRequest<unknown>(endpoints.importXlsxPackage(project.project_id), {
      method: "POST",
      body: formData,
    });
  },
  listDataPackages: () =>
    apiRequest<TablePage<BackendDataPackageDto>>(endpoints.dataPackages),
  getDataPackageDetail: (packageId: string) =>
    apiRequest<unknown>(endpoints.dataPackageDetail(packageId)),
  deleteDataPackage: (packageId: string) =>
    apiRequest<unknown>(endpoints.deleteDataPackage(packageId), {
      method: "DELETE",
    }),
  getUploadValidationResult: (packageId: string) =>
    apiRequest<BackendUploadValidationResultDto>(
      endpoints.uploadValidationResult(packageId),
    ),
  listDataResources: () =>
    apiRequest<TablePage<BackendDataResourceDto>>(endpoints.dataResources),
  getDataResourceDetail: (resourceId: string) =>
    apiRequest<BackendDataResourceDto>(endpoints.dataResourceDetail(resourceId)),
  bindResourceParty: async (resourceId: string, providerName: string, splitRatio: number) => {
    const parties = await apiRequest<TablePage<BackendPartyDto>>(endpoints.parties);
    const party = parties.items.find((item) => item.party_name === providerName);
    if (!party) {
      throw new Error(`后端参与方不存在：${providerName}`);
    }
    return apiRequest<unknown>(endpoints.resourcePartyRelations(resourceId), {
      method: "PUT",
      bodyJson: {
        relations: [
          {
            party_id: party.party_id,
            split_ratio: splitRatio / 100,
            is_primary_provider: true,
          },
        ],
      },
    });
  },
  listParties: () => apiRequest<TablePage<BackendPartyDto>>(endpoints.parties),
  createParty: (payload: Record<string, unknown>) =>
    apiRequest<BackendPartyDto>(endpoints.parties, {
      method: "POST",
      bodyJson: payload,
    }),
  updateParty: (partyId: string, payload: Record<string, unknown>) =>
    apiRequest<BackendPartyDto>(endpoints.party(partyId), {
      method: "PATCH",
      bodyJson: payload,
    }),
  updatePartyStatus: (partyId: string, status: string, reason?: string) =>
    apiRequest<BackendPartyDto>(endpoints.partyStatus(partyId), {
      method: "PATCH",
      bodyJson: { status, reason },
    }),
  runQualityAssessment: () =>
    apiRequest<unknown>(endpoints.qualityEvaluate, {
      method: "POST",
      bodyJson: {},
    }),
  getQualityWeights: () => apiRequest<Record<string, unknown>>(endpoints.qualityWeights),
  saveQualityWeights: (payload: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>(endpoints.qualityWeights, {
      method: "PUT",
      bodyJson: payload,
    }),
  getLatestQualityAssessment: () =>
    apiRequest<Record<string, unknown>>(endpoints.qualityLatest),
    getQualityAssessmentDetails: (assessmentId: string) =>
      apiRequest<Record<string, unknown>>(endpoints.qualityDetails(assessmentId)),
    getQualityResourceResults: (assessmentId = "latest") =>
      apiRequest<Record<string, unknown>>(endpoints.qualityResourceResults(assessmentId)),
    getQualityResourceDetail: (resourceId: string, assessmentId = "latest") =>
      apiRequest<Record<string, unknown>>(endpoints.qualityResourceDetail(resourceId, assessmentId)),
    saveShuyuanParameters: (payload: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>(endpoints.shuyuanParameters, {
      method: "PUT",
      bodyJson: payload,
    }),
  saveShuyuanCallCounts: (payload: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>(endpoints.shuyuanCallCounts, {
      method: "PUT",
      bodyJson: payload,
    }),
  runShuyuanMetering: () =>
    apiRequest<unknown>(endpoints.shuyuanCalculate, {
      method: "POST",
      bodyJson: {},
    }),
  getLatestShuyuanMetering: () =>
    apiRequest<Record<string, unknown>>(endpoints.shuyuanLatest),
  getShuyuanMeteringDetails: (meteringId: string) =>
    apiRequest<Record<string, unknown>>(endpoints.shuyuanDetails(meteringId)),
  saveContributionFactors: (payload: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>(endpoints.contributionFactors, {
      method: "PUT",
      bodyJson: payload,
    }),
  runContribution: () =>
    apiRequest<unknown>(endpoints.contributionCalculate, {
      method: "POST",
      bodyJson: {},
    }),
  saveUtilityFunction: (payload: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>(endpoints.utilityFunction, {
      method: "PUT",
      bodyJson: payload,
    }),
  runUtility: () =>
    apiRequest<unknown>(endpoints.utilityCalculate, {
      method: "POST",
      bodyJson: {},
    }),
  getLatestUtility: () =>
    apiRequest<Record<string, unknown>>(endpoints.utilityLatest),
  getUtilityTrace: (utilityId: string) =>
    apiRequest<Record<string, unknown>>(endpoints.utilityTrace(utilityId)),
  getMdDshapConfig: () =>
    apiRequest<Record<string, unknown>>(endpoints.mdDshapConfig),
  saveMdDshapConfig: (payload: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>(endpoints.mdDshapConfig, {
      method: "PUT",
      bodyJson: payload,
    }),
  listMdDshapParticipantPool: () =>
    apiRequest<unknown>(endpoints.mdDshapParticipantPool),
  getMdDshapTask: (taskId: string) =>
    apiRequest<Record<string, unknown>>(endpoints.mdDshapTask(taskId)),
  getMdDshapTaskResults: (taskId: string) =>
    apiRequest<TablePage<Record<string, unknown>>>(endpoints.mdDshapTaskResults(taskId)),
  getMdDshapMarginalTraces: (taskId: string) =>
    apiRequest<TablePage<Record<string, unknown>>>(endpoints.mdDshapMarginalTraces(taskId)),
  runMdDshap: (payload: Record<string, unknown> = {}) =>
    apiRequest<unknown>(endpoints.mdDshapTasks, {
      method: "POST",
      bodyJson: payload,
    }),
  runProjectMdDshapJob: async (payload: Record<string, unknown> = {}) => {
    const project = await apiRequest<BackendProjectDto>(endpoints.projectCurrent);
    return apiRequest<unknown>(endpoints.projectMdDshapTasks(project.project_id), {
      method: "POST",
      bodyJson: payload,
    });
  },
  getMdDshapProgress: async (taskId: string) => {
    const project = await apiRequest<BackendProjectDto>(endpoints.projectCurrent);
    return apiRequest<Record<string, unknown>>(
      endpoints.mdDshapTaskProgress(project.project_id, taskId),
    );
  },
  exportMdDshapAudit: async (taskId?: string) => {
    const resolvedTaskId =
      taskId || String((await apiRequest<BackendProjectDto>(endpoints.projectCurrent)).current_algorithm_task_id ?? "");
    if (!resolvedTaskId) {
      return apiRequest<unknown>(endpoints.reportMdDshapAudit, {
        method: "POST",
        bodyJson: {},
      });
    }
    return apiRequest<unknown>(endpoints.mdDshapTaskAuditExport(resolvedTaskId), {
      method: "POST",
      bodyJson: {},
    });
  },
  runAllocationSimulation: (payload: Record<string, unknown>) =>
    apiRequest<unknown>(endpoints.allocationRun, {
      method: "POST",
      bodyJson: payload,
    }),
  getContractRatio: (projectId: string) =>
    apiRequest<Record<string, unknown>>(endpoints.contractRatio(projectId)),
  getCurrentContractRatio: async () => {
    const project = await apiRequest<BackendProjectDto>(endpoints.projectCurrent);
    return apiRequest<Record<string, unknown>>(endpoints.contractRatio(project.project_id));
  },
  saveCurrentContractRatio: async (payload: Record<string, unknown>) => {
    const project = await apiRequest<BackendProjectDto>(endpoints.projectCurrent);
    return apiRequest<Record<string, unknown>>(endpoints.contractRatio(project.project_id), {
      method: "PUT",
      bodyJson: payload,
    });
  },
  clearCurrentContractRatio: async () => {
    const project = await apiRequest<BackendProjectDto>(endpoints.projectCurrent);
    return apiRequest<Record<string, unknown>>(endpoints.contractRatio(project.project_id), {
      method: "DELETE",
    });
  },
  getAllocationSummary: (projectId: string) =>
    apiRequest<Record<string, unknown>>(endpoints.projectAllocationSummary(projectId)),
  runCurrentContractRatioSimulation: async () => {
    const project = await apiRequest<BackendProjectDto>(endpoints.projectCurrent);
    return apiRequest<unknown>(endpoints.projectAllocationSimulate(project.project_id), {
      method: "POST",
      bodyJson: {},
    });
  },
  saveAllocationRevenuePool: (payload: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>(endpoints.allocationRevenuePool, {
      method: "PUT",
      bodyJson: payload,
    }),
  saveAllocationPriorityItems: (payload: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>(endpoints.allocationPriorityItems, {
      method: "PUT",
      bodyJson: payload,
    }),
  saveAllocationMode: (payload: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>(endpoints.allocationMode, {
      method: "PUT",
      bodyJson: payload,
    }),
  getAllocationResults: (allocationId: string) =>
    apiRequest<TablePage<Record<string, unknown>>>(endpoints.allocationResults(allocationId)),
  listAllocationConstraints: () =>
    apiRequest<TablePage<BackendConstraintDto>>(endpoints.allocationConstraints),
  createAllocationConstraint: (payload: Record<string, unknown>) =>
    apiRequest<BackendConstraintDto>(endpoints.allocationConstraints, {
      method: "POST",
      bodyJson: payload,
    }),
  updateAllocationConstraint: (constraintId: string, payload: Record<string, unknown>) =>
    apiRequest<BackendConstraintDto>(endpoints.allocationConstraint(constraintId), {
      method: "PATCH",
      bodyJson: payload,
    }),
  updateAllocationConstraintStatus: (constraintId: string, status: string, description?: string) =>
    apiRequest<BackendConstraintDto>(endpoints.allocationConstraintStatus(constraintId), {
      method: "PATCH",
      bodyJson: { status, description },
    }),
  lockCurrentAllocation: async () => {
    const project = await apiRequest<BackendProjectDto>(endpoints.projectCurrent);
    const allocationId = String(project.current_allocation_id ?? "");
    if (!allocationId) {
      throw new Error("后端未返回 current_allocation_id，无法锁定分配方案");
    }
    return apiRequest<unknown>(endpoints.allocationLock(allocationId), {
      method: "POST",
      bodyJson: {},
    });
  },
  exportCurrentAllocationJson: async () => {
    const project = await apiRequest<BackendProjectDto>(endpoints.projectCurrent);
    const allocationId = String(project.current_allocation_id ?? "");
    if (!allocationId) {
      throw new Error("后端未返回 current_allocation_id，无法导出分配结果");
    }
    return apiRequest<unknown>(endpoints.allocationExport(allocationId), {
      method: "POST",
      bodyJson: {},
    });
  },
  listReports: () => apiRequest<TablePage<BackendReportRecordDto>>(endpoints.reports),
  previewReport: () => apiRequest<unknown>(endpoints.reportPreview),
  generateMarkdownReport: () =>
    apiRequest<unknown>(endpoints.reportMarkdown, {
      method: "POST",
      bodyJson: {},
    }),
  generateCsvReport: () =>
    apiRequest<unknown>(endpoints.reportCsv, {
      method: "POST",
      bodyJson: {},
    }),
  generateJsonReport: () =>
    apiRequest<unknown>(endpoints.reportJson, {
      method: "POST",
      bodyJson: {},
    }),
  exportAuditLog: () =>
    apiRequest<unknown>(endpoints.reportAuditLog, {
      method: "POST",
      bodyJson: {},
    }),
  runProjectJob: async () => {
    const project = await apiRequest<BackendProjectDto>(endpoints.projectCurrent);
    return apiRequest<unknown>(endpoints.projectJobs(project.project_id), {
      method: "POST",
      bodyJson: {},
    });
  },
  listJobs: async () => {
    const project = await apiRequest<BackendProjectDto>(endpoints.projectCurrent);
    return apiRequest<TablePage<Record<string, unknown>>>(endpoints.projectJobs(project.project_id));
  },
  cancelJob: (jobId: string) =>
    apiRequest<unknown>(endpoints.jobCancel(jobId), {
      method: "POST",
      bodyJson: {},
    }),
  generatePdfReport: async () => {
    const project = await apiRequest<BackendProjectDto>(endpoints.projectCurrent);
    return apiRequest<unknown>(endpoints.projectReportPdf(project.project_id), {
      method: "POST",
      bodyJson: {},
    });
  },
  listProjectReports: async () => {
    const project = await apiRequest<BackendProjectDto>(endpoints.projectCurrent);
    return apiRequest<TablePage<BackendReportRecordDto>>(endpoints.projectReports(project.project_id));
  },
  getReportDetail: (reportId: string) => apiRequest<unknown>(endpoints.reportDetail(reportId)),
  getReportFiles: (reportId: string) =>
    apiRequest<TablePage<Record<string, unknown>>>(endpoints.reportFiles(reportId)),
  getReportManifest: (reportId: string) =>
    apiRequest<Record<string, unknown>>(endpoints.reportManifest(reportId)),
  downloadReport: (reportId: string, fileId?: string) =>
    apiRequest<BackendDownloadDto>(
      `${endpoints.reportDownload(reportId)}${fileId ? `?file_id=${encodeURIComponent(fileId)}` : ""}`,
    ),
  archiveReport: (reportId: string) =>
    apiRequest<unknown>(endpoints.reportArchive(reportId), {
      method: "PATCH",
      bodyJson: {},
    }),
  generateMdDshapAuditReport: () =>
    apiRequest<unknown>(endpoints.reportMdDshapAudit, {
      method: "POST",
      bodyJson: {},
    }),
  listSystemParameters: () =>
    apiRequest<TablePage<BackendSystemParameterDto>>(endpoints.systemParameters),
  updateSystemParameter: (parameterCode: string, currentValue: string | number | boolean) =>
    apiRequest<BackendSystemParameterDto>(endpoints.systemParameter(parameterCode), {
      method: "PUT",
      bodyJson: { current_value: currentValue },
    }),
  restoreSystemParameterDefault: (parameterCode: string) =>
    apiRequest<BackendSystemParameterDto>(
      endpoints.systemParameterRestoreDefault(parameterCode),
      {
        method: "POST",
        bodyJson: {},
      },
    ),
  listAuditLogs: (limit = 50) =>
    apiRequest<TablePage<BackendAuditLogDto>>(`${endpoints.systemAuditLogs}?limit=${limit}`),
  getAuditLogDetail: (logId: string) =>
    apiRequest<BackendAuditLogDetailDto>(endpoints.auditLogDetail(logId)),
  listUsers: () => apiRequest<TablePage<Record<string, unknown>>>(endpoints.users),
  getUserMe: () => apiRequest<Record<string, unknown>>(endpoints.usersMe),
  createUser: (payload: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>(endpoints.users, {
      method: "POST",
      bodyJson: payload,
    }),
  updateUser: (userId: string, payload: Record<string, unknown>) =>
    apiRequest<Record<string, unknown>>(endpoints.user(userId), {
      method: "PATCH",
      bodyJson: payload,
    }),
  disableUser: (userId: string) =>
    apiRequest<Record<string, unknown>>(endpoints.userDisable(userId), {
      method: "POST",
      bodyJson: {},
    }),
  resetUserPassword: (userId: string, temporaryPassword?: string) =>
    apiRequest<Record<string, unknown>>(endpoints.userResetPassword(userId), {
      method: "POST",
      bodyJson: temporaryPassword ? { temporary_password: temporaryPassword } : {},
    }),
  changeOwnPassword: (payload: {
    current_password: string;
    new_password: string;
    confirm_password: string;
  }) =>
    apiRequest<Record<string, unknown>>(endpoints.usersMePassword, {
      method: "PUT",
      bodyJson: payload,
    }),
  listRoles: () => apiRequest<TablePage<Record<string, unknown>>>(endpoints.roles),
  listPermissions: () =>
    apiRequest<TablePage<Record<string, unknown>>>(endpoints.permissions),
  updateRolePermissions: (roleId: string, permissionCodes: string[]) =>
    apiRequest<Record<string, unknown>>(endpoints.rolePermissions(roleId), {
      method: "PUT",
      bodyJson: { permission_codes: permissionCodes },
    }),
};

export interface BackendDownloadDto {
  file_name: string;
  mime_type?: string;
  file_format?: string;
  byte_size: number;
  checksum: string;
  content_base64: string;
}

export * from "./config";
export * from "./dtoMappers";
export * from "./endpoints";
export * from "./errors";
export * from "./httpClient";
