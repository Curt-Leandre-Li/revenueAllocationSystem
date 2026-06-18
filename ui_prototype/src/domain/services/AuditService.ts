import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore, writeMockServiceResult } from "./serviceTypes";
import {
  markSnapshotSource,
  refreshStoreFromBackend,
  shouldUseBackend,
} from "./backendWorkspace";

export const AuditService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action) {
    if (action.id === "AUD-002") {
      const mockStore = writeMockServiceResult("AuditService", store, action);
      if (shouldUseBackend()) {
        return refreshStoreFromBackend(
          store,
          "审计日志已从后端读取，日志列表已刷新。",
          mockStore,
        );
      }
      return {
        ...mockStore,
        snapshot: markSnapshotSource(mockStore.snapshot, "mock"),
        lastMessage: `${mockStore.lastMessage}（数据来源：本地模拟）`,
      };
    }

    return writeMockServiceResult("AuditService", store, action);
  },
};
