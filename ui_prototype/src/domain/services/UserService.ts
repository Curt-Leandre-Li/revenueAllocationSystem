import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import { backendUnavailableStore } from "./backendWorkspace";

export const UserService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action) {
    return backendUnavailableStore(store, action.label, "user P1 action");
  },
};
