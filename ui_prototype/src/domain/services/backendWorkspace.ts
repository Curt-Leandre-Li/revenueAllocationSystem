import { actionRegistry } from "../actionRegistry";
import {
  dvasApi,
  getDvasApiBaseUrl,
  isDvasBackendEnabled,
  mapAuditLogDto,
  mapConstraintDto,
  mapDashboardSummaryDto,
  mapDataPackageDto,
  mapDataResourceDto,
  mapDataResourceToRow,
  mapUploadValidationResultDto,
  mapPartyDto,
  mapProjectStatus,
  mapReportRecordDto,
  mapSystemParameterDto,
  normalizeApiError,
  projectStatusLabel,
  type BackendPreconditionDto,
} from "../api";
import type {
  ActionId,
  BackendOptionalReadIssue,
  DataRow,
  MetricItem,
  MockWorkspaceState,
  PageWorkspaceData,
  PreconditionItem,
  RoutePath,
  WorkbenchSnapshot,
} from "../types";
import type { WorkbenchStore } from "../store";
import type { ServiceResult } from "./serviceTypes";

interface BackendWorkspaceData {
  overview: ReturnType<typeof mapDashboardSummaryDto>;
  packages: ReturnType<typeof mapDataPackageDto>[];
  uploadValidationResults: Record<string, ReturnType<typeof mapUploadValidationResultDto>>;
  resources: ReturnType<typeof mapDataResourceDto>[];
  parties: ReturnType<typeof mapPartyDto>[];
  reports: ReturnType<typeof mapReportRecordDto>[];
  auditLogs: ReturnType<typeof mapAuditLogDto>[];
  constraints: ReturnType<typeof mapConstraintDto>[];
  constraintSummary: Record<string, unknown>;
  allocationPriorityItems: Record<string, unknown>[];
  parameters: ReturnType<typeof mapSystemParameterDto>[];
  participantPool: Record<string, unknown>;
  mdConfig: Record<string, unknown> | null;
  mdTask: Record<string, unknown> | null;
  mdResults: Record<string, unknown>[];
  mdMarginalTraces: Record<string, unknown>[];
  qualityLatest: Record<string, unknown> | null;
  qualityDetails: Record<string, unknown>[];
  qualityResourceResults: Record<string, unknown> | null;
  shuyuanLatest: Record<string, unknown> | null;
  shuyuanDetails: Record<string, unknown>[];
  utilityLatest: Record<string, unknown> | null;
  utilityTrace: Record<string, unknown>[];
  allocationSummary: Record<string, unknown>;
  projectAllocationSummary: Record<string, unknown>;
  contractRatio: Record<string, unknown>;
  contractPriorityAllocations: Record<string, unknown>[];
  allocationConstraintTraces: Record<string, unknown>[];
  allocationConstraintApplyTrace: Record<string, unknown>;
  allocationResults: Record<string, unknown>[];
  currentAlgorithmTaskId: string;
  currentAllocationId: string;
  optionalReadIssues: BackendOptionalReadIssue[];
}

interface OptionalBackendCallOptions {
  suppressIssueCodes?: string[];
}

const preconditionLabels: Record<
  string,
  { name: string; targetPath?: RoutePath }
> = {
  HAS_VALID_DATA_PACKAGE: { name: "输入快照", targetPath: "/data/ingestion" },
  HAS_RESOURCE_PARTY_RELATION: {
    name: "资源主体关系",
    targetPath: "/data/resources",
  },
  HAS_QUALITY_ASSESSMENT: { name: "质量评估", targetPath: "/metering/quality" },
  HAS_SHUYUAN_METERING: { name: "数元计量", targetPath: "/metering/shuyuan" },
  HAS_CONTRIBUTION_RECORDS: { name: "贡献度计算", targetPath: "/metering/utility" },
  HAS_UTILITY_RESULT: { name: "效用计算", targetPath: "/metering/utility" },
  HAS_MDS_WEIGHT_RESULT: { name: "MD-DShap 权重", targetPath: "/allocation/md-dshap" },
  HAS_ALLOCATION_SCENARIO: {
    name: "分配方案",
    targetPath: "/allocation/simulation",
  },
  HAS_ALLOCATION_RESULT: {
    name: "分配结果",
    targetPath: "/allocation/simulation",
  },
  HAS_CONFIRMED_ALLOCATION: {
    name: "锁定方案",
    targetPath: "/allocation/simulation",
  },
  HAS_REPORT_RECORD: { name: "报告记录", targetPath: "/reports" },
  HAS_EXPORT_FILE: { name: "导出文件", targetPath: "/reports" },
};

export function shouldUseBackend() {
  return isDvasBackendEnabled();
}

