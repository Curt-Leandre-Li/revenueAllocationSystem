import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore, writeMockServiceResult } from "./serviceTypes";

export const UserService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action) {
    return writeMockServiceResult("UserService", store, action);
  },
};
