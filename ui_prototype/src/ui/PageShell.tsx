import type { ReactNode } from "react";
import type { MetricItem } from "../domain/types";
import { userFacingText } from "./displayText";

function displaySummaryHint(value: string) {
  const text = userFacingText(value);
  if (text.includes("/") || /[a-z]{2,}/.test(text) || /[a-z]+[_-][a-z0-9_-]+/i.test(text)) {
    return text.includes("需要") || text.includes("待补") ? "待生成" : "系统结果";
  }
  return /^[a-z][a-z0-9_]*$/.test(text) ? "系统结果" : text;
}

interface CompactPageHeaderProps {
  title: string;
  description: string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
}

export function CompactPageHeader({
  title,
  description,
  primaryAction,
  secondaryActions,
}: CompactPageHeaderProps) {
  return (
    <header className="compactPageHeader">
      <div>
        <h1>{userFacingText(title)}</h1>
        <p>{userFacingText(description)}</p>
      </div>
      {(primaryAction || secondaryActions) ? (
        <div className="compactPageActions">
          {secondaryActions}
          {primaryAction}
        </div>
      ) : null}
    </header>
  );
}

interface SummaryStripProps {
  items: MetricItem[];
}

export function SummaryStrip({ items }: SummaryStripProps) {
  return (
    <section className="summaryStrip" aria-label="页面摘要">
      {items.slice(0, 5).map((item) => (
        <article key={item.label}>
          <span>{userFacingText(item.label)}</span>
          <strong>{userFacingText(item.value)}</strong>
          <small>{displaySummaryHint(item.hint)}</small>
        </article>
      ))}
    </section>
  );
}

interface WorkspaceLayoutProps {
  main: ReactNode;
  aside?: ReactNode;
  reverse?: boolean;
}

export function WorkspaceLayout({ main, aside, reverse = false }: WorkspaceLayoutProps) {
  return (
    <section className={`workspaceLayout${reverse ? " reverse" : ""}`}>
      <div className="workspaceMain">{main}</div>
      {aside ? <aside className="workspaceAside">{aside}</aside> : null}
    </section>
  );
}

interface InlineNoticeProps {
  title?: string;
  children: ReactNode;
  details?: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}

export function InlineNotice({
  title,
  children,
  details,
  tone = "neutral",
}: InlineNoticeProps) {
  return (
    <section className={`inlineNotice ${tone}`}>
      {title ? <strong>{userFacingText(title)}</strong> : null}
      <span>{typeof children === "string" ? userFacingText(children) : children}</span>
      {details ? (
        <details>
          <summary>查看详情</summary>
          <div>{details}</div>
        </details>
      ) : null}
    </section>
  );
}

interface ProgressiveDisclosureProps {
  title: string;
  summary?: string;
  children: ReactNode;
}

export function ProgressiveDisclosure({
  title,
  summary,
  children,
}: ProgressiveDisclosureProps) {
  return (
    <details className="progressiveDisclosure">
      <summary>
        <strong>{userFacingText(title)}</strong>
        {summary ? <span>{userFacingText(summary)}</span> : null}
      </summary>
      <div className="progressiveDisclosureBody">{children}</div>
    </details>
  );
}

interface ChartAreaProps {
  title?: string;
  source?: string;
  children?: ReactNode;
  emptyText?: string;
}

export function ChartArea({
  title,
  source,
  children,
  emptyText = "暂无",
}: ChartAreaProps) {
  return (
    <section className="chartArea" aria-label={title ?? "图表区域"}>
      {title ? (
        <div className="chartAreaHead">
          <h2>{userFacingText(title)}</h2>
          {source ? <span>已生成</span> : null}
        </div>
      ) : null}
      {children ?? <p className="productEmptyChart">{source ? "待展示" : userFacingText(emptyText)}</p>}
    </section>
  );
}

export interface ProductChartPoint {
  label: string;
  value: string;
  numeric: number | null;
  meta?: string;
}

interface ProductBarChartProps {
  points: ProductChartPoint[];
  unit?: string;
  emptyText?: string;
}

export function ProductBarChart({
  points,
  unit,
  emptyText = "暂无",
}: ProductBarChartProps) {
  const visiblePoints = points.filter((item) => item.numeric !== null).slice(0, 6);
  if (!visiblePoints.length) {
    return <p className="productEmptyChart">{emptyText}</p>;
  }

  let max = 0;
  for (const item of visiblePoints) {
    if (item.numeric !== null && item.numeric > max) {
      max = item.numeric;
    }
  }

  return (
    <div className="productBarChart">
      {visiblePoints.map((item, index) => {
        const width = max > 0 && item.numeric !== null ? Math.max(6, (item.numeric / max) * 100) : 6;
        return (
          <div
            className="productBarRow dashboardInteractiveTip"
            data-tooltip={`${userFacingText(item.label)} · ${userFacingText(item.value)} · 第 ${index + 1} 名${item.meta ? ` · ${userFacingText(item.meta)}` : ""}`}
            key={`${item.label}-${index}`}
            tabIndex={0}
          >
            <span title={userFacingText(item.label)}>{userFacingText(item.label)}</span>
            <div className="productBarTrack">
              <div className="productBarFill" style={{ width: `${width}%` }} />
            </div>
            <strong>{userFacingText(item.value)}</strong>
          </div>
        );
      })}
      {unit ? <small>{userFacingText(unit)}</small> : null}
    </div>
  );
}

interface ProductDonutChartProps {
  points: ProductChartPoint[];
  emptyText?: string;
}