export async function loadBackendWorkspaceSnapshot(
  currentSnapshot: WorkbenchSnapshot,
): Promise<ServiceResult<WorkbenchSnapshot>> {
  const optionalReadIssues: BackendOptionalReadIssue[] = [];
  try {
    const [
      projectDto,
      overviewDto,
      preconditionsDto,
      packagesPage,
      resourcesPage,
      partiesPage,
      reportsPage,
      auditPage,
      constraintsPage,
      parametersPage,
    ] =
      await Promise.all([
        dvasApi.getProject(),
        dvasApi.getDashboardOverview(),
        dvasApi.getDashboardPreconditions(),
        dvasApi.listDataPackages(),
        dvasApi.listDataResources(),
        dvasApi.listParties(),
        dvasApi.listReports(),
        optionalBackendCall("audit logs", () => dvasApi.listAuditLogs(), { items: [], total: 0, page: 1, page_size: 0 }, optionalReadIssues),
        dvasApi.listAllocationConstraints(),
        optionalBackendCall("system parameters", () => dvasApi.listSystemParameters(), { items: [], total: 0, page: 1, page_size: 0 }, optionalReadIssues),
      ]);
    const [contractRatio, projectAllocationSummary] = await Promise.all([
      optionalBackendCall("contract ratio", () => dvasApi.getContractRatio(projectDto.project_id), {}, optionalReadIssues),
      optionalBackendCall("allocation summary", () => dvasApi.getAllocationSummary(projectDto.project_id), {}, optionalReadIssues),
    ]);
    const uploadValidationResultItems = await Promise.all(
      packagesPage.items.map((item) =>
        optionalBackendCall(
          `upload validation ${item.package_id}`,
          () => dvasApi.getUploadValidationResult(item.package_id),
          null,
          optionalReadIssues,
        ),
      ),
    );
    const uploadValidationResults = Object.fromEntries(
      uploadValidationResultItems
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .map((item) => {
          const mapped = mapUploadValidationResultDto(item);
          return [mapped.packageId, mapped];
        }),
    );

    const currentAlgorithmTaskId = String(projectDto.current_algorithm_task_id ?? "");
    const currentAllocationId = String(projectDto.current_allocation_id ?? "");
    const [participantPool, mdConfig, mdTask, mdResultsPage, allocationResultsPage] = await Promise.all([
      optionalBackendCall("MD-DShap participant pool", () => dvasApi.listMdDshapParticipantPool(), {}, optionalReadIssues),
      optionalBackendCall("MD-DShap config", () => dvasApi.getMdDshapConfig(), null, optionalReadIssues),
      currentAlgorithmTaskId
        ? optionalBackendCall("MD-DShap task", () => dvasApi.getMdDshapTask(currentAlgorithmTaskId), null, optionalReadIssues)
        : Promise.resolve(null),
      currentAlgorithmTaskId
        ? optionalBackendCall("MD-DShap task results", () => dvasApi.getMdDshapTaskResults(currentAlgorithmTaskId), {
            items: [],
            total: 0,
            page: 1,
            page_size: 0,
          }, optionalReadIssues)
        : Promise.resolve({ items: [], total: 0, page: 1, page_size: 0 }),
      currentAllocationId
        ? optionalBackendCall("allocation results", () => dvasApi.getAllocationResults(currentAllocationId), {
            items: [],
            total: 0,
            page: 1,
            page_size: 0,
          }, optionalReadIssues)
        : Promise.resolve({ items: [], total: 0, page: 1, page_size: 0 }),
    ]);
    const [qualityLatest, shuyuanLatest, utilityLatest, mdMarginalTracesPage] =
      await Promise.all([
        optionalBackendCall("latest quality assessment", () => dvasApi.getLatestQualityAssessment(), null, optionalReadIssues, {
          suppressIssueCodes: ["DVAS_NOT_FOUND"],
        }),
        optionalBackendCall("latest shuyuan metering", () => dvasApi.getLatestShuyuanMetering(), null, optionalReadIssues, {
          suppressIssueCodes: ["DVAS_NOT_FOUND"],
        }),
        optionalBackendCall("latest utility", () => dvasApi.getLatestUtility(), null, optionalReadIssues, {
          suppressIssueCodes: ["DVAS_NOT_FOUND"],
        }),
        currentAlgorithmTaskId
          ? optionalBackendCall("MD-DShap marginal traces", () => dvasApi.getMdDshapMarginalTraces(currentAlgorithmTaskId), {
              items: [],
              total: 0,
              page: 1,
              page_size: 0,
            }, optionalReadIssues)
          : Promise.resolve({ items: [], total: 0, page: 1, page_size: 0 }),
      ]);
    const qualityAssessmentId = stringValue(
      recordValue(qualityLatest).assessment_id,
    );
    const shuyuanMeteringId = stringValue(recordValue(shuyuanLatest).metering_id);
    const utilityId = stringValue(recordValue(utilityLatest).utility_id);
    const [qualityDetailResult, qualityResourceResult, shuyuanDetailResult, utilityTraceResult] =
      await Promise.all([
        qualityAssessmentId
          ? optionalBackendCall(
              "quality assessment details",
              () => dvasApi.getQualityAssessmentDetails(qualityAssessmentId),
              null,
              optionalReadIssues,
            )
          : Promise.resolve(null),
        qualityAssessmentId
          ? optionalBackendCall(
              "quality resource results",
              () => dvasApi.getQualityResourceResults(qualityAssessmentId),
              null,
              optionalReadIssues,
            )
          : Promise.resolve(null),
        shuyuanMeteringId
          ? optionalBackendCall(
              "shuyuan metering details",
              () => dvasApi.getShuyuanMeteringDetails(shuyuanMeteringId),
              null,
              optionalReadIssues,
            )
          : Promise.resolve(null),
        utilityId
          ? optionalBackendCall("utility trace", () => dvasApi.getUtilityTrace(utilityId), null, optionalReadIssues)
          : Promise.resolve(null),
      ]);
    const allocationResultPayload = recordValue(allocationResultsPage);
    const data: BackendWorkspaceData = {
      overview: mapDashboardSummaryDto({
        ...overviewDto,
        ...projectDto,
        preconditions: preconditionsDto.preconditions,
        available_actions: preconditionsDto.available_actions,
        disabled_actions: preconditionsDto.disabled_actions,
      }),
      packages: packagesPage.items.map(mapDataPackageDto),
      uploadValidationResults,
      resources: resourcesPage.items.map(mapDataResourceDto),
      parties: partiesPage.items.map(mapPartyDto),
      reports: reportsPage.items.map(mapReportRecordDto),
      auditLogs: auditPage.items.map(mapAuditLogDto),
      constraints: constraintsPage.items.map(mapConstraintDto),
      constraintSummary: recordValue(recordValue(constraintsPage).summary),
      allocationPriorityItems: arrayRecord(recordValue(constraintsPage).allocation_priority_items),
      parameters: parametersPage.items.map(mapSystemParameterDto),
      participantPool: participantPool as Record<string, unknown>,
      mdConfig: recordOrNull(mdConfig),
      mdTask,
      mdResults: mdResultsPage.items,
      mdMarginalTraces: mdMarginalTracesPage.items,
      qualityLatest: recordOrNull(qualityLatest),
      qualityDetails: arrayRecord(recordOrNull(qualityDetailResult)?.details),
      qualityResourceResults: recordOrNull(qualityResourceResult),
      shuyuanLatest: recordOrNull(shuyuanLatest),
      shuyuanDetails: arrayRecord(recordOrNull(shuyuanDetailResult)?.details),
      utilityLatest: recordOrNull(utilityLatest),
      utilityTrace: arrayRecord(recordOrNull(utilityTraceResult)?.trace),
      allocationSummary: recordValue(allocationResultPayload.summary),
      projectAllocationSummary: recordValue(projectAllocationSummary),
      contractRatio: recordValue(contractRatio),
      contractPriorityAllocations: arrayRecord(allocationResultPayload.contract_priority_allocations),
      allocationConstraintTraces: arrayRecord(allocationResultPayload.constraint_traces),
      allocationConstraintApplyTrace: recordValue(allocationResultPayload.constraint_apply_trace),
      allocationResults: allocationResultsPage.items,
      currentAlgorithmTaskId,
      currentAllocationId,
      optionalReadIssues,
    };

    return {
      ok: true,
      source: "backend",
      data: buildSnapshotFromBackend(currentSnapshot, data),
    };
  } catch (error) {
    return {
      ok: false,
      source: "backend_unavailable",
      error: normalizeApiError(error),
    };
  }
}

async function optionalBackendCall<T>(
  label: string,
  call: () => Promise<T>,
  fallback: T,
  issues: BackendOptionalReadIssue[],
  options: OptionalBackendCallOptions = {},
): Promise<T> {
  try {
    return await call();
  } catch (error) {
    const normalized = normalizeApiError(error);
    if (!options.suppressIssueCodes?.includes(normalized.errorCode)) {
      issues.push({
        label,
        errorCode: normalized.errorCode,
        errorMessage: normalized.errorMessage,
        errorField: normalized.errorField,
      });
    }
    return fallback;
  }
}

export async function refreshStoreFromBackend(
  store: WorkbenchStore,
  successMessage: string,
): Promise<WorkbenchStore> {
  const result = await loadBackendWorkspaceSnapshot(store.snapshot);
  if (result.ok && result.data) {
    const lastSyncAt = result.data.backend?.lastSyncedAt ?? new Date().toISOString();
    const optionalIssueCount = result.data.backend?.optionalReadIssues?.length ?? 0;
    return {
      ...store,
      snapshot: result.data,
      lastMessage: optionalIssueCount
        ? `${successMessage}（数据来源：后端；${optionalIssueCount} 个次要接口读取失败，页面已标注）`
        : `${successMessage}（数据来源：后端）`,
      dataSource: {
        mode: "backend",
        lastSyncAt,
        backendAvailable: true,
      },
    };
  }

  return {
    ...store,
    snapshot: markSnapshotSource(store.snapshot, "backend_unavailable"),
    lastMessage: `后端刷新失败，当前页面未用 mock 伪造成功。位置：workspace refresh。${formatBackendError(result.error)}`,
    dataSource: {
      mode: "backend_unavailable",
      lastError: result.error,
      backendAvailable: false,
    },
  };
}

export async function mutateBackendAndRefresh(
  store: WorkbenchStore,
  mutation: () => Promise<unknown>,
  successMessage: string,
  location: string,
): Promise<WorkbenchStore> {
  try {
    await mutation();
    return refreshStoreFromBackend(store, successMessage);
  } catch (error) {
    const normalized = normalizeApiError(error);
    if (!normalized.retryable) {
      return {
        ...store,
        lastMessage: `后端操作未完成，当前页面未用 mock 伪造成功。位置：${location}。${formatBackendError(normalized)}`,
        dataSource: {
          ...store.dataSource,
          mode: "backend",
          lastError: normalized,
          backendAvailable: true,
        },
      };
    }
    return {
      ...store,
      snapshot: markSnapshotSource(store.snapshot, "backend_unavailable"),
      lastMessage: `后端操作失败，当前页面未用 mock 伪造成功。位置：${location}。${formatBackendError(normalized)}`,
      dataSource: {
        mode: "backend_unavailable",
        lastError: normalized,
        backendAvailable: false,
      },
    };
  }
}

export function backendUnavailableStore(
  store: WorkbenchStore,
  actionLabel: string,
  location: string,
): WorkbenchStore {
  return {
    ...store,
    lastMessage: `${actionLabel} 未执行：接口未接入/暂不可用。位置：${location}。未写入前端 mock 成功状态。`,
  };
}

