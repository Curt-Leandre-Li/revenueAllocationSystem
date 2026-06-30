import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import { dvasApi } from "../api";
import {
  backendUnavailableStore,
  mutateBackendAndRefresh,
  refreshStoreFromBackend,
} from "./backendWorkspace";

export const ShuyuanService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action, payload) {
    if (action.id === "DU-002") {
      if (payload?.kind !== "shuyuan-parameters") {
        return backendUnavailableStore(
          store,
          action.label,
          "shuyuan parameters save requires backend DTO payload",
        );
      }
      return mutateBackendAndRefresh(
        store,
        () =>
          dvasApi.saveShuyuanParameters({
            base_price: payload.basePrice,
            scenario_coefficient: payload.scenarioCoefficient,
            technology_coefficient: payload.technologyCoefficient,
            expert_coefficient: payload.expertCoefficient,
            development_coefficient: payload.developmentCoefficient,
          }),
        "数元参数已由后端保存，项目状态已刷新。",
        "shuyuan parameters save",
      );
    }

    if (action.id === "DU-003") {
      if (payload?.kind !== "shuyuan-call-counts") {
        return backendUnavailableStore(
          store,
          action.label,
          "shuyuan call-count save requires backend DTO payload",
        );
      }
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.saveShuyuanCallCounts({ call_counts: payload.callCounts }),
        "资源调用量已由后端保存，项目状态已刷新。",
        "shuyuan call-count save",
      );
    }

    if (action.id === "DU-009") {
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.runShuyuanMetering(),
        "数元计量已由后端完成，项目状态已刷新。",
        "shuyuan calculate",
      );
    }

    if (action.id === "DU-010") {
      return refreshStoreFromBackend(store, "数元计量明细已从后端刷新。");
    }

    return backendUnavailableStore(store, action.label, "shuyuan action");
  },
};
