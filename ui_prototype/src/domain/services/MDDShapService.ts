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
  handleAction(store, action, payload) {
    if (action.id === "MDS-011" || action.id === "MDS-016") {
      const parameters =
        payload?.kind === "mds-parameters"
          ? {
              seed: payload.seed,
              sample_rounds: payload.sampleRounds,
              epsilon: payload.epsilon,
              save_marginal_detail: payload.saveMarginalDetail,
            }
          : {};
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.runMdDshap(parameters),
        "MD-DShap 权重已由后端计算，项目状态已刷新。",
        "md-dshap run",
      );
    }

    if (["MDS-012", "MDS-013", "MDS-014", "MDS-015"].includes(action.id)) {
      return refreshStoreFromBackend(store, "MD-DShap 任务、参与方池和权重结果已从后端刷新。");
    }

    if (action.id === "MDS-018") {
      const taskId = payload?.kind === "mds-audit-export" ? payload.taskId : undefined;
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.exportMdDshapAudit(taskId),
        "MD-DShap 算法审计说明已由后端生成，报告记录已刷新。",
        "md-dshap audit export",
      );
    }

    return backendUnavailableStore(store, action.label, "md-dshap action");
  },
};
