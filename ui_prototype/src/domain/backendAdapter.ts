import { actionRegistry } from "./actionRegistry";
import {
  ApiClientError,
  dvasApi,
  getApiBaseUrl,
  type BackendDashboardOverview,
  type BackendDataPackage,
  type BackendDataResource,
  type BackendParty,
  type BackendPrecondition,
  type BackendPreconditions,
  type BackendQualityAssessment,
  type BackendQualityDetail,
} from "./apiClient";
import { workbenchSnapshot } from "./mockData";
import { getStatusIndex, projectStatusLabels } from "./status";
import type {
  ActionId,
  DataRow,
  MetricItem,
  PageWorkspaceData,
  PreconditionItem,
  RoutePath,
  WorkbenchSnapshot,
} from "./types";

interface BackendWorkspacePayload {
  overview: BackendDashboardOverview;
  preconditions: BackendPreconditions;
  packages: BackendDataPackage[];
  resources: BackendDataResource[];
  parties: BackendParty[];
  qualityAssessment: BackendQualityAssessment | null;
  qualityDetails: BackendQualityDetail[];
}

const preconditionLabels: Record<
  string,
  { name: string; targetPath?: RoutePath }
> = {
  HAS_VALID_DATA_PACKAGE: {
    name: "输入快照",
    targetPath: "/data/packages",
  },
  HAS_RESOURCE_PARTY_RELATION: {
    name: "资源主体关系",
    targetPath: "/data/resources",
  },
  HAS_QUALITY_ASSESSMENT: {
    name: "质量评估",
    targetPath: "/measure/quality",
  },
  HAS_SHUYUAN_METERING: {
    name: "数元计量",
    targetPath: "/measure/shuyuan",
  },
  HAS_CONTRIBUTION_RECORDS: {
    name: "贡献度计算",
    targetPath: "/measure/utility",
  },
  HAS_UTILITY_RESULT: {
    name: "效用计算",
    targetPath: "/measure/utility",
  },
};

export async function loadWorkbenchSnapshotFromBackend(): Promise<WorkbenchSnapshot> {
  const [overview, preconditions, packages, resources, parties] = await Promise.all([
    dvasApi.getDashboardOverview(),
    dvasApi.getDashboardPreconditions(),
    dvasApi.listPackages(),
    dvasApi.listResources(),
    dvasApi.listParties(),
  ]);
  const quality =
    getStatusIndex(overview.project_status) >= getStatusIndex("ASSESSED")
      ? await loadQualityIfPresent()
      : null;

  return buildSnapshotFromBackend({
    overview,
    preconditions,
    packages: packages.items,
    resources: resources.items,
    parties: parties.items,
    qualityAssessment: quality?.assessment ?? null,
    qualityDetails: quality?.details ?? [],
  });
}

async function loadQualityIfPresent() {
  try {
    const assessment = await dvasApi.getLatestQualityAssessment();
    return dvasApi.getQualityDetails(assessment.assessment_id);
  } catch (error) {
    if (error instanceof ApiClientError && error.code === "DVAS_NOT_FOUND") {
      return null;
    }
    throw error;
  }
}

function buildSnapshotFromBackend(payload: BackendWorkspacePayload): WorkbenchSnapshot {
  const pages = {
    ...workbenchSnapshot.pages,
    "/dashboard": buildOverviewPage(payload),
    "/data/packages": buildPackagesPage(payload),
    "/data/resources": buildResourcesPage(payload),
    "/data/parties": buildPartiesPage(payload),
    "/measure/quality": buildQualityPage(payload),
  };

  return {
    projectName: payload.overview.project_name,
    scenarioName: payload.overview.scenario_name,
    operator: payload.overview.operator_id,
    status: payload.overview.project_status,
    updatedAt: formatDateTime(payload.overview.updated_at),
    backend: {
      apiBaseUrl: getApiBaseUrl(),
      availableActions: toActionIds(payload.preconditions.available_actions),
      disabledActions: payload.preconditions.disabled_actions,
      connected: true,
      lastSyncedAt: new Date().toISOString(),
    },
    pages,
  };
}

