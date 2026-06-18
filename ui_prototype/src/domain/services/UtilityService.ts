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
  handleAction(store, action) {
    if (action.id === "UTIL-006") {
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.runContribution(),
        "贡献度计算已由后端完成，项目状态已刷新。",
        "contribution calculate",
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
