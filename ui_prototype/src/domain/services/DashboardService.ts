import type { MockDomainService } from "./serviceTypes";
import { dvasApi, normalizeApiError } from "../api";
import type { WorkbenchSnapshot } from "../types";
import {
  markSnapshotSource,
  refreshStoreFromBackend,
  shouldUseBackend,
} from "./backendWorkspace";
import {
  appendAudit,
  appendSnapshot,
  getMockState,
  readPageFromStore,
  writeMockServiceResult,
} from "./serviceTypes";

export const DashboardService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action) {
    if (action.id === "SYS-002") {
      const mockStore = selectDemoDataInMock(store);
      if (shouldUseBackend()) {
        return initializeDemoFromBackend(store, mockStore);
      }

      return {
        ...mockStore,
        snapshot: markSnapshotSource(mockStore.snapshot, "mock"),
        lastMessage: "演示数据已初始化，已生成输入快照和审计记录。（数据来源：本地模拟）",
      };
    }

    if (action.id === "SYS-004") {
      const mock = getMockState(store.snapshot);
      let snapshot: WorkbenchSnapshot = {
        ...store.snapshot,
        status: "WEIGHT_CALCULATED" as const,
        mock: {
          ...mock,
          mdsTasks: [
            {
              taskName: `完整链路 MD-DShap 任务 ${mock.mdsTasks.length + 1}`,
              algorithmMode: "MD_DSHAP",
              status: "已完成",
              progress: 100,
              seed: 20260618,
              sampleRounds: 512,
              epsilon: 0.0001,
              saveMarginalDetail: true,
              createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
            },
            ...mock.mdsTasks,
          ],
          mdsWeights: [
            {
              partyName: "数据源主体甲",
              normalizedWeight: 0.4628,
              marginalContribution: 0.2184,
              qualityFactor: 1.08,
              utilityValue: 0.524316,
              status: "已归一化",
            },
            {
              partyName: "数据源主体乙",
              normalizedWeight: 0.3239,
              marginalContribution: 0.1531,
              qualityFactor: 1.03,
              utilityValue: 0.363744,
              status: "已归一化",
            },
            {
              partyName: "数据源主体丙",
              normalizedWeight: 0.2133,
              marginalContribution: 0.1008,
              qualityFactor: 0.98,
              utilityValue: 0.241918,
              status: "已归一化",
            },
          ],
        },
      };

      for (const item of [
        { name: "质量评估快照", type: "QUALITY_OUTPUT", status: "已生成" },
        { name: "数元计量快照", type: "METERING_OUTPUT", status: "已生成" },
        { name: "效用计算快照", type: "UTILITY_OUTPUT", status: "已生成" },
        { name: "MD-DShap 权重快照", type: "MDS_OUTPUT", status: "已生成" },
      ]) {
        snapshot = appendSnapshot(snapshot, item);
      }

      snapshot = appendAudit(snapshot, {
        operation: "执行完整链路计算",
        objectType: "计算流水线",
        status: "成功",
        summary: "完成质量、计量、效用和 MD-DShap 权重计算。",
      });

      return {
        ...store,
        snapshot,
        lastMessage: "完整链路模拟计算已完成，项目状态推进到已计算权重。",
      };
    }

    if (action.id === "SYS-005" && shouldUseBackend()) {
      const mockStore = writeMockServiceResult("DashboardService", store, action);
      return refreshStoreFromBackend(
        store,
        "风险边界和仪表盘摘要已从后端刷新。",
        mockStore,
      );
    }

    return writeMockServiceResult("DashboardService", store, action);
  },
};

function selectDemoDataInMock(store: Parameters<MockDomainService["handleAction"]>[0]) {
  let snapshot = appendSnapshot(store.snapshot, {
    name: "演示数据输入快照",
    type: "INPUT",
    status: "已生成",
  });
  snapshot = appendAudit(snapshot, {
    operation: "选择演示数据",
    objectType: "数据包",
    status: "成功",
    summary: "初始化演示数据、资源清单和参与方边界。",
  });

  return {
    ...store,
    snapshot: {
      ...snapshot,
      status: "INGESTED" as const,
    },
    lastMessage: "演示数据已初始化，已生成输入快照和审计记录。",
  };
}

async function initializeDemoFromBackend(
  store: Parameters<MockDomainService["handleAction"]>[0],
  fallbackStore: Parameters<MockDomainService["handleAction"]>[0],
) {
  try {
    await dvasApi.initializeDemoCase();
    return refreshStoreFromBackend(
      store,
      "演示数据已由后端初始化，仪表盘和前置条件已刷新。",
      fallbackStore,
    );
  } catch (error) {
    const normalized = normalizeApiError(error);
    return {
      ...fallbackStore,
      snapshot: markSnapshotSource(fallbackStore.snapshot, "mock_fallback"),
      lastMessage: `后端初始化失败，已回退本地模拟：${normalized.errorMessage}`,
    };
  }
}
