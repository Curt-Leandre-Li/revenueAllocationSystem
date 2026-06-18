import {
  getDvasApiBaseUrl,
  isDvasBackendEnabled,
  type ApiError,
} from "./api";
import { workbenchSnapshot } from "./mockData";
import {
  loadBackendWorkspaceSnapshot,
  markSnapshotSource,
} from "./services/backendWorkspace";
import type { WorkbenchSnapshot } from "./types";

const initialWorkbenchSnapshot: WorkbenchSnapshot = {
  ...workbenchSnapshot,
  status: "UTILITY_CALCULATED",
  backend: {
    apiBaseUrl: getDvasApiBaseUrl(),
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

export type DataSourceMode = "mock" | "backend" | "mock_fallback";

export interface DataSourceState {
  mode: DataSourceMode;
  lastSyncAt?: string;
  lastError?: ApiError;
  backendAvailable?: boolean;
}

export interface WorkbenchStore {
  snapshot: WorkbenchSnapshot;
  lastMessage: string;
  dataSource: DataSourceState;
}

export function createWorkbenchStore(): WorkbenchStore {
  return {
    snapshot: markSnapshotSource(initialWorkbenchSnapshot, "mock"),
    lastMessage: "演示工作区已加载，所有操作会写入本地模拟记录。",
    dataSource: {
      mode: "mock",
      backendAvailable: false,
    },
  };
}

export function shouldAttemptBackendSync(search = "") {
  const params = new URLSearchParams(search);
  return isDvasBackendEnabled() || params.get("backend") === "1";
}

export async function loadBackendWorkbenchStore(
  fallbackStore = createWorkbenchStore(),
): Promise<WorkbenchStore> {
  const result = await loadBackendWorkspaceSnapshot(fallbackStore.snapshot);
  if (result.ok && result.data) {
    return {
      ...fallbackStore,
      snapshot: result.data,
      lastMessage: "后端 API 已连接，工作区已同步。（数据来源：后端）",
      dataSource: {
        mode: "backend",
        lastSyncAt: result.data.backend?.lastSyncedAt ?? new Date().toISOString(),
        backendAvailable: true,
      },
    };
  }

  const fallbackSnapshot = markSnapshotSource(fallbackStore.snapshot, "mock_fallback");
  return {
    ...fallbackStore,
    snapshot: fallbackSnapshot,
    lastMessage: fallbackMessage(
      result.error,
      "dashboard workspace sync",
    ),
    dataSource: {
      mode: "mock_fallback",
      lastError: result.error,
      backendAvailable: false,
    },
  };
}

export function fallbackMessage(error: ApiError | undefined, location: string) {
  const problem = error?.errorMessage ?? "后端 API 暂不可用";
  const suggestion =
    error?.repairSuggestion ?? "确认后端服务已启动后刷新页面。";
  return `${problem}，已回退本地模拟数据。位置：${location}。建议：${suggestion}`;
}
