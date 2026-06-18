import type { MenuGroup } from "../domain/types";

export const menuGroups: MenuGroup[] = [
  {
    label: "系统首页",
    items: [
      {
        label: "首页总览",
        path: "/dashboard/overview",
        menuCode: "NAV_SYS_OVERVIEW",
        moduleCode: "SYS",
        phase: "P0",
      },
      {
        label: "流程入口",
        path: "/dashboard/process",
        menuCode: "NAV_SYS_PROCESS",
        moduleCode: "SYS",
        phase: "P0",
      },
      {
        label: "风险提示",
        path: "/dashboard/risk",
        menuCode: "NAV_SYS_RISK",
        moduleCode: "SYS",
        phase: "P0",
      },
      {
        label: "一键计算",
        path: "/dashboard/one-click",
        menuCode: "NAV_SYS_ONE_CLICK",
        moduleCode: "SYS",
        phase: "P0",
      },
    ],
  },
  {
    label: "数据管理",
    items: [
      {
        label: "数据接入管理",
        path: "/data/packages",
        menuCode: "NAV_DATA_PACKAGE",
        moduleCode: "DATA",
        phase: "P0",
      },
      {
        label: "数据资源管理",
        path: "/data/resources",
        menuCode: "NAV_DATA_RESOURCE",
        moduleCode: "RES",
        phase: "P0",
      },
      {
        label: "参与方管理",
        path: "/data/parties",
        menuCode: "NAV_DATA_PARTY",
        moduleCode: "PARTY",
        phase: "P0",
      },
    ],
  },
  {
    label: "数元贡献度计量",
    items: [
      {
        label: "质量评估管理",
        path: "/measure/quality",
        menuCode: "NAV_MEASURE_QUALITY",
        moduleCode: "QUAL",
        phase: "P0",
      },
      {
        label: "数元计量管理",
        path: "/measure/shuyuan",
        menuCode: "NAV_MEASURE_SHUYUAN",
        moduleCode: "DU",
        phase: "P0",
      },
      {
        label: "贡献度与效用计算",
        path: "/measure/utility",
        menuCode: "NAV_MEASURE_UTILITY",
        moduleCode: "UTIL",
        phase: "P0",
      },
    ],
  },
  {
    label: "收益分配计算",
    items: [
      {
        label: "MD-DShap 计算管理",
        path: "/allocation/md-dshap",
        menuCode: "NAV_ALLOC_MDS",
        moduleCode: "MDS",
        phase: "P0",
      },
      {
        label: "收益分配模拟",
        path: "/allocation/simulation",
        menuCode: "NAV_ALLOC_SIMULATION",
        moduleCode: "ALLOC",
        phase: "P0",
      },
      {
        label: "合同约束管理",
        path: "/allocation/constraints",
        menuCode: "NAV_ALLOC_CONSTRAINT",
        moduleCode: "CONS",
        phase: "P0",
      },
    ],
  },
  {
    label: "报告生成与导出",
    items: [
      {
        label: "报告生成与导出",
        path: "/reports",
        menuCode: "NAV_REPORT_EXPORT",
        moduleCode: "REP",
        phase: "P0/P1",
      },
    ],
  },
  {
    label: "系统管理",
    items: [
      {
        label: "参数配置",
        path: "/system/parameters",
        menuCode: "NAV_SYSTEM_PARAMETER",
        moduleCode: "PARAM",
        phase: "P0",
      },
      {
        label: "用户与权限管理（P1）",
        path: "/system/users",
        menuCode: "NAV_SYSTEM_USER",
        moduleCode: "USER",
        phase: "P1",
      },
      {
        label: "审计日志管理",
        path: "/system/audit",
        menuCode: "NAV_SYSTEM_AUDIT",
        moduleCode: "AUD",
        phase: "P0",
      },
    ],
  },
];
