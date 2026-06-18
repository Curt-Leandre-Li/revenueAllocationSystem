import { createMockWorkspaceState } from "../mockData";
import type {
  ActionDefinition,
  ActionPayload,
  AuditLogRecord,
  ExportFileRecord,
  MockWorkspaceState,
  ReportRecord,
  RoutePath,
  SnapshotRecord,
  WorkbenchSnapshot,
} from "../types";
import type { WorkbenchStore } from "../store";

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
  return snapshot.mock ?? createMockWorkspaceState();
}

export function nowText() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}

export function appendAudit(
  snapshot: WorkbenchSnapshot,
  record: Omit<AuditLogRecord, "operator" | "createdAt">,
) {
  const mock = getMockState(snapshot);
  const auditRecord: AuditLogRecord = {
    ...record,
    operator: snapshot.operator,
    createdAt: nowText(),
  };

  return {
    ...snapshot,
    mock: {
      ...mock,
      auditLogs: [auditRecord, ...mock.auditLogs].slice(0, 12),
    },
  };
}

export function appendSnapshot(
  snapshot: WorkbenchSnapshot,
  record: Omit<SnapshotRecord, "createdAt">,
) {
  const mock = getMockState(snapshot);
  const snapshotRecord: SnapshotRecord = {
    ...record,
    createdAt: nowText(),
  };

  return {
    ...snapshot,
    mock: {
      ...mock,
      snapshots: [snapshotRecord, ...mock.snapshots].slice(0, 12),
    },
  };
}

export function appendReport(
  snapshot: WorkbenchSnapshot,
  record: Omit<ReportRecord, "createdAt">,
) {
  const mock = getMockState(snapshot);
  const reportRecord: ReportRecord = {
    ...record,
    createdAt: nowText(),
  };

  return {
    ...snapshot,
    mock: {
      ...mock,
      reports: [reportRecord, ...mock.reports].slice(0, 12),
    },
  };
}

export function appendExport(
  snapshot: WorkbenchSnapshot,
  record: Omit<ExportFileRecord, "createdAt">,
) {
  const mock = getMockState(snapshot);
  const exportRecord: ExportFileRecord = {
    ...record,
    createdAt: nowText(),
  };

  return {
    ...snapshot,
    mock: {
      ...mock,
      exports: [exportRecord, ...mock.exports].slice(0, 12),
    },
  };
}

export function withMockState(
  store: WorkbenchStore,
  mock: MockWorkspaceState,
  message: string,
  snapshotPatch: Partial<WorkbenchSnapshot> = {},
): WorkbenchStore {
  return {
    ...store,
    snapshot: {
      ...store.snapshot,
      ...snapshotPatch,
      mock,
    },
    lastMessage: message,
  };
}

export function writeMockServiceResult(
  serviceName: string,
  store: WorkbenchStore,
  action: ActionDefinition,
): WorkbenchStore {
  const snapshot = appendAudit(store.snapshot, {
    operation: action.label,
    objectType: action.audit.objectType,
    status: "已记录",
    summary: action.sideEffect,
  });

  return {
    ...store,
    snapshot,
    lastMessage: `${serviceName} 已接收 ${action.id}：${action.sideEffect}`,
  };
}
