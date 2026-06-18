import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore, writeMockServiceResult } from "./serviceTypes";

export const UtilityService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action) {
    return writeMockServiceResult("UtilityService", store, action);
  },
};
