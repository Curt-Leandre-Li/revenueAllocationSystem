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
    menuCode: "NAV_SYS_HOME",
    moduleCode: "SYS",
    label: "系统首页",
    routePath: "/dashboard",
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
    routePath: "/data/ingestion",
    icon: "data",
    phase: "P0",
    sortNo: 20,
    visibleInSideNav: true,
    children: [
      {
        menuCode: "NAV_DATA_PACKAGE",
        moduleCode: "DATA",
        label: "数据接入管理",
        routePath: "/data/ingestion",
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
    routePath: "/metering/quality",
    icon: "measure",
    phase: "P0",
    sortNo: 30,
    visibleInSideNav: true,
    children: [
      {
        menuCode: "NAV_MEASURE_QUALITY",
        moduleCode: "QUAL",
        label: "质量评估管理",
        routePath: "/metering/quality",
        phase: "P0",
        sortNo: 31,
        visibleInSideNav: true,
      },
      {
        menuCode: "NAV_MEASURE_SHUYUAN",
        moduleCode: "DU",
        label: "数元计量管理",
        routePath: "/metering/shuyuan",
        phase: "P0",
        sortNo: 32,
        visibleInSideNav: true,
      },
      {
        menuCode: "NAV_MEASURE_UTILITY",
        moduleCode: "UTIL",
        label: "贡献度与效用计算",
        routePath: "/metering/utility",
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

export const allMenuNodes: MenuNode[] = [
  ...sideNavMenuNodes,
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
