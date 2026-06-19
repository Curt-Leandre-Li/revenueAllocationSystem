import { projectStatusLabels } from "../status";
import type {
  AuditLogRecord,
  DataProviderOption,
  DataRow,
  ExportFileRecord,
  ReportRecord,
  ResourceInventoryRecord,
  StatusCode,
} from "../types";

export type BackendPrimitive = string | number | boolean | null;
export type BackendRecord = Record<string, unknown>;

export interface BackendProjectDto extends BackendRecord {
  project_id: string;
  project_name: string;
  scenario_name: string;
  project_status: string;
  operator_id: string;
  current_package_id?: string | null;
  current_input_snapshot_id?: string | null;
  current_algorithm_task_id?: string | null;
  current_allocation_id?: string | null;
  updated_at: string;
  simulation_disclaimer?: string;
}

export interface BackendPreconditionDto extends BackendRecord {
  code: string;
  passed: boolean;
  message: string;
}

export interface BackendDisabledActionDto extends BackendRecord {
  button_code: string;
  reason: string;
}

export interface BackendNavigationMenuDto extends BackendRecord {
  menu_id: string;
  parent_id?: string | null;
  menu_code: string;
  menu_name: string;
  module_code: string;
  route_path: string;
  sort_no: number;
  p0_required?: boolean;
  p1_only?: boolean;
  status?: string;
  children?: BackendNavigationMenuDto[];
}

export interface BackendDashboardSummaryDto extends BackendProjectDto {
  metrics: BackendRecord;
  risk_notices: string[];
  next_step: { label: string; button_code: string };
  preconditions: BackendPreconditionDto[];
  available_actions: string[];
  disabled_actions: BackendDisabledActionDto[];
}

