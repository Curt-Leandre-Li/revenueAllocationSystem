import type { DataRow, MetricItem, PageWorkspaceData } from "../domain/types";

export function pageRows(pageData: PageWorkspaceData | undefined): DataRow[] {
  return pageData?.rows ?? [];
}

export function pageMetrics(pageData: PageWorkspaceData | undefined): MetricItem[] {
  return pageData?.metrics ?? [];
}

export function cellText(row: DataRow | undefined, key: string, fallback = "后端未返回") {
  if (!row) {
    return fallback;
  }
  const value = row[key];
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return String(value);
}

export function optionalCellText(row: DataRow | undefined, key: string) {
  if (!row) {
    return "";
  }
  const value = row[key];
  if (value === undefined || value === null || value === "") {
    return "";
  }
  return String(value);
}

export function amountCell(row: DataRow | undefined, key: string, fallback = "后端未返回") {
  const value = optionalCellText(row, key);
  if (!value) {
    return fallback;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : value;
}

export function weightCell(row: DataRow | undefined, key: string, fallback = "后端未返回") {
  const value = optionalCellText(row, key);
  if (!value) {
    return fallback;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(6) : value;
}

export function hasBackendRows(pageData: PageWorkspaceData | undefined) {
  return Boolean(pageData?.rows?.length);
}

