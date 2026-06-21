import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import { p0Api } from "../../lib/api";
import {
  backendUnavailableStore,
  mutateBackendAndRefresh,
  refreshStoreFromBackend,
  requireCurrentProjectId,
} from "./backendWorkspace";

export const ReportService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action) {
    if (action.id === "REP-001") {
      return refreshStoreFromBackend(store, "报告预览数据已从后端读取。");
    }

    if (["REP-002", "REP-004", "REP-005", "REP-006", "REP-009"].includes(action.id)) {
      return mutateBackendAndRefresh(
        store,
        () => p0Api.generateReport(requireCurrentProjectId(store)),
        "P0 报告已由后端生成，Markdown/CSV/JSON/JSONL 和 checksum 已刷新。",
        "report generate",
      );
    }

    return backendUnavailableStore(store, action.label, "report action");
  },
};
