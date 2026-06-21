import type { AppRoute, RoutePath } from "../domain/types";
import { OverviewPage } from "../pages/dashboard/OverviewPage";
import type { PageProps } from "../pages/pageTypes";
import { ReportsPage } from "../pages/reports/ReportsPage";
import { AuditPage } from "../pages/system/AuditPage";
import { UsersP1Page } from "../pages/system/UsersP1Page";
import type { ComponentType } from "react";
import { WorkbenchPage } from "../pages/WorkbenchPage";

export const appRoutes: AppRoute[] = [
  {
    path: "/dashboard",
    label: "系统首页",
    menuCode: "NAV_SYS_HOME",
    moduleCode: "SYS",
    phase: "P0",
    responsibility: "展示当前项目、流程入口、风险提示、一键计算和最近报告摘要。",
    actionIds: ["SYS-002", "DATA-003", "SYS-004", "ALLOC-015", "REP-002", "AUD-002"],
  },
  {
    path: "/data/ingestion",
    label: "数据接入管理",
    menuCode: "NAV_DATA_PACKAGE",
    moduleCode: "DATA",
    phase: "P0",
    responsibility: "选择演示数据、上传 UTF-8 JSON、校验字段并生成输入快照。",
    actionIds: ["DATA-002", "DATA-003", "DATA-007", "DATA-008"],
  },
  {
    path: "/data/resources",
    label: "数据资源管理",
    menuCode: "NAV_DATA_RESOURCE",
    moduleCode: "RES",
    phase: "P0",
    responsibility: "展示资源、字段、模态、统计、敏感标记、主体绑定和计算纳入状态。",
    actionIds: ["RES-002"],
  },
  {
    path: "/data/parties",
    label: "参与方管理",
    menuCode: "NAV_DATA_PARTY",
    moduleCode: "PARTY",
    phase: "P0",
    responsibility: "维护数据源主体与非数据贡献主体，控制 MD-DShap 权重池边界。",
    actionIds: ["PARTY-008"],
  },
  {
    path: "/measure/quality",
    label: "质量评估管理",
    menuCode: "NAV_MEASURE_QUALITY",
    moduleCode: "QUAL",
    phase: "P0",
    responsibility: "配置质量权重、运行评估、展示总分、证据、预警和版本。",
    actionIds: ["SYS-004", "QUAL-006"],
  },
  {
    path: "/measure/shuyuan",
    label: "数元计量管理",
    menuCode: "NAV_MEASURE_SHUYUAN",
    moduleCode: "DU",
    phase: "P0",
    responsibility: "配置基础单价、调用次数和系数，执行数元计量并展示明细。",
    actionIds: ["SYS-004", "DU-010"],
  },
  {
    path: "/measure/utility",
    label: "贡献度与效用计算",
    menuCode: "NAV_MEASURE_UTILITY",
    moduleCode: "UTIL",
    phase: "P0",
    responsibility: "计算贡献度、归一化贡献和效用值，并开放轨迹查看。",
    actionIds: ["SYS-004", "UTIL-009"],
  },
  {
    path: "/allocation/md-dshap",
    label: "MD-DShap 计算管理",
    menuCode: "NAV_ALLOC_MDS",
    moduleCode: "MDS",
    phase: "P0",
    responsibility: "默认使用 MD-DShap，展示参与者、任务、参数、权重和边际轨迹。",
    actionIds: [
      "MDS-012",
      "MDS-014",
      "MDS-018",
      "SYS-004",
    ],
  },
  {
    path: "/allocation/simulation",
    label: "收益分配模拟",
    menuCode: "NAV_ALLOC_SIMULATION",
    moduleCode: "ALLOC",
    phase: "P0",
    responsibility: "配置总收益、优先分配、收益池和约束，生成模拟分配结果。",
    actionIds: [
      "ALLOC-013",
      "ALLOC-015",
      "REP-002",
      "SYS-004",
    ],
  },
  {
    path: "/allocation/constraints",
    label: "合同约束管理",
    menuCode: "NAV_ALLOC_CONSTRAINT",
    moduleCode: "CONS",
    phase: "P0",
    responsibility: "维护合同约束、优先级、状态和约束应用结果。",
    actionIds: ["CONS-011"],
  },
  {
    path: "/reports",
    label: "报告生成与导出",
    menuCode: "NAV_REPORT_EXPORT",
    moduleCode: "REP",
    phase: "P0/P1",
    responsibility: "预览报告并导出 Markdown、CSV、JSON、JSONL，PDF 保持 P1 禁用。",
    actionIds: ["REP-001", "REP-002", "REP-003", "REP-004", "REP-005", "REP-006", "REP-009"],
  },
  {
    path: "/system/parameters",
    label: "参数配置",
    menuCode: "NAV_SYSTEM_PARAMETER",
    moduleCode: "PARAM",
    phase: "P0",
    responsibility: "维护场景系数、质量权重、算法默认值、风险文案和参数版本。",
    actionIds: ["PARAM-001"],
  },
  {
    path: "/system/users",
    label: "用户与权限管理（P1）",
    menuCode: "NAV_SYSTEM_USER",
    moduleCode: "USER",
    phase: "P1",
    responsibility: "只读展示 P1 用户、角色、权限和密码重置规划，P0 不启用。",
    actionIds: ["USER-001", "USER-002", "USER-007", "USER-008", "USER-009"],
  },
  {
    path: "/system/audit",
    label: "审计日志管理",
    menuCode: "NAV_SYSTEM_AUDIT",
    moduleCode: "AUD",
    phase: "P0",
    responsibility: "查询操作、计算、导出日志并查看快照、失败原因和导出记录。",
    actionIds: ["AUD-002", "AUD-006", "AUD-007"],
  },
];

