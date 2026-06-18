import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import { dvasApi } from "../api";
import {
  backendUnavailableStore,
  mutateBackendAndRefresh,
  refreshStoreFromBackend,
} from "./backendWorkspace";

export const ResourceService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action, payload) {
    if (action.id === "RES-002") {
      return refreshStoreFromBackend(store, "资源详情已从后端读取，资源列表已刷新。");
    }

    if (action.id === "RES-005" && payload?.kind === "resource-binding") {
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.bindResourceParty(payload.resourceKey, payload.providerName, payload.splitRatio),
        "资源主体关系已由后端保存，项目状态已刷新。",
        "resource party binding",
      );
    }

    return backendUnavailableStore(store, action.label, "resource action");
  },
};
