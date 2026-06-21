import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import { p0Api } from "../../lib/api";
import {
  backendUnavailableStore,
  mutateBackendAndRefresh,
  refreshStoreFromBackend,
  requireCurrentProjectId,
} from "./backendWorkspace";

export const AllocationService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action) {
    if (action.id === "ALLOC-011") {
      return mutateBackendAndRefresh(
        store,
        () => p0Api.runPipeline(requireCurrentProjectId(store)),
        "完整计算链路已由后端完成，收益分配模拟结果已刷新。",
        "allocation simulation run",
      );
    }

    if (action.id === "ALLOC-015") {
      return mutateBackendAndRefresh(
        store,
        () => p0Api.confirmAllocation(requireCurrentProjectId(store)),
        "分配方案已由后端锁定，项目状态已刷新。",
        "allocation lock",
      );
    }

    if (action.id === "ALLOC-016") {
      return mutateBackendAndRefresh(
        store,
        () => p0Api.generateReport(requireCurrentProjectId(store)),
        "分配结果已由后端导出，项目状态和报告记录已刷新。",
        "allocation export",
      );
    }

    if (action.id === "ALLOC-013") {
      return refreshStoreFromBackend(store, "收益分配结果已从后端刷新。");
    }

    return backendUnavailableStore(store, action.label, "allocation action");
  },
};
