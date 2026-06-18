import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore, writeMockServiceResult } from "./serviceTypes";
import { dvasApi } from "../apiClient";
import { formatApiError, loadWorkbenchSnapshotFromBackend } from "../backendAdapter";

export const DataPackageService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action) {
    if (store.snapshot.backend?.connected && action.id === "DATA-002") {
      return initializeDemoFromBackend(store);
    }
    if (store.snapshot.backend?.connected && action.id === "DATA-003") {
      return uploadJsonToBackend(store);
    }
    return writeMockServiceResult("DataPackageService", store, action);
  },
};

async function initializeDemoFromBackend(store: Parameters<MockDomainService["handleAction"]>[0]) {
  try {
    await dvasApi.initializeDemoCase();
    const snapshot = await loadWorkbenchSnapshotFromBackend();
    return {
      ...store,
      snapshot: {
        ...snapshot,
        mock: store.snapshot.mock ?? snapshot.mock,
      },
      lastMessage: "演示数据已由后端初始化，数据包列表和前置条件已刷新。",
    };
  } catch (error) {
    return {
      ...store,
      lastMessage: `选择演示数据 未执行：${formatApiError(error)}`,
    };
  }
}

async function uploadJsonToBackend(store: Parameters<MockDomainService["handleAction"]>[0]) {
  try {
    await dvasApi.uploadDemoJson();
    const snapshot = await loadWorkbenchSnapshotFromBackend();
    return {
      ...store,
      snapshot: {
        ...snapshot,
        mock: store.snapshot.mock ?? snapshot.mock,
      },
      lastMessage: "JSON 数据包已由后端校验接入，仪表盘和前置条件已刷新。",
    };
  } catch (error) {
    return {
      ...store,
      lastMessage: `上传 JSON 未执行：${formatApiError(error)}`,
    };
  }
}
