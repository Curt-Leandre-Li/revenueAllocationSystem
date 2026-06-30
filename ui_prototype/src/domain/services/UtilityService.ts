import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import { dvasApi } from "../api";
import {
  backendUnavailableStore,
  mutateBackendAndRefresh,
  refreshStoreFromBackend,
} from "./backendWorkspace";

export const UtilityService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action, payload) {
    if (action.id === "UTIL-001") {
      if (payload?.kind !== "contribution-factors") {
        return backendUnavailableStore(
          store,
          action.label,
          "contribution factors save requires backend DTO payload",
        );
      }
      return mutateBackendAndRefresh(
        store,
        () =>
          dvasApi.saveContributionFactors({
            usage_weight: payload.usageWeight,
            coverage_weight: payload.coverageWeight,
            scarcity_weight: payload.scarcityWeight,
          }),
        "贡献因子已由后端保存，项目状态已刷新。",
        "contribution factors save",
      );
    }

    if (action.id === "UTIL-006") {
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.runContribution(),
        "贡献度计算已由后端完成，项目状态已刷新。",
        "contribution calculate",
      );
    }

    if (action.id === "UTIL-007") {
      if (payload?.kind !== "utility-function") {
        return backendUnavailableStore(
          store,
          action.label,
          "utility function save requires backend DTO payload",
        );
      }
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.saveUtilityFunction(payload.payload),
        "效用函数配置已由后端保存，项目状态已刷新。",
        "utility function save",
      );
    }

    if (action.id === "UTIL-008") {
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.runUtility(),
        "效用值已由后端完成，项目状态已刷新。",
        "utility calculate",
      );
    }

    if (action.id === "UTIL-009") {
      return refreshStoreFromBackend(store, "效用轨迹已从后端刷新。");
    }

    return backendUnavailableStore(store, action.label, "utility action");
  },
};
