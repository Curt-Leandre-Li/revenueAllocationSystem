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
    if (action.id === "ALLOC-003") {
      if (payload?.kind !== "allocation-revenue-pool") {
        return backendUnavailableStore(
          store,
          action.label,
          "allocation revenue-pool save requires backend DTO payload",
        );
      }
      return mutateBackendAndRefresh(
        store,
        () =>
          dvasApi.saveAllocationRevenuePool({
            total_revenue: payload.totalRevenue,
            priority_allocation_amount: payload.priorityAllocationAmount,
            currency: payload.currency,
          }),
        "总收益已由后端保存，项目状态已刷新。",
        "allocation revenue-pool save",
      );
    }

    if (action.id === "ALLOC-005") {
      if (payload?.kind !== "allocation-priority-items") {
        return backendUnavailableStore(
          store,
          action.label,
          "allocation priority save requires backend DTO payload",
        );
      }
      return mutateBackendAndRefresh(
        store,
        () =>
          dvasApi.saveAllocationPriorityItems({
            items: payload.items.map((item) => ({
              party_id: item.partyId,
              value_type: item.valueType,
              priority_amount: item.priorityAmount,
              priority_ratio: item.priorityRatio,
              cap_amount: item.capAmount,
              basis_text: item.basisText,
              priority_order: item.priorityOrder,
            })),
          }),
        "非数据主体合同比例已由后端保存，项目状态已刷新。",
        "allocation priority save",
      );
    }

    if (action.id === "ALLOC-007") {
      if (payload?.kind !== "allocation-mode") {
        return backendUnavailableStore(
          store,
          action.label,
          "allocation mode save requires backend DTO payload",
        );
      }
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.saveAllocationMode({ allocation_mode: payload.allocationMode }),
        "分配模式已由后端保存，项目状态已刷新。",
        "allocation mode save",
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
