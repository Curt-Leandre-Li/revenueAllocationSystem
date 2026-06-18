import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import { dvasApi } from "../api";
import {
  backendUnavailableStore,
  mutateBackendAndRefresh,
  refreshStoreFromBackend,
} from "./backendWorkspace";

export const ShuyuanService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action) {
    if (action.id === "DU-009") {
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.runShuyuanMetering(),
        "数元计量已由后端完成，项目状态已刷新。",
        "shuyuan calculate",
      );
    }

    if (action.id === "DU-010") {
      return refreshStoreFromBackend(store, "数元计量明细已从后端刷新。");
    }

    return backendUnavailableStore(store, action.label, "shuyuan action");
  },
};
