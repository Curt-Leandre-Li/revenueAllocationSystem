import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import { p0Api } from "../../lib/api";
import {
  backendUnavailableStore,
  mutateBackendAndRefresh,
  refreshStoreFromBackend,
  requireCurrentProjectId,
} from "./backendWorkspace";

export const UtilityService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action) {
    if (action.id === "UTIL-006") {
      return mutateBackendAndRefresh(
        store,
        () => p0Api.runPipeline(requireCurrentProjectId(store)),
        "完整计算链路已由后端执行，贡献度摘要已刷新。",
        "contribution calculate",
      );
    }

    if (action.id === "UTIL-008") {
      return mutateBackendAndRefresh(
        store,
        () => p0Api.runPipeline(requireCurrentProjectId(store)),
        "完整计算链路已由后端执行，效用摘要已刷新。",
        "utility calculate",
      );
    }

    if (action.id === "UTIL-009") {
      return refreshStoreFromBackend(store, "效用轨迹已从后端刷新。");
    }

    return backendUnavailableStore(store, action.label, "utility action");
  },
};
