import { endpoints } from "./endpoints";
import { apiRequest, type TablePage } from "./httpClient";
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
};

export * from "./config";
export * from "./dtoMappers";
export * from "./endpoints";
export * from "./errors";
export * from "./httpClient";
