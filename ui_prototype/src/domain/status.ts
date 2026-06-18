import type { CheckStatus, StatusCode } from "./types";

export const projectStatusFlow: StatusCode[] = [
  "DRAFT",
  "INGESTED",
  "ASSESSED",
  "METERED",
  "UTILITY_CALCULATED",
  "WEIGHT_CALCULATED",
  "ALLOCATED",
  "CONFIRMED",
  "EXPORTED",
];

export const projectStatusLabels: Record<StatusCode, string> = {
  DRAFT: "草稿",
  INGESTED: "已接入",
  ASSESSED: "已评估",
  METERED: "已计量",
  UTILITY_CALCULATED: "已计算效用",
  WEIGHT_CALCULATED: "已计算权重",
  ALLOCATED: "已分配",
  CONFIRMED: "已确认",
  EXPORTED: "已导出",
};

export const checkStatusLabels: Record<CheckStatus, string> = {
  PASS: "通过",
  BLOCKED: "阻塞",
  PENDING: "待处理",
};

export function isLockedStatus(status: StatusCode) {
  return status === "CONFIRMED" || status === "EXPORTED";
}

export function getStatusIndex(status: StatusCode) {
  return projectStatusFlow.indexOf(status);
}
