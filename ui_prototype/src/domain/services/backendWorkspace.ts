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
  mapPartyToProviderOption,
  mapProjectStatus,
  mapReportRecordDto,
  mapSystemParameterDto,
  normalizeApiError,
  projectStatusLabel,
  type BackendPreconditionDto,
} from "../api";
import { createMockWorkspaceState, workbenchSnapshot } from "../mockData";
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
  mdTask: Record<string, unknown> | null;
  mdResults: Record<string, unknown>[];
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
  HAS_QUALITY_ASSESSMENT: { name: "质量评估", targetPath: "/measure/quality" },
  HAS_SHUYUAN_METERING: { name: "数元计量", targetPath: "/measure/shuyuan" },
  HAS_CONTRIBUTION_RECORDS: { name: "贡献度计算", targetPath: "/measure/utility" },
  HAS_UTILITY_RESULT: { name: "效用计算", targetPath: "/measure/utility" },
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
    const [participantPool, mdTask, mdResultsPage, allocationResultsPage] = await Promise.all([
      optionalBackendCall(() => dvasApi.listMdDshapParticipantPool(), {}),
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
      mdTask,
      mdResults: mdResultsPage.items,
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
      source: "mock_fallback",
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
    snapshot: markSnapshotSource(store.snapshot, "mock_fallback"),
    lastMessage: `后端刷新失败，当前页面未用 mock 伪造成功。位置：workspace refresh。${formatBackendError(result.error)}`,
    dataSource: {
      mode: "mock_fallback",
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
      snapshot: markSnapshotSource(store.snapshot, "mock_fallback"),
      lastMessage: `后端操作失败，当前页面未用 mock 伪造成功。位置：${location}。${formatBackendError(normalized)}`,
      dataSource: {
        mode: "mock_fallback",
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
      lastSyncedAt: source === "mock" ? snapshot.backend?.lastSyncedAt ?? "" : new Date().toISOString(),
    },
  };
}

function buildSnapshotFromBackend(
  currentSnapshot: WorkbenchSnapshot,
  data: BackendWorkspaceData,
): WorkbenchSnapshot {
  const mock = buildMockState(currentSnapshot.mock ?? workbenchSnapshot.mock, data);
  const pages = {
    ...currentSnapshot.pages,
    "/dashboard": buildOverviewPage(data),
    "/data/ingestion": buildPackagesPage(data),
    "/data/resources": buildResourcesPage(data),
    "/data/parties": buildPartiesPage(data),
    "/allocation/md-dshap": buildMDDShapPage(data),
    "/allocation/simulation": buildSimulationPage(data),
    "/allocation/constraints": buildConstraintsPage(data),
    "/reports": buildReportsPage(data),
    "/system/parameters": buildParametersPage(data),
    "/system/audit": buildAuditPage(data, mock),
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

function buildMockState(
  currentMock: MockWorkspaceState | undefined,
  data: BackendWorkspaceData,
): MockWorkspaceState {
  const base = currentMock ?? workbenchSnapshot.mock ?? createMockWorkspaceState();
  return {
    ...base,
    resources: data.resources,
    dataProviders: data.parties.map((party) =>
      mapPartyToProviderOption(party, linkedResourceCount(party.partyId, data.resources)),
    ),
    mdsParticipants: mdParticipantsFromBackend(data),
    mdsWeights: mdWeightsFromBackend(data),
    mdsTraces: mdTracesFromBackend(data),
    mdsTasks: mdTasksFromBackend(data, base),
    currentRevenuePool: currentRevenuePoolFromBackend(data, base.currentRevenuePool),
    reports: data.reports,
    auditLogs: data.auditLogs,
  };
}

function mdParticipantsFromBackend(data: BackendWorkspaceData) {
  const items = arrayRecord(data.participantPool.items);
  return items.map((item) => ({
    name: stringValue(item.party_name, "数据源主体"),
    partyType: "DATA_PROVIDER" as const,
    contributionScore: numberValue(item.contribution_score),
    utilityValue: numberValue(item.utility_value),
    qualityFactor: numberValue(item.quality_factor, 1),
    includeInMDDShap: Boolean(item.include_in_md_dshap ?? true),
  }));
}

function mdWeightsFromBackend(data: BackendWorkspaceData) {
  return data.mdResults.map((item) => ({
    partyName: stringValue(item.party_name, "数据源主体"),
    normalizedWeight: numberValue(item.normalized_weight),
    marginalContribution: numberValue(item.participant_weight),
    qualityFactor: 1,
    utilityValue: numberValue(item.normalized_weight),
    status: "后端已归一化",
  }));
}

function mdTracesFromBackend(data: BackendWorkspaceData) {
  return data.mdResults.map((item, index) => ({
    coalition: index === 0 ? "{}" : "{前序参与方}",
    partyName: stringValue(item.party_name, "数据源主体"),
    vBefore: 0,
    vAfter: numberValue(item.normalized_weight),
    marginalContribution: numberValue(item.participant_weight),
  }));
}

function mdTasksFromBackend(data: BackendWorkspaceData, base: MockWorkspaceState) {
  if (!data.mdTask) {
    return base.mdsTasks;
  }
  return [
    {
      taskName: stringValue(data.mdTask.task_id, "MD-DShap 后端任务"),
      algorithmMode: stringValue(data.mdTask.algorithm_mode, "MD_DSHAP"),
      status: stringValue(data.mdTask.status, "COMPLETED") === "COMPLETED" ? "已完成" : "执行中",
      progress: stringValue(data.mdTask.status, "COMPLETED") === "COMPLETED" ? 100 : 50,
      seed: numberValue(data.mdTask.seed, 42),
      sampleRounds: numberValue(data.mdTask.sample_rounds, 64),
      epsilon: numberValue(data.mdTask.epsilon, 0.000001),
      saveMarginalDetail: true,
      createdAt: stringValue(data.mdTask.created_at, data.overview.updatedAt),
    },
  ];
}

function currentRevenuePoolFromBackend(data: BackendWorkspaceData, fallback: number) {
  const first = data.allocationResults[0];
  if (!first) {
    return fallback;
  }
  return data.allocationResults.reduce(
    (sum, item) => sum + numberValue(item.post_constraint_amount),
    0,
  );
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
      metric("通过检查", data.overview.preconditions.filter((item) => item.passed).length, "后端前置条件", "success"),
      metric("阻塞检查", data.overview.preconditions.filter((item) => !item.passed).length, "需处理节点", "warning"),
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
      metric("通过检查", data.overview.preconditions.filter((item) => item.passed).length, "可继续节点", "success"),
      metric("未通过检查", data.overview.preconditions.filter((item) => !item.passed).length, "阻塞节点", "warning"),
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
  const invalidCount = data.packages.filter((item) => item.status !== "VALIDATED").length;
  return {
    summary: "数据包列表来自后端；演示数据初始化和 JSON 上传均调用真实接口。",
    primaryTask: data.packages.length ? "检查最新数据包校验结果。" : "选择演示数据或上传 JSON。",
    metrics: [
      metric("数据包", data.packages.length, "来自数据接入接口", "neutral"),
      metric("有效数据包", data.packages.filter((item) => item.status === "VALIDATED").length, "可进入后续处理", "success"),
      metric("校验失败", invalidCount, "需要修复", invalidCount ? "warning" : "success"),
    ],
    preconditions: toPreconditions(data.overview.preconditions),
    rows: data.packages.map((item) => ({
      package_name: item.packageName,
      source_type: item.sourceTypeLabel,
      file_name: item.fileName,
      validation_status: item.statusLabel,
      access_status: item.status === "VALIDATED" ? "已接入" : "待处理",
      resource_count: data.resources.filter((resource) => resource.packageId === item.packageId).length,
      party_count: data.parties.length,
      created_at: item.createdAt,
      error_field: item.status === "VALIDATED" ? "无" : "见校验结果",
      repair_suggestion: item.status === "VALIDATED" ? "可进入资源管理" : "按失败字段修复后重新上传",
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
  const unboundCount = data.resources.filter((item) => item.providerName === "未关联").length;
  return {
    summary: "资源清单来自后端；主体关系读取已接入，未接入写操作会明确提示暂不可用。",
    primaryTask: unboundCount ? "补齐资源与数据源主体关系。" : "资源主体关系已满足质量评估前置条件。",
    metrics: [
      metric("资源", data.resources.length, "来自 /data-resources", "neutral"),
      metric("已绑定主体", data.resources.length - unboundCount, "主体关系", unboundCount ? "warning" : "success"),
      metric("进入计算", data.resources.filter((item) => item.includeInCalculation).length, "include_in_calculation 映射", "success"),
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
  const dataProviders = data.parties.filter((item) => item.partyType === "DATA_PROVIDER");
  return {
    summary: "参与方列表来自后端；非数据贡献主体默认不进入 MD-DShap 权重层。",
    primaryTask: "维护数据源主体与非数据贡献主体边界。",
    metrics: [
      metric("参与方", data.parties.length, "来自 /parties", "neutral"),
      metric("数据源主体", dataProviders.length, "DATA_PROVIDER", "success"),
      metric("进入权重池", data.parties.filter((item) => item.includeInMdDshap).length, "include_in_md_dshap 映射", "success"),
    ],
    preconditions: toPreconditions(data.overview.preconditions),
    rows: data.parties.map((item) => ({
      party_id: item.partyId,
      party_name: item.partyName,
      party_type_code: item.partyType,
      party_type: item.partyTypeLabel,
      is_data_provider: item.partyType === "DATA_PROVIDER" ? "是" : "否",
      include_in_md_dshap: item.includeInMdDshap ? "是" : "否",
      linked_resource_count: linkedResourceCount(item.partyId, data.resources),
      status: item.statusLabel,
      contribution_summary: item.includeInMdDshap
        ? "数据贡献主体，进入权重层候选"
        : "非数据贡献主体，合同优先或约束处理",
    })),
    technicalDetails: {
      project_id: data.overview.projectId,
      menu_code: "NAV_DATA_PARTY",
      module_code: "PARTY",
    },
  };
}

function buildMDDShapPage(data: BackendWorkspaceData): PageWorkspaceData {
  const participantCount = mdParticipantsFromBackend(data).length;
  const weightTotal = data.mdResults.reduce(
    (sum, item) => sum + numberValue(item.normalized_weight),
    0,
  );
  return {
    summary: "MD-DShap 参与方池、任务和权重结果来自后端。",
    primaryTask: data.mdTask ? "查看后端权重结果。" : "完成效用计算后启动 MD-DShap。",
    metrics: [
      metric("参与方池", participantCount, "include_in_md_dshap=true", "neutral"),
      metric("权重结果", data.mdResults.length, "后端 task results", data.mdResults.length ? "success" : "warning"),
      metric("权重合计", weightTotal ? weightTotal.toFixed(6) : "待计算", "目标为 1.000000", Math.abs(weightTotal - 1) < 0.000001 ? "success" : "warning"),
    ],
    preconditions: toPreconditions(data.overview.preconditions),
    rows: data.mdResults.length
      ? data.mdResults.map((item) => ({
          algorithm_mode: stringValue(data.mdTask?.algorithm_mode, "MD_DSHAP"),
          participant_set: participantCount,
          task_set: "P0_DETERMINISTIC_UTILITY",
          sample_rounds: numberValue(data.mdTask?.sample_rounds, 64),
          epsilon: numberValue(data.mdTask?.epsilon, 0.000001).toFixed(6),
          task_status: stringValue(data.mdTask?.status, "COMPLETED"),
          party_name: stringValue(item.party_name, "数据源主体"),
          participant_weight: numberValue(item.participant_weight).toFixed(6),
          normalized_weight: numberValue(item.normalized_weight).toFixed(6),
          marginal_contribution: numberValue(item.weight_diff).toFixed(6),
        }))
      : mdParticipantsFromBackend(data).map((item) => ({
          algorithm_mode: "MD_DSHAP",
          participant_set: participantCount,
          task_set: "P0_DETERMINISTIC_UTILITY",
          sample_rounds: 64,
          epsilon: "0.000001",
          task_status: "待启动",
          party_name: item.name,
          participant_weight: "待计算",
          normalized_weight: "待计算",
          marginal_contribution: "待计算",
        })),
    technicalDetails: {
      project_id: data.overview.projectId,
      current_algorithm_task_id: data.currentAlgorithmTaskId,
      menu_code: "NAV_ALLOC_MDS",
      module_code: "MDS",
    },
  };
}

function buildSimulationPage(data: BackendWorkspaceData): PageWorkspaceData {
  const total = data.allocationResults.reduce(
    (sum, item) => sum + numberValue(item.post_constraint_amount),
    0,
  );
  return {
    summary: "收益分配模拟结果来自后端 allocation results。",
    primaryTask: data.allocationResults.length ? "查看模拟结果或锁定方案。" : "完成权重计算后执行收益分配模拟。",
    metrics: [
      metric("结果行", data.allocationResults.length, "后端 allocation results", data.allocationResults.length ? "success" : "warning"),
      metric("数据源收益池", total.toFixed(2), "约束后金额合计", "neutral"),
      metric("锁定/导出", projectStatusLabel(data.overview.status), "项目状态", "neutral"),
    ],
    preconditions: toPreconditions(data.overview.preconditions),
    rows: data.allocationResults.map((item) => ({
      total_revenue: total.toFixed(2),
      priority_allocation_amount: "0.00",
      data_provider_revenue_pool: total.toFixed(2),
      allocation_mode: "MD-DShap 权重分配",
      party_name: stringValue(item.party_name, "数据源主体"),
      raw_weight: numberValue(item.raw_weight).toFixed(6),
      normalized_weight: numberValue(item.normalized_weight).toFixed(6),
      pre_constraint_amount: numberValue(item.pre_constraint_amount).toFixed(2),
      post_constraint_amount: numberValue(item.post_constraint_amount).toFixed(2),
      adjustment_reason: stringValue(item.constraint_adjustment_reason, "无约束调整"),
      scenario_status: projectStatusLabel(data.overview.status),
    })),
    technicalDetails: {
      project_id: data.overview.projectId,
      current_allocation_id: data.currentAllocationId,
      menu_code: "NAV_ALLOC_SIMULATION",
      module_code: "ALLOC",
    },
  };
}

function buildConstraintsPage(data: BackendWorkspaceData): PageWorkspaceData {
  const activeCount = data.constraints.filter((item) => item.status === "ACTIVE").length;
  const targetCount = new Set(data.constraints.map((item) => item.partyId).filter(Boolean)).size;
  return {
    summary: "合同约束列表来自后端 allocation constraints；没有约束时不显示示例约束。",
    primaryTask: data.constraints.length ? "查看或刷新合同约束。" : "暂无后端合同约束记录。",
    metrics: [
      metric("约束总数", data.constraints.length, "来自 /allocation/constraints", "neutral"),
      metric("启用约束", activeCount, "ACTIVE 状态", activeCount ? "success" : "neutral"),
      metric("约束对象", targetCount, "主体级约束", "neutral"),
      metric("检查结果", data.constraints.length ? "后端已返回" : "暂无约束", "不使用前端示例", "neutral"),
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
      metric("报告记录", data.reports.length, "来自 /reports", "neutral"),
      metric("导出文件", data.overview.metrics.exportFileCount, "dashboard 聚合计数", "neutral"),
      metric("PDF", "P1 禁用", "不直连", "warning"),
    ],
    preconditions: toPreconditions(data.overview.preconditions),
    rows: data.reports.map((item) => ({
      report_name: item.name,
      report_type: item.type,
      report_status: item.status,
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
  const latestVersion = Math.max(0, ...data.parameters.map((item) => item.versionNo));
  return {
    summary: "系统参数列表来自后端 system parameters；保存类动作未接入时明确提示暂不可用。",
    primaryTask: data.parameters.length ? "查看当前后端参数版本。" : "参数接口暂不可用。",
    metrics: [
      metric("参数版本", latestVersion ? `v${latestVersion}` : "暂不可用", "后端 version_no", "neutral"),
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

function buildAuditPage(
  data: BackendWorkspaceData,
  mock: MockWorkspaceState,
): PageWorkspaceData {
  return {
    summary: "审计日志列表来自后端；快照详情通过 audit-log detail 读取，不直读 snapshot endpoint。",
    primaryTask: data.auditLogs.length ? "查看最近审计日志。" : "执行操作后生成审计记录。",
    metrics: [
      metric("最近日志", data.auditLogs.length, "来自 /audit-logs", "neutral"),
      metric("失败日志", data.auditLogs.filter((item) => item.status === "失败").length, "失败原因保留", "warning"),
      metric("快照记录", mock.snapshots.length, "本地追溯摘要", "neutral"),
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

function linkedResourceCount(partyId: string, resources: Array<{ partyId: string; relations: Array<{ partyId: string }> }>) {
  return resources.filter(
    (item) =>
      item.partyId === partyId ||
      item.relations.some((relation) => relation.partyId === partyId),
  ).length;
}

function arrayRecord(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    : [];
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

function numberValue(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
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
