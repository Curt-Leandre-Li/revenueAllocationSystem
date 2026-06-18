import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import { backendUnavailableStore, refreshStoreFromBackend } from "./backendWorkspace";

export const ConstraintService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action) {
    if (action.id === "CONS-011") {
      return refreshStoreFromBackend(store, "合同约束与应用结果已从后端刷新。");
    }

    return backendUnavailableStore(store, action.label, "constraint action");
  },
};
