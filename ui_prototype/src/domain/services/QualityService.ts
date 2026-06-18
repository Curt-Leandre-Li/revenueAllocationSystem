import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import { dvasApi } from "../api";
import {
  backendUnavailableStore,
  mutateBackendAndRefresh,
  refreshStoreFromBackend,
} from "./backendWorkspace";

export const QualityService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action) {
    if (action.id === "QUAL-003" || action.id === "QUAL-009") {
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.runQualityAssessment(),
        "质量评估已由后端完成，项目状态已刷新。",
        "quality evaluate",
      );
    }

    if (action.id === "QUAL-006") {
      return refreshStoreFromBackend(store, "质量评估结果已从后端刷新。");
    }

    return backendUnavailableStore(store, action.label, "quality action");
  },
};
