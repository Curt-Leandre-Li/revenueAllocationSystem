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
  handleAction(store, action, payload) {
    if (action.id === "QUAL-002") {
      if (payload?.kind !== "quality-weights") {
        return backendUnavailableStore(
          store,
          action.label,
          "quality weights save requires backend DTO payload",
        );
      }
      return mutateBackendAndRefresh(
        store,
        () =>
          dvasApi.saveQualityWeights({
            items: payload.items.map((item) => ({
              metric_code: item.metricCode,
              weight: item.weight,
            })),
          }),
        "质量指标权重已由后端保存，项目状态已刷新。",
        "quality weights save",
      );
    }

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