export interface BackendDataPackageDto extends BackendRecord {
  package_id: string;
  package_name: string;
  source_type: string;
  file_name?: string | null;
  status: string;
  file_size?: number | null;
  validation_result_id?: string | null;
  input_snapshot_id?: string | null;
  checksum?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface BackendUploadValidationResultDto extends BackendRecord {
  validation_result_id: string;
  package_id: string;
  status: string;
  error_field?: string | null;
  repair_suggestion?: string | null;
  field_errors?: Array<{ field: string; reason: string }>;
  created_at?: string;
}

export interface BackendResourcePartyRelationDto extends BackendRecord {
  relation_id?: string;
  resource_id?: string;
  party_id: string;
  party_name?: string;
  split_ratio: number;
  is_primary_provider?: boolean;
}

export interface BackendDataResourceFieldDto extends BackendRecord {
  field_name: string;
  field_type?: string;
  missing_rate?: number;
  sensitive_level?: string;
  sample_preview?: string;
}

export interface BackendDataResourceDto extends BackendRecord {
  resource_id: string;
  package_id: string;
  resource_name: string;
  modality: string;
  field_count: number;
  sample_count: number;
  missing_rate?: number;
  sensitive_field_count?: number;
  include_in_calculation?: boolean;
  party_id?: string | null;
  provider_party_name?: string | null;
  party_relations?: BackendResourcePartyRelationDto[];
  fields?: BackendDataResourceFieldDto[];
  status: string;
  updated_at: string;
}

export interface BackendPartyDto extends BackendRecord {
  party_id: string;
  party_name: string;
  party_type: string;
  include_in_md_dshap: boolean;
  status: string;
  description?: string | null;
  updated_at: string;
}

export interface BackendReportRecordDto extends BackendRecord {
  report_id: string;
  project_id: string;
  report_type: string;
  file_name?: string;
  file_format?: string;
  checksum?: string;
  created_at: string;
  export_file_ids?: string[];
  simulation_disclaimer?: string;
}

export interface BackendConstraintDto extends BackendRecord {
  constraint_id: string;
  party_id: string;
  party_name: string;
  constraint_name: string;
  constraint_type: string;
  value_type: string;
  constraint_value: number;
  priority: number;
  status: string;
  version_no: number;
  updated_at: string;
}

export interface BackendSystemParameterDto extends BackendRecord {
  parameter_code: string;
  parameter_name: string;
  parameter_type: string;
  default_value: unknown;
  current_value: unknown;
  scope: string;
  editable: boolean;
  version_no: number;
  updated_at: string;
}

export interface BackendExportFileDto extends BackendRecord {
  export_file_id: string;
  report_id: string;
  project_id: string;
  file_name: string;
  file_format: string;
  checksum?: string;
  byte_size?: number;
  created_at: string;
  simulation_disclaimer?: string;
}

export interface BackendAuditLogDto extends BackendRecord {
  log_id: string;
  project_id: string;
  module_code: string;
  menu_code: string;
  operation_type: string;
  object_type: string;
  object_id?: string | null;
  operator_id: string;
  status: string;
  failure_reason?: string | null;
  input_snapshot_id?: string | null;
  parameter_snapshot_id?: string | null;
  result_snapshot_id?: string | null;
  created_at: string;
}

export interface BackendAuditLogDetailDto extends BackendRecord {
  audit_log: BackendAuditLogDto;
  snapshot_refs: Array<{
    field: string;
    snapshot_id: string;
    available: boolean;
  }>;
  snapshots: Record<string, BackendRecord>;
  empty_state?: string | null;
}

export interface ProjectModel {
  projectId: string;
  projectName: string;
  scenarioName: string;
  status: StatusCode;
  operatorId: string;
  currentPackageId: string | null;
  currentInputSnapshotId: string | null;
  updatedAt: string;
  simulationDisclaimer: string;
}

export interface DashboardSummaryModel extends ProjectModel {
  metrics: {
    dataPackageCount: number;
    resourceCount: number;
    partyCount: number;
    reportCount: number;
    exportFileCount: number;
    auditLogCount: number;
  };
  riskNotices: string[];
  nextStep: { label: string; buttonCode: string };
  preconditions: BackendPreconditionDto[];
  availableActions: string[];
  disabledActions: BackendDisabledActionDto[];
}

export interface DataPackageModel {
  packageId: string;
  packageName: string;
  sourceType: string;
  sourceTypeLabel: string;
  fileName: string;
  fileSize: number;
  status: string;
  statusLabel: string;
  validationResultId: string;
  inputSnapshotId: string;
  checksum: string;
  createdAt: string;
  updatedAt: string;
}

export interface DataResourceModel extends ResourceInventoryRecord {
  resourceId: string;
  packageId: string;
  partyId: string;
  updatedAt: string;
  relations: ResourcePartyRelationModel[];
}

export interface ResourceFieldModel {
  fieldName: string;
  fieldType: string;
  missingRate: number;
  missingRateLabel: string;
  sensitiveLevel: string;
  samplePreview: string;
}

export interface PartyModel {
  partyId: string;
  partyName: string;
  partyType: BackendPartyDto["party_type"];
  partyTypeLabel: string;
  includeInMdDshap: boolean;
  status: string;
  statusLabel: string;
  updatedAt: string;
}

export interface ResourcePartyRelationModel {
  relationId: string;
  resourceId: string;
  partyId: string;
  partyName: string;
  splitRatio: number;
  splitRatioLabel: string;
  isPrimaryProvider: boolean;
}

export interface ReportModel extends ReportRecord {
  reportId: string;
  reportType: string;
  checksum: string;
  exportFileIds: string[];
}

export interface ExportFileModel extends ExportFileRecord {
  exportFileId: string;
  reportId: string;
  checksum: string;
  byteSize: number;
}

export interface AuditLogModel extends AuditLogRecord {
  logId: string;
  moduleCode: string;
  menuCode: string;
  objectId: string;
  failureReason: string;
}

export interface ConstraintModel {
  constraintId: string;
  partyId: string;
  partyName: string;
  constraintName: string;
  constraintType: string;
  constraintTypeLabel: string;
  valueType: string;
  constraintValue: string;
  priority: number;
  status: string;
  statusLabel: string;
  versionNo: number;
  updatedAt: string;
}

export interface SystemParameterModel {
  parameterCode: string;
  parameterName: string;
  parameterType: string;
  currentValue: string;
  defaultValue: string;
  scope: string;
  editable: boolean;
  versionNo: number;
  updatedAt: string;
}

const statusCodes: StatusCode[] = [
  "DRAFT",
  "INGESTED",
  "ASSESSED",
  "METERED",
  "UTILITY_CALCULATED",
  "WEIGHT_CALCULATED",
  "ALLOCATED",
  "CONFIRMED",
  "EXPORTED",
];

export function mapProjectStatus(value: unknown): StatusCode {
  return statusCodes.includes(value as StatusCode) ? (value as StatusCode) : "DRAFT";
}

export function mapProjectDto(dto: BackendProjectDto): ProjectModel {
  return {
    projectId: stringValue(dto.project_id),
    projectName: stringValue(dto.project_name, "未命名项目"),
    scenarioName: stringValue(dto.scenario_name, "默认场景"),
    status: mapProjectStatus(dto.project_status),
    operatorId: stringValue(dto.operator_id, "local_operator"),
    currentPackageId: nullableString(dto.current_package_id),
    currentInputSnapshotId: nullableString(dto.current_input_snapshot_id),
    updatedAt: formatDateTime(dto.updated_at),
    simulationDisclaimer: stringValue(dto.simulation_disclaimer, "结果仅作模拟参考。"),
  };
}

export function mapDashboardSummaryDto(dto: BackendDashboardSummaryDto): DashboardSummaryModel {
  const project = mapProjectDto(dto);
  const metrics = recordValue(dto.metrics);

  return {
    ...project,
    metrics: {
      dataPackageCount: numberValue(metrics.data_package_count),
      resourceCount: numberValue(metrics.resource_count),
      partyCount: numberValue(metrics.party_count),
      reportCount: numberValue(metrics.report_count),
      exportFileCount: numberValue(metrics.export_file_count),
      auditLogCount: numberValue(metrics.audit_log_count),
    },
    riskNotices: stringArray(dto.risk_notices),
    nextStep: {
      label: stringValue(dto.next_step?.label, "查看下一步"),
      buttonCode: stringValue(dto.next_step?.button_code),
    },
    preconditions: arrayValue(dto.preconditions).map((item) =>
      item as BackendPreconditionDto,
    ),
    availableActions: stringArray(dto.available_actions),
    disabledActions: arrayValue(dto.disabled_actions).map((item) =>
      item as BackendDisabledActionDto,
    ),
  };
}

export function mapDataPackageDto(dto: BackendDataPackageDto): DataPackageModel {
  return {
    packageId: stringValue(dto.package_id),
    packageName: stringValue(dto.package_name, "未命名数据包"),
    sourceType: stringValue(dto.source_type),
    sourceTypeLabel: sourceTypeLabel(dto.source_type),
    fileName: stringValue(dto.file_name, "-"),
    fileSize: numberValue(dto.file_size),
    status: stringValue(dto.status),
    statusLabel: packageStatusLabel(dto.status),
    validationResultId: stringValue(dto.validation_result_id),
    inputSnapshotId: stringValue(dto.input_snapshot_id),
    checksum: stringValue(dto.checksum),
    createdAt: formatDateTime(dto.created_at),
    updatedAt: formatDateTime(dto.updated_at ?? dto.created_at),
  };
}

export function mapUploadValidationResultDto(
  dto: BackendUploadValidationResultDto,
) {
  return {
    validationResultId: stringValue(dto.validation_result_id),
    packageId: stringValue(dto.package_id),
    status: stringValue(dto.status),
    statusLabel: packageStatusLabel(dto.status),
    errorField: stringValue(dto.error_field),
    repairSuggestion: stringValue(dto.repair_suggestion),
    fieldErrors: arrayValue(dto.field_errors).map((item) => item as BackendRecord),
    createdAt: formatDateTime(dto.created_at ?? ""),
  };
}

export function mapDataResourceDto(dto: BackendDataResourceDto): DataResourceModel {
  const relations = arrayValue(dto.party_relations).map((item) =>
    mapResourcePartyRelationDto(item as BackendResourcePartyRelationDto, dto.resource_id),
  );
  const missingRate = numberValue(dto.missing_rate);
  const includeInCalculation =
    typeof dto.include_in_calculation === "boolean"
      ? dto.include_in_calculation
      : stringValue(dto.status) === "ACTIVE";
  const providerName =
    stringValue(dto.provider_party_name) ||
    relations.find((item) => item.isPrimaryProvider)?.partyName ||
    "未关联";

  return {
    resourceId: stringValue(dto.resource_id),
    packageId: stringValue(dto.package_id),
    partyId: stringValue(dto.party_id),
    updatedAt: formatDateTime(dto.updated_at),
    resourceKey: stringValue(dto.resource_id),
    name: stringValue(dto.resource_name, "未命名资源"),
    modality: modalityLabel(dto.modality),
    fieldCount: numberValue(dto.field_count),
    sampleCount: numberValue(dto.sample_count),
    missingRate,
    sensitiveFieldCount: numberValue(dto.sensitive_field_count),
    includeInCalculation,
    providerName,
    splitRatio: relations[0]?.splitRatio ?? (providerName === "未关联" ? 0 : 100),
    status: resourceStatusLabel(dto.status, includeInCalculation, providerName),
    relations,
    fieldStats: [
      { label: "字段数", value: String(numberValue(dto.field_count)) },
      { label: "样本数", value: String(numberValue(dto.sample_count)) },
      { label: "缺失率", value: percentLabel(missingRate) },
      { label: "敏感字段", value: String(numberValue(dto.sensitive_field_count)) },
    ],
    previewRows: [],
    technicalDetails: {
      resource_id: stringValue(dto.resource_id),
      package_id: stringValue(dto.package_id),
      party_id: stringValue(dto.party_id),
      updated_at: formatDateTime(dto.updated_at),
    },
  };
}

export function mapDataResourceFieldDto(dto: BackendDataResourceFieldDto): ResourceFieldModel {
  const missingRate = numberValue(dto.missing_rate);
  return {
    fieldName: stringValue(dto.field_name),
    fieldType: stringValue(dto.field_type, "UNKNOWN"),
    missingRate,
    missingRateLabel: percentLabel(missingRate),
    sensitiveLevel: stringValue(dto.sensitive_level, "未标记"),
    samplePreview: stringValue(dto.sample_preview, "已脱敏"),
  };
}

export function mapPartyDto(dto: BackendPartyDto): PartyModel {
  return {
    partyId: stringValue(dto.party_id),
    partyName: stringValue(dto.party_name, "未命名参与方"),
    partyType: stringValue(dto.party_type),
    partyTypeLabel: partyTypeLabel(dto.party_type),
    includeInMdDshap: Boolean(dto.include_in_md_dshap),
    status: stringValue(dto.status),
    statusLabel: partyStatusLabel(dto.status),
    updatedAt: formatDateTime(dto.updated_at),
  };
}

export function mapResourcePartyRelationDto(
  dto: BackendResourcePartyRelationDto,
  fallbackResourceId = "",
): ResourcePartyRelationModel {
  const splitRatio = normalizeRatioToPercent(dto.split_ratio);
  return {
    relationId: stringValue(dto.relation_id),
    resourceId: stringValue(dto.resource_id, fallbackResourceId),
    partyId: stringValue(dto.party_id),
    partyName: stringValue(dto.party_name, stringValue(dto.party_id, "数据源主体")),
    splitRatio,
    splitRatioLabel: `${splitRatio}%`,
    isPrimaryProvider: Boolean(dto.is_primary_provider),
  };
}

export function mapReportRecordDto(dto: BackendReportRecordDto): ReportModel {
  const fileFormat = stringValue(dto.file_format, reportTypeLabel(dto.report_type));
  return {
    reportId: stringValue(dto.report_id),
    reportType: stringValue(dto.report_type),
    checksum: stringValue(dto.checksum),
    exportFileIds: stringArray(dto.export_file_ids),
    name: reportTypeLabel(dto.report_type),
    type: fileFormat,
    status: "已生成",
    createdAt: formatDateTime(dto.created_at),
    fieldScope: stringValue(
      dto.simulation_disclaimer,
      "模拟参考，非法律结算；工程字段仅用于审计追溯。",
    ),
  };
}

export function mapExportFileDto(dto: BackendExportFileDto): ExportFileModel {
  return {
    exportFileId: stringValue(dto.export_file_id),
    reportId: stringValue(dto.report_id),
    checksum: stringValue(dto.checksum),
    byteSize: numberValue(dto.byte_size),
    fileName: stringValue(dto.file_name),
    fileType: stringValue(dto.file_format),
    status: "已生成",
    createdAt: formatDateTime(dto.created_at),
    fieldScope: stringValue(dto.simulation_disclaimer, "模拟参考，非法律结算。"),
  };
}

export function mapAuditLogDto(dto: BackendAuditLogDto): AuditLogModel {
  return {
    logId: stringValue(dto.log_id),
    moduleCode: stringValue(dto.module_code),
    menuCode: stringValue(dto.menu_code),
    objectId: stringValue(dto.object_id),
    failureReason: stringValue(dto.failure_reason),
    operation: operationLabel(dto.operation_type),
    objectType: objectTypeLabel(dto.object_type),
    operator: stringValue(dto.operator_id, "local_operator"),
    status: auditStatusLabel(dto.status),
    createdAt: formatDateTime(dto.created_at),
    summary: stringValue(dto.failure_reason) || `${operationLabel(dto.operation_type)}已记录`,
  };
}

export function mapConstraintDto(dto: BackendConstraintDto): ConstraintModel {
  return {
    constraintId: stringValue(dto.constraint_id),
    partyId: stringValue(dto.party_id),
    partyName: stringValue(dto.party_name, "未命名参与方"),
    constraintName: stringValue(dto.constraint_name, "未命名约束"),
    constraintType: stringValue(dto.constraint_type),
    constraintTypeLabel: constraintTypeLabel(dto.constraint_type),
    valueType: stringValue(dto.value_type),
    constraintValue: formatParameterValue(dto.constraint_value),
    priority: numberValue(dto.priority),
    status: stringValue(dto.status),
    statusLabel: constraintStatusLabel(dto.status),
    versionNo: numberValue(dto.version_no, 1),
    updatedAt: formatDateTime(dto.updated_at),
  };
}

export function mapSystemParameterDto(dto: BackendSystemParameterDto): SystemParameterModel {
  return {
    parameterCode: stringValue(dto.parameter_code),
    parameterName: stringValue(dto.parameter_name, "未命名参数"),
    parameterType: stringValue(dto.parameter_type),
    currentValue: formatParameterValue(dto.current_value),
    defaultValue: formatParameterValue(dto.default_value),
    scope: stringValue(dto.scope),
    editable: Boolean(dto.editable),
    versionNo: numberValue(dto.version_no, 1),
    updatedAt: formatDateTime(dto.updated_at),
  };
}

export function mapPartyToProviderOption(party: PartyModel, linkedResourceCount: number): DataProviderOption {
  return {
    name: party.partyName,
    partyType: party.partyType === "DATA_PROVIDER" ? "DATA_PROVIDER" : "SERVICE_PROVIDER",
    includeInMDDShap: party.includeInMdDshap,
    linkedResourceCount,
  };
}

export function mapDataResourceToRow(resource: DataResourceModel): DataRow {
  return {
    resource_name: resource.name,
    modality: resource.modality,
    field_count: resource.fieldCount,
    sample_count: resource.sampleCount,
    missing_rate: percentLabel(resource.missingRate),
    sensitive_field_count: resource.sensitiveFieldCount,
    provider_party: resource.providerName,
    split_ratio: `${resource.splitRatio}%`,
    include_in_calculation: resource.includeInCalculation ? "是" : "否",
    status: resource.status,
  };
}

export function toCamelCaseRecord(record: BackendRecord): BackendRecord {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [snakeToCamel(key), value]),
  );
}

