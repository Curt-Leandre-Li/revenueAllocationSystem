import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import { dvasApi } from "../api";
import {
  backendUnavailableStore,
  mutateBackendAndRefresh,
  refreshStoreFromBackend,
} from "./backendWorkspace";

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
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.restoreSystemParameterDefault(payload.parameterCode),
        "系统参数默认值已由后端恢复，参数列表已刷新。",
        "parameter restore-default",
      );
    }

    if (action.id === "PARAM-004" || action.id === "PARAM-008") {
      if (!payload || payload.kind !== "parameter-update") {
        throw new Error("系统参数保存缺少参数值");
      }
      return mutateBackendAndRefresh(
        store,
        () =>
          Promise.all(
            payload.values.map((item) =>
              dvasApi.updateSystemParameter(item.parameterCode, item.currentValue),
            ),
          ),
        "系统参数已由后端保存，参数列表已刷新。",
        action.id === "PARAM-004" ? "parameter md-dshap update" : "parameter risk update",
      );
    }

    return backendUnavailableStore(store, action.label, "parameter action");
  },
};
