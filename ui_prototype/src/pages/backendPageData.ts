import type { DataRow, MetricItem, PageWorkspaceData } from "../domain/types";
import { userFacingText } from "../ui/displayText";

export function pageRows(pageData: PageWorkspaceData | undefined): DataRow[] {
  return pageData?.rows ?? [];
}

export function pageMetrics(pageData: PageWorkspaceData | undefined): MetricItem[] {
  return pageData?.metrics ?? [];
}

export function cellText(row: DataRow | undefined, key: string, fallback = "暂无") {
  if (!row) {
    return fallback;
  }
  const value = row[key];
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return userFacingText(value);
}

export function optionalCellText(row: DataRow | undefined, key: string) {
  if (!row) {
    return "";
  }
  const value = row[key];
  if (value === undefined || value === null || value === "") {
    return "";
  }
  return userFacingText(value);
}

export function amountCell(row: DataRow | undefined, key: string, fallback = "暂无") {
  const value = optionalCellText(row, key);
  if (!value) {
    return fallback;
  }
  const numeric = numericCellValue(value);
  return numeric !== null
    ? numeric.toLocaleString("zh-CN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })
    : value;
}

export function weightCell(row: DataRow | undefined, key: string, fallback = "暂无") {
  const value = optionalCellText(row, key);
  if (!value) {
    return fallback;
  }
  const numeric = numericCellValue(value);
  return numeric !== null ? numeric.toFixed(6) : value;
}

export function percentCell(row: DataRow | undefined, key: string, fallback = "暂无") {
  const value = optionalCellText(row, key);
  if (!value) {
    return fallback;
  }
  const numeric = numericCellValue(value);
  return numeric !== null
    ? `${(numeric * 100).toLocaleString("zh-CN", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      })}%`
    : value;
}

export function numberCell(row: DataRow | undefined, key: string, fallback = "暂无") {
  const value = optionalCellText(row, key);
  if (!value) {
    return fallback;
  }
  const numeric = numericCellValue(value);
  return numeric !== null ? numeric.toLocaleString("zh-CN") : value;
}

export function numericCellValue(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const normalized = String(value).trim().replace(/,/g, "");
  if (normalized.endsWith("%")) {
    const percent = Number(normalized.slice(0, -1));
    return Number.isFinite(percent) ? percent / 100 : null;
  }
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

export function hasBackendRows(pageData: PageWorkspaceData | undefined) {
  return Boolean(pageData?.rows?.length);
}
