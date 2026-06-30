export type Phase = "P0" | "P1" | "P0/P1";

export type ModuleCode =
  | "SYS"
  | "DATA"
  | "RES"
  | "PARTY"
  | "QUAL"
  | "DU"
  | "UTIL"
  | "MDS"
  | "ALLOC"
  | "CONS"
  | "REP"
  | "PARAM"
  | "USER"
  | "AUD";

export type PermissionCode =
  | "VIEW"
  | "CREATE"
  | "UPDATE"
  | "DELETE_DISABLE"
  | "CALCULATE"
  | "CONFIRM"
  | "EXPORT";

export type StatusCode =
  | "DRAFT"
  | "INGESTED"
  | "ASSESSED"
  | "METERED"
  | "UTILITY_CALCULATED"
  | "WEIGHT_CALCULATED"
  | "ALLOCATED"
  | "CONFIRMED"
  | "EXPORTED";

export type CheckStatus = "PASS" | "BLOCKED" | "PENDING";

export type RoutePath =
  | "/dashboard"
  | "/data/ingestion"
  | "/data/resources"
  | "/data/parties"
  | "/metering/quality"
  | "/metering/shuyuan"
  | "/metering/utility"
  | "/allocation/md-dshap"
  | "/allocation/simulation"
  | "/allocation/constraints"
  | "/reports"
  | "/system/parameters"
  | "/system/users"
  | "/system/audit";

export type ActionId =
  | "SYS-002"
  | "SYS-004"
  | "SYS-005"
  | "DATA-002"
  | "DATA-003"
  | "DATA-007"
  | "DATA-008"
  | "DATA-009"
  | "DATA-010"
  | "DATA-011"
  | "DATA-012"
  | "RES-002"
  | "RES-005"
  | "RES-007"
  | "PARTY-002"
  | "PARTY-003"
  | "PARTY-005"
  | "PARTY-006"
  | "PARTY-008"
  | "QUAL-002"
  | "QUAL-003"
  | "QUAL-006"
  | "QUAL-009"
  | "DU-002"
  | "DU-003"
  | "DU-009"
  | "DU-010"
  | "UTIL-001"
  | "UTIL-006"
  | "UTIL-007"
  | "UTIL-008"
  | "UTIL-009"
  | "PARAM-001"
  | "PARAM-002"
  | "PARAM-004"
  | "PARAM-008"
  | "MDS-011"
  | "MDS-012"
  | "MDS-013"
  | "MDS-014"
  | "MDS-015"
  | "MDS-016"
  | "MDS-017"
  | "MDS-018"
  | "MDS-019"
  | "ALLOC-003"
  | "ALLOC-005"
  | "ALLOC-007"
  | "ALLOC-011"
  | "ALLOC-013"
  | "ALLOC-014"
  | "ALLOC-015"
  | "ALLOC-016"
  | "CONS-002"
  | "CONS-003"
  | "CONS-004"
  | "CONS-011"
  | "REP-001"
  | "REP-002"
  | "REP-003"
  | "REP-004"
  | "REP-005"
  | "REP-006"
  | "REP-009"
  | "REP-010"
  | "REP-011"
  | "REP-012"
  | "USER-001"
  | "USER-002"
  | "USER-003"
  | "USER-004"
  | "USER-005"
  | "USER-007"
  | "USER-008"
  | "USER-009"
  | "USER-010"
  | "USER-011"
  | "AUD-002"
  | "AUD-006"
  | "AUD-007";

export type DataRow = Record<string, string | number | boolean>;

