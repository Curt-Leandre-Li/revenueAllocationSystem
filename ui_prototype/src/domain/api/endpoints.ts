export const endpoints = {
  projectCurrent: "/projects/current",
  projectCurrentStatus: "/projects/current/status",
  navigationMenus: "/navigation/menus",
  dashboardOverview: "/dashboard",
  dashboardPreconditions: "/dashboard/preconditions",
  pipelineRun: (projectId: string) =>
    `/projects/${encodeURIComponent(projectId)}/pipeline/run`,
  initializeDemoCase: (demoCaseId: string) =>
    `/demo-cases/${encodeURIComponent(demoCaseId)}/select`,
  uploadDataPackage: "/data/packages/upload",
  dataPackages: "/data/packages",
  dataPackageDetail: (packageId: string) =>
    `/data/packages/${encodeURIComponent(packageId)}/preview`,
  uploadValidationResult: (packageId: string) =>
    `/data-packages/${encodeURIComponent(packageId)}/validation-result`,
  dataResources: "/data/resources",
  dataResourceDetail: (resourceId: string) =>
    `/data-resources/${encodeURIComponent(resourceId)}`,
  resourcePartyRelations: (resourceId: string) =>
    `/data-resources/${encodeURIComponent(resourceId)}/party-relations`,
  parties: "/data/parties",
  party: (partyId: string) =>
    `/data/parties/${encodeURIComponent(partyId)}`,
  partyStatus: (partyId: string) =>
    `/data/parties/${encodeURIComponent(partyId)}/status`,
  qualityEvaluate: "/metering/quality/evaluate",
  qualityWeights: "/metering/quality/weights",
  qualityLatest: "/quality-assessments/latest",
  qualityDetails: (assessmentId: string) =>
    `/quality-assessments/${encodeURIComponent(assessmentId)}/details`,
  shuyuanParameters: "/metering/shuyuan/parameters",
  shuyuanCallCounts: "/metering/shuyuan/call-counts",
  shuyuanCalculate: "/metering/shuyuan/calculate",
  shuyuanLatest: "/shuyuan-meterings/latest",
  shuyuanDetails: (meteringId: string) =>
    `/shuyuan-meterings/${encodeURIComponent(meteringId)}/details`,
  contributionFactors: "/metering/utility/contribution-factors",
  contributionCalculate: "/metering/utility/contribution/calculate",
  utilityFunction: "/metering/utility/function",
  utilityCalculate: "/metering/utility/calculate",
  utilityLatest: "/utilities/latest",
  utilityTrace: (utilityId: string) =>
    `/utilities/${encodeURIComponent(utilityId)}/trace`,
  mdDshapConfig: "/allocation/md-dshap/config",
  mdDshapParticipantPool: "/allocation/md-dshap/participant-pool",
  mdDshapTasks: "/allocation/md-dshap/tasks",
  mdDshapTask: (taskId: string) =>
    `/allocation/md-dshap/tasks/${encodeURIComponent(taskId)}`,
  mdDshapTaskResults: (taskId: string) =>
    `/allocation/md-dshap/tasks/${encodeURIComponent(taskId)}/results`,
  mdDshapMarginalTraces: (taskId: string) =>
    `/md-dshap/tasks/${encodeURIComponent(taskId)}/marginal-traces`,
  mdDshapTaskAuditExport: (taskId: string) =>
    `/allocation/md-dshap/tasks/${encodeURIComponent(taskId)}/audit-export`,
  allocationRevenuePool: "/allocation/simulation/revenue-pool",
  allocationPriorityItems: "/allocation/simulation/priority-items",
  allocationMode: "/allocation/simulation/mode",
  allocationRun: "/allocation/simulation/run",
  allocationResults: (allocationId: string) =>
    `/allocation-scenarios/${encodeURIComponent(allocationId)}/results`,
  allocationLock: (allocationId: string) =>
    `/allocation/simulation/${encodeURIComponent(allocationId)}/lock`,
  allocationExport: (allocationId: string) =>
    `/allocation/simulation/${encodeURIComponent(allocationId)}/export`,
  allocationConstraints: "/allocation/constraints",
  allocationConstraint: (constraintId: string) =>
    `/allocation/constraints/${encodeURIComponent(constraintId)}`,
  allocationConstraintStatus: (constraintId: string) =>
    `/allocation/constraints/${encodeURIComponent(constraintId)}/status`,
  reports: "/reports",
  reportPreview: "/reports/preview",
  reportMarkdown: "/reports/markdown",
  reportCsv: "/reports/csv",
  reportJson: "/reports/json",
  reportAuditLog: "/reports/audit-log",
  reportMdDshapAudit: "/reports/md-dshap-audit",
  systemParameters: "/system/parameters",
  systemParameter: (parameterCode: string) =>
    `/system/parameters/${encodeURIComponent(parameterCode)}`,
  systemParameterRestoreDefault: (parameterCode: string) =>
    `/system/parameters/${encodeURIComponent(parameterCode)}/restore-default`,
  auditLogs: "/audit-logs",
  systemAuditLogs: "/system/audit/logs",
  auditLogDetail: (logId: string) => `/audit-logs/${encodeURIComponent(logId)}`,
} as const;
