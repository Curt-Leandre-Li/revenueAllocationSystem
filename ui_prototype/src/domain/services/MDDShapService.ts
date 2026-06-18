import type { MockDomainService } from "./serviceTypes";
import type { WorkbenchSnapshot } from "../types";
import {
  appendAudit,
  appendExport,
  appendReport,
  appendSnapshot,
  getMockState,
  nowText,
  readPageFromStore,
  writeMockServiceResult,
} from "./serviceTypes";

function buildWeightRecords() {
  return [
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
  ];
}

function buildTraceRecords() {
  return [
    {
      coalition: "{甲,乙}",
      partyName: "数据源主体丙",
      vBefore: 0.73421,
      vAfter: 0.83504,
      marginalContribution: 0.10083,
    },
    {
      coalition: "{甲}",
      partyName: "数据源主体乙",
      vBefore: 0.52432,
      vAfter: 0.67741,
      marginalContribution: 0.15309,
    },
    {
      coalition: "{}",
      partyName: "数据源主体甲",
      vBefore: 0,
      vAfter: 0.21843,
      marginalContribution: 0.21843,
    },
  ];
}

export const MDDShapService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action, payload) {
    if (action.id === "MDS-011" || action.id === "MDS-016") {
      const mock = getMockState(store.snapshot);
      const params =
        payload?.kind === "mds-parameters"
          ? payload
          : {
              seed: 20260618,
              sampleRounds: 512,
              epsilon: 0.0001,
              saveMarginalDetail: true,
            };
      const taskName =
        action.id === "MDS-016"
          ? `MD-DShap 重算任务 ${mock.mdsTasks.length + 1}`
          : `MD-DShap 权重任务 ${mock.mdsTasks.length + 1}`;
      let snapshot: WorkbenchSnapshot = {
        ...store.snapshot,
        status: "WEIGHT_CALCULATED" as const,
        mock: {
          ...mock,
          mdsTasks: [
            {
              taskName,
              algorithmMode: "MD_DSHAP",
              status: "已完成",
              progress: 100,
              seed: params.seed,
              sampleRounds: params.sampleRounds,
              epsilon: params.epsilon,
              saveMarginalDetail: params.saveMarginalDetail,
              createdAt: nowText(),
            },
            ...mock.mdsTasks,
          ],
          mdsWeights: buildWeightRecords(),
          mdsTraces: buildTraceRecords(),
        },
      };

      snapshot = appendSnapshot(snapshot, {
        name: `${taskName} 输入快照`,
        type: "MDS_INPUT",
        status: "已生成",
      });
      snapshot = appendSnapshot(snapshot, {
        name: `${taskName} 权重输出快照`,
        type: "MDS_OUTPUT",
        status: "已生成",
      });
      snapshot = appendSnapshot(snapshot, {
        name: `${taskName} 算法审计快照`,
        type: "ALGORITHM_AUDIT",
        status: "已生成",
      });
      snapshot = appendAudit(snapshot, {
        operation: action.id === "MDS-016" ? "重新计算 MD-DShap" : "启动 MD-DShap 计算",
        objectType: "MD-DShap 任务",
        status: "成功",
        summary: "生成任务、权重结果、边际贡献轨迹和算法审计快照。",
      });

      return {
        ...store,
        snapshot,
        lastMessage:
          action.id === "MDS-016"
            ? "已生成新的 MD-DShap 任务版本，历史任务未覆盖。"
            : "MD-DShap 计算已完成，权重合计为 1.000000。",
      };
    }

    if (action.id === "MDS-017") {
      let snapshot = appendExport(store.snapshot, {
        fileName: "md_dshap_weights_phase2a.json",
        fileType: "JSON",
        status: "已生成",
        fieldScope: "算法模式、参与方权重、边际贡献摘要、参数版本",
      });
      snapshot = appendReport(snapshot, {
        name: "MD-DShap 算法结果",
        type: "md_dshap_result",
        status: "已生成",
        fieldScope: "权重结果与边际贡献摘要",
      });
      snapshot = appendAudit(snapshot, {
        operation: "导出算法结果",
        objectType: "算法结果",
        status: "成功",
        summary: "生成算法结果导出文件和报告记录。",
      });
      return {
        ...store,
        snapshot,
        lastMessage: "算法结果已生成 JSON 导出和报告记录。",
      };
    }

    if (action.id === "MDS-018") {
      let snapshot = appendReport(store.snapshot, {
        name: "MD-DShap 算法审计说明",
        type: "md_dshap_audit_report",
        status: "已生成",
        fieldScope: "算法版本、参数、输入快照、输出快照、模拟边界",
      });
      snapshot = appendAudit(snapshot, {
        operation: "生成算法审计说明",
        objectType: "算法审计说明",
        status: "成功",
        summary: "生成 md_dshap_audit_report mock 记录。",
      });
      return {
        ...store,
        snapshot,
        lastMessage: "算法审计说明已生成，可在报告记录中查看。",
      };
    }

    if (["MDS-012", "MDS-013", "MDS-014", "MDS-015"].includes(action.id)) {
      const snapshot = appendAudit(store.snapshot, {
        operation: action.label,
        objectType: "MD-DShap 只读查看",
        status: "成功",
        summary: action.sideEffect,
      });
      return {
        ...store,
        snapshot,
        lastMessage: `${action.label} 已打开并记录只读审计。`,
      };
    }

    return writeMockServiceResult("MDDShapService", store, action);
  },
};