function buildOverviewPage(payload: BackendWorkspacePayload): PageWorkspaceData {
  const packageName =
    payload.packages.find((item) => item.package_id === payload.overview.current_package_id)
      ?.package_name ?? "未接入";

  return {
    summary: "从后端聚合项目状态、数据接入、参与方和下一步动作。",
    primaryTask: payload.overview.next_step.label,
    metrics: overviewMetrics(payload.overview),
    preconditions: toPreconditions(payload.preconditions.preconditions),
    rows: [
      {
        project_name: payload.overview.project_name,
        scenario_name: payload.overview.scenario_name,
        status: projectStatusLabels[payload.overview.project_status],
        current_package: packageName,
        current_algorithm_task:
          payload.overview.project_status === "ASSESSED" ? "质量评估已运行" : "待质量评估",
        current_allocation: "未启动",
        recent_report_type: "P0 暂未生成",
        recent_report_time: "-",
      },
    ],
    technicalDetails: {
      project_id: payload.overview.project_id,
      current_package_id: payload.overview.current_package_id ?? "",
      input_snapshot_id: payload.overview.current_input_snapshot_id ?? "",
      menu_code: "NAV_SYS_HOME",
      module_code: "SYS",
    },
  };
}

function buildProcessPage(payload: BackendWorkspacePayload): PageWorkspaceData {
  return {
    summary: "由后端项目状态驱动完整链路入口，当前只开放数据接入和质量评估。",
    primaryTask: payload.overview.next_step.label,
    metrics: overviewMetrics(payload.overview),
    preconditions: toPreconditions(payload.preconditions.preconditions),
    rows: [
      {
        workflow_step: "数据接入",
        step_status:
          payload.overview.project_status === "DRAFT" ? "待处理" : "通过",
        blocker: payload.overview.project_status === "DRAFT" ? "缺少有效数据包" : "无",
        next_module: "数据管理",
        next_action: "选择演示数据",
        last_updated: formatDateTime(payload.overview.updated_at),
      },
      {
        workflow_step: "质量评估",
        step_status:
          payload.overview.project_status === "INGESTED" ? "可执行" : "待满足前置条件",
        blocker:
          payload.overview.project_status === "DRAFT" ? "缺少有效数据包" : "无",
        next_module: "数元贡献度计量",
        next_action: "运行质量评估",
        last_updated: formatDateTime(payload.overview.updated_at),
      },
    ],
    technicalDetails: {
      project_id: payload.overview.project_id,
      snapshot_type: "PROJECT_STATUS",
      menu_code: "NAV_SYS_HOME",
      module_code: "SYS",
    },
  };
}

function buildOneClickPage(payload: BackendWorkspacePayload): PageWorkspaceData {
  const blocked = payload.preconditions.preconditions.find((item) => !item.passed);

  return {
    summary: "一键计算入口只读取后端前置条件，未开放后续收益分配计算。",
    primaryTask: blocked ? blocked.message : "前置条件已满足，可进入质量评估。",
    metrics: [
      {
        label: "通过检查",
        value: String(payload.preconditions.preconditions.filter((item) => item.passed).length),
        hint: "来自 /dashboard/preconditions",
        tone: blocked ? "warning" : "success",
      },
      {
        label: "当前状态",
        value: projectStatusLabels[payload.overview.project_status],
        hint: "由后端项目状态驱动",
        tone: payload.overview.project_status === "DRAFT" ? "warning" : "success",
      },
      {
        label: "后续能力",
        value: "BE-04",
        hint: "MD-DShap 与分配未启动",
        tone: "neutral",
      },
    ],
    preconditions: toPreconditions(payload.preconditions.preconditions),
    rows: payload.preconditions.preconditions.map((item) => ({
      precondition_name: preconditionLabels[item.code]?.name ?? item.code,
      check_result: item.passed ? "通过" : "阻塞",
      failed_stage: item.passed ? "无" : item.message,
      run_mode: "同步本地演示",
      algorithm_mode: "未进入 MD-DShap",
      pipeline_stage: payload.overview.next_step.label,
      stage_status: projectStatusLabels[payload.overview.project_status],
    })),
    technicalDetails: {
      project_id: payload.overview.project_id,
      menu_code: "NAV_SYS_HOME",
      module_code: "SYS",
    },
  };
}

