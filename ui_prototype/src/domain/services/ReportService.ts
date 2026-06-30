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
  handleAction(store, action, payload) {
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
        () => dvasApi.generateMdDshapAuditReport(),
        "MD-DShap 算法审计说明已由后端导出，项目状态和报告记录已刷新。",
        "report md-dshap-audit",
      );
    }

    if (action.id === "REP-003") {
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.generatePdfReport(),
        "PDF 报告已由后端生成，历史报告和文件校验和已刷新。",
        "report pdf",
      );
    }

    if (action.id === "REP-010") {
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.listProjectReports(),
        "历史报告已从后端刷新。",
        "report history",
      );
    }

    if (action.id === "REP-011") {
      if (payload?.kind !== "download-file" || !payload.reportId) {
        return refreshStoreFromBackend(store, "请选择需要下载的历史报告。");
      }
      const reportId = payload.reportId;
      const exportFileId = payload.exportFileId;
      return mutateBackendAndRefresh(
        store,
        async () => {
          const file = await dvasApi.downloadReport(reportId, exportFileId);
          downloadBase64File(
            file.file_name,
            file.content_base64,
            file.mime_type ?? "application/octet-stream",
          );
          return file;
        },
        "报告文件已通过后端权限校验并下载。",
        "report download",
      );
    }

    if (action.id === "REP-012") {
      if (payload?.kind !== "download-file" || !payload.reportId) {
        return refreshStoreFromBackend(store, "请选择需要归档的历史报告。");
      }
      const reportId = payload.reportId;
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.archiveReport(reportId),
        "历史报告已归档，文件和审计记录保留。",
        "report archive",
      );
    }

    return backendUnavailableStore(store, action.label, "report action");
  },
};

function downloadBase64File(fileName: string, contentBase64: string, mimeType: string) {
  const bytes = Uint8Array.from(window.atob(contentBase64), (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
}
