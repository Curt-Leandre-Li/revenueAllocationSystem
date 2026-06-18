import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore, writeMockServiceResult } from "./serviceTypes";

export const AuditService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action) {
    return writeMockServiceResult("AuditService", store, action);
  },
};
