import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import { dvasApi } from "../api";
import {
  backendUnavailableStore,
  mutateBackendAndRefresh,
  refreshStoreFromBackend,
} from "./backendWorkspace";

export const DataPackageService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action, payload) {
    if (action.id === "DATA-002") {
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.initializeDemoCase(),
        "演示数据已由后端初始化，数据包列表和前置条件已刷新。",
        "data package demo select",
      );
    }

    if (action.id === "DATA-003") {
      if (payload?.kind !== "data-package-upload") {
        return backendUnavailableStore(
          store,
          action.label,
          "data package JSON upload requires parsed file payload",
        );
      }
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.uploadJson(payload.payload),
        `${payload.fileName} 已提交后端校验，项目状态已刷新。`,
        "data package JSON upload",
      );
    }

    if (action.id === "DATA-007" || action.id === "DATA-008") {
      return refreshStoreFromBackend(store, "数据接入信息已从后端刷新。");
    }

    return backendUnavailableStore(store, action.label, "data package action");
  },
};