export function markSnapshotSource(
  snapshot: WorkbenchSnapshot,
  source: ServiceResult<WorkbenchSnapshot>["source"],
): WorkbenchSnapshot {
  return {
    ...snapshot,
    backend: {
      apiBaseUrl: getDvasApiBaseUrl(),
      availableActions: snapshot.backend?.availableActions ?? [],
      disabledActions: snapshot.backend?.disabledActions ?? [],
      optionalReadIssues: snapshot.backend?.optionalReadIssues ?? [],
      connected: source === "backend",
      lastSyncedAt:
        source === "backend" ? new Date().toISOString() : snapshot.backend?.lastSyncedAt ?? "",
    },
  };
}

function buildSnapshotFromBackend(
  currentSnapshot: WorkbenchSnapshot,
  data: BackendWorkspaceData,
): WorkbenchSnapshot {
  const mock = buildMockState(data);
  const pages = {
    ...currentSnapshot.pages,
    "/dashboard": buildOverviewPage(data),
    "/data/ingestion": buildPackagesPage(data),
    "/data/resources": buildResourcesPage(data),
    "/data/parties": buildPartiesPage(data),
    "/metering/quality": buildQualityPage(data),
    "/metering/shuyuan": buildShuyuanPage(data),
    "/metering/utility": buildUtilityPage(data),
    "/allocation/md-dshap": buildMDDShapPage(data),
    "/allocation/simulation": buildSimulationPage(data),
    "/allocation/constraints": buildConstraintsPage(data),
    "/reports": buildReportsPage(data),
    "/system/parameters": buildParametersPage(data),
    "/system/audit": buildAuditPage(data),
  };

  return {
    ...currentSnapshot,
    projectName: data.overview.projectName,
    scenarioName: data.overview.scenarioName,
    operator: data.overview.operatorId,
    status: data.overview.status,
    updatedAt: data.overview.updatedAt,
    mock,
    backend: {
      apiBaseUrl: getDvasApiBaseUrl(),
      availableActions: data.overview.availableActions.filter(isActionId),
      disabledActions: data.overview.disabledActions,
      optionalReadIssues: data.optionalReadIssues,
      connected: true,
      lastSyncedAt: new Date().toISOString(),
    },
    pages,
  };
}

function buildMockState(data: BackendWorkspaceData): MockWorkspaceState {
  void data;
  return emptyMockState();
}

function emptyMockState(): MockWorkspaceState {
  return {
    currentRevenuePool: 0,
    auditLogs: [],
    snapshots: [],
    reports: [],
    exports: [],
    resources: [],
    dataProviders: [],
    mdsParticipants: [],
    mdsWeights: [],
    mdsTraces: [],
    mdsTasks: [],
  };
}

function buildOverviewPage(data: BackendWorkspaceData): PageWorkspaceData {
  const packageName =
    data.packages.find((item) => item.packageId === data.overview.currentPackageId)
      ?.packageName ?? "未接入";
  const latestReport = data.reports[0];
  const latestAudit = data.auditLogs[0];
  const currentRevenuePool = data.overview.metrics.currentRevenuePool;

  return {
    summary: "从后端聚合项目状态、数据接入、参与方、报告和审计摘要。",
    primaryTask: data.overview.nextStep.label,
    metrics: [
      metric("数据包", data.overview.metrics.dataPackageCount, "有效数据包", "neutral"),
      metric("数据资源", data.overview.metrics.resourceCount, "已识别资源", "success"),
      metric("参与方", data.overview.metrics.partyCount, "当前项目主体", "success"),
      metric(
        "收益池",
        currentRevenuePool === null ? "后端未返回" : currentRevenuePool,
        "当前输入快照或分配结果",
        currentRevenuePool === null ? "warning" : "success",
      ),
      metric("报告状态", data.overview.metrics.reportCount, "已生成报告记录", "neutral"),
      metric("审计记录", data.overview.metrics.auditLogCount, "最近审计日志", "neutral"),
    ],
    preconditions: toPreconditions(data.overview.preconditions),
    rows: [
      {
        project_name: data.overview.projectName,
        scenario_name: data.overview.scenarioName,
        status: projectStatusLabel(data.overview.status),
        current_package: packageName,
        current_algorithm_task:
          data.overview.status === "WEIGHT_CALCULATED" ? "权重已计算" : "待计算",
        current_allocation:
          data.overview.status === "ALLOCATED" || data.overview.status === "CONFIRMED"
            ? "已生成"
            : "尚未生成",
        recent_report_type: latestReport?.name ?? "暂无报告",
        recent_report_time: latestReport?.createdAt ?? "-",
        recent_audit: latestAudit?.operation ?? "暂无审计",
      },
    ],
    technicalDetails: {
      project_id: data.overview.projectId,
      current_package_id: data.overview.currentPackageId ?? "",
      input_snapshot_id: data.overview.currentInputSnapshotId ?? "",
      menu_code: "NAV_SYS_HOME",
      module_code: "SYS",
    },
  };
}

function buildProcessPage(data: BackendWorkspaceData): PageWorkspaceData {
  return {
    summary: "根据后端前置条件展示完整链路阶段，不执行 GAP-API-001 一键链路。",
    primaryTask: data.overview.nextStep.label,
    metrics: [
      metric("通过检查", "后端未返回", "需要流程 summary DTO", "warning"),
      metric("阻塞检查", "后端未返回", "需要流程 summary DTO", "warning"),
      metric("当前状态", projectStatusLabel(data.overview.status), "项目状态", "neutral"),
    ],
    preconditions: toPreconditions(data.overview.preconditions),
    rows: data.overview.preconditions.map((item) => ({
      workflow_step: preconditionLabels[item.code]?.name ?? item.code,
      step_status: item.passed ? "通过" : "阻塞",
      blocker: item.passed ? "无" : item.message,
      next_module: preconditionLabels[item.code]?.targetPath ?? "/dashboard",
      next_action: item.passed ? "查看结果" : "补齐前置条件",
      last_updated: data.overview.updatedAt,
    })),
    technicalDetails: {
      project_id: data.overview.projectId,
      snapshot_type: "PROJECT_STATUS",
      menu_code: "NAV_SYS_HOME",
      module_code: "SYS",
    },
  };
}

function buildOneClickPage(data: BackendWorkspaceData): PageWorkspaceData {
  return {
    summary: "一键计算调用后端 pipeline/run，按质量、计量、贡献、效用、MD-DShap、分配模拟推进。",
    primaryTask: "前置条件满足后可执行 SYS-004 后端完整链路计算。",
    metrics: [
      metric("通过检查", "后端未返回", "需要 pipeline summary DTO", "warning"),
      metric("未通过检查", "后端未返回", "需要 pipeline summary DTO", "warning"),
      metric("一键计算", "后端直连", "pipeline/run", "success"),
    ],
    preconditions: toPreconditions(data.overview.preconditions),
    rows: data.overview.preconditions.map((item) => ({
      precondition_name: preconditionLabels[item.code]?.name ?? item.code,
      check_result: item.passed ? "通过" : "阻塞",
      failed_stage: item.passed ? "无" : item.message,
      run_mode: "后端同步 pipeline",
      algorithm_mode: "MD-DShap",
      pipeline_stage: data.overview.nextStep.label,
      stage_status: projectStatusLabel(data.overview.status),
    })),
    technicalDetails: {
      project_id: data.overview.projectId,
      menu_code: "NAV_SYS_HOME",
      module_code: "SYS",
    },
  };
}

