import type { ReactNode } from "react";
import { userFacingText } from "./displayText";

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
  emptyReason = "暂无",
  children,
}: ChartPanelProps) {
  const hasSource = Boolean(source);

  return (
    <section className={`chartPanel ${hasSource ? "chartPanelReady" : "chartPanelMissing"}`}>
      <div className="chartPanelHead">
        <div>
          <h2>{userFacingText(title)}</h2>
          <p>{userFacingText(description)}</p>
        </div>
        <span>{source ? "已生成" : "暂无"}</span>
      </div>
      <div className="chartPanelBody">
        {children ?? (
          <div className="chartEmpty">
            <strong>{hasSource ? "待展示" : "暂无"}</strong>
            <p>{userFacingText(emptyReason)}</p>
          </div>
        )}
      </div>
    </section>
  );
}