export type ActionPayload =
  | {
      kind: "data-package-upload";
      file: File;
      fileName: string;
    }
  | {
      kind: "data-package-delete";
      packageId: string;
      packageName: string;
    }
  | {
      kind: "data-package-template-import";
      file: File;
      fileName: string;
      templateType: "CSV" | "XLSX";
    }
  | {
      kind: "download-file";
      fileName?: string;
      reportId?: string;
      exportFileId?: string;
    }
  | {
      kind: "job-cancel";
      jobId: string;
    }
  | {
      kind: "user-update";
      userId?: string;
      username?: string;
      displayName?: string;
      status?: string;
      roles?: string[];
      password?: string;
    }
  | {
      kind: "resource-binding";
      resourceKey: string;
      providerName: string;
      splitRatio: number;
    }
  | {
      kind: "resource-calculation-toggle";
      resourceKey: string;
      includeInCalculation: boolean;
    }
  | {
      kind: "resource-detail";
      resourceKey: string;
    }
  | {
      kind: "quality-weights";
      items: Array<{
        metricCode: string;
        weight: number;
      }>;
    }
  | {
      kind: "shuyuan-parameters";
      basePrice?: number;
      scenarioCoefficient?: number;
      technologyCoefficient?: number;
      expertCoefficient?: number;
      developmentCoefficient?: number;
    }
  | {
      kind: "shuyuan-call-counts";
      callCounts: Record<string, number>;
    }
  | {
      kind: "contribution-factors";
      usageWeight?: number;
      coverageWeight?: number;
      scarcityWeight?: number;
    }
  | {
      kind: "utility-function";
      payload: Record<string, unknown>;
    }
  | {
      kind: "mds-parameters";
      seed: number;
      sampleRounds: number;
      epsilon: number;
      saveMarginalDetail: boolean;
    }
  | {
      kind: "mds-audit-export";
      taskId?: string;
    }
  | {
      kind: "party-upsert";
      partyId?: string;
      partyName: string;
      partyType: string;
      includeInMdDshap: boolean;
      creditCode?: string;
      contactName?: string;
      description?: string;
    }
  | {
      kind: "party-status";
      partyId: string;
      status: "ENABLED" | "DISABLED";
      reason?: string;
    }
  | {
      kind: "constraint-upsert";
      constraintId?: string;
      partyId: string;
      constraintName: string;
      constraintType: string;
      valueType: string;
      constraintValue: number;
      priority: number;
      status?: "ACTIVE" | "DISABLED";
      description?: string;
    }
  | {
      kind: "constraint-status";
      constraintId: string;
      status: "ACTIVE" | "DISABLED";
      description?: string;
    }
  | {
      kind: "contract-ratio-save";
      totalRevenue: string;
      currency: string;
      dataProviderPoolRatio: string;
      items: Array<{
        bucketType: "NON_DATA_PARTY";
        partyId: string;
        ratio: string;
        basisText?: string;
      }>;
    }
  | {
      kind: "contract-ratio-clear";
    }
  | {
      kind: "parameter-update";
      values: Array<{
        parameterCode: string;
        currentValue: string | number | boolean;
      }>;
    }
  | {
      kind: "parameter-restore";
      parameterCode: string;
    }
  | {
      kind: "allocation-revenue-pool";
      totalRevenue: number;
      priorityAllocationAmount?: number;
      currency?: string;
    }
  | {
      kind: "allocation-priority-items";
      items: Array<{
        partyId: string;
        valueType?: string;
        priorityAmount?: number;
        priorityRatio?: number;
        capAmount?: number;
        basisText?: string;
        priorityOrder?: number;
      }>;
    }
  | {
      kind: "allocation-mode";
      allocationMode: string;
    }
  | {
      kind: "allocation-run";
      totalRevenue?: number;
      priorityAllocationAmount?: number;
      allocationMode?: string;
    }
  | {
      kind: "none";
    };

export type ActionHandlerName =
  | "DashboardService.handleAction"
  | "DataPackageService.handleAction"
  | "ResourceService.handleAction"
  | "PartyService.handleAction"
  | "QualityService.handleAction"
  | "ShuyuanService.handleAction"
  | "UtilityService.handleAction"
  | "MDDShapService.handleAction"
  | "AllocationService.handleAction"
  | "ConstraintService.handleAction"
  | "ReportService.handleAction"
  | "ParameterService.handleAction"
  | "UserService.handleAction"
  | "AuditService.handleAction";

export interface FieldDefinition {
  key: string;
  label: string;
  technical: boolean;
  visibleInTable: boolean;
}

export interface MenuItem {
  label: string;
  path: RoutePath;
  menuCode: string;
  moduleCode: ModuleCode;
  phase: Phase;
}

export interface MenuGroup {
  label: string;
  items: MenuItem[];
}

export interface RouteFieldMapping {
  routePath: RoutePath;
  menuCode: string;
  moduleCode: ModuleCode;
  pageName: string;
  mainTable: string;
  tableFields: FieldDefinition[];
  technicalFields: FieldDefinition[];
}

export interface ActionAuditDefinition {
  operationType: string;
  objectType: string;
  writes: string[];
}

