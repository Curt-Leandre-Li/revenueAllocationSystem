export const endpoints = {
  authLogin: "/auth/login",
  authLogout: "/auth/logout",
  authMe: "/auth/me",
  authPermissions: "/auth/permissions",
  myProjects: "/my/projects",
  myUploads: "/my/uploads",
  myJobs: "/my/jobs",
  myReports: "/my/reports",
  myWorkbench: "/my/workbench",
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
  csvImportTemplate: "/import-templates/csv",
  xlsxImportTemplate: "/import-templates/xlsx",
  importCsvPackage: (projectId: string) =>
    `/projects/${encodeURIComponent(projectId)}/data-packages/import/csv`,
  importXlsxPackage: (projectId: string) =>
    `/projects/${encodeURIComponent(projectId)}/data-packages/import/xlsx`,
  dataPackages: "/data/packages",
  dataPackageDetail: (packageId: string) =>
    `/data/packages/${encodeURIComponent(packageId)}/preview`,
  deleteDataPackage: (packageId: string) =>
    `/data/packages/${encodeURIComponent(packageId)}`,
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
    qualityResourceResults: (assessmentId = "latest") =>
      `/metering/quality/resource-results?assessment_id=${encodeURIComponent(assessmentId)}`,
    qualityResourceDetail: (resourceId: string, assessmentId = "latest") =>
      `/metering/quality/resource-results/${encodeURIComponent(resourceId)}?assessment_id=${encodeURIComponent(assessmentId)}`,
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
  projectMdDshapTasks: (projectId: string) =>
    `/projects/${encodeURIComponent(projectId)}/md-dshap/tasks`,
  mdDshapTaskProgress: (projectId: string, taskId: string) =>
    `/projects/${encodeURIComponent(projectId)}/md-dshap/tasks/${encodeURIComponent(taskId)}/progress`,
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
  projectAllocationSummary: (projectId: string) =>
    `/projects/${encodeURIComponent(projectId)}/allocation/summary`,
  projectAllocationSimulate: (projectId: string) =>
    `/projects/${encodeURIComponent(projectId)}/allocation/simulate`,
  contractRatio: (projectId: string) =>
    `/projects/${encodeURIComponent(projectId)}/allocation/contract-ratio`,
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
  projectJobs: (projectId: string) =>
    `/projects/${encodeURIComponent(projectId)}/jobs`,
  jobDetail: (jobId: string) => `/jobs/${encodeURIComponent(jobId)}`,
  jobCancel: (jobId: string) => `/jobs/${encodeURIComponent(jobId)}/cancel`,
  projectReports: (projectId: string) =>
    `/projects/${encodeURIComponent(projectId)}/reports`,
  projectReportPdf: (projectId: string) =>
    `/projects/${encodeURIComponent(projectId)}/reports/pdf`,
  reportDetail: (reportId: string) => `/reports/${encodeURIComponent(reportId)}`,
  reportFiles: (reportId: string) => `/reports/${encodeURIComponent(reportId)}/files`,
  reportManifest: (reportId: string) =>
    `/reports/${encodeURIComponent(reportId)}/manifest`,
  reportDownload: (reportId: string) =>
    `/reports/${encodeURIComponent(reportId)}/download`,
  reportArchive: (reportId: string) =>
    `/reports/${encodeURIComponent(reportId)}/archive`,
  systemParameters: "/system/parameters",
  systemParameter: (parameterCode: string) =>
    `/system/parameters/${encodeURIComponent(parameterCode)}`,
  systemParameterRestoreDefault: (parameterCode: string) =>
    `/system/parameters/${encodeURIComponent(parameterCode)}/restore-default`,
  auditLogs: "/audit-logs",
  p1AuditLogs: "/audit/logs",
  auditSnapshot: (snapshotId: string) =>
    `/audit/snapshots/${encodeURIComponent(snapshotId)}`,
  auditExport: "/audit/export",
  systemAuditLogs: "/system/audit/logs",
  auditLogDetail: (logId: string) => `/audit-logs/${encodeURIComponent(logId)}`,
  users: "/system/users",
  user: (userId: string) => `/system/users/${encodeURIComponent(userId)}`,
  usersMe: "/users/me",
  usersMePassword: "/users/me/password",
  userDisable: (userId: string) => `/system/users/${encodeURIComponent(userId)}/disable`,
  userResetPassword: (userId: string) =>
    `/system/users/${encodeURIComponent(userId)}/reset-password`,
  roles: "/system/roles",
  rolePermissions: (roleId: string) =>
    `/system/roles/${encodeURIComponent(roleId)}/permissions`,
  permissions: "/system/permissions",
} as const;
