import { useMemo, useState } from "react";
import type { DataRow, WorkbenchSnapshot } from "../../domain/types";
import {
  numericCellValue,
  optionalCellText,
  pageMetrics,
  pageRows,
} from "../backendPageData";

interface PartyContext {
  partyId: string;
  partyName: string;
  partyTypeCode: string;
  partyTypeLabel: string;
  statusLabel: string;
  isDataProvider: boolean;
  includeInMdDshap: boolean;
}

interface WeightContext {
  partyId: string;
  partyName: string;
  rawWeight: number;
  normalizedWeight: number;
  taskId: string;
}

interface PriorityContext {
  partyId: string;
  partyName: string;
  priorityAmount: number;
  capAmount: number | null;
}

export type ConstraintCheckState =
  | "not_run"
  | "contract_ratio"
  | "no_hits"
  | "has_hits"
  | "unknown";

interface ConstraintCheckContext {
  state: ConstraintCheckState;
  hitCount: number | null;
  adjustmentAmount: number | null;
  traceRows: DataRow[];
  statusText: string;
  detailText: string;
}

const numberFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 0,
});

export function useAllocationContext(snapshot: WorkbenchSnapshot) {
  const partiesPage = snapshot.pages["/data/parties"];
  const mdsPage = snapshot.pages["/allocation/md-dshap"];
  const simulationPage = snapshot.pages["/allocation/simulation"];
  const constraintsPage = snapshot.pages["/allocation/constraints"];
  const dashboardPage = snapshot.pages["/dashboard"];

  const projectId =
    readText(simulationPage?.technicalDetails, "project_id") ||
    readText(mdsPage?.technicalDetails, "project_id") ||
    "current";
  const [storedConfirmed, setStoredConfirmed] = useState(() =>
    readConstraintsConfirmed(projectId),
  );

  return useMemo(() => {
    const parties = pageRows(partiesPage).map(mapParty);
    const partyNameById = new Map(parties.map((item) => [item.partyId, item.partyName]));
    const dataProviders = parties.filter((item) => item.isDataProvider);
    const nonDataParties = parties.filter((item) => !item.isDataProvider);
    const mdEligibleProviders = dataProviders.filter((item) => item.includeInMdDshap);
    const mdEligibleIds = new Set(mdEligibleProviders.map((item) => item.partyId));
    const mdEligibleNames = new Set(mdEligibleProviders.map((item) => item.partyName));
    const mdsWeights = pageRows(mdsPage)
      .map(mapWeight)
      .filter((item) => mdEligibleIds.has(item.partyId) || mdEligibleNames.has(item.partyName));
    const constraints = pageRows(constraintsPage);
    const activeOrdinaryConstraintCount = constraints.filter((row) =>
      ["启用", "ACTIVE"].includes(readText(row, "status")) &&
      readText(row, "constraint_type") !== "PRIORITY_ALLOCATION",
    ).length;
    const allocationResults = pageRows(simulationPage).filter((row) =>
      numberValue(row.post_constraint_amount) !== null,
    );
    const constraintCheck = buildConstraintCheck(allocationResults, simulationPage?.technicalDetails);
    const parsedPriorityItems = parsePriorityItems(
      readText(simulationPage?.technicalDetails, "contract_priority_allocations_json"),
      partyNameById,
    );
    const parsedAllocationPriorityItems = parsePriorityItems(
      readText(simulationPage?.technicalDetails, "allocation_priority_items_json"),
      partyNameById,
    );
    const priorityItems = parsedPriorityItems.length
      ? parsedPriorityItems
      : parsedAllocationPriorityItems.length
        ? parsedAllocationPriorityItems
        : priorityItemsFromConstraints(constraints);
    const activeConstraintCount = activeOrdinaryConstraintCount;
    const priorityTotalAmount =
      numberValue(simulationPage?.technicalDetails.non_data_contract_amount) ??
      numberValue(simulationPage?.technicalDetails.priority_allocation_amount) ??
      priorityItems.reduce((total, item) => total + item.priorityAmount, 0);
    const totalRevenue =
      numberValue(simulationPage?.technicalDetails.total_revenue) ??
      numberValue(allocationResults[0]?.total_revenue) ??
      metricNumber(dashboardPage, "当前收益池") ??
      metricNumber(dashboardPage, "收益池") ??
      metricNumber(dashboardPage, "总收益");
    const dataProviderRevenuePool =
      numberValue(simulationPage?.technicalDetails.data_provider_revenue_pool) ??
      numberValue(allocationResults[0]?.data_provider_revenue_pool);
    const weightSum = mdsWeights.reduce((total, item) => total + item.normalizedWeight, 0);
    const mdsWeightSumValid = mdsWeights.length > 0 && Math.abs(weightSum - 1) <= 0.000001;
    const contractRatioConfigured = ["true", "是", "SAVED", "LOCKED"].includes(
      readText(simulationPage?.technicalDetails, "contract_ratio_configured") ||
        readText(constraintsPage?.technicalDetails, "configured"),
    );
    const contractRatioSum = numberValue(simulationPage?.technicalDetails.contract_ratio_sum) ??
      numberValue(constraintsPage?.technicalDetails.ratio_sum);
    const contractBlockingReasons = parseStringList(
      readText(simulationPage?.technicalDetails, "blocking_reasons_json") ||
      readText(constraintsPage?.technicalDetails, "blocking_reasons_json"),
    );
    const constraintsConfirmed = contractRatioConfigured || storedConfirmed;
    const simulateBlockReasons = contractBlockingReasons.length
      ? contractBlockingReasons
      : [
          contractRatioConfigured ? "" : "请先配置并保存合同比例分配方案",
          mdsWeights.length ? "" : "请先完成 MD-DShap 权重计算",
          mdsWeightSumValid ? "" : "权重合计异常",
          totalRevenue !== null && totalRevenue >= 0 ? "" : "请配置总收益",
          priorityTotalAmount <= (totalRevenue ?? 0) ? "" : "非数据主体合同金额超过总收益",
        ].filter(Boolean);

    return {
      project: {
        projectId,
        status: snapshot.status,
      },
      parties,
      dataProviders,
      nonDataParties,
      activeMdsTask: {
        taskId: readText(mdsPage?.technicalDetails, "current_algorithm_task_id"),
        algorithmMode:
          readText(mdsPage?.technicalDetails, "algorithm_mode") || "MD_DSHAP",
      },
      mdsWeights,
      revenuePool: totalRevenue,
      priorityItems,
      constraints,
      allocationScenario: {
        allocationId: readText(simulationPage?.technicalDetails, "current_allocation_id"),
      },
      allocationResults,
      constraintCheck,
      constraintsConfirmed,
      setConstraintsConfirmed: (value: boolean) => {
        writeConstraintsConfirmed(projectId, value);
        setStoredConfirmed(value);
      },
      readiness: {
        hasMdsWeights: mdsWeights.length > 0,
        mdsWeightSumValid,
        dataProviderCount: mdsWeights.length || dataProviders.length,
        nonDataPartyCount: nonDataParties.length,
        hasRevenuePool: totalRevenue !== null && totalRevenue > 0,
        totalRevenue,
        priorityTotalAmount,
        dataProviderRevenuePool,
        contractRatioConfigured,
        contractRatioSum,
        activeConstraintCount,
        constraintsConfirmed,
        canSimulate: simulateBlockReasons.length === 0,
        simulateBlockReasons,
        weightSum,
        hasAllocationResults: allocationResults.length > 0,
      },
    };
  }, [
    constraintsPage,
    dashboardPage,
    mdsPage,
    partiesPage,
    projectId,
    simulationPage,
    snapshot.status,
    storedConfirmed,
  ]);
}

