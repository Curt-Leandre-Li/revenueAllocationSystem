import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore, writeMockServiceResult } from "./serviceTypes";

export const ReportService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action) {
    return writeMockServiceResult("ReportService", store, action);
  },
};