function buildPackagesPage(data: BackendWorkspaceData): PageWorkspaceData {
  const currentPackageId = data.overview.currentPackageId;
  return {
    summary: "数据包列表来自后端；演示数据初始化和 JSON 上传均调用真实接口。",
    primaryTask: data.packages.length ? "检查最新数据包校验结果。" : "选择演示数据或上传 JSON。",
    metrics: [
      metric("数据包", data.overview.metrics.dataPackageCount, "后端聚合字段", "neutral"),
      metric("有效数据包", "后端未返回", "需要数据接入 summary DTO", "warning"),
      metric("校验失败", "后端未返回", "需要上传校验 summary DTO", "warning"),
    ],
    preconditions: toPreconditions(data.overview.preconditions),
    rows: data.packages.map((item) => {
      const validation = data.uploadValidationResults[item.packageId];
      const firstFieldError = validation?.fieldErrors[0];
      const validationDetail = recordValue(validation?.detailJson);
      const isCurrentPackage = item.packageId === currentPackageId;
      return {
        package_id: item.packageId,
        package_name: item.packageName,
        source_type: item.sourceTypeLabel,
        file_name: item.fileName,
        validation_status: item.statusLabel,
        access_status: item.status,
        file_size: item.fileSize,
        resource_count: stringValue(
          isCurrentPackage ? data.overview.metrics.resourceCount : validationDetail.resource_count,
        ),
        party_count: stringValue(
          isCurrentPackage ? data.overview.metrics.partyCount : validationDetail.party_count,
        ),
        validation_result_id: item.validationResultId || validation?.validationResultId || "",
        input_snapshot_id: item.inputSnapshotId,
        checksum: item.checksum,
        created_at: item.createdAt,
        error_code: validation?.errorCode || validation?.code || "",
        error_field: validation?.errorField || stringValue(firstFieldError?.field),
        error_message: validation?.errorMessage || validation?.message || "",
        repair_suggestion: validation?.repairSuggestion || stringValue(firstFieldError?.reason),
        validation_field_errors_json: stringifyJson(validation?.fieldErrors ?? []),
        validation_result_json: stringifyJson(validation ?? {}),
      };
    }),
    technicalDetails: {
      project_id: data.overview.projectId,
      current_package_id: data.overview.currentPackageId ?? "",
      input_snapshot_id: data.overview.currentInputSnapshotId ?? "",
      menu_code: "NAV_DATA_PACKAGE",
      module_code: "DATA",
    },
  };
}

function buildResourcesPage(data: BackendWorkspaceData): PageWorkspaceData {
  const relationPrecondition = data.overview.preconditions.find(
    (item) => item.code === "HAS_RESOURCE_PARTY_RELATION",
  );
  const resourceCount = data.resources.length;
  const fieldCountTotal = data.resources.reduce((total, item) => total + item.fieldCount, 0);
  const sampleCountTotal = data.resources.reduce((total, item) => total + item.sampleCount, 0);
  const sensitiveFieldCount = data.resources.reduce(
    (total, item) => total + item.sensitiveFieldCount,
    0,
  );
  const providerPartyCount = new Set(
    data.resources
      .map((item) => item.providerName)
      .filter((providerName) => providerName && providerName !== "未关联"),
  ).size;
  return {
    summary: "资源清单来自后端；主体关系读取已接入，未接入写操作会明确提示暂不可用。",
    primaryTask: relationPrecondition?.passed
      ? "资源主体关系已满足质量评估前置条件。"
      : relationPrecondition?.message ?? "等待后端返回资源主体关系前置条件。",
    metrics: [
      metric("数据资源", resourceCount, "当前数据包资源行", resourceCount ? "success" : "neutral"),
      metric("字段数量", formatInteger(fieldCountTotal), "资源字段合计", fieldCountTotal ? "success" : "neutral"),
      metric("样本数量", formatInteger(sampleCountTotal), "资源样本合计", sampleCountTotal ? "success" : "neutral"),
      metric("关联主体", providerPartyCount, "已关联数据源主体", providerPartyCount ? "success" : "warning"),
      metric("敏感字段", formatInteger(sensitiveFieldCount), "资源敏感字段合计", "neutral"),
    ],
    preconditions: toPreconditions(data.overview.preconditions),
    rows: data.resources.map(mapDataResourceToRow),
    technicalDetails: {
      project_id: data.overview.projectId,
      current_package_id: data.overview.currentPackageId ?? "",
      field_count_total: fieldCountTotal,
      sample_count_total: sampleCountTotal,
      provider_party_count: providerPartyCount,
      sensitive_field_count: sensitiveFieldCount,
      relation_precondition: relationPrecondition?.passed ? "通过" : relationPrecondition?.message ?? "",
      menu_code: "NAV_DATA_RESOURCE",
      module_code: "RES",
    },
  };
}

function buildPartiesPage(data: BackendWorkspaceData): PageWorkspaceData {
  const linkedResourceCountByPartyName = new Map<string, number>();
  for (const resource of data.resources) {
    if (!resource.providerName || resource.providerName === "未关联") {
      continue;
    }
    linkedResourceCountByPartyName.set(
      resource.providerName,
      (linkedResourceCountByPartyName.get(resource.providerName) ?? 0) + 1,
    );
  }
  const currentParties = data.resources.length
    ? data.parties.filter((item) =>
        item.partyType !== "DATA_PROVIDER" ||
        linkedResourceCountByPartyName.has(item.partyName),
      )
    : data.parties;
  const dataProviderCount = currentParties.filter((item) => item.partyType === "DATA_PROVIDER").length;
  const weightPoolCount = currentParties.filter(
    (item) => item.partyType === "DATA_PROVIDER" && item.includeInMdDshap && item.statusLabel !== "停用",
  ).length;
  return {
    summary: "参与方列表来自后端；非数据贡献主体默认不进入 MD-DShap 权重层。",
    primaryTask: "维护数据源主体与非数据贡献主体边界。",
    metrics: [
      metric("参与方", currentParties.length, "当前数据包主体", currentParties.length ? "success" : "neutral"),
      metric("数据源主体", dataProviderCount, "当前数据包数据源主体", dataProviderCount ? "success" : "neutral"),
      metric("进入权重池", weightPoolCount, "当前数据包算法主体", weightPoolCount ? "success" : "warning"),
    ],
    preconditions: toPreconditions(data.overview.preconditions),
    rows: currentParties.map((item) => {
      const linkedResourceCount = linkedResourceCountByPartyName.get(item.partyName) ?? 0;
      return {
      party_id: item.partyId,
      party_name: item.partyName,
      party_type_code: item.partyType,
      party_type: item.partyTypeLabel,
      is_data_provider: item.partyType === "DATA_PROVIDER" ? "是" : "否",
      include_in_md_dshap: item.partyType === "DATA_PROVIDER" && item.includeInMdDshap ? "是" : "否",
      processing_method: item.partyType === "DATA_PROVIDER" ? "贡献度 / 效用 / MD-DShap" : "合同比例分配",
      linked_resource_count: linkedResourceCount,
      status: item.statusLabel,
      contribution_summary: item.partyType === "DATA_PROVIDER" ? "当前数据包资源关联" : "合同比例分配",
    };
    }),
    technicalDetails: {
      project_id: data.overview.projectId,
      menu_code: "NAV_DATA_PARTY",
      module_code: "PARTY",
    },
  };
}

