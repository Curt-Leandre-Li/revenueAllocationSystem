import { actionRegistry } from "../actionRegistry";
import { projectStatusLabel } from "../api";
import { createMockWorkspaceState, workbenchSnapshot } from "../mockData";
import type {
  ActionId,
  DataRow,
  MetricItem,
  MockWorkspaceState,
  PageWorkspaceData,
  PreconditionItem,
  StatusCode,
  WorkbenchSnapshot,
} from "../types";
import { getApiBaseUrl, p0Api } from "../../lib/api";
import { formatAmount, formatCount, formatWeight } from "../../lib/formatters";
import { normalizeApiError, type ApiError } from "../../lib/errors";
import type {
  AllocationSummary,
  AuditLogItem,
  ConstraintsSummary,
  ExportFileItem,
  MdDshapSummary,
  PartyItem,
  ProjectListItem,
  ProjectStatusSummary,
  QualitySummary,
  ReportItem,
  ResourceItem,
  ShuyuanSummary,
  UtilitySummary,
  WriteResult,
} from "../../lib/types";
import type { WorkbenchStore } from "../store";
import type { ServiceResult } from "./serviceTypes";

interface P0WorkspaceData {
  projects: ProjectListItem[];
  status: ProjectStatusSummary | null;
  reports: ReportItem[];
  auditLogs: AuditLogItem[];
  resources: ResourceItem[];
  parties: PartyItem[];
  quality: QualitySummary | null;
  shuyuan: ShuyuanSummary | null;
  utility: UtilitySummary | null;
  constraints: ConstraintsSummary | null;
  exportFiles: ExportFileItem[];
  allocation: AllocationSummary | null;
  mdDshap: MdDshapSummary | null;
}

const p0Actions: ActionId[] = [
  "SYS-002",
  "DATA-003",
  "SYS-004",
  "ALLOC-015",
  "REP-002",
  "REP-004",
  "REP-005",
  "REP-009",
  "AUD-002",
];

export function shouldUseBackend() {
  return true;
}

