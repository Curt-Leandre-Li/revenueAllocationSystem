import type { ModuleCode, Phase, RoutePath } from "../domain/types";

export interface MenuNode {
  menuCode: string;
  moduleCode: ModuleCode;
  label: string;
  routePath: RoutePath;
  icon?: "home" | "data" | "measure" | "allocation" | "report" | "system";
  children?: MenuNode[];
  p1Only?: boolean;
  phase?: Phase;
  sortNo: number;
  visibleInSideNav?: boolean;
  inPageSection?: boolean;
  sectionId?: string;
}

export const sideNavMenuNodes: MenuNode[] = [
  {
    menuCode: "NAV_SYS_OVERVIEW",
    moduleCode: "SYS",
    label: "系统首页",
    routePath: "/dashboard/overview",
    icon: "home",
    phase: "P0",
    sortNo: 10,
    visibleInSideNav: true,
    children: [],
  },
  {
    menuCode: "NAV_GROUP_DATA",
    moduleCode: "DATA",
    label: "数据管理",
    routePath: "/data/packages",
    icon: "data",
    phase: "P0",
    sortNo: 20,
    visibleInSideNav: true,
    children: [
      {
        menuCode: "NAV_DATA_PACKAGE",
        moduleCode: "DATA",
        label: "数据接入管理",
        routePath: "/data/packages",
        phase: "P0",
        sortNo: 21,
        visibleInSideNav: true,
      },
      {
        menuCode: "NAV_DATA_RESOURCE",
        moduleCode: "RES",
        label: "数据资源管理",
        routePath: "/data/resources",
        phase: "P0",
        sortNo: 22,
        visibleInSideNav: true,
      },
      {
        menuCode: "NAV_DATA_PARTY",
        moduleCode: "PARTY",
        label: "参与方管理",
        routePath: "/data/parties",
        phase: "P0",
        sortNo: 23,
        visibleInSideNav: true,
      },
    ],
  },
  {
    menuCode: "NAV_GROUP_MEASURE",
    moduleCode: "QUAL",
    label: "数元贡献度计量",
    routePath: "/measure/quality",
    icon: "measure",
    phase: "P0",
    sortNo: 30,
    visibleInSideNav: true,
    children: [
      {
        menuCode: "NAV_MEASURE_QUALITY",
        moduleCode: "QUAL",
        label: "质量评估管理",
        routePath: "/measure/quality",
        phase: "P0",
        sortNo: 31,
        visibleInSideNav: true,
      },
      {
        menuCode: "NAV_MEASURE_SHUYUAN",
        moduleCode: "DU",
        label: "数元计量管理",
        routePath: "/measure/shuyuan",
        phase: "P0",
        sortNo: 32,
        visibleInSideNav: true,
      },
      {
        menuCode: "NAV_MEASURE_UTILITY",
        moduleCode: "UTIL",
        label: "贡献度与效用计算",
        routePath: "/measure/utility",
        phase: "P0",
        sortNo: 33,
        visibleInSideNav: true,
      },
    ],
  },
  {
    menuCode: "NAV_GROUP_ALLOCATION",
    moduleCode: "MDS",
    label: "收益分配计算",
    routePath: "/allocation/md-dshap",
    icon: "allocation",
    phase: "P0",
    sortNo: 40,
    visibleInSideNav: true,
    children: [
      {
        menuCode: "NAV_ALLOC_MDS",
        moduleCode: "MDS",
        label: "MD-DShap 计算管理",
        routePath: "/allocation/md-dshap",
        phase: "P0",
        sortNo: 41,
        visibleInSideNav: true,
      },
      {
        menuCode: "NAV_ALLOC_SIMULATION",
        moduleCode: "ALLOC",
        label: "收益分配模拟",
        routePath: "/allocation/simulation",
        phase: "P0",
        sortNo: 42,
        visibleInSideNav: true,
      },
      {
        menuCode: "NAV_ALLOC_CONSTRAINT",
        moduleCode: "CONS",
        label: "合同约束管理",
        routePath: "/allocation/constraints",
        phase: "P0",
        sortNo: 43,
        visibleInSideNav: true,
      },
    ],
  },
  {
    menuCode: "NAV_REPORT_EXPORT",
    moduleCode: "REP",
    label: "报告生成与导出",
    routePath: "/reports",
    icon: "report",
    phase: "P0/P1",
    sortNo: 50,
    visibleInSideNav: true,
    children: [],
  },
  {
    menuCode: "NAV_GROUP_SYSTEM",
    moduleCode: "PARAM",
    label: "系统管理",
    routePath: "/system/parameters",
    icon: "system",
    phase: "P0",
    sortNo: 60,
    visibleInSideNav: true,
    children: [
      {
        menuCode: "NAV_SYSTEM_PARAMETER",
        moduleCode: "PARAM",
        label: "参数配置",
        routePath: "/system/parameters",
        phase: "P0",
        sortNo: 61,
        visibleInSideNav: true,
      },
      {
        menuCode: "NAV_SYSTEM_USER",
        moduleCode: "USER",
        label: "用户与权限管理（P1）",
        routePath: "/system/users",
        phase: "P1",
        p1Only: true,
        sortNo: 62,
        visibleInSideNav: true,
      },
      {
        menuCode: "NAV_SYSTEM_AUDIT",
        moduleCode: "AUD",
        label: "审计日志管理",
        routePath: "/system/audit",
        phase: "P0",
        sortNo: 63,
        visibleInSideNav: true,
      },
    ],
  },
];

export const dashboardInPageNodes: MenuNode[] = [
  {
    menuCode: "NAV_SYS_PROCESS",
    moduleCode: "SYS",
    label: "流程入口",
    routePath: "/dashboard/process",
    phase: "P0",
    sortNo: 11,
    visibleInSideNav: false,
    inPageSection: true,
    sectionId: "process",
  },
  {
    menuCode: "NAV_SYS_RISK",
    moduleCode: "SYS",
    label: "风险提示",
    routePath: "/dashboard/risk",
    phase: "P0",
    sortNo: 12,
    visibleInSideNav: false,
    inPageSection: true,
    sectionId: "risk",
  },
  {
    menuCode: "NAV_SYS_ONE_CLICK",
    moduleCode: "SYS",
    label: "一键计算",
    routePath: "/dashboard/one-click",
    phase: "P0",
    sortNo: 13,
    visibleInSideNav: false,
    inPageSection: true,
    sectionId: "one-click",
  },
];

export const allMenuNodes: MenuNode[] = [
  ...sideNavMenuNodes,
  ...dashboardInPageNodes,
];

export function getSideNavNodes() {
  return sideNavMenuNodes
    .filter((node) => node.visibleInSideNav !== false)
    .map((node) => ({
      ...node,
      children: node.children?.filter((child) => child.visibleInSideNav !== false) ?? [],
    }))
    .sort((left, right) => left.sortNo - right.sortNo);
}