function buildPackagesPage(payload: BackendWorkspacePayload): PageWorkspaceData {
  const invalidCount = payload.packages.filter((item) => item.status !== "VALIDATED").length;

  return {
    summary: "数据包列表来自后端，演示数据初始化和 JSON 上传会生成新包与输入快照。",
    primaryTask:
      payload.packages.length === 0 ? "选择演示数据或上传 JSON。" : "检查最新数据包校验结果。",
    metrics: [
      {
        label: "数据包",
        value: String(payload.packages.length),
        hint: "来自 /data-packages",
        tone: "neutral",
      },
      {
        label: "有效数据包",
        value: String(payload.overview.metrics.data_package_count),
        hint: "VALIDATED 状态",
        tone: payload.overview.metrics.data_package_count > 0 ? "success" : "warning",
      },
      {
        label: "校验失败",
        value: String(invalidCount),
        hint: "可查看失败详情",
        tone: invalidCount > 0 ? "warning" : "success",
      },
    ],
    preconditions: toPreconditions(payload.preconditions.preconditions),
    rows: payload.packages.map((item) => ({
      package_name: item.package_name,
      source_type: sourceTypeLabel(item.source_type),
      file_name: item.file_name ?? "-",
      validation_status: packageStatusLabel(item.status),
      access_status: item.status === "VALIDATED" ? "已接入" : "待修复",
      resource_count: payload.resources.filter(
        (resource) => resource.package_id === item.package_id,
      ).length,
      party_count: payload.parties.length,
      created_at: formatDateTime(item.created_at),
      error_field: item.status === "VALIDATED" ? "无" : "见校验结果",
      repair_suggestion:
        item.status === "VALIDATED" ? "可进入资源管理" : "按失败字段修复后重新上传",
      package_id: item.package_id,
      input_snapshot_id: item.input_snapshot_id ?? "",
      checksum: item.checksum ?? "",
    })),
    technicalDetails: {
      project_id: payload.overview.project_id,
      current_package_id: payload.overview.current_package_id ?? "",
      input_snapshot_id: payload.overview.current_input_snapshot_id ?? "",
      menu_code: "NAV_DATA_PACKAGE",
      module_code: "DATA",
    },
  };
}

function buildResourcesPage(payload: BackendWorkspacePayload): PageWorkspaceData {
  const unboundCount = payload.resources.filter((item) => !item.party_id).length;

  return {
    summary: "数据资源列表来自后端，主体绑定由 BE-03 写接口维护。",
    primaryTask:
      unboundCount > 0 ? "补齐资源与数据源主体关系。" : "资源主体关系已满足质量评估前置条件。",
    metrics: [
      {
        label: "资源",
        value: String(payload.resources.length),
        hint: "来自 /data-resources",
        tone: "neutral",
      },
      {
        label: "已绑定主体",
        value: String(payload.resources.length - unboundCount),
        hint: "party_id 已写入",
        tone: unboundCount > 0 ? "warning" : "success",
      },
      {
        label: "当前数据包",
        value: payload.overview.current_package_id ? "已选择" : "未选择",
        hint: "由项目 current_package_id 驱动",
        tone: payload.overview.current_package_id ? "success" : "warning",
      },
    ],
    preconditions: toPreconditions(payload.preconditions.preconditions),
    rows: payload.resources.map((item) => ({
      resource_name: item.resource_name,
      modality: modalityLabel(item.modality),
      field_count: item.field_count,
      sample_count: item.sample_count,
      missing_rate: "待质量评估",
      sensitive_field_count: 0,
      provider_party: item.provider_party_name ?? "待绑定",
      split_ratio: splitRatioLabel(item),
      include_in_calculation: item.status === "ACTIVE" ? "是" : "否",
      status: item.status === "ACTIVE" ? "有效" : item.status,
      resource_id: item.resource_id,
      package_id: item.package_id,
      party_id: item.party_id ?? "",
      updated_at: formatDateTime(item.updated_at),
    })),
    technicalDetails: {
      project_id: payload.overview.project_id,
      current_package_id: payload.overview.current_package_id ?? "",
      menu_code: "NAV_DATA_RESOURCE",
      module_code: "RES",
    },
  };
}

