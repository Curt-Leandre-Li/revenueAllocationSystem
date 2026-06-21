export function formatAmount(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    return "0.00";
  }
  return parsed.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatWeight(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    return "0.000000";
  }
  return parsed.toFixed(6);
}

export function formatCount(value: number | null | undefined) {
  return String(value ?? 0);
}
