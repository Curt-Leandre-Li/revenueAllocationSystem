import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore, writeMockServiceResult } from "./serviceTypes";
import {
  markSnapshotSource,
  refreshStoreFromBackend,
  shouldUseBackend,
} from "./backendWorkspace";

export const ReportService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action) {
    if (action.id === "REP-001") {
      const mockStore = writeMockServiceResult("ReportService", store, action);
      if (shouldUseBackend()) {
        return refreshStoreFromBackend(
          store,
          "报告记录已从后端读取，报告列表已刷新。",
          mockStore,
        );
      }
      return {
        ...mockStore,
        snapshot: markSnapshotSource(mockStore.snapshot, "mock"),
        lastMessage: `${mockStore.lastMessage}（数据来源：本地模拟）`,
      };
    }

    return writeMockServiceResult("ReportService", store, action);
  },
};
