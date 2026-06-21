import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import type { ActionPayload } from "../types";
import { backendUnavailableStore, refreshStoreFromBackend } from "./backendWorkspace";

export const ConstraintService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action, payload) {
    if (action.id === "CONS-002") {
      requireConstraintUpsertPayload(payload);
      return backendUnavailableStore(store, action.label, "constraint create");
    }

    if (action.id === "CONS-003") {
      const constraint = requireConstraintUpsertPayload(payload);
      if (!constraint.constraintId) {
        throw new Error("编辑合同约束缺少 constraint_id");
      }
      return backendUnavailableStore(store, action.label, "constraint update");
    }

    if (action.id === "CONS-004") {
      if (!payload || payload.kind !== "constraint-status") {
        throw new Error("合同约束启停缺少 constraint_id/status");
      }
      return backendUnavailableStore(store, action.label, "constraint status");
    }

    if (action.id === "CONS-011") {
      return refreshStoreFromBackend(store, "合同约束与应用结果已从后端刷新。");
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