function buildPartiesPage(payload: BackendWorkspacePayload): PageWorkspaceData {
  const dataProviderCount = payload.parties.filter(
    (item) => item.party_type === "DATA_PROVIDER",
  ).length;
  const mdDshapCount = payload.parties.filter((item) => item.include_in_md_dshap).length;

  return {
    summary: "参与方列表来自后端，非数据主体默认不进入 MD-DShap 权重层。",
    primaryTask: "维护数据源主体与非数据贡献主体边界。",
    metrics: [
      {
        label: "参与方",
        value: String(payload.parties.length),
        hint: "来自 /parties",
        tone: "neutral",
      },
      {
        label: "数据源主体",
        value: String(dataProviderCount),
        hint: "DATA_PROVIDER",
        tone: dataProviderCount > 0 ? "success" : "warning",
      },
      {
        label: "进入权重池",
        value: String(mdDshapCount),
        hint: "仅作为权重层候选",
        tone: "success",
      },
    ],
    preconditions: toPreconditions(payload.preconditions.preconditions),
    rows: payload.parties.map((item) => ({
      party_name: item.party_name,
      party_type: partyTypeLabel(item.party_type),
      is_data_provider: item.party_type === "DATA_PROVIDER" ? "是" : "否",
      include_in_md_dshap: item.include_in_md_dshap ? "是" : "否",
      linked_resource_count: linkedResourceCount(item.party_id, payload.resources),
      status: item.status === "ENABLED" ? "有效" : "停用",
      contribution_summary: item.include_in_md_dshap
        ? "数据贡献主体，进入权重层候选"
        : "非数据贡献主体，合同优先或约束处理",
      party_id: item.party_id,
      updated_at: formatDateTime(item.updated_at),
    })),
    technicalDetails: {
      project_id: payload.overview.project_id,
      menu_code: "NAV_DATA_PARTY",
      module_code: "PARTY",
    },
  };
}

function buildQualityPage(payload: BackendWorkspacePayload): PageWorkspaceData {
  const assessment = payload.qualityAssessment;

  return {
    summary: "质量评估结果来自 BE-04 骨架，运行会生成新评估记录和结果快照。",
    primaryTask: assessment ? "查看最新质量评估详情。" : "完成数据接入后运行质量评估。",
    metrics: [
      {
        label: "总分",
        value: assessment ? String(assessment.quality_score) : "待运行",
        hint: assessment ? `质量等级 ${assessment.quality_level}` : "等待 QUAL-003",
        tone: assessment ? "success" : "warning",
      },
      {
        label: "详情指标",
        value: String(payload.qualityDetails.length),
        hint: "质量维度明细",
        tone: payload.qualityDetails.length > 0 ? "success" : "neutral",
      },
      {
        label: "算法版本",
        value: assessment?.algorithm_version ?? "待生成",
        hint: "BE-04 骨架",
        tone: "neutral",
      },
      {
        label: "质量因子",
        value: assessment ? assessment.quality_factor.toFixed(4) : "待生成",
        hint: "供 BE-05 计量与效用使用",
        tone: assessment ? "success" : "neutral",
      },
    ],
    preconditions: toPreconditions(payload.preconditions.preconditions),
    rows: payload.qualityDetails.map((item) => ({
      metric_name: item.dimension_name,
      metric_weight: percentLabel(item.weight),
      score: item.score,
      total_score: assessment?.quality_score ?? 0,
      quality_level: assessment?.quality_level ?? "-",
      quality_factor: assessment?.quality_factor.toFixed(4) ?? "-",
      evidence_summary: item.evidence,
      low_quality_warning: item.score < 80 ? "需关注" : "无",
      assessment_id: assessment?.assessment_id ?? "",
      detail_id: item.detail_id,
      metric_version: assessment ? String(assessment.version_no) : "",
      input_snapshot_id: assessment?.input_snapshot_id ?? "",
      parameter_snapshot_id: assessment?.parameter_snapshot_id ?? "",
      output_snapshot_id: assessment?.output_snapshot_id ?? "",
      algorithm_version: assessment?.algorithm_version ?? "",
      created_at: assessment ? formatDateTime(assessment.created_at) : "-",
    })),
    technicalDetails: {
      project_id: payload.overview.project_id,
      assessment_id: assessment?.assessment_id ?? "",
      metric_version: assessment ? String(assessment.version_no) : "",
      input_snapshot_id: assessment?.input_snapshot_id ?? "",
      parameter_snapshot_id: assessment?.parameter_snapshot_id ?? "",
      output_snapshot_id: assessment?.output_snapshot_id ?? "",
      algorithm_version: assessment?.algorithm_version ?? "",
      menu_code: "NAV_MEASURE_QUALITY",
      module_code: "QUAL",
    },
  };
}