function buildQualityPage(data: BackendWorkspaceData): PageWorkspaceData {
  const latest = data.qualityLatest;
  const resourceResult = recordValue(data.qualityResourceResults);
  const resourceRows = arrayRecord(resourceResult.resources);
  const averageResourceScore = stringValue(
    resourceResult.average_resource_score ?? resourceResult.avg_resource_score,
    latest ? "后端未返回" : "后端未返回",
  );
  const lowScoreResourceCount = stringValue(
    resourceResult.low_score_resource_count,
    latest ? "后端未返回" : "后端未返回",
  );
  const assessedResourceCount = stringValue(
    resourceResult.assessed_resource_count,
    latest ? "后端未返回" : "后端未返回",
  );
  const resourceQualityRows = resourceRows.map((item) => ({
    assessment_id: stringValue(latest?.assessment_id),
    resource_id: stringValue(item.resource_id),
    resource_name: stringValue(item.resource_name),
    owner_name: stringValue(item.owner_name ?? item.party_names_text),
    provider_party: stringValue(item.provider_party ?? item.party_names_text),
    resource_type: stringValue(item.resource_type ?? item.modality),
    modality: stringValue(item.modality),
    total_score: stringValue(item.total_score),
    quality_level: stringValue(item.quality_level),
    quality_factor: stringValue(item.quality_factor),
    min_primary_metric: stringValue(item.min_primary_metric ?? item.lowest_dimension_name),
    lowest_dimension_code: stringValue(item.lowest_dimension_code),
    lowest_dimension_name: stringValue(item.lowest_dimension_name),
    update_time: stringValue(item.update_time ?? item.updated_at),
    updated_at: stringValue(item.updated_at),
    evidence_summary: stringValue(item.evidence_summary),
    average_resource_score: averageResourceScore,
    avg_resource_score: averageResourceScore,
    low_score_resource_count: lowScoreResourceCount,
    assessed_resource_count: assessedResourceCount,
    ...flattenDimensionScores(recordValue(item.dimension_scores)),
  }));
  const resourceDetailRows = arrayRecord(resourceResult.details).map((item) => ({
    row_type: "resource_quality_detail",
    detail_id: stringValue(item.detail_id),
    assessment_id: stringValue(item.assessment_id ?? latest?.assessment_id),
    resource_assessment_id: stringValue(item.resource_assessment_id),
    resource_id: stringValue(item.resource_id),
    resource_name: stringValue(item.resource_name),
    quality_score: stringValue(latest?.quality_score),
    quality_level: stringValue(latest?.quality_level),
    quality_factor: stringValue(latest?.quality_factor),
    version_no: stringValue(latest?.version_no),
    primary_metric_count: stringValue(latest?.primary_metric_count),
    secondary_metric_count: stringValue(latest?.secondary_metric_count),
    average_resource_score: averageResourceScore,
    avg_resource_score: averageResourceScore,
    low_score_resource_count: lowScoreResourceCount,
    assessed_resource_count: assessedResourceCount,
    dimension_name: stringValue(item.dimension_name),
    dimension_code: stringValue(item.dimension_code),
    metric_name: stringValue(item.metric_name),
    metric_code: stringValue(item.metric_code),
    metric_level: stringValue(item.metric_level),
    parent_metric_code: stringValue(item.parent_metric_code),
    parent_dimension_code: stringValue(item.parent_dimension_code),
    dimension_weight: stringValue(item.weight),
    dimension_score: stringValue(item.score),
    weighted_score: stringValue(item.weighted_score),
    evidence: stringValue(item.evidence ?? item.evidence_text),
    evidence_text: stringValue(item.evidence_text ?? item.evidence),
    issue_summary: stringValue(item.issue_summary),
    rule_code: stringValue(item.rule_code),
    created_at: stringValue(item.created_at ?? latest?.created_at),
  }));
  const detailRows = data.qualityDetails.map((item) => ({
    detail_id: stringValue(item.detail_id),
    assessment_id: stringValue(latest?.assessment_id),
    quality_score: stringValue(latest?.quality_score),
    quality_level: stringValue(latest?.quality_level),
    quality_factor: stringValue(latest?.quality_factor),
    version_no: stringValue(latest?.version_no),
    evidence_summary: stringValue(latest?.evidence_summary),
    primary_metric_count: stringValue(latest?.primary_metric_count),
    secondary_metric_count: stringValue(latest?.secondary_metric_count),
    average_resource_score: averageResourceScore,
    avg_resource_score: averageResourceScore,
    low_score_resource_count: lowScoreResourceCount,
    assessed_resource_count: assessedResourceCount,
    dimension_name: stringValue(item.dimension_name),
    dimension_code: stringValue(item.dimension_code),
    metric_name: stringValue(item.metric_name),
    metric_code: stringValue(item.metric_code),
    metric_level: stringValue(item.metric_level),
    parent_metric_code: stringValue(item.parent_metric_code),
    dimension_weight: stringValue(item.weight),
    dimension_score: stringValue(item.score),
    weighted_score: stringValue(item.weighted_score),
    evidence: stringValue(item.evidence),
    issue_summary: stringValue(item.issue_summary),
    rule_code: stringValue(item.rule_code),
    created_at: stringValue(latest?.created_at),
  }));
  return {
    summary: "质量评估页面只展示后端 latest/detail/resource-results 返回字段；无结果时显示空状态。",
    primaryTask: latest ? "查看后端质量评估结果。" : "完成数据接入后运行质量评估。",
    metrics: [
      metric("质量总分", stringValue(latest?.quality_score, "后端未返回"), "quality_score", latest ? "success" : "warning"),
      metric("质量等级", stringValue(latest?.quality_level, "后端未返回"), "quality_level", latest ? "success" : "warning"),
      metric("质量因子", stringValue(latest?.quality_factor, "后端未返回"), "quality_factor", latest ? "neutral" : "warning"),
      metric("评估版本", stringValue(latest?.version_no, "后端未返回"), "version_no", "neutral"),
      metric("资源级评分", assessedResourceCount, "resource-results", resourceRows.length ? "success" : "warning"),
    ],
    preconditions: toPreconditions(data.overview.preconditions),
    rows: [...detailRows, ...resourceQualityRows, ...resourceDetailRows],
    technicalDetails: {
      project_id: data.overview.projectId,
      assessment_id: stringValue(latest?.assessment_id),
      input_snapshot_id: stringValue(latest?.input_snapshot_id),
      output_snapshot_id: stringValue(latest?.output_snapshot_id),
      algorithm_version: stringValue(latest?.algorithm_version),
      primary_metric_count: stringValue(latest?.primary_metric_count),
      secondary_metric_count: stringValue(latest?.secondary_metric_count),
      resource_result_count: String(resourceRows.length),
      menu_code: "NAV_MEASURE_QUALITY",
      module_code: "QUAL",
    },
  };
}

function buildShuyuanPage(data: BackendWorkspaceData): PageWorkspaceData {
  const latest = data.shuyuanLatest;
  return {
    summary: "数元计量页面只展示后端 metering/detail 字段；金额和调用量不在前端推导。",
    primaryTask: latest ? "查看后端数元计量结果。" : "完成质量评估后运行数元计量。",
    metrics: [
      metric("项目总计量金额", stringValue(latest?.metering_amount, "后端未返回"), "metering_amount", latest ? "success" : "warning"),
      metric("基准数元价", stringValue(latest?.base_shuyuan_price, "后端未返回"), "base_shuyuan_price", latest ? "neutral" : "warning"),
      metric("资源调用量", stringValue(latest?.call_count, "后端未返回"), "call_count", latest ? "neutral" : "warning"),
      metric("计量版本", stringValue(latest?.version_no, "后端未返回"), "version_no", "neutral"),
      metric("图表 DTO", "后端未提供", "不在前端推导金额图", "neutral"),
    ],
    preconditions: toPreconditions(data.overview.preconditions),
    rows: data.shuyuanDetails.map((item) => ({
      metering_id: stringValue(latest?.metering_id),
      resource_id: stringValue(item.resource_id),
      resource_name: stringValue(item.resource_name),
      party_id: stringValue(item.party_id),
      party_name: stringValue(item.party_name),
      valid_units: stringValue(item.valid_units),
      call_count: stringValue(item.call_count),
      base_shuyuan_price: stringValue(item.base_shuyuan_price),
      scenario_coefficient: stringValue(item.scenario_coefficient),
      quality_coefficient: stringValue(item.quality_coefficient),
      technology_coefficient: stringValue(item.technology_coefficient),
      expert_coefficient: stringValue(item.expert_coefficient),
      development_coefficient: stringValue(item.development_coefficient),
      metering_amount: stringValue(item.metering_amount),
      evidence: stringValue(item.evidence),
    })),
    technicalDetails: {
      project_id: data.overview.projectId,
      metering_id: stringValue(latest?.metering_id),
      assessment_id: stringValue(latest?.assessment_id),
      input_snapshot_id: stringValue(latest?.input_snapshot_id),
      output_snapshot_id: stringValue(latest?.output_snapshot_id),
      algorithm_version: stringValue(latest?.algorithm_version),
      menu_code: "NAV_MEASURE_SHUYUAN",
      module_code: "DU",
    },
  };
}

