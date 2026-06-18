export const twelveColumnLayout = {
  columns: 12,
  gap: 16,
  maxWidth: "none",
};

export function gridColumn(columnStart: number, columnSpan: number) {
  return `${columnStart} / span ${columnSpan}`;
}
