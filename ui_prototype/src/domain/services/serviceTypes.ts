import type {
  ActionDefinition,
  ActionPayload,
  MockWorkspaceState,
  RoutePath,
  WorkbenchSnapshot,
} from "../types";
import type { ApiError } from "../api";
import type { WorkbenchStore } from "../store";

export type ServiceResult<T> = {
  ok: boolean;
  data?: T;
  error?: ApiError;
  source: "backend" | "backend_unavailable";
};

export type ServiceActionHandler = (
  store: WorkbenchStore,
  action: ActionDefinition,
  payload?: ActionPayload,
) => WorkbenchStore | Promise<WorkbenchStore>;

export interface MockDomainService {
  readPage: (store: WorkbenchStore, routePath: RoutePath) => unknown;
  handleAction: ServiceActionHandler;
}

export function readPageFromStore(store: WorkbenchStore, routePath: RoutePath) {
  return store.snapshot.pages[routePath];
}

export function getMockState(snapshot: WorkbenchSnapshot): MockWorkspaceState {
  return snapshot.mock ?? {
    currentRevenuePool: 0,
    auditLogs: [],
    snapshots: [],
    reports: [],
    exports: [],
    resources: [],
    dataProviders: [],
    mdsParticipants: [],
    mdsWeights: [],
    mdsTraces: [],
    mdsTasks: [],
  };
}

export function writeMockServiceResult(
  serviceName: string,
  store: WorkbenchStore,
  action: ActionDefinition,
): WorkbenchStore {
  return {
    ...store,
    lastMessage: `${serviceName} 未执行 ${action.id}：后端接口未接入，前端不会写入本地成功态。`,
  };
}
