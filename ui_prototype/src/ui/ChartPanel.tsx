import { simulationDisclaimer } from "../domain/stateGuards";
import type { ReactNode } from "react";

interface ChartPanelProps {
  title: string;
  description: string;
  source?: string;
  emptyReason?: string;
  children?: ReactNode;
}

export function ChartPanel({
  title,
  description,
  source,
  emptyReason = "后端暂未返回 chart DTO，本阶段不在前端拼接业务图表。",
  children,
}: ChartPanelProps) {
  return (
    <section className="chartPanel">
      <div className="chartPanelHead">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span>{source ?? "等待后端 DTO"}</span>
      </div>
      <div className="chartPanelBody">
        {children ?? (
          <div className="chartEmpty">
            <strong>图表未启用</strong>
            <p>{emptyReason}</p>
          </div>
        )}
      </div>
      <p className="chartDisclaimer">{simulationDisclaimer}</p>
    </section>
  );
}
