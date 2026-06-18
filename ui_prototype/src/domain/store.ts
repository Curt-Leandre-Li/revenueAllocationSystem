import {
  formatApiError,
  loadWorkbenchSnapshotFromBackend,
} from "./backendAdapter";
import { dvasApi } from "./apiClient";
import { workbenchSnapshot } from "./mockData";
import type { WorkbenchSnapshot } from "./types";

const initialWorkbenchSnapshot: WorkbenchSnapshot = {
  ...workbenchSnapshot,
  status: "UTILITY_CALCULATED",
  backend: {
    apiBaseUrl: dvasApi.baseUrl(),
    availableActions: [
      "SYS-002",
      "SYS-004",
      "DATA-002",
      "DATA-003",
      "RES-002",
      "RES-005",
      "RES-007",
      "MDS-011",
      "MDS-012",
      "MDS-013",
      "MDS-014",
      "MDS-015",
      "MDS-016",
      "MDS-017",
      "MDS-018",
      "REP-001",
    ],
    disabledActions: [],
    connected: false,
    lastSyncedAt: "",
  },
};

export interface WorkbenchStore {
  snapshot: WorkbenchSnapshot;
  lastMessage: string;
}

export function createWorkbenchStore(): WorkbenchStore {
  return {
    snapshot: initialWorkbenchSnapshot,
    lastMessage: "工作区已加载，正在连接后端；后端不可用时使用本地 mock 工作区。",
  };
}

export async function loadBackendWorkbenchStore(): Promise<WorkbenchStore> {
  try {
    const backendSnapshot = await loadWorkbenchSnapshotFromBackend();
    return {
      snapshot: {
        ...backendSnapshot,
        mock: backendSnapshot.mock ?? initialWorkbenchSnapshot.mock,
      },
      lastMessage: "后端 API 已连接，工作区已同步。",
    };
  } catch (error) {
    return {
      snapshot: initialWorkbenchSnapshot,
      lastMessage: `后端 API 暂不可用：${formatApiError(error)}。已切换为本地 mock 工作区。`,
    };
  }
}
