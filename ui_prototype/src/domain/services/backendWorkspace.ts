import { actionRegistry } from "../actionRegistry";
import {
  dvasApi,
  getDvasApiBaseUrl,
  isDvasBackendEnabled,
  mapAuditLogDto,
  mapDashboardSummaryDto,
  mapDataPackageDto,
  mapDataResourceDto,
  mapDataResourceToRow,
  mapPartyDto,
  mapPartyToProviderOption,
  mapProjectStatus,
  mapReportRecordDto,
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
}

const preconditionLabels: Record<
  string,
  { name: string; targetPath?: RoutePath }
> = {
  HAS_VALID_DATA_PACKAGE: { name: "输入快照", targetPath: "/data/packages" },
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
  if (isDvasBackendEnabled()) {
    return true;
  }
  if (typeof window === "undefined") {
    return false;
  }
  return new URLSearchParams(window.location.search).get("backend") === "1";
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

export async function refreshStoreFromBackend(
  store: WorkbenchStore,
  successMessage: string,
  fallbackStore?: WorkbenchStore,
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

  const fallback = fallbackStore ?? store;
  return {
    ...fallback,
    snapshot: markSnapshotSource(fallback.snapshot, "mock_fallback"),
    lastMessage: `后端请求失败，已回退本地模拟数据。位置：workspace refresh。建议：${result.error?.repairSuggestion ?? "确认后端服务已启动后刷新页面。"}`,
    dataSource: {
      mode: "mock_fallback",
      lastError: result.error,
      backendAvailable: false,
    },
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
    "/dashboard/overview": buildOverviewPage(data),
    "/dashboard/process": buildProcessPage(data),
    "/dashboard/one-click": buildOneClickPage(data),
    "/data/packages": buildPackagesPage(data),
    "/data/resources": buildResourcesPage(data),
    "/data/parties": buildPartiesPage(data),
    "/reports": buildReportsPage(data),
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
    reports: data.reports,
    auditLogs: data.auditLogs,
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
      menu_code: "NAV_SYS_OVERVIEW",
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
      next_module: preconditionLabels[item.code]?.targetPath ?? "/dashboard/overview",
      next_action: item.passed ? "查看结果" : "补齐前置条件",
      last_updated: data.overview.updatedAt,
    })),
    technicalDetails: {
      project_id: data.overview.projectId,
      snapshot_type: "PROJECT_STATUS",
      menu_code: "NAV_SYS_PROCESS",
      module_code: "SYS",
    },
  };
}

function buildOneClickPage(data: BackendWorkspaceData): PageWorkspaceData {
  return {
    summary: "后端一键计算仍为 PARTIAL，本页只读取前置条件并保留 mock 编排。",
    primaryTask: "GAP-API-001 未关闭前，不直连 SYS-004 完整链路计算。",
    metrics: [
      metric("通过检查", data.overview.preconditions.filter((item) => item.passed).length, "可继续节点", "success"),
      metric("未通过检查", data.overview.preconditions.filter((item) => !item.passed).length, "阻塞节点", "warning"),
      metric("一键计算", "暂不直连", "GAP-API-001", "neutral"),
    ],
    preconditions: toPreconditions(data.overview.preconditions),
    rows: data.overview.preconditions.map((item) => ({
      precondition_name: preconditionLabels[item.code]?.name ?? item.code,
      check_result: item.passed ? "通过" : "阻塞",
      failed_stage: item.passed ? "无" : item.message,
      run_mode: "前端 mock 编排保留",
      algorithm_mode: "MD-DShap",
      pipeline_stage: data.overview.nextStep.label,
      stage_status: projectStatusLabel(data.overview.status),
    })),
    technicalDetails: {
      project_id: data.overview.projectId,
      menu_code: "NAV_SYS_ONE_CLICK",
      module_code: "SYS",
    },
  };
}

function buildPackagesPage(data: BackendWorkspaceData): PageWorkspaceData {
  const invalidCount = data.packages.filter((item) => item.status !== "VALIDATED").length;
  return {
    summary: "数据包列表来自后端；演示数据初始化和 JSON 上传可直连后端并回退 mock。",
    primaryTask: data.packages.length ? "检查最新数据包校验结果。" : "选择演示数据或上传 JSON。",
    metrics: [
      metric("数据包", data.packages.length, "来自 /data-packages", "neutral"),
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
    summary: "资源清单来自后端；主体关系读取已接入，计算纳入变更仍保留 mock。",
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
      party_name: item.partyName,
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

function buildReportsPage(data: BackendWorkspaceData): PageWorkspaceData {
  return {
    summary: "报告记录读取已接入；独立 export_file 列表 endpoint 缺失，导出文件清单继续使用 mock。",
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