export interface ActionDefinition {
  id: ActionId;
  label: string;
  moduleCode: ModuleCode;
  permission: PermissionCode;
  preconditions: string[];
  handlerName: ActionHandlerName;
  audit: ActionAuditDefinition;
  sideEffect: string;
  tone?: "primary" | "secondary" | "danger";
  requiresConfirmation?: boolean;
  phase: Phase;
}

export interface MetricItem {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}

export interface PreconditionItem {
  name: string;
  status: CheckStatus;
  targetPath?: RoutePath;
  message: string;
}

export interface BackendOptionalReadIssue {
  label: string;
  errorCode: string;
  errorMessage: string;
  errorField?: string;
}

export interface PageWorkspaceData {
  summary: string;
  primaryTask: string;
  metrics: MetricItem[];
  preconditions: PreconditionItem[];
  rows: DataRow[];
  technicalDetails: DataRow;
  chart?: BackendChartDto;
}

export interface AuditLogRecord {
  operation: string;
  objectType: string;
  operator: string;
  status: string;
  createdAt: string;
  summary: string;
}

export interface SnapshotRecord {
  name: string;
  type: string;
  status: string;
  createdAt: string;
}

export interface ReportRecord {
  name: string;
  type: string;
  status: string;
  createdAt: string;
  fieldScope: string;
}

export interface ExportFileRecord {
  fileName: string;
  fileType: string;
  status: string;
  createdAt: string;
  fieldScope: string;
}

export interface ResourceInventoryRecord {
  resourceKey: string;
  name: string;
  modality: string;
  fieldCount: number;
  sampleCount: number;
  missingRate: number;
  sensitiveFieldCount: number;
  includeInCalculation: boolean;
  providerName: string;
  splitRatio: number;
  status: string;
  fieldStats: Array<{ label: string; value: string }>;
  previewRows: Array<Record<string, string>>;
  technicalDetails: DataRow;
}

export interface DataProviderOption {
  name: string;
  partyType: "DATA_PROVIDER" | "SERVICE_PROVIDER" | "OPERATOR";
  includeInMDDShap: boolean;
  linkedResourceCount: number;
}

export interface MDDShapParticipant {
  name: string;
  partyType: "DATA_PROVIDER";
  contributionScore: number;
  utilityValue: number;
  qualityFactor: number;
  includeInMDDShap: boolean;
}

export interface MDDShapWeightRecord {
  partyName: string;
  normalizedWeight: number;
  marginalContribution: number;
  qualityFactor: number;
  utilityValue: number;
  status: string;
}

export interface MDDShapTraceRecord {
  coalition: string;
  partyName: string;
  vBefore: number;
  vAfter: number;
  marginalContribution: number;
}

export interface MDDShapTaskRecord {
  taskName: string;
  algorithmMode: string;
  status: string;
  progress: number;
  seed: number;
  sampleRounds: number;
  epsilon: number;
  saveMarginalDetail: boolean;
  createdAt: string;
}

export interface MockWorkspaceState {
  auditLogs: AuditLogRecord[];
  snapshots: SnapshotRecord[];
  reports: ReportRecord[];
  exports: ExportFileRecord[];
  resources: ResourceInventoryRecord[];
  dataProviders: DataProviderOption[];
  mdsParticipants: MDDShapParticipant[];
  mdsWeights: MDDShapWeightRecord[];
  mdsTraces: MDDShapTraceRecord[];
  mdsTasks: MDDShapTaskRecord[];
  currentRevenuePool: number;
}

export interface WorkbenchSnapshot {
  projectName: string;
  scenarioName: string;
  operator: string;
  status: StatusCode;
  updatedAt: string;
  mock?: MockWorkspaceState;
  backend?: {
    apiBaseUrl: string;
    availableActions: ActionId[];
    disabledActions: Array<{ button_code: string; reason: string }>;
    optionalReadIssues?: BackendOptionalReadIssue[];
    connected: boolean;
    lastSyncedAt: string;
  };
  pages: Record<RoutePath, PageWorkspaceData>;
}

export interface AppRoute {
  path: RoutePath;
  label: string;
  menuCode: string;
  moduleCode: ModuleCode;
  phase: Phase;
  responsibility: string;
  actionIds: ActionId[];
}

export interface BackendChartDto {
  chart_id: string;
  chart_type: string;
  title: string;
  source?: {
    result_id?: string;
    snapshot_id?: string;
    generated_at?: string;
  };
  series: unknown[];
  metadata?: Record<string, unknown>;
}
