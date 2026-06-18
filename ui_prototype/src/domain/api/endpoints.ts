export const endpoints = {
  projectCurrent: "/projects/current",
  dashboardOverview: "/dashboard",
  dashboardPreconditions: "/dashboard/preconditions",
  initializeDemoCase: (demoCaseId: string) =>
    `/demo-cases/${encodeURIComponent(demoCaseId)}/initialize`,
  uploadDataPackage: "/data-packages/upload",
  dataPackages: "/data-packages",
  dataPackageDetail: (packageId: string) =>
    `/data-packages/${encodeURIComponent(packageId)}`,
  uploadValidationResult: (packageId: string) =>
    `/data-packages/${encodeURIComponent(packageId)}/validation-result`,
  dataResources: "/data-resources",
  dataResourceDetail: (resourceId: string) =>
    `/data-resources/${encodeURIComponent(resourceId)}`,
  resourcePartyRelations: (resourceId: string) =>
    `/data-resources/${encodeURIComponent(resourceId)}/party-relations`,
  parties: "/parties",
  reports: "/reports",
  auditLogs: "/audit-logs",
  auditLogDetail: (logId: string) => `/audit-logs/${encodeURIComponent(logId)}`,
} as const;
