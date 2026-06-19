export const endpoints = {
  projectCurrent: "/projects/current",
  projectCurrentStatus: "/projects/current/status",
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
  qualityEvaluate: "/metering/quality/evaluate",
  shuyuanCalculate: "/metering/shuyuan/calculate",
  contributionCalculate: "/metering/utility/contribution/calculate",
  utilityCalculate: "/metering/utility/calculate",
  mdDshapParticipantPool: "/allocation/md-dshap/participant-pool",
  mdDshapTasks: "/allocation/md-dshap/tasks",
  mdDshapTask: (taskId: string) =>
    `/allocation/md-dshap/tasks/${encodeURIComponent(taskId)}`,
  mdDshapTaskResults: (taskId: string) =>
    `/allocation/md-dshap/tasks/${encodeURIComponent(taskId)}/results`,
  allocationRun: "/allocation/simulation/run",
  allocationResults: (allocationId: string) =>
    `/allocation-scenarios/${encodeURIComponent(allocationId)}/results`,
  allocationLock: (allocationId: string) =>
    `/allocation/simulation/${encodeURIComponent(allocationId)}/lock`,
  allocationExport: (allocationId: string) =>
    `/allocation/simulation/${encodeURIComponent(allocationId)}/export`,
  allocationConstraints: "/allocation/constraints",
  reports: "/reports",
  reportPreview: "/reports/preview",
  reportMarkdown: "/reports/markdown",
  reportCsv: "/reports/csv",
  reportJson: "/reports/json",
  reportAuditLog: "/reports/audit-log",
  systemParameters: "/system/parameters",
  auditLogs: "/audit-logs",
  systemAuditLogs: "/system/audit/logs",
  auditLogDetail: (logId: string) => `/audit-logs/${encodeURIComponent(logId)}`,
} as const;
