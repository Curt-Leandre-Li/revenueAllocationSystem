import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import { dvasApi } from "../api";
import {
  backendUnavailableStore,
  mutateBackendAndRefresh,
  refreshStoreFromBackend,
} from "./backendWorkspace";

export const AllocationService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action, payload) {
    if (["ALLOC-003", "ALLOC-005", "ALLOC-007"].includes(action.id)) {
      return refreshStoreFromBackend(
        store,
        `${action.label} 已降级为兼容旧草稿动作；当前 P0 主链路请在合同分配规则页保存合同比例方案。`,
      );
    }

    if (action.id === "ALLOC-011") {
      if (payload?.kind !== "allocation-run") {
        return backendUnavailableStore(
          store,
          action.label,
          "allocation run requires backend-owned revenue payload",
        );
      }
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.runCurrentContractRatioSimulation(),
        "收益分配模拟已由后端完成，项目状态已刷新。",
        "allocation simulation run",
      );
    }

    if (action.id === "ALLOC-015") {
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.lockCurrentAllocation(),
        "分配方案已由后端锁定，项目状态已刷新。",
        "allocation lock",
      );
    }

    if (action.id === "ALLOC-016") {
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.exportCurrentAllocationJson(),
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
