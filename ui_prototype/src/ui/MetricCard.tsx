import type { MetricItem } from "../domain/types";

interface MetricCardProps {
  item: MetricItem;
}

export function MetricCard({ item }: MetricCardProps) {
  return (
    <article className={`metricCard ${item.tone ?? "neutral"}`}>
      <span>{item.label}</span>
      <strong>{item.value}</strong>
      <small>{item.hint}</small>
    </article>
  );
}
