import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import { dvasApi } from "../api";
import type { ActionPayload } from "../types";
import {
  backendUnavailableStore,
  mutateBackendAndRefresh,
  refreshStoreFromBackend,
} from "./backendWorkspace";

export const ConstraintService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action, payload) {
    if (action.id === "CONS-002") {
      if (payload?.kind === "contract-ratio-save") {
        return mutateBackendAndRefresh(
          store,
          () => dvasApi.saveCurrentContractRatio(toContractRatioPayload(payload)),
          "合同比例分配方案已由后端保存，合同页和模拟页已刷新。",
          "contract ratio save",
        );
      }
      const constraint = requireConstraintUpsertPayload(payload);
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.createAllocationConstraint(toConstraintWritePayload(constraint)),
        "合同约束已由后端新增，约束列表、分配快照和项目状态已刷新。",
        "constraint create",
      );
    }

    if (action.id === "CONS-003") {
      if (payload?.kind === "contract-ratio-save") {
        return mutateBackendAndRefresh(
          store,
          () => dvasApi.saveCurrentContractRatio(toContractRatioPayload(payload)),
          "合同比例分配方案已由后端保存，合同页和模拟页已刷新。",
          "contract ratio save",
        );
      }
      const constraint = requireConstraintUpsertPayload(payload);
      if (!constraint.constraintId) {
        throw new Error("编辑合同约束缺少 constraint_id");
      }
      return mutateBackendAndRefresh(
        store,
        () =>
          dvasApi.updateAllocationConstraint(
            constraint.constraintId ?? "",
            toConstraintWritePayload(constraint),
          ),
        "合同约束已由后端更新，约束列表、分配快照和项目状态已刷新。",
        "constraint update",
      );
    }

    if (action.id === "CONS-004") {
      if (payload?.kind === "contract-ratio-clear") {
        return mutateBackendAndRefresh(
          store,
          () => dvasApi.clearCurrentContractRatio(),
          "合同比例分配方案已由后端清空，合同页和模拟页已刷新。",
          "contract ratio clear",
        );
      }
      if (!payload || payload.kind !== "constraint-status") {
        throw new Error("合同约束启停缺少 constraint_id/status");
      }
      return mutateBackendAndRefresh(
        store,
        () =>
          dvasApi.updateAllocationConstraintStatus(
            payload.constraintId,
            payload.status,
            payload.description,
          ),
        "合同约束状态已由后端更新，约束列表、分配快照和项目状态已刷新。",
        "constraint status",
      );
    }

    if (action.id === "CONS-011") {
      return refreshStoreFromBackend(store, "合同比例方案与可模拟状态已从后端刷新。");
    }

    return backendUnavailableStore(store, action.label, "constraint action");
  },
};

function requireConstraintUpsertPayload(payload?: ActionPayload) {
  if (!payload || payload.kind !== "constraint-upsert") {
    throw new Error("合同约束保存缺少表单参数");
  }
  return payload;
}

function toConstraintWritePayload(
  payload: Extract<ActionPayload, { kind: "constraint-upsert" }>,
) {
  return {
    party_id: payload.partyId,
    constraint_name: payload.constraintName,
    constraint_type: payload.constraintType,
    value_type: payload.valueType,
    constraint_value: payload.constraintValue,
    priority: payload.priority,
    status: payload.status ?? "ACTIVE",
    description: payload.description,
  };
}

function toContractRatioPayload(
  payload: Extract<ActionPayload, { kind: "contract-ratio-save" }>,
) {
  return {
    total_revenue: payload.totalRevenue,
    currency: payload.currency,
    data_provider_pool_ratio: payload.dataProviderPoolRatio,
    items: payload.items.map((item) => ({
      bucket_type: item.bucketType,
      party_id: item.partyId,
      ratio: item.ratio,
      basis_text: item.basisText,
    })),
  };
}
