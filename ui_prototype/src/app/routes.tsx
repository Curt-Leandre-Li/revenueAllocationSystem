import type { AppRoute, RoutePath } from "../domain/types";
import { MDDShapPage } from "../pages/allocation/MDDShapPage";
import { SimulationPage } from "../pages/allocation/SimulationPage";
import { ConstraintsPage } from "../pages/allocation/ConstraintsPage";
import { DataPackagesPage } from "../pages/data/DataPackagesPage";
import { DataPartiesPage } from "../pages/data/DataPartiesPage";
import { DataResourcesPage } from "../pages/data/DataResourcesPage";
import { OverviewPage } from "../pages/dashboard/OverviewPage";
import { QualityPage } from "../pages/measure/QualityPage";
import { ShuyuanPage } from "../pages/measure/ShuyuanPage";
import { UtilityPage } from "../pages/measure/UtilityPage";
import type { PageProps } from "../pages/pageTypes";
import { ReportsPage } from "../pages/reports/ReportsPage";
import { AuditPage } from "../pages/system/AuditPage";
import { ParametersPage } from "../pages/system/ParametersPage";
import { UsersP1Page } from "../pages/system/UsersP1Page";
import type { ComponentType } from "react";

export const appRoutes: AppRoute[] = [
  {
    path: "/dashboard",
    label: "系统首页",
    menuCode: "NAV_SYS_HOME",
    moduleCode: "SYS",
    phase: "P0",
    responsibility: "展示当前项目、流程入口、风险提示、一键计算和最近报告摘要。",
    actionIds: ["SYS-002", "DATA-003", "SYS-004", "SYS-005", "REP-001"],
  },
  {
    path: "/data/packages",
    label: "数据接入管理",
    menuCode: "NAV_DATA_PACKAGE",
    moduleCode: "DATA",
    phase: "P0",
    responsibility: "选择演示数据、上传 UTF-8 JSON、校验字段并生成输入快照。",
    actionIds: ["DATA-002", "DATA-003", "DATA-007", "DATA-008", "DATA-009"],
  },
  {
    path: "/data/resources",
    label: "数据资源管理",
    menuCode: "NAV_DATA_RESOURCE",
    moduleCode: "RES",
    phase: "P0",
    responsibility: "展示资源、字段、模态、统计、敏感标记、主体绑定和计算纳入状态。",
    actionIds: ["RES-002", "RES-005", "RES-007"],
  },
  {
    path: "/data/parties",
    label: "参与方管理",
    menuCode: "NAV_DATA_PARTY",
    moduleCode: "PARTY",
    phase: "P0",
    responsibility: "维护数据源主体与非数据贡献主体，控制 MD-DShap 权重池边界。",
    actionIds: ["PARTY-002", "PARTY-003", "PARTY-005", "PARTY-006", "PARTY-008"],
  },
  {
    path: "/measure/quality",
    label: "质量评估管理",
    menuCode: "NAV_MEASURE_QUALITY",
    moduleCode: "QUAL",
    phase: "P0",
    responsibility: "配置质量权重、运行评估、展示总分、证据、预警和版本。",
    actionIds: ["QUAL-002", "QUAL-003", "QUAL-006", "QUAL-009"],
  },
  {
    path: "/measure/shuyuan",
    label: "数元计量管理",
    menuCode: "NAV_MEASURE_SHUYUAN",
    moduleCode: "DU",
    phase: "P0",
    responsibility: "配置基础单价、调用次数和系数，执行数元计量并展示明细。",
    actionIds: ["DU-002", "DU-003", "DU-009", "DU-010"],
  },
  {
    path: "/measure/utility",
    label: "贡献度与效用计算",
    menuCode: "NAV_MEASURE_UTILITY",
    moduleCode: "UTIL",
    phase: "P0",
    responsibility: "计算贡献度、归一化贡献和效用值，并开放轨迹查看。",
    actionIds: ["UTIL-001", "UTIL-006", "UTIL-007", "UTIL-008", "UTIL-009"],
  },
  {
    path: "/allocation/md-dshap",
    label: "MD-DShap 计算管理",
    menuCode: "NAV_ALLOC_MDS",
    moduleCode: "MDS",
    phase: "P0",
    responsibility: "默认使用 MD-DShap，展示参与者、任务、参数、权重和边际轨迹。",
    actionIds: [
      "PARAM-004",
      "MDS-011",
      "MDS-012",
      "MDS-013",
      "MDS-014",
      "MDS-015",
      "MDS-016",
      "MDS-017",
      "MDS-018",
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
      "ALLOC-003",
      "ALLOC-005",
      "ALLOC-007",
      "ALLOC-011",
      "ALLOC-013",
      "ALLOC-014",
      "ALLOC-015",
      "ALLOC-016",
    ],
  },
  {
    path: "/allocation/constraints",
    label: "合同约束管理",
    menuCode: "NAV_ALLOC_CONSTRAINT",
    moduleCode: "CONS",
    phase: "P0",
    responsibility: "维护合同约束、优先级、状态和约束应用结果。",
    actionIds: ["CONS-002", "CONS-003", "CONS-004", "CONS-011"],
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
    actionIds: ["PARAM-001", "PARAM-002", "PARAM-004", "PARAM-008"],
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
  "/data/ingestion": "/data/packages",
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
  "/data/packages": DataPackagesPage,
  "/data/resources": DataResourcesPage,
  "/data/parties": DataPartiesPage,
  "/measure/quality": QualityPage,
  "/measure/shuyuan": ShuyuanPage,
  "/measure/utility": UtilityPage,
  "/allocation/md-dshap": MDDShapPage,
  "/allocation/simulation": SimulationPage,
  "/allocation/constraints": ConstraintsPage,
  "/reports": ReportsPage,
  "/system/parameters": ParametersPage,
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