export async function loadBackendWorkspaceSnapshot(
  currentSnapshot: WorkbenchSnapshot,
  preferredProjectId?: string,
): Promise<ServiceResult<WorkbenchSnapshot>> {
  try {
    await p0Api.healthDb();
    const projectsPage = await p0Api.listProjects();
    const projects = projectsPage.items;
    const project = chooseProject(projects, preferredProjectId || projectIdFromSnapshot(currentSnapshot));

    if (!project) {
      return {
        ok: true,
        source: "backend",
        data: buildNoProjectSnapshot(currentSnapshot),
      };
    }

    const status = await p0Api.getProjectStatus(project.project_id);
    const [
      reportsPage,
      auditPage,
      allocation,
      mdDshap,
      resourcesPage,
      partiesPage,
      quality,
      shuyuan,
      utility,
      constraints,
      exportFilesPage,
    ] = await Promise.all([
      p0Api.listReports(project.project_id),
      p0Api.listAuditLogs(project.project_id, 50),
      optionalBackendCall(() => p0Api.getAllocationSummary(project.project_id), null),
      optionalBackendCall(() => p0Api.getMdDshapSummary(project.project_id), null),
      optionalBackendCall(() => p0Api.listProjectResources(project.project_id), emptyPage<ResourceItem>()),
      optionalBackendCall(() => p0Api.listProjectParties(project.project_id), emptyPage<PartyItem>()),
      optionalBackendCall(() => p0Api.getQualitySummary(project.project_id), null),
      optionalBackendCall(() => p0Api.getShuyuanSummary(project.project_id), null),
      optionalBackendCall(() => p0Api.getUtilitySummary(project.project_id), null),
      optionalBackendCall(() => p0Api.getConstraintsSummary(project.project_id), null),
      optionalBackendCall(() => p0Api.listExportFiles(project.project_id), emptyPage<ExportFileItem>()),
    ]);

    return {
      ok: true,
      source: "backend",
      data: buildSnapshotFromP0(currentSnapshot, {
        projects,
        status,
        reports: reportsPage.items,
        auditLogs: auditPage.items,
        resources: resourcesPage.items,
        parties: partiesPage.items,
        quality,
        shuyuan,
        utility,
        constraints,
        exportFiles: exportFilesPage.items,
        allocation,
        mdDshap,
      }),
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

function emptyPage<T>() {
  return {
    items: [] as T[],
    total: 0,
    page: 1,
    page_size: 0,
  };
}

export async function refreshStoreFromBackend(
  store: WorkbenchStore,
  successMessage: string,
  preferredProjectId?: string,
): Promise<WorkbenchStore> {
  const result = await loadBackendWorkspaceSnapshot(store.snapshot, preferredProjectId);
  if (result.ok && result.data) {
    const lastSyncAt = result.data.backend?.lastSyncedAt ?? new Date().toISOString();
    return {
      ...store,
      snapshot: result.data,
      lastMessage: `${successMessage}（数据来源：真实 PostgreSQL API）`,
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
    const mutationResult = await mutation();
    return refreshStoreFromBackend(store, successMessage, projectIdFromMutation(mutationResult));
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
    lastMessage: `${actionLabel} 未执行：Phase 2C 未接入该写接口。位置：${location}。未写入前端 mock 成功状态。`,
  };
}

export function currentProjectId(store: WorkbenchStore) {
  return projectIdFromSnapshot(store.snapshot);
}

export function requireCurrentProjectId(store: WorkbenchStore) {
  const projectId = currentProjectId(store);
  if (!projectId) {
    throw new Error("当前未选择 PostgreSQL 项目，请先选择演示数据或上传 JSON。");
  }
  return projectId;
}

export function markSnapshotSource(
  snapshot: WorkbenchSnapshot,
  source: ServiceResult<WorkbenchSnapshot>["source"],
): WorkbenchSnapshot {
  return {
    ...snapshot,
    backend: {
      apiBaseUrl: getApiBaseUrl(),
      availableActions: snapshot.backend?.availableActions ?? p0Actions,
      disabledActions: snapshot.backend?.disabledActions ?? [],
      connected: source === "backend",
      lastSyncedAt:
        source === "mock" ? snapshot.backend?.lastSyncedAt ?? "" : new Date().toISOString(),
    },
  };
}

function buildNoProjectSnapshot(currentSnapshot: WorkbenchSnapshot): WorkbenchSnapshot {
  const pages = Object.fromEntries(
    Object.entries(currentSnapshot.pages).map(([path, page]) => [
      path,
      {
        ...page,
        summary: "PostgreSQL 已连接，但当前库中尚无项目。请选择演示数据或上传合法 JSON。",
        primaryTask: "选择演示数据，创建真实 PostgreSQL 项目。",
        metrics: [
          metric("数据库", "已连接", "PostgreSQL health ok", "success"),
          metric("项目", 0, "allocation_project", "warning"),
          metric("数据来源", "真实 API", getApiBaseUrl(), "neutral"),
        ],
        preconditions: [
          {
            name: "项目",
            status: "BLOCKED",
            targetPath: "/data/ingestion",
            message: "尚未创建项目。",
          },
        ],
        rows: [],
        technicalDetails: {
          api_base_url: getApiBaseUrl(),
          project_id: "",
          menu_code: page.technicalDetails.menu_code ?? "",
          module_code: page.technicalDetails.module_code ?? "",
        },
      },
    ]),
  ) as unknown as WorkbenchSnapshot["pages"];

  return {
    ...currentSnapshot,
    projectName: "尚未加载项目",
    scenarioName: "PostgreSQL 已连接，等待创建项目",
    status: "DRAFT",
    updatedAt: new Date().toISOString(),
    mock: emptyWorkspaceState(),
    backend: {
      apiBaseUrl: getApiBaseUrl(),
      availableActions: p0Actions,
      disabledActions: [],
      connected: true,
      lastSyncedAt: new Date().toISOString(),
    },
    pages,
  };
}

function buildSnapshotFromP0(
  currentSnapshot: WorkbenchSnapshot,
  data: P0WorkspaceData,
): WorkbenchSnapshot {
  const status = data.status;
  if (!status) {
    return buildNoProjectSnapshot(currentSnapshot);
  }

  const mock = buildDerivedWorkspaceState(currentSnapshot.mock ?? workbenchSnapshot.mock, data);
  const pages = {
    ...currentSnapshot.pages,
    "/dashboard": buildOverviewPage(data),
    "/data/ingestion": buildPackagesPage(data),
    "/data/resources": buildResourcesPage(data),
    "/data/parties": buildPartiesPage(data),
    "/measure/quality": buildQualityPage(data),
    "/measure/shuyuan": buildShuyuanPage(data),
    "/measure/utility": buildUtilityPage(data),
    "/allocation/md-dshap": buildMDDShapPage(data),
    "/allocation/simulation": buildSimulationPage(data),
    "/allocation/constraints": buildConstraintsPage(data),
    "/reports": buildReportsPage(data),
    "/system/parameters": buildParametersPage(data),
    "/system/audit": buildAuditPage(data),
  };

  return {
    ...currentSnapshot,
    projectName: status.project.project_name,
    scenarioName: status.project.scenario_name,
    operator: "local_operator",
    status: toStatusCode(status.project.status),
    updatedAt: status.project.updated_at,
    mock,
    backend: {
      apiBaseUrl: getApiBaseUrl(),
      availableActions: p0Actions.filter(isActionId),
      disabledActions: [],
      connected: true,
      lastSyncedAt: new Date().toISOString(),
    },
    pages,
  };
}

function buildDerivedWorkspaceState(
  currentMock: MockWorkspaceState | undefined,
  data: P0WorkspaceData,
): MockWorkspaceState {
  const base = currentMock ?? createMockWorkspaceState();
  const reports = data.reports.map((item) => ({
    name: item.report_id,
    type: item.report_type,
    status: "已生成",
    createdAt: item.created_at,
    fieldScope: `checksum=${item.checksum}`,
  }));
  const exportSource = data.exportFiles.length
    ? data.exportFiles
    : data.reports.flatMap((report) => report.export_files);
  const exports = exportSource.map((file) => ({
      fileName: file.file_name || file.file_path,
      fileType: file.file_format || file.file_type,
      status: "已生成",
      createdAt: file.created_at,
      fieldScope: `checksum=${file.checksum}`,
    }));
  const auditLogs = data.auditLogs.map((item) => ({
    operation: item.operation_type,
    objectType: item.object_id,
    operator: "local_operator",
    status: item.status === "SUCCESS" ? "成功" : item.status,
    createdAt: item.created_at,
    summary: `${item.module_code}/${item.menu_code}`,
  }));
  const snapshots = snapshotRecords(data);
  const mdParticipants = (data.mdDshap?.participant_weight ?? []).map((item) => ({
    name: item.party_name,
    partyType: "DATA_PROVIDER" as const,
    contributionScore: numberValue(item.participant_weight),
    utilityValue: numberValue(item.normalized_weight),
    qualityFactor: 1,
    includeInMDDShap: true,
  }));
  const mdsWeights = (data.mdDshap?.participant_weight ?? []).map((item) => ({
    partyName: item.party_name,
    normalizedWeight: numberValue(item.normalized_weight),
    marginalContribution: numberValue(item.participant_weight),
    qualityFactor: 1,
    utilityValue: numberValue(item.normalized_weight),
    status: "后端已归一化",
  }));
  const mdsTraces = (data.mdDshap?.participant_weight ?? []).map((item, index) => ({
    coalition: index === 0 ? "{}" : "{前序参与方}",
    partyName: item.party_name,
    vBefore: 0,
    vAfter: numberValue(item.normalized_weight),
    marginalContribution: numberValue(item.weight_diff || item.participant_weight),
  }));
  const task = data.mdDshap ?? data.status?.md_dshap_task;
  const mdsTasks = task
    ? [
        {
          taskName: task.task_id,
          algorithmMode: task.algorithm_mode,
          status: task.status === "COMPLETED" ? "已完成" : task.status,
          progress: task.status === "COMPLETED" ? 100 : 50,
          seed: 42,
          sampleRounds: Number(task.sample_rounds) || 0,
          epsilon: numberValue(task.epsilon),
          saveMarginalDetail: true,
          createdAt:
            ("created_at" in task ? task.created_at : data.status?.md_dshap_task?.created_at) ??
            data.status?.project.updated_at ??
            "",
        },
      ]
    : base.mdsTasks.slice(0, 0);

  return {
    ...base,
    resources: resourceRecords(data),
    dataProviders: partiesFromSummaries(data),
    mdsParticipants: mdParticipants,
    mdsWeights,
    mdsTraces,
    mdsTasks,
    currentRevenuePool: numberValue(data.allocation?.data_revenue_pool ?? data.status?.allocation_scenario?.data_revenue_pool),
    reports,
    exports,
    auditLogs,
    snapshots,
  };
}

function emptyWorkspaceState(): MockWorkspaceState {
  return {
    ...createMockWorkspaceState(),
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
    currentRevenuePool: 0,
  };
}

function buildOverviewPage(data: P0WorkspaceData): PageWorkspaceData {
  const status = requireStatus(data);
  const latestReport = data.reports[0];
  const latestAudit = data.auditLogs[0];
  return {
    summary: "从真实 PostgreSQL API 聚合项目状态、阶段计数、报告和审计摘要。",
    primaryTask: primaryTaskForStatus(status.project.status),
    metrics: [
      metric("数据包", status.counts.data_package, "dvas.data_package", "neutral"),
      metric("数据资源", status.counts.data_resource, "dvas.data_resource", "success"),
      metric("参与方", status.counts.party, "dvas.party", "success"),
      metric("报告状态", status.counts.report_record, "dvas.report_record", "neutral"),
      metric("审计记录", status.counts.audit_log, "dvas.audit_log", "neutral"),
      metric("导出文件", status.counts.export_file, "checksum 必填", "neutral"),
    ],
    preconditions: buildPreconditions(data),
    rows: [
      {
        project_name: status.project.project_name,
        scenario_name: status.project.scenario_name,
        status: projectStatusLabel(status.project.status),
        current_package: status.current_package_id ?? "未接入",
        current_algorithm_task: status.current_algorithm_task_id ?? "待计算",
        current_allocation: status.current_allocation_id ?? "待生成",
        recent_report_type: latestReport?.report_type ?? "暂无报告",
        recent_report_time: latestReport?.created_at ?? "-",
        recent_audit: latestAudit?.operation_type ?? "暂无审计",
      },
    ],
    technicalDetails: baseTechnical(status, "NAV_SYS_HOME", "SYS"),
  };
}

function buildPackagesPage(data: P0WorkspaceData): PageWorkspaceData {
  const status = requireStatus(data);
  const dataPackage = status.data_package;
  const validation = status.upload_validation_latest;
  const rows: DataRow[] = dataPackage
    ? [
        {
          package_name: dataPackage.package_name,
          source_type: dataPackage.source_type,
          file_name: dataPackage.package_name,
          validation_status: dataPackage.status,
          access_status: status.project.status === "DRAFT" ? "未接入" : "已接入",
          resource_count: status.counts.data_resource,
          party_count: status.counts.party,
          created_at: dataPackage.created_at,
          error_field: validation?.is_valid === false ? validation.error_field ?? "body" : "无",
          repair_suggestion:
            validation?.is_valid === false
              ? validation.error_message ?? "按字段级错误修正 JSON 后重新上传。"
              : "成功后刷新真实项目状态；失败字段由后端错误返回。",
          validation_result_id: validation?.validation_result_id ?? "",
          detail_json: validation?.detail_json ? JSON.stringify(validation.detail_json) : "",
        },
      ]
    : [];
  return {
    summary: "数据接入页读取真实项目/数据包摘要；上传 JSON 和演示数据按钮调用真实写接口。",
    primaryTask: rows.length ? "检查最新数据包校验结果。" : "选择演示数据或上传合法 JSON。",
    metrics: [
      metric("数据包", status.counts.data_package, "真实 data_package 计数", "neutral"),
      metric("校验通过", validation?.is_valid === false ? 0 : status.counts.data_package, "可生成输入快照", validation?.is_valid === false ? "warning" : "success"),
      metric("校验失败", validation?.is_valid === false ? 1 : 0, "失败时后端返回字段级错误", validation?.is_valid === false ? "warning" : "neutral"),
      metric("输入快照", status.counts.input_snapshot, "dvas.input_snapshot", "success"),
    ],
    preconditions: buildPreconditions(data),
    rows,
    technicalDetails: baseTechnical(status, "NAV_DATA_PACKAGE", "DATA"),
  };
}

function buildResourcesPage(data: P0WorkspaceData): PageWorkspaceData {
  const status = requireStatus(data);
  const rows = data.resources.map((resource) => {
    const primaryProvider = resource.provider_parties.find((item) => item.is_primary_provider) ?? resource.provider_parties[0];
    return {
      resource_id: resource.resource_id,
      package_id: resource.package_id,
      resource_name: resource.resource_name,
      modality: resource.modality,
      field_count: resource.field_count,
      sample_count: resource.sample_count,
      missing_rate: formatWeight(resource.missing_rate),
      sensitive_field_count: resource.sensitive_field_count,
      provider_party: primaryProvider?.party_name ?? "未关联",
      party_id: primaryProvider?.party_id ?? "",
      split_ratio: primaryProvider ? formatWeight(primaryProvider.split_ratio) : "0.000000",
      include_in_calculation: resource.include_in_calculation ? "是" : "否",
      status: resource.status,
      field_summary: resource.fields.map((field) => field.field_name).join(", "),
      actual_field_count: resource.actual_field_count,
    };
  });
  return {
    summary: "资源页调用 /api/projects/:projectId/resources，展示真实资源、字段、模态、样本和主体关联摘要。",
    primaryTask: rows.length ? "检查资源字段、主体关联和计算纳入状态。" : "先完成数据接入。",
    metrics: [
      metric("资源总数", status.counts.data_resource, "真实计数", "neutral"),
      metric("当前数据包", status.current_package_id ?? "未接入", "project.current_package_id", "neutral"),
      metric("字段总数", data.resources.reduce((sum, item) => sum + Number(item.actual_field_count || item.field_count || 0), 0), "data_resource_field", "neutral"),
      metric("敏感字段", data.resources.reduce((sum, item) => sum + Number(item.sensitive_field_count || 0), 0), "不展示敏感原文", "warning"),
    ],
    preconditions: buildPreconditions(data),
    rows,
    technicalDetails: baseTechnical(status, "NAV_DATA_RESOURCE", "RES"),
  };
}

function buildPartiesPage(data: P0WorkspaceData): PageWorkspaceData {
  const status = requireStatus(data);
  const parties = partiesFromSummaries(data);
  const rows = data.parties.length
    ? data.parties.map((party) => ({
        party_id: party.party_id,
        party_name: party.party_name,
        party_type: party.party_type,
        is_data_provider: party.party_type === "DATA_PROVIDER" ? "是" : "否",
        include_in_md_dshap: party.include_in_md_dshap ? "是" : "否",
        linked_resource_count: party.linked_resource_count,
        status: party.status,
        contribution_summary: party.md_dshap_weight
          ? `weight=${formatWeight(party.md_dshap_weight.normalized_weight)}`
          : party.allocation_result
            ? `amount=${formatAmount(party.allocation_result.post_constraint_amount)}`
            : "待 pipeline",
        raw_weight: party.allocation_result ? formatWeight(party.allocation_result.raw_weight) : "0.000000",
        post_constraint_amount: party.allocation_result ? formatAmount(party.allocation_result.post_constraint_amount) : "0.00",
      }))
    : parties.map((party) => ({
        party_id: party.name,
        party_name: party.name,
        party_type: party.partyType,
        is_data_provider: party.partyType === "DATA_PROVIDER" ? "是" : "否",
        include_in_md_dshap: party.includeInMDDShap ? "是" : "否",
        linked_resource_count: party.linkedResourceCount,
        status: "真实摘要",
        contribution_summary: party.includeInMDDShap ? "来自 MD-DShap/分配摘要" : "非权重池主体或未返回",
      }));
  return {
    summary: "参与方页调用 /api/projects/:projectId/parties，展示真实参与方、权重池边界、资源关联和分配摘要。",
    primaryTask: parties.length ? "查看可追溯参与方摘要。" : "等待 pipeline 生成权重或分配摘要。",
    metrics: [
      metric("参与方", status.counts.party, "真实 party 计数", "neutral"),
      metric("数据源主体", data.parties.filter((item) => item.party_type === "DATA_PROVIDER").length, "进入 MD-DShap 候选", "success"),
      metric("权重池主体", data.parties.filter((item) => item.include_in_md_dshap).length, "include_in_md_dshap", "success"),
      metric("资源关联", data.parties.reduce((sum, item) => sum + Number(item.linked_resource_count || 0), 0), "真实 relation 计数", "neutral"),
    ],
    preconditions: buildPreconditions(data),
    rows,
    technicalDetails: baseTechnical(status, "NAV_DATA_PARTY", "PARTY"),
  };
}

function buildQualityPage(data: P0WorkspaceData): PageWorkspaceData {
  const status = requireStatus(data);
  const quality = data.quality?.assessment ?? status.quality_assessment_latest;
  const qualityEvidenceSummary = data.quality?.assessment?.evidence_summary ?? "真实质量明细";
  const details = data.quality?.details ?? [];
  return {
    summary: "质量评估页调用 /api/projects/:projectId/quality-summary，展示真实质量总分、等级、维度分和证据摘要。",
    primaryTask: quality ? "查看最新质量评估摘要。" : "先执行完整计算链路。",
    metrics: [
      metric("质量总分", quality?.quality_score ?? "待评估", "PostgreSQL quality_assessment", quality ? "success" : "warning"),
      metric("质量等级", quality?.quality_level ?? "待评估", "latest", quality ? "success" : "warning"),
      metric("质量因子", quality?.quality_factor ?? "待评估", "用于数元计量", quality ? "neutral" : "warning"),
      metric("维度明细", details.length, "quality_score_detail", details.length ? "success" : "warning"),
    ],
    preconditions: buildPreconditions(data),
    rows: details.map((item) => ({
      detail_id: item.detail_id,
      metric_name: item.metric_name,
      metric_weight: formatWeight(item.weight),
      score: item.score,
      total_score: quality?.quality_score ?? "待评估",
      quality_level: quality?.quality_level ?? "待评估",
      quality_factor: quality?.quality_factor ?? "待评估",
      evidence_summary: item.evidence_json ? JSON.stringify(item.evidence_json) : qualityEvidenceSummary,
      low_quality_warning: numberValue(item.score) < 80 ? "需关注" : "通过",
      assessment_id: quality?.assessment_id ?? "",
      metric_version: quality ? `v${quality.assessment_version_no}` : "",
    })),
    technicalDetails: {
      ...baseTechnical(status, "NAV_MEASURE_QUALITY", "QUAL"),
      assessment_id: quality?.assessment_id ?? "",
    },
  };
}

function buildShuyuanPage(data: P0WorkspaceData): PageWorkspaceData {
  const status = requireStatus(data);
  const fullMetering = data.shuyuan?.metering ?? null;
  const metering = fullMetering ?? status.shuyuan_metering_latest;
  const details = data.shuyuan?.details ?? [];
  return {
    summary: "数元计量页调用 /api/projects/:projectId/shuyuan-summary，展示真实基准价、系数、调用量、资源级计量金额。",
    primaryTask: metering ? "查看最新数元计量摘要。" : "先执行完整计算链路。",
    metrics: [
      metric("项目总计量金额", metering ? formatAmount(metering.total_amount) : "待计量", "保留 2 位", metering ? "success" : "warning"),
      metric("调用量", metering?.call_count_total ?? 0, "call_count_total", "neutral"),
      metric("计量版本", metering ? `v${metering.metering_version_no}` : "待计量", "latest", "neutral"),
      metric("计量明细", details.length, "shuyuan_metering_detail", details.length ? "success" : "warning"),
    ],
    preconditions: buildPreconditions(data),
    rows: details.map((item) => ({
      detail_id: item.detail_id,
      resource_id: item.resource_id,
      party_id: item.party_id,
      resource_name: item.resource_name,
      party_name: item.party_name,
      base_shuyuan_price: fullMetering ? formatAmount(fullMetering.base_shuyuan_price) : "待计量",
      scenario_coefficient: fullMetering ? formatWeight(fullMetering.scenario_coefficient) : "待计量",
      quality_coefficient: fullMetering ? formatWeight(fullMetering.quality_coefficient) : "待计量",
      technology_coefficient: fullMetering ? formatWeight(fullMetering.technology_coefficient) : "待计量",
      expert_coefficient: fullMetering ? formatWeight(fullMetering.expert_coefficient) : "待计量",
      development_coefficient: fullMetering ? formatWeight(fullMetering.development_coefficient) : "待计量",
      call_count: item.call_count,
      metering_amount: formatAmount(item.metering_amount),
    })),
    technicalDetails: {
      ...baseTechnical(status, "NAV_MEASURE_SHUYUAN", "DU"),
      metering_id: metering?.metering_id ?? "",
      assessment_id: metering?.assessment_id ?? "",
    },
  };
}

function buildUtilityPage(data: P0WorkspaceData): PageWorkspaceData {
  const status = requireStatus(data);
  const records = data.utility?.records ?? [];
  return {
    summary: "贡献度/效用页调用 /api/projects/:projectId/utility-summary，展示真实贡献度、归一化贡献、效用值和 trace 摘要。",
    primaryTask: status.counts.utility_record ? "查看贡献度与效用摘要。" : "先执行完整计算链路。",
    metrics: [
      metric("贡献记录", status.counts.contribution_record, "dvas.contribution_record", "neutral"),
      metric("效用记录", status.counts.utility_record, "dvas.utility_record", status.counts.utility_record ? "success" : "warning"),
      metric("trace 记录", data.utility?.traces.length ?? 0, "utility_trace", data.utility?.traces.length ? "success" : "warning"),
      metric("效用函数", data.utility?.utility_function?.utility_source ?? "待生成", "utility_function_snapshot", data.utility?.utility_function ? "success" : "warning"),
    ],
    preconditions: buildPreconditions(data),
    rows: records.map((item) => ({
      party_id: item.party_id,
      contribution_id: item.contribution_id ?? "",
      utility_id: item.utility_id ?? "",
      party_name: item.party_name,
      valid_units: item.valid_units,
      usage_weight: formatWeight(item.usage_weight),
      coverage_weight: formatWeight(item.coverage_weight),
      scarcity_weight: formatWeight(item.scarcity_weight),
      contribution_score: formatWeight(item.contribution_score),
      normalized_contribution: formatWeight(item.normalized_contribution),
      quality_factor: formatWeight(item.quality_factor),
      usage_factor: formatWeight(item.usage_factor),
      scenario_factor: formatWeight(item.scenario_factor),
      utility_value: formatWeight(item.utility_value),
      trace_id: `${item.trace_count} trace`,
    })),
    technicalDetails: baseTechnical(status, "NAV_MEASURE_UTILITY", "UTIL"),
  };
}

function buildMDDShapPage(data: P0WorkspaceData): PageWorkspaceData {
  const status = requireStatus(data);
  const md = data.mdDshap;
  const rows = md?.participant_weight ?? [];
  return {
    summary: "MD-DShap 页面调用 /api/projects/:projectId/md-dshap-summary，默认算法模式为 MD_DSHAP。",
    primaryTask: md ? "查看真实 MD-DShap 权重结果。" : "先执行完整计算链路。",
    metrics: [
      metric("算法模式", md?.algorithm_mode ?? "MD_DSHAP", "默认模式", "success"),
      metric("任务状态", md?.status ?? status.md_dshap_task?.status ?? "待计算", "md_dshap_task", md ? "success" : "warning"),
      metric("参与方权重", rows.length, "md_dshap_result", rows.length ? "success" : "warning"),
      metric("权重合计", md ? formatWeight(md.weight_sum) : "待计算", "目标 1.000000", md && Math.abs(numberValue(md.weight_sum) - 1) < 0.000001 ? "success" : "warning"),
      metric("审计快照", md?.audit_snapshot_exists ? "存在" : "待生成", "algorithm_audit_snapshot", md?.audit_snapshot_exists ? "success" : "warning"),
    ],
    preconditions: buildPreconditions(data),
    rows: rows.map((item) => ({
      algorithm_mode: md?.algorithm_mode ?? "MD_DSHAP",
      participant_set: rows.length,
      task_set: "P0_DETERMINISTIC_UTILITY",
      sample_rounds: md?.sample_rounds ?? status.md_dshap_task?.sample_rounds ?? 0,
      epsilon: formatWeight(md?.epsilon ?? status.md_dshap_task?.epsilon ?? 0),
      task_status: md?.status ?? status.md_dshap_task?.status ?? "待计算",
      party_name: item.party_name,
      participant_weight: formatWeight(item.participant_weight),
      normalized_weight: formatWeight(item.normalized_weight),
      marginal_contribution: formatWeight(item.weight_diff),
    })),
    technicalDetails: {
      ...baseTechnical(status, "NAV_ALLOC_MDS", "MDS"),
      task_id: md?.task_id ?? status.current_algorithm_task_id ?? "",
      algorithm_version: md?.algorithm_version ?? status.md_dshap_task?.algorithm_version ?? "",
      audit_snapshot_exists: md?.audit_snapshot_exists ? "true" : "false",
    },
  };
}

function buildSimulationPage(data: P0WorkspaceData): PageWorkspaceData {
  const status = requireStatus(data);
  const allocation = data.allocation;
  const rows = allocation?.allocations ?? [];
  return {
    summary: "收益分配页面调用 /api/projects/:projectId/allocation-summary，只展示后端金额，不在前端重算。",
    primaryTask: allocation ? "查看约束前后金额并确认模拟方案。" : "先执行完整计算链路。",
    metrics: [
      metric("总收益", allocation ? formatAmount(allocation.total_revenue) : "待生成", "后端 total_revenue", allocation ? "neutral" : "warning"),
      metric("数据源收益池", allocation ? formatAmount(allocation.data_revenue_pool) : "待生成", "后端 data_revenue_pool", allocation ? "success" : "warning"),
      metric("约束后合计", allocation ? formatAmount(allocation.post_constraint_amount_sum) : "待生成", "后端 post_constraint_amount_sum", allocation ? "success" : "warning"),
      metric("结果行", rows.length, "allocation_result", rows.length ? "success" : "warning"),
    ],
    preconditions: buildPreconditions(data),
    rows: rows.map((item) => ({
      total_revenue: formatAmount(allocation?.total_revenue),
      priority_allocation_amount: "由后端约束链路扣除",
      data_provider_revenue_pool: formatAmount(allocation?.data_revenue_pool),
      allocation_mode: "MD-DShap 权重分配",
      party_name: item.party_name,
      raw_weight: formatWeight(item.raw_weight),
      normalized_weight: formatWeight(item.raw_weight),
      pre_constraint_amount: formatAmount(item.pre_constraint_amount),
      post_constraint_amount: formatAmount(item.post_constraint_amount),
      adjustment_reason: "后端保存约束前/后金额",
      scenario_status: allocation?.status ?? status.project.status,
    })),
    technicalDetails: {
      ...baseTechnical(status, "NAV_ALLOC_SIMULATION", "ALLOC"),
      allocation_id: allocation?.allocation_id ?? status.current_allocation_id ?? "",
    },
  };
}

function buildConstraintsPage(data: P0WorkspaceData): PageWorkspaceData {
  const status = requireStatus(data);
  const constraints = data.constraints;
  const allocation = constraints?.allocation ?? data.allocation;
  const traceRows = constraints?.traces ?? [];
  return {
    summary: "合同约束页调用 /api/projects/:projectId/constraints-summary，展示真实优先分配、合同约束和约束执行 trace。",
    primaryTask: allocation ? "查看约束前后金额摘要。" : "先执行完整计算链路。",
    metrics: [
      metric("优先分配项", constraints?.priority_items.length ?? 0, "allocation_priority_item", constraints?.priority_items.length ? "success" : "warning"),
      metric("合同约束", constraints?.constraints.length ?? 0, "contract_constraint", constraints?.constraints.length ? "success" : "warning"),
      metric("执行 trace", traceRows.length, "constraint_apply_trace", traceRows.length ? "success" : "warning"),
      metric("检查结果", allocation ? "已应用" : "待计算", "约束前/后金额已保存", allocation ? "success" : "warning"),
    ],
    preconditions: buildPreconditions(data),
    rows: traceRows.map((item) => ({
      trace_id: item.trace_id,
      constraint_id: item.constraint_id ?? "",
      constraint_name: item.constraint_type ?? "约束执行",
      party_id: item.party_id,
      party_name: item.party_name,
      constraint_type: item.constraint_type ?? "PRIORITY_AMOUNT",
      value_type: "AMOUNT",
      constraint_value: formatAmount(item.adjustment_amount),
      priority: item.step_no,
      status: allocation?.status ?? "待计算",
      before_amount: formatAmount(item.before_amount),
      after_amount: formatAmount(item.after_amount),
      reason: item.reason,
    })),
    technicalDetails: {
      ...baseTechnical(status, "NAV_ALLOC_CONSTRAINT", "CONS"),
      allocation_id: allocation?.allocation_id ?? "",
    },
  };
}

function buildReportsPage(data: P0WorkspaceData): PageWorkspaceData {
  const status = requireStatus(data);
  const exportRows = data.exportFiles.length
    ? data.exportFiles.map((file) => ({
        report_id: file.report_id,
        file_id: file.file_id,
        report_type: "P0_EXPORT",
        report_status: "已生成",
        file_name: file.file_name,
        file_type: file.file_format || file.file_type,
        field_scope: file.file_type,
        generated_at: file.created_at,
        created_by: "local_operator",
        download_status: `checksum=${file.checksum}`,
        p1_pdf_boundary: "PDF 为 P1，不生成假 PDF",
        file_path: file.file_path,
        checksum: file.checksum,
      }))
    : data.reports.flatMap((report) =>
        (report.export_files.length ? report.export_files : [null]).map((file) => ({
          report_type: report.report_type,
          report_status: "已生成",
          file_name: file?.file_name ?? report.file_path,
          file_type: file?.file_format ?? file?.file_type ?? "REPORT",
          field_scope: `report_checksum=${report.checksum}`,
          generated_at: file?.created_at ?? report.created_at,
          created_by: "local_operator",
          download_status: file?.checksum ? `checksum=${file.checksum}` : `checksum=${report.checksum}`,
          p1_pdf_boundary: "PDF 为 P1，不生成假 PDF",
          report_id: report.report_id,
          file_id: file?.file_id ?? "",
          file_path: file?.file_path ?? report.file_path,
          checksum: file?.checksum ?? report.checksum,
        })),
      );
  const exportCount = exportRows.length;
  return {
    summary: "报告页调用 /api/reports?project_id=...，展示 report/export checksum；PDF 仍为 P1。",
    primaryTask: data.reports.length ? "查看真实报告与导出文件。" : "生成 P0 报告。",
    metrics: [
      metric("报告记录", data.reports.length, "report_record", "neutral"),
      metric("导出文件", exportCount, "export_file", "neutral"),
      metric("checksum", exportCount ? "已展示" : "待生成", "每个文件必填", exportCount ? "success" : "warning"),
      metric("PDF", "P1 禁用", "不生成假 PDF", "warning"),
    ],
    preconditions: buildPreconditions(data),
    rows: exportRows,
    technicalDetails: baseTechnical(status, "NAV_REPORT_EXPORT", "REP"),
  };
}

function buildParametersPage(data: P0WorkspaceData): PageWorkspaceData {
  const status = requireStatus(data);
  return {
    summary: "P0 参数页只展示只读说明；Phase 2C 不接完整参数编辑。",
    primaryTask: "查看 P0 只读运行参数边界。",
    metrics: [
      metric("算法模式", "MD_DSHAP", "默认模式", "success"),
      metric("PDF", "P1", "不实现", "warning"),
      metric("RBAC", "P1", "不实现", "warning"),
    ],
    preconditions: buildPreconditions(data),
    rows: [
      {
        parameter_group: "P0_ALGORITHM",
        parameter_name: "algorithm_mode",
        parameter_value: "MD_DSHAP",
        effective_status: "只读",
        version_no: "Phase 2C",
        updated_by: "local_operator",
        updated_at: status.project.updated_at,
        risk_disclaimer_text: "模拟参考，非法律结算",
      },
    ],
    technicalDetails: baseTechnical(status, "NAV_SYSTEM_PARAMETER", "PARAM"),
  };
}

function buildAuditPage(data: P0WorkspaceData): PageWorkspaceData {
  const status = requireStatus(data);
  return {
    summary: "审计页调用 /api/audit/logs?project_id=...&limit=50，展示真实 audit_log。",
    primaryTask: data.auditLogs.length ? "查看最近真实审计日志。" : "执行操作后生成审计记录。",
    metrics: [
      metric("最近日志", data.auditLogs.length, "默认 50 条", "neutral"),
      metric("失败日志", data.auditLogs.filter((item) => item.status !== "SUCCESS").length, "失败原因保留", "warning"),
      metric("快照记录", status.counts.snapshot_store, "snapshot_store 计数", "neutral"),
      metric("导出记录", status.counts.export_file, "export_file 计数", "neutral"),
    ],
    preconditions: buildPreconditions(data),
    rows: data.auditLogs.map((item) => ({
      operation_type: item.operation_type,
      object_type: item.object_type ?? item.object_id,
      operator_id: item.operator_id ?? "local_operator",
      module_code_display: item.module_code,
      menu_code_display: item.menu_code,
      status: item.status,
      failure_reason: item.failure_reason ?? (item.status === "SUCCESS" ? "无" : "见后端日志"),
      created_at: item.created_at,
      report_type: item.checksum ? `checksum=${item.checksum}` : item.object_id,
      log_id: item.log_id,
      object_id: item.object_id,
      input_snapshot_id: item.input_snapshot_id ?? "",
      parameter_snapshot_id: item.parameter_snapshot_id ?? "",
      output_snapshot_id: item.result_snapshot_id ?? "",
    })),
    technicalDetails: baseTechnical(status, "NAV_SYSTEM_AUDIT", "AUD"),
  };
}

function buildPreconditions(data: P0WorkspaceData): PreconditionItem[] {
  const status = requireStatus(data);
  return [
    precondition("输入快照", status.counts.input_snapshot > 0, "/data/ingestion", "需要完成演示数据或 JSON 接入。"),
    precondition("质量评估", status.counts.quality_assessment > 0, "/measure/quality", "执行完整计算链路后生成。"),
    precondition("数元计量", status.counts.shuyuan_metering > 0, "/measure/shuyuan", "执行完整计算链路后生成。"),
    precondition("效用计算", status.counts.utility_record > 0, "/measure/utility", "执行完整计算链路后生成。"),
    precondition("MD-DShap 权重", Number(status.md_dshap_result.result_count) > 0, "/allocation/md-dshap", "权重结果必须真实写库。"),
    precondition("收益分配", status.counts.allocation_result > 0, "/allocation/simulation", "分配结果必须包含约束前后金额。"),
    precondition("报告导出", status.counts.report_record > 0 && status.counts.export_file > 0, "/reports", "生成 Markdown/CSV/JSON/JSONL 报告。"),
  ];
}

function precondition(
  name: string,
  passed: boolean,
  targetPath: PreconditionItem["targetPath"],
  blockedMessage: string,
): PreconditionItem {
  return {
    name,
    status: passed ? "PASS" : "BLOCKED",
    targetPath,
    message: passed ? "已通过真实 PostgreSQL 数据检查。" : blockedMessage,
  };
}

function partiesFromSummaries(data: P0WorkspaceData) {
  const byName = new Map<
    string,
    {
      name: string;
      partyType: "DATA_PROVIDER" | "SERVICE_PROVIDER" | "OPERATOR";
      includeInMDDShap: boolean;
      linkedResourceCount: number;
    }
  >();
  for (const item of data.parties) {
    byName.set(item.party_name, {
      name: item.party_name,
      partyType:
        item.party_type === "OPERATOR" ? "OPERATOR" : item.party_type === "DATA_PROVIDER" ? "DATA_PROVIDER" : "SERVICE_PROVIDER",
      includeInMDDShap: item.include_in_md_dshap,
      linkedResourceCount: item.linked_resource_count,
    });
  }
  for (const item of data.mdDshap?.participant_weight ?? []) {
    byName.set(item.party_name, {
      name: item.party_name,
      partyType: "DATA_PROVIDER",
      includeInMDDShap: true,
      linkedResourceCount: 0,
    });
  }
  for (const item of data.allocation?.allocations ?? []) {
    if (!byName.has(item.party_name)) {
      byName.set(item.party_name, {
        name: item.party_name,
        partyType:
          item.party_type === "OPERATOR" ? "OPERATOR" : item.party_type === "DATA_PROVIDER" ? "DATA_PROVIDER" : "SERVICE_PROVIDER",
        includeInMDDShap: item.party_type === "DATA_PROVIDER",
        linkedResourceCount: 0,
      });
    }
  }
  return Array.from(byName.values());
}

function resourceRecords(data: P0WorkspaceData) {
  return data.resources.map((resource) => {
    const provider = resource.provider_parties.find((item) => item.is_primary_provider) ?? resource.provider_parties[0];
    return {
      resourceKey: resource.resource_id,
      name: resource.resource_name,
      modality: resource.modality,
      fieldCount: Number(resource.field_count) || 0,
      sampleCount: Number(resource.sample_count) || 0,
      missingRate: numberValue(resource.missing_rate),
      sensitiveFieldCount: Number(resource.sensitive_field_count) || 0,
      includeInCalculation: resource.include_in_calculation,
      providerName: provider?.party_name ?? "未关联",
      splitRatio: numberValue(provider?.split_ratio, 0),
      status: resource.status,
      fieldStats: resource.fields.slice(0, 4).map((field) => ({
        label: field.field_name,
        value: `${field.field_type ?? "UNKNOWN"} / 缺失率 ${formatWeight(field.missing_rate)}`,
      })),
      previewRows: [],
      technicalDetails: {
        resource_id: resource.resource_id,
        package_id: resource.package_id,
        provider_party: provider?.party_name ?? "",
        include_in_calculation: resource.include_in_calculation ? "是" : "否",
        field_count: resource.field_count,
        actual_field_count: resource.actual_field_count,
        sample_count: resource.sample_count,
        sensitive_field_count: resource.sensitive_field_count,
      },
    };
  });
}

function snapshotRecords(data: P0WorkspaceData) {
  const status = requireStatus(data);
  const records = [
    {
      name: "输入快照",
      type: "INPUT",
      status: status.counts.input_snapshot ? "已生成" : "待生成",
      createdAt: status.project.updated_at,
    },
    {
      name: "阶段输出快照",
      type: "OUTPUT",
      status: status.counts.snapshot_store ? "已生成" : "待生成",
      createdAt: status.project.updated_at,
    },
    {
      name: "报告输出快照",
      type: "REPORT_OUTPUT",
      status: status.counts.report_record ? "已生成" : "待生成",
      createdAt: status.project.updated_at,
    },
  ];
  return records;
}

function chooseProject(projects: ProjectListItem[], preferredProjectId?: string) {
  if (preferredProjectId) {
    const preferred = projects.find((item) => item.project_id === preferredProjectId);
    if (preferred) {
      return preferred;
    }
  }
  return [...projects].sort((left, right) =>
    String(right.updated_at || right.created_at).localeCompare(String(left.updated_at || left.created_at)),
  )[0];
}

function projectIdFromSnapshot(snapshot: WorkbenchSnapshot) {
  const value = snapshot.pages["/dashboard"]?.technicalDetails.project_id;
  return typeof value === "string" ? value : "";
}

function projectIdFromMutation(value: unknown) {
  const result = value as Partial<WriteResult> | undefined;
  return result && typeof result.project_id === "string" ? result.project_id : undefined;
}

function requireStatus(data: P0WorkspaceData) {
  if (!data.status) {
    throw new Error("PostgreSQL 项目状态未加载");
  }
  return data.status;
}

function baseTechnical(status: ProjectStatusSummary, menuCode: string, moduleCode: string) {
  return {
    project_id: status.project.project_id,
    current_package_id: status.current_package_id ?? "",
    current_algorithm_task_id: status.current_algorithm_task_id ?? "",
    current_allocation_id: status.current_allocation_id ?? "",
    menu_code: menuCode,
    module_code: moduleCode,
  };
}

function primaryTaskForStatus(status: string) {
  if (status === "DRAFT") {
    return "选择演示数据或上传 JSON。";
  }
  if (status === "INGESTED") {
    return "启动完整计算链路。";
  }
  if (status === "ALLOCATED") {
    return "确认分配方案或生成报告。";
  }
  if (status === "CONFIRMED") {
    return "生成报告。";
  }
  if (status === "EXPORTED") {
    return "查看报告和审计记录。";
  }
  return "查看项目阶段状态。";
}

function formatBackendError(error: ApiError | undefined) {
  if (!error) {
    return "建议：确认后端服务已启动后重试。";
  }
  const detail = error.detail ? ` ${error.detail}` : "";
  const field = error.errorField ? ` 字段：${error.errorField}` : "";
  const suggestion = error.repairSuggestion ? ` 建议：${error.repairSuggestion}` : "";
  return `${error.errorMessage}${field}${detail}${suggestion}`;
}

function numberValue(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function toStatusCode(value: string): StatusCode {
  if (
    [
      "DRAFT",
      "INGESTED",
      "ASSESSED",
      "METERED",
      "UTILITY_CALCULATED",
      "WEIGHT_CALCULATED",
      "ALLOCATED",
      "CONFIRMED",
      "EXPORTED",
    ].includes(value)
  ) {
    return value as StatusCode;
  }
  return "DRAFT";
}

function metric(
  label: string,
  value: string | number,
  hint: string,
  tone: MetricItem["tone"],
): MetricItem {
  const formattedValue = typeof value === "number" ? formatCount(value) : value;
  return { label, value: formattedValue, hint, tone };
}

function isActionId(value: string): value is ActionId {
  return value in actionRegistry;
}

export function backendStatusLabel(value: string) {
  return projectStatusLabel(value);
}
