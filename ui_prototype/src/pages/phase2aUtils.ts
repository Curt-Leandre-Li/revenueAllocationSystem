import { createMockWorkspaceState } from "../domain/mockData";
import type { MockWorkspaceState, WorkbenchSnapshot } from "../domain/types";

export function getMockWorkspace(snapshot: WorkbenchSnapshot): MockWorkspaceState {
  return snapshot.mock ?? createMockWorkspaceState();
}

export function formatAmount(value: number) {
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPercent(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatWeight(value: number) {
  return value.toFixed(6);
}

export function isResourceBlocked(resource: {
  includeInCalculation: boolean;
  providerName: string;
}) {
  return (
    resource.includeInCalculation &&
    (resource.providerName === "未关联" || resource.providerName === "")
  );
}
