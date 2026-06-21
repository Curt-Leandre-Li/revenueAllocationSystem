import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import { p0Api } from "../../lib/api";
import { backendUnavailableStore, mutateBackendAndRefresh, refreshStoreFromBackend, requireCurrentProjectId } from "./backendWorkspace";

export const MDDShapService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action, payload) {
    if (action.id === "MDS-011" || action.id === "MDS-016") {
      return mutateBackendAndRefresh(
        store,
        () => {
          void payload;
          return p0Api.runPipeline(requireCurrentProjectId(store));
        },
        "完整计算链路已由后端执行，MD-DShap 权重已刷新。",
        "md-dshap run",
      );
    }

    if (["MDS-012", "MDS-013", "MDS-014", "MDS-015"].includes(action.id)) {
      return refreshStoreFromBackend(store, "MD-DShap 任务、参与方池和权重结果已从后端刷新。");
    }

    if (action.id === "MDS-018") {
      return mutateBackendAndRefresh(
        store,
        () => {
          void payload;
          return p0Api.generateReport(requireCurrentProjectId(store));
        },
        "MD-DShap 算法审计说明已由后端报告生成接口刷新。",
        "md-dshap audit export",
      );
    }

    return backendUnavailableStore(store, action.label, "md-dshap action");
  },
};
