import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import { p0Api } from "../../lib/api";
import {
  backendUnavailableStore,
  mutateBackendAndRefresh,
  refreshStoreFromBackend,
  requireCurrentProjectId,
} from "./backendWorkspace";

export const QualityService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action) {
    if (action.id === "QUAL-003" || action.id === "QUAL-009") {
      return mutateBackendAndRefresh(
        store,
        () => p0Api.runPipeline(requireCurrentProjectId(store)),
        "完整计算链路已由后端执行，质量评估摘要已刷新。",
        "quality evaluate",
      );
    }

    if (action.id === "QUAL-006") {
      return refreshStoreFromBackend(store, "质量评估结果已从后端刷新。");
    }

    return backendUnavailableStore(store, action.label, "quality action");
  },
};
