import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import { dvasApi } from "../api";
import type { ActionPayload } from "../types";
import {
  backendUnavailableStore,
  mutateBackendAndRefresh,
  refreshStoreFromBackend,
} from "./backendWorkspace";

export const PartyService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action, payload) {
    if (action.id === "PARTY-002") {
      const party = requirePartyUpsertPayload(payload);
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.createParty(toPartyWritePayload(party)),
        "参与方已由后端新增，参与方列表和项目状态已刷新。",
        "party create",
      );
    }

    if (action.id === "PARTY-003") {
      const party = requirePartyUpsertPayload(payload);
      if (!party.partyId) {
        throw new Error("编辑参与方缺少 party_id");
      }
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.updateParty(party.partyId ?? "", toPartyWritePayload(party)),
        "参与方已由后端更新，参与方列表和项目状态已刷新。",
        "party update",
      );
    }

    if (action.id === "PARTY-005") {
      if (!payload || payload.kind !== "party-status") {
        throw new Error("参与方启停缺少 party_id/status");
      }
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.updatePartyStatus(payload.partyId, payload.status, payload.reason),
        "参与方状态已由后端更新，参与方列表和项目状态已刷新。",
        "party status",
      );
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

function toPartyWritePayload(payload: Extract<ActionPayload, { kind: "party-upsert" }>) {
  return {
    party_name: payload.partyName,
    party_type: payload.partyType,
    include_in_md_dshap: payload.includeInMdDshap,
    credit_code: payload.creditCode,
    contact_name: payload.contactName,
    description: payload.description,
  };
}
