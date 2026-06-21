import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import { p0Api } from "../../lib/api";
import {
  backendUnavailableStore,
  mutateBackendAndRefresh,
  refreshStoreFromBackend,
  requireCurrentProjectId,
} from "./backendWorkspace";

export const ShuyuanService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action) {
    if (action.id === "DU-009") {
      return mutateBackendAndRefresh(
        store,
        () => p0Api.runPipeline(requireCurrentProjectId(store)),
        "完整计算链路已由后端执行，数元计量摘要已刷新。",
        "shuyuan calculate",
      );
    }

    if (action.id === "DU-010") {
      return refreshStoreFromBackend(store, "数元计量明细已从后端刷新。");
    }

    return backendUnavailableStore(store, action.label, "shuyuan action");
  },
};
