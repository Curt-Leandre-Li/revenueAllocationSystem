import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import { dvasApi } from "../api";
import {
  backendUnavailableStore,
  mutateBackendAndRefresh,
  refreshStoreFromBackend,
} from "./backendWorkspace";

export const AuditService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action) {
    if (action.id === "AUD-002" || action.id === "AUD-006") {
      return refreshStoreFromBackend(store, "审计日志已从后端读取，日志列表已刷新。");
    }

    if (action.id === "AUD-007") {
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.exportAuditLog(),
        "审计日志 JSONL 已由后端导出，项目状态和报告记录已刷新。",
        "audit log export",
      );
    }

    return backendUnavailableStore(store, action.label, "audit action");
  },
};
