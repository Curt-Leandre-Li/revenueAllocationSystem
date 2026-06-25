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
  resources: ReturnType<typeof mapDataResourceDto>[];
  parties: ReturnType<typeof mapPartyDto>[];
  reports: ReturnType<typeof mapReportRecordDto>[];
  auditLogs: ReturnType<typeof mapAuditLogDto>[];
  constraints: ReturnType<typeof mapConstraintDto>[];
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
  contractPriorityAllocations: Record<string, unknown>[];
  allocationResults: Record<string, unknown>[];
  currentAlgorithmTaskId: string;
  currentAllocationId: string;
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
        dvasApi.listAuditLogs(),
        dvasApi.listAllocationConstraints(),
        dvasApi.listSystemParameters(),
      ]);
    const currentAlgorithmTaskId = String(projectDto.current_algorithm_task_id ?? "");
    const currentAllocationId = String(projectDto.current_allocation_id ?? "");
    const [participantPool, mdConfig, mdTask, mdResultsPage, allocationResultsPage] = await Promise.all([
      optionalBackendCall(() => dvasApi.listMdDshapParticipantPool(), {}),
      optionalBackendCall(() => dvasApi.getMdDshapConfig(), null),
      currentAlgorithmTaskId
        ? optionalBackendCall(() => dvasApi.getMdDshapTask(currentAlgorithmTaskId), null)
        : Promise.resolve(null),
      currentAlgorithmTaskId
        ? optionalBackendCall(() => dvasApi.getMdDshapTaskResults(currentAlgorithmTaskId), {
            items: [],
            total: 0,
            page: 1,
            page_size: 0,
          })
        : Promise.resolve({ items: [], total: 0, page: 1, page_size: 0 }),
      currentAllocationId
        ? optionalBackendCall(() => dvasApi.getAllocationResults(currentAllocationId), {
            items: [],
            total: 0,
            page: 1,
            page_size: 0,
          })
        : Promise.resolve({ items: [], total: 0, page: 1, page_size: 0 }),
    ]);
    const [qualityLatest, shuyuanLatest, utilityLatest, mdMarginalTracesPage] =
      await Promise.all([
        optionalBackendCall(() => dvasApi.getLatestQualityAssessment(), null),
        optionalBackendCall(() => dvasApi.getLatestShuyuanMetering(), null),
        optionalBackendCall(() => dvasApi.getLatestUtility(), null),
        currentAlgorithmTaskId
          ? optionalBackendCall(() => dvasApi.getMdDshapMarginalTraces(currentAlgorithmTaskId), {
              items: [],
              total: 0,
              page: 1,
              page_size: 0,
            })
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
              () => dvasApi.getQualityAssessmentDetails(qualityAssessmentId),
              null,
            )
          : Promise.resolve(null),
        qualityAssessmentId
          ? optionalBackendCall(
              () => dvasApi.getQualityResourceResults(qualityAssessmentId),
              null,
            )
          : Promise.resolve(null),
        shuyuanMeteringId
          ? optionalBackendCall(
              () => dvasApi.getShuyuanMeteringDetails(shuyuanMeteringId),
              null,
            )
          : Promise.resolve(null),
        utilityId
          ? optionalBackendCall(() => dvasApi.getUtilityTrace(utilityId), null)
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
      resources: resourcesPage.items.map(mapDataResourceDto),
      parties: partiesPage.items.map(mapPartyDto),
      reports: reportsPage.items.map(mapReportRecordDto),
      auditLogs: auditPage.items.map(mapAuditLogDto),
      constraints: constraintsPage.items.map(mapConstraintDto),
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
      contractPriorityAllocations: arrayRecord(allocationResultPayload.contract_priority_allocations),
      allocationResults: allocationResultsPage.items,
      currentAlgorithmTaskId,
      currentAllocationId,
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

async function optionalBackendCall<T>(call: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await call();
  } catch {
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
    return {
      ...store,
      snapshot: result.data,
      lastMessage: `${successMessage}（数据来源：后端）`,
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

  return {
    summary: "从后端聚合项目状态、数据接入、参与方、报告和审计摘要。",
    primaryTask: data.overview.nextStep.label,
    metrics: [
      metric("数据包", data.overview.metrics.dataPackageCount, "有效数据包", "neutral"),
      metric("数据资源", data.overview.metrics.resourceCount, "已识别资源", "success"),
      metric("参与方", data.overview.metrics.partyCount, "当前项目主体", "success"),
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
  return {
    summary: "数据包列表来自后端；演示数据初始化和 JSON 上传均调用真实接口。",
    primaryTask: data.packages.length ? "检查最新数据包校验结果。" : "选择演示数据或上传 JSON。",
    metrics: [
      metric("数据包", data.overview.metrics.dataPackageCount, "后端聚合字段", "neutral"),
      metric("有效数据包", "后端未返回", "需要数据接入 summary DTO", "warning"),
      metric("校验失败", "后端未返回", "需要上传校验 summary DTO", "warning"),
    ],
    preconditions: toPreconditions(data.overview.preconditions),
    rows: data.packages.map((item) => ({
      package_id: item.packageId,
      package_name: item.packageName,
      source_type: item.sourceTypeLabel,
      file_name: item.fileName,
      validation_status: item.statusLabel,
      access_status: item.status,
      file_size: item.fileSize,
      validation_result_id: item.validationResultId,
      input_snapshot_id: item.inputSnapshotId,
      checksum: item.checksum,
      created_at: item.createdAt,
      error_field: "",
      repair_suggestion: "",
    })),
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
  return {
    summary: "资源清单来自后端；主体关系读取已接入，未接入写操作会明确提示暂不可用。",
    primaryTask: relationPrecondition?.passed
      ? "资源主体关系已满足质量评估前置条件。"
      : relationPrecondition?.message ?? "等待后端返回资源主体关系前置条件。",
    metrics: [
      metric("资源", data.overview.metrics.resourceCount, "来自 dashboard 聚合字段", "neutral"),
      metric(
        "主体关系",
        relationPrecondition?.passed ? "通过" : "待处理",
        "来自后端前置条件",
        relationPrecondition?.passed ? "success" : "warning",
      ),
      metric("图表 DTO", "待后端返回", "不在前端聚合缺失率", "neutral"),
    ],
    preconditions: toPreconditions(data.overview.preconditions),
    rows: data.resources.map(mapDataResourceToRow),
    technicalDetails: {
      project_id: data.overview.projectId,
      current_package_id: data.overview.currentPackageId ?? "",
      menu_code: "NAV_DATA_RESOURCE",
      module_code: "RES",
    },
  };
}

function buildPartiesPage(data: BackendWorkspaceData): PageWorkspaceData {
  return {
    summary: "参与方列表来自后端；非数据贡献主体默认不进入 MD-DShap 权重层。",
    primaryTask: "维护数据源主体与非数据贡献主体边界。",
    metrics: [
      metric("参与方", data.overview.metrics.partyCount, "来自 dashboard 聚合字段", "neutral"),
      metric("数据源主体", "后端摘要待补", "不在前端按类型聚合", "neutral"),
      metric("进入权重池", "后端摘要待补", "不在前端按标记聚合", "neutral"),
    ],
    preconditions: toPreconditions(data.overview.preconditions),
    rows: data.parties.map((item) => ({
      party_id: item.partyId,
      party_name: item.partyName,
      party_type_code: item.partyType,
      party_type: item.partyTypeLabel,
      is_data_provider: item.partyType === "DATA_PROVIDER" ? "是" : "否",
      include_in_md_dshap: item.includeInMdDshap ? "是" : "否",
      processing_method: item.partyType === "DATA_PROVIDER" ? "贡献度 / 效用 / MD-DShap" : "合同优先 / 合同约束",
      linked_resource_count: "后端未返回",
      status: item.statusLabel,
      contribution_summary: "后端未返回",
    })),
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
  const participantPoolTotal = stringValue(
    participantPool.total ?? task.result_count,
  );
  const taskSet = Array.isArray(task.task_set) ? task.task_set : [];
  const participantSet = arrayRecord(task.participant_set);
  return {
    summary: "MD-DShap 只计算数据源主体归一化权重；权重用于分配扣除合同优先后的数据源收益池。",
    primaryTask: data.mdTask ? "查看后端权重结果。" : "完成效用计算后启动 MD-DShap。",
    metrics: [
      metric("进入权重池主体数", participantPoolTotal || "待生成", "participant-pool total", participantPoolTotal ? "neutral" : "warning"),
      metric("当前算法模式", stringValue(task.algorithm_mode ?? config.algorithm_mode, "待生成"), "algorithm_mode", task.algorithm_mode ? "success" : "neutral"),
      metric("计算状态", stringValue(task.status, "待生成"), "task.status", task.status ? "success" : "warning"),
      metric("归一化权重合计", stringValue(task.weight_sum, "暂无"), "weight_sum", task.weight_sum ? "success" : "neutral"),
      metric("最高权重主体", stringValue(task.top_weight_party_name, "暂无"), "top_weight_party_name", "neutral"),
    ],
    preconditions: toPreconditions(data.overview.preconditions),
    rows: data.mdResults.map((item) => ({
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
      result_count: stringValue(task.result_count),
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
      task_set_json: stringifyJson(taskSet),
      participant_pool_json: stringifyJson(arrayRecord(participantPool.items)),
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
  const summary = data.allocationSummary;
  const firstResult = data.allocationResults[0] ?? {};
  const totalRevenue = stringValue(summary.total_revenue ?? firstResult.total_revenue);
  const priorityAmount = stringValue(
    summary.total_contract_priority_amount
      ?? summary.priority_allocation_amount
      ?? firstResult.total_contract_priority_amount
      ?? firstResult.priority_allocation_amount,
  );
  const dataProviderPool = stringValue(
    summary.data_provider_revenue_pool ?? firstResult.data_provider_revenue_pool,
  );
  return {
    summary: "收益分配模拟结果来自后端：先扣非数据源主体合同优先分配，再形成数据源主体收益池。",
    primaryTask: data.allocationResults.length ? "查看模拟结果或锁定方案。" : "完成权重计算后执行收益分配模拟。",
    metrics: [
      metric("结果行", data.allocationResults.length, "后端 allocation results", data.allocationResults.length ? "success" : "warning"),
      metric("总收益", totalRevenue || "后端未返回", "allocation summary DTO", totalRevenue ? "success" : "warning"),
      metric("非数据合同优先", priorityAmount || "后端未返回", "contract priority summary", priorityAmount ? "success" : "warning"),
      metric("数据源收益池", dataProviderPool || "后端未返回", "data_provider_revenue_pool", dataProviderPool ? "success" : "warning"),
      metric("锁定/导出", projectStatusLabel(data.overview.status), "项目状态", "neutral"),
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
      party_name: stringValue(item.party_name, "数据源主体"),
      subject_track: stringValue(item.subject_track, "DATA_PROVIDER_POOL"),
      raw_weight: stringValue(item.raw_weight),
      normalized_weight: stringValue(item.normalized_weight),
      pre_constraint_amount: stringValue(item.pre_constraint_amount),
      post_constraint_amount: stringValue(item.post_constraint_amount),
      constraint_adjustment_amount: stringValue(item.constraint_adjustment_amount),
      adjustment_reason: stringValue(item.constraint_adjustment_reason, "无约束调整"),
      scenario_status: projectStatusLabel(data.overview.status),
    })),
    technicalDetails: {
      project_id: data.overview.projectId,
      current_allocation_id: data.currentAllocationId,
      total_revenue: totalRevenue,
      priority_allocation_amount: priorityAmount,
      data_provider_revenue_pool: dataProviderPool,
      contract_priority_allocations_json: stringifyJson(data.contractPriorityAllocations),
      menu_code: "NAV_ALLOC_SIMULATION",
      module_code: "ALLOC",
    },
  };
}

function buildConstraintsPage(data: BackendWorkspaceData): PageWorkspaceData {
  return {
    summary: "合同约束列表来自后端 allocation constraints；没有约束时不显示示例约束。",
    primaryTask: data.constraints.length ? "查看或刷新合同约束。" : "暂无后端合同约束记录。",
    metrics: [
      metric("约束总数", "后端未返回", "需要 constraints summary DTO", "warning"),
      metric("启用约束", "后端未返回", "不在前端按状态聚合", "warning"),
      metric("约束对象", "后端未返回", "不在前端按主体聚合", "warning"),
      metric("检查结果", "后端未返回", "不使用前端示例", "warning"),
      metric("被引用约束", "后端追溯", "分配后查看轨迹", "neutral"),
    ],
    preconditions: toPreconditions(data.overview.preconditions),
    rows: data.constraints.map((item) => ({
      constraint_id: item.constraintId,
      party_id: item.partyId,
      constraint_name: item.constraintName,
      party_name: item.partyName,
      constraint_type: item.constraintType,
      constraint_type_label: item.constraintTypeLabel,
      value_type: item.valueType,
      constraint_value: item.constraintValue,
      priority: item.priority,
      status: item.statusLabel,
      version_no: item.versionNo,
      updated_at: item.updatedAt,
    })),
    technicalDetails: {
      project_id: data.overview.projectId,
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

function metric(
  label: string,
  value: string | number,
  hint: string,
  tone: MetricItem["tone"],
): MetricItem {
  return { label, value: String(value), hint, tone };
}

function isActionId(value: string): value is ActionId {
  return value in actionRegistry;
}

export function backendStatusLabel(value: string) {
  return projectStatusLabel(mapProjectStatus(value));
}
