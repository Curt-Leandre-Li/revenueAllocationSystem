import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore, writeMockServiceResult } from "./serviceTypes";
import { dvasApi, normalizeApiError } from "../api";
import {
  markSnapshotSource,
  refreshStoreFromBackend,
  shouldUseBackend,
} from "./backendWorkspace";

export const DataPackageService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action) {
    if (action.id === "DATA-002") {
      const mockStore = writeMockServiceResult("DataPackageService", store, action);
      if (shouldUseBackend()) {
        return initializeDemoFromBackend(store, mockStore);
      }
      return {
        ...mockStore,
        snapshot: markSnapshotSource(mockStore.snapshot, "mock"),
        lastMessage: `${mockStore.lastMessage}（数据来源：本地模拟）`,
      };
    }
    if (action.id === "DATA-003") {
      const mockStore = writeMockServiceResult("DataPackageService", store, action);
      if (shouldUseBackend()) {
        return uploadJsonToBackend(store, mockStore);
      }
      return {
        ...mockStore,
        snapshot: markSnapshotSource(mockStore.snapshot, "mock"),
        lastMessage: `${mockStore.lastMessage}（数据来源：本地模拟）`,
      };
    }
    return writeMockServiceResult("DataPackageService", store, action);
  },
};

async function initializeDemoFromBackend(
  store: Parameters<MockDomainService["handleAction"]>[0],
  fallbackStore: Parameters<MockDomainService["handleAction"]>[0],
) {
  try {
    await dvasApi.initializeDemoCase();
    return refreshStoreFromBackend(
      store,
      "演示数据已由后端初始化，数据包列表和前置条件已刷新。",
      fallbackStore,
    );
  } catch (error) {
    const normalized = normalizeApiError(error);
    return {
      ...fallbackStore,
      snapshot: markSnapshotSource(fallbackStore.snapshot, "mock_fallback"),
      lastMessage: `后端初始化失败，已回退本地模拟数据。位置：data package demo initialize。建议：${normalized.repairSuggestion ?? "确认后端服务已启动后重试。"}`,
      dataSource: {
        mode: "mock_fallback" as const,
        lastError: normalized,
        backendAvailable: false,
      },
    };
  }
}

async function uploadJsonToBackend(
  store: Parameters<MockDomainService["handleAction"]>[0],
  fallbackStore: Parameters<MockDomainService["handleAction"]>[0],
) {
  try {
    await dvasApi.uploadJson();
    return refreshStoreFromBackend(
      store,
      "JSON 数据包已由后端校验接入，仪表盘和前置条件已刷新。",
      fallbackStore,
    );
  } catch (error) {
    const normalized = normalizeApiError(error);
    return {
      ...fallbackStore,
      snapshot: markSnapshotSource(fallbackStore.snapshot, "mock_fallback"),
      lastMessage: `后端上传失败，已回退本地模拟数据。位置：data package JSON upload。建议：${normalized.repairSuggestion ?? "确认后端服务已启动后重试。"}`,
      dataSource: {
        mode: "mock_fallback" as const,
        lastError: normalized,
        backendAvailable: false,
      },
    };
  }
}
