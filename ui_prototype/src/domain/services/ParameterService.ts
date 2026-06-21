import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import { backendUnavailableStore, refreshStoreFromBackend } from "./backendWorkspace";

export const ParameterService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action, payload) {
    if (action.id === "PARAM-001") {
      return refreshStoreFromBackend(store, "系统参数已从后端刷新。");
    }

    if (action.id === "PARAM-002") {
      if (!payload || payload.kind !== "parameter-restore") {
        throw new Error("恢复默认缺少 parameter_code");
      }
      return backendUnavailableStore(store, action.label, "parameter restore-default");
    }

    if (action.id === "PARAM-004" || action.id === "PARAM-008") {
      if (!payload || payload.kind !== "parameter-update") {
        throw new Error("系统参数保存缺少参数值");
      }
      return backendUnavailableStore(
        store,
        action.label,
        action.id === "PARAM-004" ? "parameter md-dshap update" : "parameter risk update",
      );
    }

    return backendUnavailableStore(store, action.label, "parameter action");
  },
};