function overviewMetrics(overview: BackendDashboardOverview): MetricItem[] {
  return [
    {
      label: "有效数据包",
      value: String(overview.metrics.data_package_count),
      hint: "VALIDATED",
      tone: overview.metrics.data_package_count > 0 ? "success" : "warning",
    },
    {
      label: "数据资源",
      value: String(overview.metrics.resource_count),
      hint: "已识别资源数",
      tone: overview.metrics.resource_count > 0 ? "success" : "neutral",
    },
    {
      label: "参与方",
      value: String(overview.metrics.party_count),
      hint: "当前项目参与主体",
      tone: overview.metrics.party_count > 0 ? "success" : "neutral",
    },
  ];
}

function toPreconditions(items: BackendPrecondition[]): PreconditionItem[] {
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

function toActionIds(values: string[]): ActionId[] {
  return values.filter((value): value is ActionId => value in actionRegistry);
}

function linkedResourceCount(partyId: string, resources: BackendDataResource[]) {
  return resources.filter(
    (item) =>
      item.party_id === partyId ||
      item.party_relations?.some((relation) => relation.party_id === partyId),
  ).length;
}

function splitRatioLabel(resource: BackendDataResource) {
  const primaryRelation = resource.party_relations?.find(
    (relation) => relation.is_primary_provider,
  );
  if (primaryRelation) {
    return percentLabel(primaryRelation.split_ratio);
  }
  return resource.party_id ? "100%" : "0%";
}

function percentLabel(value: number) {
  return `${Math.round(value * 100)}%`;
}

function sourceTypeLabel(value: string) {
  if (value === "DEMO") {
    return "演示数据";
  }
  if (value === "UPLOAD") {
    return "JSON 上传";
  }
  return value;
}

function packageStatusLabel(value: string) {
  if (value === "VALIDATED") {
    return "通过";
  }
  if (value === "INVALID") {
    return "失败";
  }
  return value;
}

function modalityLabel(value: string) {
  const labels: Record<string, string> = {
    TABULAR: "结构化",
    TEXT: "文本",
    IMAGE: "影像",
    FEATURE: "特征",
  };
  return labels[value] ?? value;
}

function partyTypeLabel(value: string) {
  const labels: Record<string, string> = {
    DATA_PROVIDER: "数据提供方",
    OPERATOR: "运营服务方",
    TECH_SERVICE: "技术服务方",
    EXPERT: "专家服务方",
  };
  return labels[value] ?? value;
}

function formatDateTime(value: string) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatApiError(error: unknown) {
  if (error instanceof ApiClientError) {
    const fieldMessage = error.fieldErrors
      .map((item) => `${item.field}: ${item.reason}`)
      .join("；");
    return fieldMessage ? `${error.message}（${fieldMessage}）` : error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "未知错误";
}
