import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import { dvasApi, formatApiError } from "../api";
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
      if (payload?.kind !== "data-package-upload" || !(payload.file instanceof File)) {
        return backendUnavailableStore(
          store,
          action.label,
          "data package JSON upload requires File payload",
        );
      }
      return dvasApi
        .uploadDataPackageFile(payload.file)
        .then(() =>
          refreshStoreFromBackend(
            store,
            `${payload.fileName} 已提交后端校验，项目状态已刷新。`,
          ),
        )
        .catch(async (error) => {
          const refreshed = await refreshStoreFromBackend(
            store,
            `${payload.fileName} 校验失败，失败详情已从后端刷新。`,
          );
          return {
            ...refreshed,
            lastMessage: `上传校验失败，当前页面未用 mock 伪造成功。${formatApiError(error)}`,
          };
        });
    }

    if (action.id === "DATA-010" || action.id === "DATA-011") {
      const templateRequest =
        action.id === "DATA-010" ? dvasApi.downloadCsvTemplate : dvasApi.downloadXlsxTemplate;
      return mutateBackendAndRefresh(
        store,
        async () => {
          const file = await templateRequest();
          downloadBase64File(
            file.file_name,
            file.content_base64,
            file.mime_type ?? "application/octet-stream",
          );
          return file;
        },
        `${action.label} 已从后端生成并下载。`,
        "data package template download",
      );
    }

    if (action.id === "DATA-012") {
      if (
        payload?.kind !== "data-package-template-import" ||
        !(payload.file instanceof File)
      ) {
        return backendUnavailableStore(
          store,
          action.label,
          "CSV/XLSX template import requires File payload",
        );
      }
      const importRequest =
        payload.templateType === "CSV" ? dvasApi.importCsvPackage : dvasApi.importXlsxPackage;
      return importRequest(payload.file)
        .then(() =>
          refreshStoreFromBackend(
            store,
            `${payload.fileName} 已完成模板导入，数据包、快照和校验结果已刷新。`,
          ),
        )
        .catch(async (error) => {
          const refreshed = await refreshStoreFromBackend(
            store,
            `${payload.fileName} 模板导入失败，失败详情已从后端刷新。`,
          );
          return {
            ...refreshed,
            lastMessage: `模板导入失败，当前页面未用 mock 伪造成功。${formatApiError(error)}`,
          };
        });
    }

    if (action.id === "DATA-009") {
      if (payload?.kind !== "data-package-delete" || !payload.packageId) {
        return backendUnavailableStore(
          store,
          action.label,
          "data package delete requires package_id payload",
        );
      }
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.deleteDataPackage(payload.packageId),
        `${payload.packageName || payload.packageId} 已删除，数据包列表和项目状态已刷新。`,
        "data package delete",
      );
    }

    if (action.id === "DATA-007" || action.id === "DATA-008") {
      return refreshStoreFromBackend(store, "数据接入信息已从后端刷新。");
    }

    return backendUnavailableStore(store, action.label, "data package action");
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
