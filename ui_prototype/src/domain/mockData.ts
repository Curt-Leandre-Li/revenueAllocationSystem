import { routeFieldMappings } from "./fieldMap";
import type {
  MockWorkspaceState,
  PageWorkspaceData,
  RoutePath,
  WorkbenchSnapshot,
} from "./types";

function emptyPage(routePath: RoutePath): PageWorkspaceData {
  const mapping = routeFieldMappings.find((item) => item.routePath === routePath);
  return {
    summary: "Dev-only 空页面结构；业务数据必须来自后端接口。",
    primaryTask: "连接后端后读取页面 DTO。",
    metrics: [
      {
        label: "后端数据",
        value: "未连接",
        hint: "不会使用 dev-only fixture 伪造成功",
        tone: "warning",
      },
    ],
    preconditions: [],
    rows: [],
    technicalDetails: {
      route_path: routePath,
      menu_code: mapping?.menuCode ?? "",
      module_code: mapping?.moduleCode ?? "",
      fixture_mode: "dev-only-empty",
    },
  };
}

function buildPages() {
  const pages = {} as Record<RoutePath, PageWorkspaceData>;
  for (const mapping of routeFieldMappings) {
    pages[mapping.routePath] = emptyPage(mapping.routePath);
  }
  return pages;
}

// Dev-only fixture for component structure and non-backend local previews.
// It must not be used as a backend failure fallback or as a production success state.
export function createDevOnlyWorkspaceFixtureState(): MockWorkspaceState {
  return {
    currentRevenuePool: 0,
    auditLogs: [],
    snapshots: [],
    reports: [],
    exports: [],
    resources: [],
    dataProviders: [],
    mdsParticipants: [],
    mdsWeights: [],
    mdsTraces: [],
    mdsTasks: [],
  };
}

// Dev-only snapshot shape. AppShell blocks business pages while the backend is unavailable.
export const devOnlyWorkbenchSnapshot: WorkbenchSnapshot = {
  projectName: "后端未连接",
  scenarioName: "等待后端工作区",
  operator: "local_operator",
  status: "DRAFT",
  updatedAt: "",
  mock: createDevOnlyWorkspaceFixtureState(),
  pages: buildPages(),
};