function buildUtilityPage(data: BackendWorkspaceData): PageWorkspaceData {
  const latest = data.utilityLatest;
  return {
    summary: "贡献度与效用页面只展示后端 utility/trace 字段；归一化和效用值由后端计算。",
    primaryTask: latest ? "查看后端效用结果和 trace。" : "完成数元计量后运行贡献度与效用计算。",
    metrics: [
      metric("效用值", stringValue(latest?.utility_value, "后端未返回"), "utility_value", latest ? "success" : "warning"),
      metric("质量因子", stringValue(latest?.quality_factor, "后端未返回"), "quality_factor", latest ? "neutral" : "warning"),
      metric("效用函数", stringValue(latest?.formula_text, "后端未返回"), "formula_text", "neutral"),
      metric("图表 DTO", "后端未提供", "不在前端推导排行图", "neutral"),
    ],
    preconditions: toPreconditions(data.overview.preconditions),
    rows: data.utilityTrace.map((item) => ({
      utility_id: stringValue(latest?.utility_id),
      version_no: stringValue(latest?.version_no),
      algorithm_version: stringValue(latest?.algorithm_version),
      trace_id: stringValue(item.trace_id),
      party_id: stringValue(item.party_id),
      party_name: stringValue(item.party_name),
      normalized_contribution: stringValue(item.normalized_contribution),
      quality_factor: stringValue(item.quality_factor),
      usage_factor: stringValue(item.usage_factor),
      scenario_factor: stringValue(item.scenario_factor),
      utility_value: stringValue(item.utility_value),
      formula_text: stringValue(item.formula_text),
      created_at: stringValue(item.created_at),
    })),
    technicalDetails: {
      project_id: data.overview.projectId,
      utility_id: stringValue(latest?.utility_id),
      contribution_run_id: stringValue(latest?.contribution_run_id),
      version_no: stringValue(latest?.version_no),
      top_contribution_party_name: stringValue(latest?.top_contribution_party_name ?? latest?.highest_contribution_party_name),
      top_contribution_value: stringValue(latest?.top_contribution_value ?? latest?.highest_contribution_value),
      top_utility_party_name: stringValue(latest?.top_utility_party_name ?? latest?.highest_utility_party_name),
      top_utility_value: stringValue(latest?.top_utility_value ?? latest?.highest_utility_value),
      average_utility_value: stringValue(latest?.average_utility_value ?? latest?.avg_utility_value),
      parameter_snapshot_id: stringValue(latest?.parameter_snapshot_id),
      output_snapshot_id: stringValue(latest?.output_snapshot_id),
      algorithm_version: stringValue(latest?.algorithm_version),
      menu_code: "NAV_MEASURE_UTILITY",
      module_code: "UTIL",
    },
  };
}

function buildMDDShapPage(data: BackendWorkspaceData): PageWorkspaceData {
  const task = recordValue(data.mdTask);
  const config = recordValue(data.mdConfig);
  const participantPool = recordValue(data.participantPool);
  const currentResources = data.overview.currentPackageId
    ? data.resources.filter((item) => item.packageId === data.overview.currentPackageId)
    : data.resources;
  const currentResourcePartyIds = new Set(
    currentResources
      .map((item) => item.partyId)
      .filter((partyId) => partyId),
  );
  const currentProviderNames = new Set(
    currentResources
      .map((item) => item.providerName)
      .filter((providerName) => providerName && providerName !== "未关联"),
  );
  const shouldScopeToCurrentResources = currentResourcePartyIds.size > 0 || currentProviderNames.size > 0;
  const isCurrentResourceParty = (item: Record<string, unknown>) => {
    if (!shouldScopeToCurrentResources) {
      return true;
    }
    const partyId = stringValue(item.party_id);
    const partyName = stringValue(item.party_name);
    return currentResourcePartyIds.has(partyId) || currentProviderNames.has(partyName);
  };
  const participantPoolItems = arrayRecord(participantPool.items).filter(isCurrentResourceParty);
  const scopedMdResults = data.mdResults.filter(isCurrentResourceParty);
  const scopedParticipantPoolTotal = participantPoolItems.length || undefined;
  const participantPoolTotal = stringValue(
    scopedParticipantPoolTotal
      ?? participantPool.algorithm_party_count
      ?? task.algorithm_party_count
      ?? participantPool.total
      ?? task.result_count,
  );
  const contractPartyCount = stringValue(
    participantPool.contract_party_count ?? task.contract_party_count,
  );
  const excludedPartyCount = stringValue(
    participantPool.excluded_party_count ?? task.excluded_party_count,
  );
  const taskSet = Array.isArray(task.task_set) ? task.task_set : [];
  const participantSet = arrayRecord(task.participant_set).filter(isCurrentResourceParty);
  const excludedParties = arrayRecord(
    participantPool.excluded_parties ?? participantPool.excluded_items ?? task.excluded_parties,
  );
  return {
    summary: "MD-DShap 只计算数据源主体归一化权重；权重用于分配合同比例方案划分后的数据源收益池。",
    primaryTask: data.mdTask ? "查看后端权重结果。" : "完成效用计算后启动 MD-DShap。",
    metrics: [
      metric("进入权重池主体数", participantPoolTotal || "待生成", "participant-pool total", participantPoolTotal ? "neutral" : "warning"),
      metric("当前算法模式", stringValue(task.algorithm_mode ?? config.algorithm_mode, "待生成"), "algorithm_mode", task.algorithm_mode ? "success" : "neutral"),
      metric("计算状态", stringValue(task.status, "待生成"), "task.status", task.status ? "success" : "warning"),
      metric("归一化权重合计", stringValue(task.weight_sum, "暂无"), "weight_sum", task.weight_sum ? "success" : "neutral"),
      metric("最高权重主体", stringValue(task.top_weight_party_name, "暂无"), "top_weight_party_name", "neutral"),
    ],
    preconditions: toPreconditions(data.overview.preconditions),
    rows: scopedMdResults.map((item) => ({
      result_id: stringValue(item.result_id),
      task_id: stringValue(item.task_id ?? task.task_id),
      party_id: stringValue(item.party_id),
      party_name: stringValue(item.party_name, "数据源主体"),
      algorithm_mode: stringValue(task.algorithm_mode ?? config.algorithm_mode),
      algorithm_version: stringValue(task.algorithm_version),
      task_status: stringValue(task.status),
      participant_weight: stringValue(item.participant_weight),
      normalized_weight: stringValue(item.normalized_weight),
      baseline_weight: stringValue(item.baseline_weight),
      weight_diff: stringValue(item.weight_diff),
      utility_value: stringValue(item.utility_value),
      approximation_note: stringValue(item.approximation_note ?? task.approximation_note),
      task_level_weight_json: stringifyJson(item.task_level_weight_json),
      task_set_json: stringifyJson(taskSet),
      participant_set_json: stringifyJson(participantSet),
      seed: stringValue(task.seed ?? config.seed),
      sample_rounds: stringValue(task.sample_rounds ?? config.sample_rounds),
      epsilon: stringValue(task.epsilon ?? config.epsilon),
      baseline_enabled: stringValue(task.baseline_enabled ?? config.baseline_enabled),
      save_marginal_detail: stringValue(task.save_marginal_detail),
      parameter_snapshot_id: stringValue(task.parameter_snapshot_id),
      result_snapshot_id: stringValue(task.result_snapshot_id),
      algorithm_audit_snapshot_id: stringValue(task.algorithm_audit_snapshot_id),
      created_at: stringValue(task.created_at),
      completed_at: stringValue(task.completed_at),
    })),
    technicalDetails: {
      project_id: data.overview.projectId,
      current_algorithm_task_id: data.currentAlgorithmTaskId,
      current_project_name: data.overview.projectName,
      project_status: data.overview.status,
      participant_pool_total: participantPoolTotal,
      algorithm_party_count: participantPoolTotal,
      contract_party_count: contractPartyCount,
      excluded_party_count: excludedPartyCount,
      result_count: stringValue(scopedMdResults.length || task.result_count),
      raw_result_count: stringValue(task.result_count),
      task_set_count: stringValue(task.task_set_count),
      algorithm_mode: stringValue(task.algorithm_mode ?? config.algorithm_mode),
      algorithm_version: stringValue(task.algorithm_version),
      task_status: stringValue(task.status),
      weight_sum: stringValue(task.weight_sum),
      weight_validation_status: stringValue(task.weight_validation_status),
      top_weight_party_name: stringValue(task.top_weight_party_name),
      seed: stringValue(task.seed ?? config.seed),
      sample_rounds: stringValue(task.sample_rounds ?? config.sample_rounds),
      epsilon: stringValue(task.epsilon ?? config.epsilon),
      baseline_enabled: stringValue(task.baseline_enabled ?? config.baseline_enabled),
      approximation_note: stringValue(task.approximation_note),
      parameter_snapshot_id: stringValue(task.parameter_snapshot_id),
      result_snapshot_id: stringValue(task.result_snapshot_id),
      algorithm_audit_snapshot_id: stringValue(task.algorithm_audit_snapshot_id),
      participant_set_json: stringifyJson(participantSet),
      excluded_parties_json: stringifyJson(excludedParties),
      task_set_json: stringifyJson(taskSet),
      participant_pool_json: stringifyJson(participantPoolItems),
      marginal_traces_json: stringifyJson(data.mdMarginalTraces),
      menu_code: "NAV_ALLOC_MDS",
      module_code: "MDS",
    },
  };
}

