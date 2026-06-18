import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore, writeMockServiceResult } from "./serviceTypes";
import { dvasApi } from "../apiClient";
import { formatApiError, loadWorkbenchSnapshotFromBackend } from "../backendAdapter";

export const QualityService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action) {
    if (
      store.snapshot.backend?.connected &&
      (action.id === "QUAL-003" || action.id === "QUAL-006")
    ) {
      return runQualityAssessmentFromBackend(store, action.label);
    }
    return writeMockServiceResult("QualityService", store, action);
  },
};

async function runQualityAssessmentFromBackend(
  store: Parameters<MockDomainService["handleAction"]>[0],
  label: string,
) {
  try {
    await dvasApi.runQualityAssessment();
    const snapshot = await loadWorkbenchSnapshotFromBackend();
    return {
      ...store,
      snapshot: {
        ...snapshot,
        mock: store.snapshot.mock ?? snapshot.mock,
      },
      lastMessage: `${label} 已完成，质量结果、仪表盘和前置条件已刷新。`,
    };
  } catch (error) {
    return {
      ...store,
      lastMessage: `${label} 未执行：${formatApiError(error)}`,
    };
  }
}
