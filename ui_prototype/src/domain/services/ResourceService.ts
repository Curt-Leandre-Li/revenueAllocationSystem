import type { MockDomainService } from "./serviceTypes";
import { dvasApi, normalizeApiError } from "../api";
import {
  markSnapshotSource,
  refreshStoreFromBackend,
  shouldUseBackend,
} from "./backendWorkspace";
import {
  appendAudit,
  appendExport,
  appendReport,
  getMockState,
  readPageFromStore,
  writeMockServiceResult,
} from "./serviceTypes";

export const ResourceService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action, payload) {
    if (action.id === "RES-002" && shouldUseBackend()) {
      const fallbackStore = readResourceDetailInMock(store);
      return readResourceDetailFromBackend(store, fallbackStore, payload);
    }

    if (action.id === "RES-005" && payload?.kind === "resource-binding") {
      const mock = getMockState(store.snapshot);
      const resources = mock.resources.map((resource) =>
        resource.resourceKey === payload.resourceKey
          ? {
              ...resource,
              providerName: payload.providerName,
              splitRatio: payload.splitRatio,
              status: resource.includeInCalculation ? "有效" : resource.status,
              technicalDetails: {
                ...resource.technicalDetails,
                relation_id: `relation-${resource.resourceKey}-${payload.providerName}`,
              },
            }
          : resource,
      );

      let snapshot = {
        ...store.snapshot,
        mock: {
          ...mock,
          resources,
        },
      };
      snapshot = appendAudit(snapshot, {
        operation: "数据源主体关联",
        objectType: "数据资源",
        status: "成功",
        summary: `${payload.providerName} 已关联到资源，拆分比例 ${payload.splitRatio}%。`,
      });

      return {
        ...store,
        snapshot,
        lastMessage: "资源主体归属已保存，已写入关联变更审计。",
      };
    }

    if (action.id === "RES-005" && payload?.kind === "resource-calculation-toggle") {
      const mock = getMockState(store.snapshot);
      const resources = mock.resources.map((resource) => {
        if (resource.resourceKey !== payload.resourceKey) {
          return resource;
        }
        const isBlocked =
          payload.includeInCalculation &&
          (resource.providerName === "未关联" || resource.providerName === "");
        return {
          ...resource,
          includeInCalculation: payload.includeInCalculation,
          status: isBlocked
            ? "阻断"
            : payload.includeInCalculation
              ? "有效"
              : "不进入计算",
        };
      });

      const nextMock = {
        ...mock,
        resources,
      };
      const snapshot = appendAudit(
        {
          ...store.snapshot,
          mock: nextMock,
        },
        {
          operation: "更新资源计算设置",
          objectType: "数据资源",
          status: "成功",
          summary: payload.includeInCalculation
            ? "资源已设置为进入后续计算。"
            : "资源已设置为不进入后续计算。",
        },
      );

      return {
        ...store,
        snapshot,
        lastMessage: "资源计算设置已更新；若进入计算但未关联主体，将阻断后续评估和 MD-DShap。",
      };
    }

    if (action.id === "RES-007") {
      let snapshot = appendExport(store.snapshot, {
        fileName: "resource_summary_phase2a.csv",
        fileType: "CSV",
        status: "已生成",
        fieldScope: "资源名称、模态、字段数、样本数、缺失率、主体归属、是否进入后续计算；不导出敏感原文",
      });
      snapshot = appendReport(snapshot, {
        name: "资源盘点与主体归属摘要",
        type: "resource_summary",
        status: "已生成",
        fieldScope: "脱敏资源统计与主体归属",
      });
      snapshot = appendAudit(snapshot, {
        operation: "导出资源摘要",
        objectType: "数据资源",
        status: "成功",
        summary: "生成资源摘要 CSV/报告记录，不包含敏感原文。",
      });

      return {
        ...store,
        snapshot,
        lastMessage: "资源摘要已生成导出文件和报告记录。",
      };
    }

    if (action.id === "RES-002") {
      const mockStore = readResourceDetailInMock(store);
      return {
        ...mockStore,
        snapshot: markSnapshotSource(mockStore.snapshot, "mock"),
      };
    }

    return writeMockServiceResult("ResourceService", store, action);
  },
};

function readResourceDetailInMock(store: Parameters<MockDomainService["handleAction"]>[0]) {
  const snapshot = appendAudit(store.snapshot, {
    operation: "查看资源详情",
    objectType: "数据资源",
    status: "成功",
    summary: "打开资源详情抽屉，读取字段统计、脱敏预览和主体归属。",
  });
  return {
    ...store,
    snapshot,
    lastMessage: "资源详情已打开，并记录只读审计。（数据来源：本地模拟）",
  };
}

async function readResourceDetailFromBackend(
  store: Parameters<MockDomainService["handleAction"]>[0],
  fallbackStore: Parameters<MockDomainService["handleAction"]>[0],
  payload: Parameters<MockDomainService["handleAction"]>[2],
) {
  try {
    if (payload?.kind === "resource-detail") {
      await dvasApi.getDataResourceDetail(payload.resourceKey);
    }
    return refreshStoreFromBackend(
      store,
      "资源详情已从后端读取，资源列表已刷新。",
      fallbackStore,
    );
  } catch (error) {
    const normalized = normalizeApiError(error);
    return {
      ...fallbackStore,
      snapshot: markSnapshotSource(fallbackStore.snapshot, "mock_fallback"),
      lastMessage: `后端资源详情读取失败，已回退本地模拟：${normalized.errorMessage}`,
    };
  }
}