export function ProductDonutChart({
  points,
  emptyText = "暂无",
}: ProductDonutChartProps) {
  const visiblePoints = points.filter((item) => item.numeric !== null && item.numeric > 0).slice(0, 5);
  if (!visiblePoints.length) {
    return <p className="productEmptyChart">{emptyText}</p>;
  }

  let offset = 25;
  return (
    <div className="productDonutChart">
      <svg aria-label="占比图" viewBox="0 0 120 120">
        <circle className="productDonutTrack" cx="60" cy="60" pathLength={100} r="42" />
        {visiblePoints.map((item, index) => {
          const share = item.numeric === null ? 0 : Math.max(0, Math.min(item.numeric * 100, 100));
          const segment = (
            <circle
              className={`productDonutSegment segment${(index % 6) + 1}`}
              cx="60"
              cy="60"
              key={`${item.label}-${index}`}
              pathLength={100}
              r="42"
              strokeDasharray={`${share} ${100 - share}`}
              strokeDashoffset={offset}
            >
              <title>{userFacingText(item.label)} · {userFacingText(item.value)}</title>
            </circle>
          );
          offset -= share;
          return segment;
        })}
      </svg>
      <div className="productDonutLegend">
        {visiblePoints.map((item, index) => (
          <div
            className="dashboardInteractiveTip"
            data-tooltip={`${userFacingText(item.label)} · ${userFacingText(item.value)}${item.meta ? ` · ${userFacingText(item.meta)}` : ""}`}
            key={`${item.label}-${index}`}
            tabIndex={0}
          >
            <span className={`legendDot segment${(index % 6) + 1}`} />
            <strong title={userFacingText(item.label)}>{userFacingText(item.label)}</strong>
            <small>{userFacingText(item.value)}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ProductTimelineProps {
  items: ProductChartPoint[];
  emptyText?: string;
}

export function ProductTimeline({
  items,
  emptyText = "暂无",
}: ProductTimelineProps) {
  const visibleItems = items.slice(0, 6);
  if (!visibleItems.length) {
    return <p className="productEmptyChart">{emptyText}</p>;
  }

  return (
    <div className="productTimeline">
      {visibleItems.map((item, index) => (
        <article
          className="dashboardInteractiveTip"
          data-tooltip={`${userFacingText(item.label)} · ${userFacingText(item.value)}${item.meta ? ` · ${userFacingText(item.meta)}` : ""}`}
          key={`${item.label}-${index}`}
          tabIndex={0}
        >
          <span />
          <div>
            <strong>{userFacingText(item.label)}</strong>
            <small>{userFacingText(item.value)}</small>
          </div>
        </article>
      ))}
    </div>
  );
}

interface ProductFlowChartProps {
  total?: string;
  priority?: string;
  pool?: string;
  parties: ProductChartPoint[];
  emptyText?: string;
}

export function ProductFlowChart({
  total = "暂无",
  priority = "暂无",
  pool = "暂无",
  parties,
  emptyText = "暂无",
}: ProductFlowChartProps) {
  const visibleParties = parties.slice(0, 3);
  if (total === "暂无" && priority === "暂无" && pool === "暂无" && !visibleParties.length) {
    return <p className="productEmptyChart">{emptyText}</p>;
  }

  const missingMainFlow = total === "暂无" || pool === "暂无";

  return (
    <div className={`productFlowChart${missingMainFlow ? " missingFlow" : ""}`}>
      <svg aria-hidden="true" viewBox="0 0 760 260" preserveAspectRatio="none">
        <defs>
          <linearGradient id="productFlowMain" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <path className="productFlowPath wide" d="M135 120 C250 120 290 70 398 70" />
        <path className="productFlowPath" d="M135 120 C250 120 292 172 398 172" />
        {visibleParties.map((item, index) => (
          <path
            className={`productFlowPath partyPath partyPath${index + 1}`}
            d={[
              "M485 172 C572 172 606 68 705 68",
              "M485 172 C572 172 606 130 705 130",
              "M485 172 C572 172 606 192 705 192",
            ][index]}
            key={`${item.label}-path`}
          />
        ))}
      </svg>
      {missingMainFlow ? (
        <div className="flowNotice">总收益与收益池待生成，当前仅展示参与方分配结果。</div>
      ) : (
        <>
          <div className="productFlowNode total dashboardInteractiveTip" data-tooltip={`总收益 · ${total}`} tabIndex={0}>
            <span>总收益</span>
            <strong>{total}</strong>
          </div>
          <div className="productFlowNode priority dashboardInteractiveTip" data-tooltip={`合同优先 · ${priority}`} tabIndex={0}>
            <span>合同优先</span>
            <strong>{priority}</strong>
          </div>
          <div className="productFlowNode pool dashboardInteractiveTip" data-tooltip={`数据源收益池 · ${pool}`} tabIndex={0}>
            <span>数据源收益池</span>
            <strong>{pool}</strong>
          </div>
        </>
      )}
      {visibleParties.map((item, index) => (
        <div
          className={`productFlowNode party party${index + 1} dashboardInteractiveTip`}
          data-tooltip={`${userFacingText(item.label)} · ${userFacingText(item.value)}`}
          key={`${item.label}-${index}`}
          tabIndex={0}
        >
          <span title={userFacingText(item.label)}>{userFacingText(item.label)}</span>
          <strong>{userFacingText(item.value)}</strong>
        </div>
      ))}
    </div>
  );
}