export function toSnakeCaseRecord(record: BackendRecord): BackendRecord {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [camelToSnake(key), value]),
  );
}

export function formatAmount(value: unknown) {
  return numberValue(value).toFixed(2);
}

export function formatWeight(value: unknown) {
  return numberValue(value).toFixed(6);
}

export function formatCoefficient(value: unknown) {
  return numberValue(value).toFixed(6);
}

export function formatDateTime(value: unknown) {
  const raw = stringValue(value);
  if (!raw) {
    return "-";
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
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

export function projectStatusLabel(value: unknown) {
  return projectStatusLabels[mapProjectStatus(value)];
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

function nullableString(value: unknown) {
  const mapped = stringValue(value);
  return mapped || null;
}

function numberValue(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function recordValue(value: unknown): BackendRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as BackendRecord)
    : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringArray(value: unknown) {
  return arrayValue(value).map((item) => stringValue(item)).filter(Boolean);
}

function normalizeRatioToPercent(value: unknown) {
  const numeric = numberValue(value);
  return numeric <= 1 ? Math.round(numeric * 100) : Math.round(numeric);
}

function percentLabel(value: unknown) {
  const numeric = numberValue(value);
  const percent = numeric <= 1 ? numeric * 100 : numeric;
  return `${percent.toFixed(2)}%`;
}

function sourceTypeLabel(value: unknown) {
  const labels: Record<string, string> = {
    DEMO: "演示数据",
    UPLOAD: "JSON 上传",
  };
  return labels[stringValue(value)] ?? stringValue(value, "未知来源");
}

function packageStatusLabel(value: unknown) {
  const labels: Record<string, string> = {
    VALIDATED: "通过",
    INVALID: "失败",
    DISABLED: "已停用",
  };
  return labels[stringValue(value)] ?? stringValue(value, "待校验");
}

function modalityLabel(value: unknown) {
  const labels: Record<string, string> = {
    TABULAR: "结构化",
    TEXT: "文本",
    IMAGE: "影像",
    FEATURE: "特征",
  };
  return labels[stringValue(value)] ?? stringValue(value, "未知模态");
}

function resourceStatusLabel(value: unknown, includeInCalculation: boolean, providerName: string) {
  if (includeInCalculation && providerName === "未关联") {
    return "阻断";
  }
  if (!includeInCalculation) {
    return "不进入计算";
  }
  const labels: Record<string, string> = {
    ACTIVE: "有效",
    INACTIVE: "停用",
  };
  return labels[stringValue(value)] ?? stringValue(value, "待处理");
}

function partyTypeLabel(value: unknown) {
  const labels: Record<string, string> = {
    DATA_PROVIDER: "数据提供方",
    OPERATOR: "运营服务方",
    TECH_SERVICE: "技术服务方",
    SERVICE_PROVIDER: "服务提供方",
    EXPERT: "专家服务方",
  };
  return labels[stringValue(value)] ?? stringValue(value, "其他主体");
}

function partyStatusLabel(value: unknown) {
  const labels: Record<string, string> = {
    ENABLED: "有效",
    DISABLED: "停用",
  };
  return labels[stringValue(value)] ?? stringValue(value, "待确认");
}

function constraintTypeLabel(value: unknown) {
  const labels: Record<string, string> = {
    MIN_AMOUNT: "最小金额",
    MAX_AMOUNT: "最大金额",
    CAP_AMOUNT: "封顶金额",
    FLOOR_AMOUNT: "保底金额",
    FIXED_RATIO: "固定比例",
    PRIORITY_ALLOCATION: "优先分配",
  };
  return labels[stringValue(value)] ?? stringValue(value, "未知约束");
}

function constraintStatusLabel(value: unknown) {
  const labels: Record<string, string> = {
    ACTIVE: "启用",
    DISABLED: "停用",
  };
  return labels[stringValue(value)] ?? stringValue(value, "待确认");
}

function reportTypeLabel(value: unknown) {
  const labels: Record<string, string> = {
    P0_MARKDOWN_REPORT: "P0 模拟参考报告",
    P0_CSV_EXPORT: "CSV 明细导出",
    P0_JSON_EXPORT: "JSON 结果导出",
    P0_AUDIT_LOG_EXPORT: "审计日志导出",
  };
  return labels[stringValue(value)] ?? stringValue(value, "报告记录");
}

function auditStatusLabel(value: unknown) {
  const labels: Record<string, string> = {
    SUCCESS: "成功",
    FAILED: "失败",
  };
  return labels[stringValue(value)] ?? stringValue(value, "已记录");
}

function operationLabel(value: unknown) {
  const labels: Record<string, string> = {
    INITIALIZE_DEMO: "选择演示数据",
    INITIALIZE_DEMO_CASE: "初始化演示数据",
    UPLOAD_JSON: "上传 JSON 数据包",
    READ_PROJECT: "读取项目状态",
    READ_DASHBOARD: "读取系统首页",
    READ_DATA_PACKAGE: "读取数据包",
    READ_DATA_RESOURCE: "读取数据资源",
    READ_PARTY: "读取参与方",
    READ_REPORT: "读取报告记录",
    READ_AUDIT_LOG: "读取审计日志",
    CREATE_PARTY: "新增参与方",
    UPDATE_PARTY: "编辑参与方",
    DISABLE_PARTY: "停用参与方",
    BIND_RESOURCE_PARTY: "绑定资源主体",
    UPDATE_RESOURCE_CALCULATION: "更新资源计算设置",
    RUN_QUALITY_ASSESSMENT: "运行质量评估",
    RUN_SHUYUAN_METERING: "运行数元计量",
    RUN_CONTRIBUTION: "运行贡献度计算",
    RUN_UTILITY: "运行效用计算",
    RUN_FULL_PIPELINE: "执行完整链路计算",
    RUN_MD_DSHAP: "启动 MD-DShap 计算",
    RERUN_MD_DSHAP: "重新计算 MD-DShap",
    VIEW_MD_DSHAP_TRACE: "查看边际贡献明细",
    CREATE_ALLOCATION_SCENARIO: "创建收益分配方案",
    SIMULATE_ALLOCATION: "执行收益分配模拟",
    LOCK_ALLOCATION: "锁定参考方案",
    APPLY_CONSTRAINT: "应用合同约束",
    GENERATE_REPORT: "生成报告",
    GENERATE_MARKDOWN_REPORT: "导出 Markdown 报告",
    GENERATE_CSV_EXPORT: "导出 CSV 明细",
    GENERATE_JSON_EXPORT: "导出 JSON 结果",
    EXPORT_RESOURCE_SUMMARY: "导出资源摘要",
    EXPORT_AUDIT_LOG: "导出审计日志",
    UPDATE_PARAMETER: "更新系统参数",
    RESTORE_DEFAULT: "恢复默认参数",
  };
  const key = stringValue(value);
  return labels[key] ?? "已记录操作";
}

function objectTypeLabel(value: unknown) {
  const labels: Record<string, string> = {
    PROJECT: "项目",
    DATA_PACKAGE: "数据包",
    DATA_RESOURCE: "数据资源",
    RESOURCE_FIELD: "资源字段",
    PARTY: "参与方",
    RESOURCE_PARTY_RELATION: "资源主体关系",
    QUALITY_ASSESSMENT: "质量评估",
    SHUYUAN_METERING: "数元计量",
    UTILITY_RESULT: "效用计算结果",
    MD_DSHAP_TASK: "MD-DShap 任务",
    MD_DSHAP_RESULT: "MD-DShap 权重结果",
    MD_DSHAP_TRACE: "边际贡献明细",
    ALLOCATION_SCENARIO: "收益分配方案",
    ALLOCATION_RESULT: "收益分配结果",
    CONSTRAINT_RULE: "合同约束",
    REPORT_RECORD: "报告记录",
    EXPORT_FILE: "导出文件",
    AUDIT_LOG: "审计日志",
    PARAMETER: "系统参数",
    USER: "用户",
    project: "项目",
    data_package: "数据包",
    data_resource: "数据资源",
    party: "参与方",
    resource_party_relation: "资源主体关系",
    report_record: "报告记录",
    export_file: "导出文件",
    audit_log: "审计日志",
  };
  const key = stringValue(value);
  return labels[key] ?? "业务对象";
}

function formatParameterValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function snakeToCamel(value: string) {
  return value.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

function camelToSnake(value: string) {
  return value.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}
