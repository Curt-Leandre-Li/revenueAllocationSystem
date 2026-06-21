import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import type { ActionPayload } from "../types";
import { backendUnavailableStore, refreshStoreFromBackend } from "./backendWorkspace";

export const PartyService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action, payload) {
    if (action.id === "PARTY-002") {
      requirePartyUpsertPayload(payload);
      return backendUnavailableStore(store, action.label, "party create");
    }

    if (action.id === "PARTY-003") {
      const party = requirePartyUpsertPayload(payload);
      if (!party.partyId) {
        throw new Error("编辑参与方缺少 party_id");
      }
      return backendUnavailableStore(store, action.label, "party update");
    }

    if (action.id === "PARTY-005") {
      if (!payload || payload.kind !== "party-status") {
        throw new Error("参与方启停缺少 party_id/status");
      }
      return backendUnavailableStore(store, action.label, "party status");
    }

    if (action.id === "PARTY-008") {
      return refreshStoreFromBackend(store, "参与方、贡献和权重摘要已从后端刷新。");
    }

    return backendUnavailableStore(store, action.label, "party action");
  },
};

function requirePartyUpsertPayload(payload?: ActionPayload) {
  if (!payload || payload.kind !== "party-upsert") {
    throw new Error("参与方保存缺少表单参数");
  }
  return payload;
}