export function formatAmount(value: number | null | undefined, fallback = "当前尚未配置") {
  return typeof value === "number" && Number.isFinite(value)
    ? numberFormatter.format(value)
    : fallback;
}

export function formatYuan(value: number | null | undefined, fallback = "当前尚未配置") {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  const formatted = value.toLocaleString("zh-CN", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    minimumFractionDigits: 0,
  });
  return `${formatted} 元`;
}

export function formatInteger(value: number | null | undefined, fallback = "当前尚未配置") {
  return typeof value === "number" && Number.isFinite(value)
    ? integerFormatter.format(value)
    : fallback;
}

export function formatWeight(value: number | null | undefined, fallback = "当前尚未配置") {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(6)
    : fallback;
}

export function formatPercent(value: number | null | undefined, fallback = "当前尚未配置") {
  return typeof value === "number" && Number.isFinite(value)
    ? `${(value * 100).toLocaleString("zh-CN", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      })}%`
    : fallback;
}

export function displayPartyName(name: string) {
  return name.trim() || "未命名主体";
}

export function contractPriorityBasisText(partyTypeCode: string, partyTypeLabel = "") {
  const basisByType: Record<string, string> = {
    OPERATOR: "合同比例 / 运营服务费",
    TECH_SERVICE: "合同比例 / 技术服务费",
    SERVICE_PROVIDER: "合同比例 / 技术服务费",
    PILOT_BASE: "合同比例 / 中试服务费",
    EXPERT_REVIEWER: "合同比例 / 专家服务费",
    EXPERT: "合同比例 / 专家服务费",
    CONTRACT_PARTY: "合同比例 / 合同约定费用",
  };
  if (basisByType[partyTypeCode]) {
    return basisByType[partyTypeCode];
  }
  return partyTypeLabel ? `合同比例 / ${partyTypeLabel}` : "合同比例";
}

function mapParty(row: DataRow): PartyContext {
  const partyTypeCode = readText(row, "party_type_code") || readText(row, "party_type");
  const isDataProvider =
    partyTypeCode === "DATA_PROVIDER" ||
    readText(row, "is_data_provider") === "是" ||
    readText(row, "party_type") === "数据源主体";
  return {
    partyId: readText(row, "party_id"),
    partyName: readText(row, "party_name") || "未命名主体",
    partyTypeCode,
    partyTypeLabel: readText(row, "party_type") || partyTypeCode || "未分类主体",
    statusLabel: readText(row, "status") || "待确认",
    isDataProvider,
    includeInMdDshap: ["是", "true", "TRUE", "1"].includes(readText(row, "include_in_md_dshap")),
  };
}

