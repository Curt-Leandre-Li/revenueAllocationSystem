import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import { dvasApi } from "../api";
import {
  backendUnavailableStore,
  mutateBackendAndRefresh,
  refreshStoreFromBackend,
} from "./backendWorkspace";

export const ReportService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action) {
    if (action.id === "REP-001") {
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.previewReport(),
        "报告预览已从后端读取。",
        "report preview",
      );
    }

    if (action.id === "REP-002") {
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.generateMarkdownReport(),
        "Markdown 报告已由后端生成，项目状态和报告记录已刷新。",
        "report markdown",
      );
    }

    if (action.id === "REP-004") {
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.generateCsvReport(),
        "CSV 明细已由后端导出，项目状态和报告记录已刷新。",
        "report csv",
      );
    }

    if (action.id === "REP-005") {
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.generateJsonReport(),
        "JSON 结果已由后端导出，项目状态和报告记录已刷新。",
        "report json",
      );
    }

    if (action.id === "REP-006") {
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.exportAuditLog(),
        "审计日志 JSONL 已由后端导出，项目状态和报告记录已刷新。",
        "report audit-log",
      );
    }

    return backendUnavailableStore(store, action.label, "report action");
  },
};
