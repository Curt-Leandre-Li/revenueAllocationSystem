import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import { dvasApi } from "../api";
import {
  backendUnavailableStore,
  mutateBackendAndRefresh,
  refreshStoreFromBackend,
} from "./backendWorkspace";

export const MDDShapService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action) {
    if (action.id === "MDS-011" || action.id === "MDS-016") {
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.runMdDshap(),
        "MD-DShap 权重已由后端计算，项目状态已刷新。",
        "md-dshap run",
      );
    }

    if (["MDS-012", "MDS-013", "MDS-014", "MDS-015"].includes(action.id)) {
      return refreshStoreFromBackend(store, "MD-DShap 任务、参与方池和权重结果已从后端刷新。");
    }

    return backendUnavailableStore(store, action.label, "md-dshap action");
  },
};