function stringifyJson(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function buildSimulationPage(data: BackendWorkspaceData): PageWorkspaceData {
  const summary = Object.keys(data.projectAllocationSummary).length
    ? data.projectAllocationSummary
    : data.allocationSummary;
  const firstResult = data.allocationResults[0] ?? {};
  const totalRevenueValue =
    summary.total_revenue ??
    firstResult.total_revenue ??
    data.overview.metrics.currentRevenuePool;
  const priorityAmountValue =
    summary.total_contract_priority_amount ??
    summary.priority_allocation_amount ??
    firstResult.total_contract_priority_amount ??
    firstResult.priority_allocation_amount;
  const dataProviderPoolValue =
    summary.data_provider_revenue_pool ??
    firstResult.data_provider_revenue_pool;
  const totalRevenue = stringValue(totalRevenueValue);
  const priorityAmount = stringValue(priorityAmountValue);
  const dataProviderPool = stringValue(dataProviderPoolValue);
  const contractConfigured = Boolean(summary.contract_ratio_configured);
  const blockingReasons = Array.isArray(summary.blocking_reasons)
    ? summary.blocking_reasons.map((item) => stringValue(item)).filter(Boolean)
    : [];
  return {
    summary: "收益分配模拟结果来自后端：总收益先按合同比例划分非数据主体金额与数据源收益池，再按 MD-DShap 权重分配数据源收益池。",
    primaryTask: data.allocationResults.length ? "查看模拟结果或锁定方案。" : contractConfigured ? "完成权重计算后执行收益分配模拟。" : "请先配置并保存合同比例分配方案。",
    metrics: [
      metric("结果行", data.allocationResults.length, "后端 allocation results", data.allocationResults.length ? "success" : "warning"),
      metric("总收益", totalRevenue || "后端未返回", "allocation summary DTO", totalRevenue ? "success" : "warning"),
      metric("非数据合同金额", stringValue(summary.non_data_contract_amount ?? priorityAmountValue, "后端未返回"), "contract-ratio summary", priorityAmount ? "success" : "warning"),
      metric("数据源收益池", dataProviderPool || "后端未返回", "data_provider_revenue_pool", dataProviderPool ? "success" : "warning"),
      metric("合同比例方案", contractConfigured ? "已保存" : "未配置", "contract_ratio_configured", contractConfigured ? "success" : "warning"),
    ],
    preconditions: toPreconditions(data.overview.preconditions),
    rows: data.allocationResults.map((item) => ({
      total_revenue: stringValue(item.total_revenue ?? summary.total_revenue, ""),
      priority_allocation_amount: stringValue(
        item.total_contract_priority_amount
          ?? item.priority_allocation_amount
          ?? summary.total_contract_priority_amount
          ?? summary.priority_allocation_amount,
        "",
      ),
      data_provider_revenue_pool: stringValue(item.data_provider_revenue_pool ?? summary.data_provider_revenue_pool, ""),
      allocation_mode: stringValue(item.allocation_mode, "MD-DShap 权重分配"),
      party_id: stringValue(item.party_id, ""),
      party_name: stringValue(item.party_name, "数据源主体"),
      party_type: stringValue(item.party_type, ""),
      is_data_provider: stringValue(item.is_data_provider, ""),
      include_in_md_dshap: stringValue(item.include_in_md_dshap, ""),
      subject_track: stringValue(item.subject_track, "DATA_PROVIDER_POOL"),
      amount_source: stringValue(item.amount_source, ""),
      contract_ratio: stringValue(item.contract_ratio, ""),
      base_pool_amount: stringValue(item.base_pool_amount, ""),
      weight_source: stringValue(item.weight_source, ""),
      raw_weight: stringValue(item.raw_weight),
      normalized_weight: stringValue(item.normalized_weight),
      pre_constraint_amount: stringValue(item.pre_constraint_amount),
      post_constraint_amount: stringValue(item.post_constraint_amount),
      final_amount: stringValue(item.final_amount ?? item.post_constraint_amount),
      rounding_delta: stringValue(item.rounding_delta),
      constraint_adjustment_amount: stringValue(item.constraint_adjustment_amount),
      adjustment_reason: stringValue(item.constraint_adjustment_reason, "无约束调整"),
      scenario_status: projectStatusLabel(data.overview.status),
    })),
    technicalDetails: {
      project_id: data.overview.projectId,
      current_allocation_id: data.currentAllocationId,
      total_revenue: totalRevenue,
      priority_allocation_amount: priorityAmount,
      non_data_contract_amount: stringValue(summary.non_data_contract_amount ?? priorityAmountValue, ""),
      contract_ratio_configured: String(contractConfigured),
      contract_ratio_sum: stringValue(summary.contract_ratio_sum, ""),
      data_provider_pool_ratio: stringValue(summary.data_provider_pool_ratio, ""),
      data_provider_revenue_pool: dataProviderPool,
      blocking_reasons_json: stringifyJson(blockingReasons),
      allocation_summary_json: stringifyJson(summary),
      contract_priority_allocations_json: stringifyJson(data.contractPriorityAllocations),
      allocation_priority_items_json: stringifyJson(data.allocationPriorityItems),
      constraint_traces_json: stringifyJson(data.allocationConstraintTraces),
      constraint_apply_trace_json: stringifyJson(data.allocationConstraintApplyTrace),
      constraint_trace_count: String(data.allocationConstraintTraces.length),
      ordinary_constraint_state: data.allocationConstraintTraces.length
        ? "HAS_TRACE"
        : data.allocationResults.length
          ? "CONTRACT_RATIO_OR_NO_TRACE"
          : "NOT_RUN",
      menu_code: "NAV_ALLOC_SIMULATION",
      module_code: "ALLOC",
    },
  };
}

function buildConstraintsPage(data: BackendWorkspaceData): PageWorkspaceData {
  const contractRatio = data.contractRatio;
  const summary = data.projectAllocationSummary;
  const items = arrayRecord(contractRatio.items);
  const configured = Boolean(contractRatio.configured);
  const totalRevenueValue =
    contractRatio.total_revenue ??
    summary.total_revenue ??
    data.overview.metrics.currentRevenuePool;
  const blockingReasons = Array.isArray(contractRatio.blocking_reasons)
    ? contractRatio.blocking_reasons.map((item) => stringValue(item)).filter(Boolean)
    : [];
  return {
    summary: "合同比例分配方案来自后端 contract-ratio；没有保存方案时不显示示例合同规则。",
    primaryTask: configured ? "查看或调整已保存的合同比例分配方案。" : "配置数据源收益池比例并新增非数据主体比例。",
    metrics: [
      metric("合同规则状态", stringValue(contractRatio.status, "EMPTY"), "contract-ratio status", configured ? "success" : "warning"),
      metric("合同比例合计", stringValue(contractRatio.ratio_sum, "0.000000"), "ratio_sum", stringValue(contractRatio.ratio_sum) === "1.000000" ? "success" : "warning"),
      metric(
        "数据源收益池比例",
        stringValue(contractRatio.data_provider_pool_ratio, "后端未返回"),
        "data_provider_pool_ratio",
        stringValue(contractRatio.data_provider_pool_ratio) ? "success" : "warning",
      ),
      metric("可执行模拟", Boolean(summary.can_simulate) ? "是" : "否", "can_simulate", Boolean(summary.can_simulate) ? "success" : "warning"),
      metric("非数据主体金额", stringValue(summary.non_data_contract_amount, "后端未返回"), "allocation summary", stringValue(summary.non_data_contract_amount) ? "neutral" : "warning"),
    ],
    preconditions: toPreconditions(data.overview.preconditions),
    rows: items.map((item) => ({
      item_id: stringValue(item.item_id),
      plan_id: stringValue(item.plan_id),
      bucket_type: stringValue(item.bucket_type),
      party_id: stringValue(item.party_id),
      party_name: stringValue(item.party_name),
      party_type: stringValue(item.party_type),
      ratio: stringValue(item.ratio),
      calculated_amount: stringValue(item.calculated_amount),
      basis_text: stringValue(item.basis_text),
      amount_source: stringValue(item.amount_source),
      sort_no: stringValue(item.sort_no),
    })),
    technicalDetails: {
      project_id: data.overview.projectId,
      project_name: stringValue(contractRatio.project_name ?? data.overview.projectName),
      project_status: stringValue(contractRatio.project_status ?? data.overview.status),
      configured: String(configured),
      plan_id: stringValue(contractRatio.plan_id),
      status: stringValue(contractRatio.status, "EMPTY"),
      total_revenue: stringValue(totalRevenueValue),
      currency: stringValue(contractRatio.currency, "CNY"),
      ratio_sum: stringValue(contractRatio.ratio_sum, "0.000000"),
      data_provider_pool_ratio: stringValue(contractRatio.data_provider_pool_ratio),
      data_provider_revenue_pool: stringValue(contractRatio.data_provider_revenue_pool),
      can_simulate: String(Boolean(summary.can_simulate)),
      blocking_reasons_json: stringifyJson(blockingReasons),
      allocation_summary_json: stringifyJson(summary),
      contract_ratio_json: stringifyJson(contractRatio),
      menu_code: "NAV_ALLOC_CONSTRAINT",
      module_code: "CONS",
    },
  };
}

function buildReportsPage(data: BackendWorkspaceData): PageWorkspaceData {
  return {
    summary: "报告记录读取已接入；Markdown、CSV、JSON、JSONL 导出调用真实后端。",
    primaryTask: data.reports.length ? "查看最近报告记录。" : "完成分配模拟后生成报告。",
    metrics: [
      metric("报告记录", data.overview.metrics.reportCount, "dashboard 聚合计数", "neutral"),
      metric("导出文件", data.overview.metrics.exportFileCount, "dashboard 聚合计数", "neutral"),
      metric("PDF", "P1 禁用", "不直连", "warning"),
    ],
    preconditions: toPreconditions(data.overview.preconditions),
    rows: data.reports.map((item) => ({
      report_id: item.reportId,
      report_name: item.name,
      report_type: item.type,
      report_status: item.status,
      checksum: item.checksum,
      created_at: item.createdAt,
      field_scope: item.fieldScope,
    })),
    technicalDetails: {
      project_id: data.overview.projectId,
      menu_code: "NAV_REPORT_EXPORT",
      module_code: "REP",
    },
  };
}

function buildParametersPage(data: BackendWorkspaceData): PageWorkspaceData {
  const byCode = new Map(data.parameters.map((item) => [item.parameterCode, item]));
  const algorithmMode = "MD_DSHAP";
  const rounds = byCode.get("DEFAULT_MD_DSHAP_SAMPLE_ROUNDS")?.currentValue ?? "暂不可用";
  const epsilon = byCode.get("DEFAULT_MD_DSHAP_EPSILON")?.currentValue ?? "暂不可用";
  return {
    summary: "系统参数列表来自后端 system parameters；保存类动作未接入时明确提示暂不可用。",
    primaryTask: data.parameters.length ? "查看当前后端参数版本。" : "参数接口暂不可用。",
    metrics: [
      metric("参数版本", "后端未返回", "需要 parameter summary DTO", "warning"),
      metric("算法模式", algorithmMode, "默认模式", "success"),
      metric("采样轮次", rounds, "必须 > 0", rounds === "暂不可用" ? "warning" : "neutral"),
      metric("收敛阈值", epsilon, "必须 > 0", epsilon === "暂不可用" ? "warning" : "neutral"),
    ],
    preconditions: toPreconditions(data.overview.preconditions),
    rows: data.parameters.map((item) => ({
      parameter_code: item.parameterCode,
      parameter_name: item.parameterName,
      parameter_type: item.parameterType,
      current_value: item.currentValue,
      default_value: item.defaultValue,
      scope: item.scope,
      editable: item.editable ? "是" : "否",
      version_no: item.versionNo,
      status: item.editable ? "可编辑" : "只读",
      updated_at: item.updatedAt,
    })),
    technicalDetails: {
      project_id: data.overview.projectId,
      menu_code: "NAV_SYSTEM_PARAMETER",
      module_code: "PARAM",
    },
  };
}

function formatBackendError(error: ReturnType<typeof normalizeApiError> | undefined) {
  if (!error) {
    return "建议：确认后端服务已启动后重试。";
  }
  const detail = error.detail ? ` ${error.detail}` : "";
  const field = error.errorField ? ` 字段：${error.errorField}` : "";
  const suggestion = error.repairSuggestion ? ` 建议：${error.repairSuggestion}` : "";
  return `${error.errorMessage}${field}${detail}${suggestion}`;
}

function buildAuditPage(data: BackendWorkspaceData): PageWorkspaceData {
  return {
    summary: "审计日志列表来自后端；快照详情通过 audit-log detail 读取，不直读 snapshot endpoint。",
    primaryTask: data.auditLogs.length ? "查看最近审计日志。" : "执行操作后生成审计记录。",
    metrics: [
      metric("最近日志", data.auditLogs.length, "来自 /audit-logs", "neutral"),
      metric("失败日志", "后端未返回", "需要 audit summary DTO", "warning"),
      metric("快照详情", "后端未返回", "audit detail DTO 待补", "warning"),
    ],
    preconditions: toPreconditions(data.overview.preconditions),
    rows: data.auditLogs.map((item) => ({
      operation: item.operation,
      object_type: item.objectType,
      operator: item.operator,
      status: item.status,
      created_at: item.createdAt,
      summary: item.summary,
    })),
    technicalDetails: {
      project_id: data.overview.projectId,
      menu_code: "NAV_SYSTEM_AUDIT",
      module_code: "AUD",
    },
  };
}

function toPreconditions(items: BackendPreconditionDto[]): PreconditionItem[] {
  return items.map((item) => {
    const label = preconditionLabels[item.code];
    return {
      name: label?.name ?? item.code,
      status: item.passed ? "PASS" : "BLOCKED",
      targetPath: label?.targetPath,
      message: item.message,
    };
  });
}

function flattenDimensionScores(scores: Record<string, unknown>): DataRow {
  return Object.fromEntries(
    Object.entries(scores).flatMap(([key, value]) => [
      [key, stringValue(value)],
      [`${key}_score`, stringValue(value)],
    ]),
  );
}

function arrayRecord(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    : [];
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  const record = recordValue(value);
  return Object.keys(record).length ? record : null;
}

function stringValue(value: unknown, fallback = "") {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

function numberFromUnknown(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

function metric(
  label: string,
  value: string | number,
  hint: string,
  tone: MetricItem["tone"],
): MetricItem {
  return { label, value: String(value), hint, tone };
}

function formatInteger(value: number) {
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 0 });
}

function isActionId(value: string): value is ActionId {
  return value in actionRegistry;
}

export function backendStatusLabel(value: string) {
  return projectStatusLabel(mapProjectStatus(value));
}