export const defaultRoutePath: RoutePath = "/dashboard";

export const dashboardSectionRouteMap: Record<string, { path: RoutePath; sectionId: string }> = {};

export const compatibilityRouteMap: Record<string, RoutePath> = {
  "/": "/dashboard",
  "/dashboard": "/dashboard",
  "/data/packages": "/data/ingestion",
  "/metering/quality": "/measure/quality",
  "/metering/shuyuan": "/measure/shuyuan",
  "/metering/utility": "/measure/utility",
  "/quality": "/measure/quality",
  "/shuyuan": "/measure/shuyuan",
  "/utility": "/measure/utility",
  "/md-dshap": "/allocation/md-dshap",
  "/allocation": "/allocation/simulation",
  "/constraints": "/allocation/constraints",
  "/parameters": "/system/parameters",
  "/users": "/system/users",
  "/audit": "/system/audit",
};

export const routeComponents: Record<RoutePath, ComponentType<PageProps>> = {
  "/dashboard": OverviewPage,
  "/data/ingestion": WorkbenchPage,
  "/data/resources": WorkbenchPage,
  "/data/parties": WorkbenchPage,
  "/measure/quality": WorkbenchPage,
  "/measure/shuyuan": WorkbenchPage,
  "/measure/utility": WorkbenchPage,
  "/allocation/md-dshap": WorkbenchPage,
  "/allocation/simulation": WorkbenchPage,
  "/allocation/constraints": WorkbenchPage,
  "/reports": ReportsPage,
  "/system/parameters": WorkbenchPage,
  "/system/users": UsersP1Page,
  "/system/audit": AuditPage,
};

export function resolveRoute(pathname: string): RoutePath {
  const dashboardSection = dashboardSectionRouteMap[pathname];
  if (dashboardSection) {
    return dashboardSection.path;
  }

  const directRoute = appRoutes.find((route) => route.path === pathname);
  if (directRoute) {
    return directRoute.path;
  }

  return compatibilityRouteMap[pathname] ?? defaultRoutePath;
}

export function canonicalLocationForPathname(pathname: string) {
  const dashboardSection = dashboardSectionRouteMap[pathname];
  if (dashboardSection) {
    return `${dashboardSection.path}#${dashboardSection.sectionId}`;
  }

  const compatibilityPath = compatibilityRouteMap[pathname];
  if (compatibilityPath) {
    return compatibilityPath;
  }

  const directRoute = appRoutes.find((route) => route.path === pathname);
  return directRoute ? directRoute.path : defaultRoutePath;
}

export function sectionIdForRoute(path: RoutePath) {
  return dashboardSectionRouteMap[path]?.sectionId;
}

export function getRoute(path: RoutePath) {
  return appRoutes.find((route) => route.path === path) ?? appRoutes[0];
}
