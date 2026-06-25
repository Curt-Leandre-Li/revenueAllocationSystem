import type { MetricItem } from "../domain/types";
import { userFacingText } from "./displayText";

interface MetricCardProps {
  item: MetricItem;
}

export function MetricCard({ item }: MetricCardProps) {
  return (
    <article className={`metricCard ${item.tone ?? "neutral"}`}>
      <span>{userFacingText(item.label)}</span>
      <strong>{userFacingText(item.value)}</strong>
      <small>{userFacingText(item.hint)}</small>
    </article>
  );
}
