import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import { backendUnavailableStore, refreshStoreFromBackend } from "./backendWorkspace";

export const ParameterService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action) {
    if (action.id === "PARAM-001") {
      return refreshStoreFromBackend(store, "系统参数已从后端刷新。");
    }

    return backendUnavailableStore(store, action.label, "parameter action");
  },
};
