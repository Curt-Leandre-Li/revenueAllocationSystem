import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import { backendUnavailableStore, refreshStoreFromBackend } from "./backendWorkspace";

export const PartyService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action) {
    if (action.id === "PARTY-008") {
      return refreshStoreFromBackend(store, "参与方、贡献和权重摘要已从后端刷新。");
    }

    return backendUnavailableStore(store, action.label, "party action");
  },
};