function mapWeight(row: DataRow): WeightContext {
  const normalizedWeight = numberValue(row.normalized_weight) ?? 0;
  return {
    partyId: readText(row, "party_id"),
    partyName: readText(row, "party_name") || "数据源主体",
    rawWeight: numberValue(row.participant_weight) ?? normalizedWeight,
    normalizedWeight,
    taskId: readText(row, "task_id"),
  };
}

function parsePriorityItems(raw: string, partyNameById: Map<string, string>): PriorityContext[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((item) => {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const partyId = readText(row, "party_id");
      return {
        partyId,
        partyName: readText(row, "party_name") || partyNameById.get(partyId) || "非数据主体",
        priorityAmount:
          numberValue(row.actual_priority_amount) ??
          numberValue(row.priority_amount) ??
          numberValue(row.requested_amount) ??
          0,
        capAmount: numberValue(row.cap_amount),
      };
    });
  } catch {
    return [];
  }
}

function priorityItemsFromConstraints(rows: DataRow[]): PriorityContext[] {
  return rows
    .filter((row) => readText(row, "constraint_type") === "PRIORITY_ALLOCATION")
    .map((row) => ({
      partyId: readText(row, "party_id"),
      partyName: readText(row, "party_name") || "非数据主体",
      priorityAmount: 0,
      capAmount: null,
    }));
}

function buildConstraintCheck(
  allocationResults: DataRow[],
  technicalDetails?: DataRow,
): ConstraintCheckContext {
  if (!allocationResults.length) {
    return {
      state: "not_run",
      hitCount: null,
      adjustmentAmount: null,
      traceRows: [],
      statusText: "待执行后生成",
      detailText: "执行收益分配模拟后可查看金额来源和尾差说明。",
    };
  }

  const traceRows = parseTraceRows(readText(technicalDetails, "constraint_traces_json"));
  if (traceRows.length) {
    const adjustmentAmount = traceRows.reduce(
      (total, row) =>
        total + (
          numberValue(row.adjustment_amount) ??
          numberValue(row.constraint_adjustment_amount) ??
          0
        ),
      0,
    );
    return {
      state: "has_hits",
      hitCount: traceRows.length,
      adjustmentAmount,
      traceRows,
      statusText: "历史兼容约束 trace 已返回",
      detailText: `后端返回 ${traceRows.length} 条 constraint_apply_trace，调整合计 ${formatAmount(adjustmentAmount, "0.00")}。`,
    };
  }

  const hasTracePayload = readText(technicalDetails, "constraint_traces_json") !== "";
  const usesContractRatio = allocationResults.some((row) =>
    ["CONTRACT_RATIO", "MD_DSHAP_WEIGHT"].includes(readText(row, "amount_source")),
  );
  if (usesContractRatio) {
    return {
      state: "contract_ratio",
      hitCount: 0,
      adjustmentAmount: 0,
      traceRows: [],
      statusText: "合同比例金额来源",
      detailText: "",
    };
  }

  if (!hasTracePayload) {
    return {
      state: "unknown",
      hitCount: null,
      adjustmentAmount: null,
      traceRows: [],
      statusText: "后端未返回约束 trace",
      detailText: "当前分配结果可展示金额，但无法判断历史兼容约束 trace 状态。",
    };
  }

  return {
    state: "no_hits",
    hitCount: 0,
    adjustmentAmount: 0,
    traceRows: [],
    statusText: "历史兼容约束 trace 为空",
    detailText: "后端返回空 constraint_apply_trace；当前合同比例主路径不依赖普通约束命中结果。",
  };
}

function parseTraceRows(raw: string): DataRow[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map(toDataRow);
  } catch {
    return [];
  }
}

function toDataRow(value: unknown): DataRow {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(
    Object.entries(row).map(([key, cellValue]) => [
      key,
      dataCellValue(cellValue),
    ]),
  );
}

function dataCellValue(value: unknown): string | number | boolean {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  return JSON.stringify(value);
}

function parseStringList(raw: string): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((item) => String(item)).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function metricNumber(page: WorkbenchSnapshot["pages"][keyof WorkbenchSnapshot["pages"]] | undefined, label: string) {
  const metric = pageMetrics(page).find((item) => item.label === label);
  return numberValue(metric?.value);
}

function readText(row: DataRow | Record<string, unknown> | undefined, key: string) {
  const value = row?.[key];
  return value === undefined || value === null ? "" : optionalCellText(row as DataRow, key);
}

function numberValue(value: unknown) {
  return numericCellValue(value);
}

function storageKey(projectId: string) {
  return `dvas.constraintsConfirmed.${projectId}`;
}

function readConstraintsConfirmed(projectId: string) {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(storageKey(projectId)) === "true";
}

function writeConstraintsConfirmed(projectId: string, value: boolean) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(storageKey(projectId), String(value));
}
