import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import { dvasApi } from "../api";
import {
  backendUnavailableStore,
  mutateBackendAndRefresh,
  refreshStoreFromBackend,
} from "./backendWorkspace";

export const DashboardService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action) {
    if (action.id === "SYS-002") {
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.initializeDemoCase(),
        "演示数据已由后端初始化，项目状态和前置条件已刷新。",
        "dashboard demo select",
      );
    }

    if (action.id === "SYS-004") {
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.runPipeline(),
        "后端完整链路已执行，状态已刷新到收益分配模拟结果。",
        "dashboard pipeline run",
      );
    }

    if (action.id === "SYS-005") {
      return refreshStoreFromBackend(store, "风险边界和仪表盘摘要已从后端刷新。");
    }

    return backendUnavailableStore(store, action.label, "dashboard action");
  },
};
