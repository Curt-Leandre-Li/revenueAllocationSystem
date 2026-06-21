import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import { p0Api } from "../../lib/api";
import {
  backendUnavailableStore,
  mutateBackendAndRefresh,
  refreshStoreFromBackend,
  requireCurrentProjectId,
} from "./backendWorkspace";

export const DashboardService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action) {
    if (action.id === "SYS-002") {
      return mutateBackendAndRefresh(
        store,
        () => p0Api.loadDemoCase(),
        "演示数据已由后端初始化，项目状态和前置条件已刷新。",
        "dashboard demo select",
      );
    }

    if (action.id === "SYS-004") {
      return mutateBackendAndRefresh(
        store,
        () => p0Api.runPipeline(requireCurrentProjectId(store)),
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
