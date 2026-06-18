import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore, writeMockServiceResult } from "./serviceTypes";

export const ParameterService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action) {
    return writeMockServiceResult("ParameterService", store, action);
  },
};
