import { useEffect, useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import { dvasApi } from "../../domain/api";
import type { DataRow } from "../../domain/types";
import { ActionButton } from "../../ui";
import { userFacingText } from "../../ui/displayText";
import type { PageProps } from "../pageTypes";

interface CoreMetric {
  label: string;
  value: string;
  route: PageProps["route"]["path"];
  tooltip: string;
}

interface ChartPoint {
  label: string;
  displayLabel: string;
  value: string;
  numeric: number;
  amount?: string;
  status?: string;
}

interface MyWorkbenchSummary {
  project_count: number;
  upload_count: number;
  job_count: number;
  report_count: number;
  recent_operation_count: number;
}

export function OverviewPage({ route, snapshot, onAction, onNavigate }: PageProps) {
  const [activeParty, setActiveParty] = useState("");
  const [myWorkbench, setMyWorkbench] = useState<MyWorkbenchSummary | null>(null);
  const pageData = snapshot.pages[route.path];
  const dashboardMetrics = new Map(pageData.metrics.map((item) => [item.label, item.value]));
  const shuyuanPage = snapshot.pages["/metering/shuyuan"];
  const allocationPage = snapshot.pages["/allocation/simulation"];
  const mdsPage = snapshot.pages["/allocation/md-dshap"];
  const firstAllocation = allocationPage.rows[0];
  const shuyuanTotal = metricValue(shuyuanPage.metrics, "项目总计量金额");
  const currentRevenuePool = dashboardMetrics.get("收益池");
  const reportCount = dashboardMetrics.get("报告状态");
  const coreMetrics: CoreMetric[] = [
    {
      label: "数据资源数",
      value: formatDisplayValue(dashboardMetrics.get("数据资源"), "number"),
      route: "/data/resources",
      tooltip: "当前项目已识别的数据资源数量。",
    },
    {
      label: "参与方数量",
      value: formatDisplayValue(dashboardMetrics.get("参与方"), "number"),
      route: "/data/parties",
      tooltip: "当前数据包输入快照中的参与方数量，含数据源主体与非数据主体。",
    },
    {
      label: "数元统计总额",
      value: formatDisplayValue(shuyuanTotal, "amount"),
      route: "/metering/shuyuan",
      tooltip: "系统返回的数元计量结果总额。",
    },
    {
      label: "当前收益池",
      value: formatDisplayValue(firstAllocation?.data_provider_revenue_pool ?? currentRevenuePool, "amount"),
      route: "/allocation/simulation",
      tooltip: firstAllocation?.data_provider_revenue_pool
        ? "当前分配模拟结果中的数据源收益池。"
        : "当前输入快照或后端分配结果返回的收益池。",
    },
    {
      label: "已生成报告数",
      value: formatDisplayValue(reportCount, "number"),
      route: "/reports",
      tooltip: "当前项目已生成的报告记录数量。",
    },
  ];
  const allocationPoints = allocationPage.rows
    .map((row) => toChartPoint(row, ["party_name"], "post_constraint_amount", "amount"))
    .filter(isChartPoint)
    .sort(sortChartPointDescending)
    .slice(0, 6);
  const allocationSharePoints = allocationPage.rows
    .flatMap((row) => {
      const point = toChartPoint(row, ["party_name"], "normalized_weight", "percent");
      return point
        ? {
            ...point,
            amount: formatDisplayValue(row.post_constraint_amount, "amount"),
            status: cleanValue(row.scenario_status),
          }
        : [];
    })
    .sort(sortChartPointDescending)
    .slice(0, 6);
  const shuyuanPoints = shuyuanPage.rows
    .map((row) => toChartPoint(row, ["resource_name", "party_name"], "metering_amount", "amount"))
    .filter(isChartPoint)
    .sort(sortChartPointDescending)
    .slice(0, 6);
  const weightPoints = mdsPage.rows
    .map((row) => toChartPoint(row, ["party_name"], "normalized_weight", "percent"))
    .filter(isChartPoint)
    .sort(sortChartPointDescending)
    .slice(0, 6);

  useEffect(() => {
    let mounted = true;
    void dvasApi.getMyWorkbench().then(
      (response) => {
        const summary = response.summary as Partial<MyWorkbenchSummary> | undefined;
        if (mounted && summary) {
          setMyWorkbench({
            project_count: Number(summary.project_count ?? 0),
            upload_count: Number(summary.upload_count ?? 0),
            job_count: Number(summary.job_count ?? 0),
            report_count: Number(summary.report_count ?? 0),
            recent_operation_count: Number(summary.recent_operation_count ?? 0),
          });
        }
      },
      () => {
        if (mounted) {
          setMyWorkbench(null);
        }
      },
    );
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="pageWorkspace overviewPage dashboardResultsPage">
      <section className="resultMetricRow" aria-label="核心指标">
        {coreMetrics.map((item) => (
          <button
            className="resultMetricCard dashboardInteractiveTip"
            data-tooltip={item.tooltip}
            key={item.label}
            type="button"
            onClick={() => onNavigate(item.route)}
          >
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </button>
        ))}
      </section>

      <section className="myWorkbenchPanel" aria-label="我的工作台">
        <div>
          <h2>我的工作台</h2>
          <span>按当前登录用户和角色权限汇总可见内容。</span>
        </div>
        <button type="button" onClick={() => onNavigate("/dashboard")}>
          我创建的项目 <strong>{myWorkbench?.project_count ?? 0}</strong>
        </button>
        <button type="button" onClick={() => onNavigate("/data/ingestion")}>
          我上传的数据包 <strong>{myWorkbench?.upload_count ?? 0}</strong>
        </button>
        <button type="button" onClick={() => onNavigate("/allocation/md-dshap")}>
          我发起的计算任务 <strong>{myWorkbench?.job_count ?? 0}</strong>
        </button>
        <button type="button" onClick={() => onNavigate("/reports")}>
          我生成的报告 <strong>{myWorkbench?.report_count ?? 0}</strong>
        </button>
        <button type="button" onClick={() => onNavigate("/system/audit")}>
          最近操作记录 <strong>{myWorkbench?.recent_operation_count ?? 0}</strong>
        </button>
      </section>

      <section className="dashboardActionPanel" aria-label="完整链路操作">
        <div>
          <h2>完整链路入口</h2>
          <span>选择演示数据、执行完整链路计算，并查看模拟参考边界。</span>
        </div>
        <div className="dashboardActionButtons">
          <ActionButton action={actionRegistry["SYS-002"]} onClick={(action) => onAction(action)} />
          <ActionButton action={actionRegistry["SYS-004"]} onClick={(action) => onAction(action)} />
          <ActionButton action={actionRegistry["SYS-005"]} onClick={(action) => onAction(action)} />
        </div>
      </section>

      <section className="resultChartGrid primary" aria-label="核心图表">
        <article className="resultChartPanel sankeyPanel">
          <div className="resultChartHead">
            <h2>收益流向</h2>
          </div>
          <RevenueFlowChart
            allocation={firstAllocation}
            parties={allocationPoints}
          />
        </article>

        <article className="resultChartPanel">
          <div className="resultChartHead">
            <h2>参与方收益占比</h2>
          </div>
          <DonutChart
            activeParty={activeParty}
            points={allocationSharePoints}
            onActiveParty={setActiveParty}
          />
        </article>
      </section>

      <section className="resultChartGrid secondary" aria-label="补充图表">
        <article className="resultChartPanel">
          <div className="resultChartHead">
            <h2>数据价值排行</h2>
          </div>
          <BarRankChart
            points={shuyuanPoints}
            unit="金额"
          />
        </article>

        <article className="resultChartPanel optional">
          <div className="resultChartHead">
            <h2>分配权重排行</h2>
          </div>
          <BarRankChart
            activeParty={activeParty}
            points={weightPoints}
            unit="权重"
            onActiveParty={setActiveParty}
          />
        </article>
      </section>

      <p className="resultRiskLine">
        本系统输出仅作为数据收益分配模拟与审计说明参考，不作为法律结算或付款依据。
      </p>
    </div>
  );
}

function RevenueFlowChart({
  allocation,
  parties,
}: {
  allocation: DataRow | undefined;
  parties: ChartPoint[];
}) {
  const total = readRow(allocation, "total_revenue");
  const priority = readRow(allocation, "priority_allocation_amount");
  const pool = readRow(allocation, "data_provider_revenue_pool");
  const missingRevenueFlow = total === "暂无" || pool === "暂无";
  const hasFlow = total !== "暂无" || priority !== "暂无" || pool !== "暂无" || parties.length > 0;

  if (!hasFlow) {
    return <EmptyChart message="待执行收益分配模拟后生成收益流向" />;
  }

  return (
    <div className={`sankeyChart${missingRevenueFlow ? " missingFlow" : ""}`}>
      <svg aria-hidden="true" viewBox="0 0 760 260" preserveAspectRatio="none">
        <defs>
          <linearGradient id="flowMain" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.22" />
          </linearGradient>
        </defs>
        <path className="flowPath wide" d="M135 120 C250 120 290 70 398 70">
          <title>非数据主体合同金额 · {priority} · 合同比例</title>
        </path>
        <path className="flowPath" d="M135 120 C250 120 292 172 398 172">
          <title>数据源收益池 · {pool} · 收益池</title>
        </path>
        {parties.slice(0, 3).map((item, index) => (
          <path
            className={`flowPath partyPath partyPath${index + 1}`}
            d={[
              "M485 172 C572 172 606 68 705 68",
              "M485 172 C572 172 606 130 705 130",
              "M485 172 C572 172 606 192 705 192",
            ][index]}
            key={`${item.label}-path`}
          >
            <title>{item.label} · {item.value} · 参与方</title>
          </path>
        ))}
      </svg>
      {missingRevenueFlow ? (
        <div className="flowNotice">
          总收益与收益池待生成，当前仅展示参与方分配结果。
        </div>
      ) : (
        <>
          <div
            className="flowNode total dashboardInteractiveTip"
            data-tooltip={`总收益 · ${total}`}
            tabIndex={0}
          >
            <span>总收益</span>
            <strong>{total}</strong>
          </div>
          <div
            className="flowNode priority dashboardInteractiveTip"
            data-tooltip={`非数据主体合同金额 · ${priority}`}
            tabIndex={0}
          >
            <span>非数据主体合同金额</span>
            <strong>{priority}</strong>
          </div>
          <div
            className="flowNode pool dashboardInteractiveTip"
            data-tooltip={`数据源收益池 · ${pool}`}
            tabIndex={0}
          >
            <span>数据源收益池</span>
            <strong>{pool}</strong>
          </div>
        </>
      )}
      {parties.slice(0, 3).map((item, index) => (
        <div
          className={`flowNode party party${index + 1} dashboardInteractiveTip`}
          data-tooltip={`${item.label} · ${item.value} · 参与方`}
          key={`${item.label}-${index}`}
          tabIndex={0}
        >
          <span title={item.label}>{item.displayLabel}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function DonutChart({
  activeParty,
  points,
  onActiveParty,
}: {
  activeParty: string;
  points: ChartPoint[];
  onActiveParty: (party: string) => void;
}) {
  if (!points.length) {
    return <EmptyChart message="待执行收益分配模拟后生成参与方收益占比" />;
  }

  let offset = 25;
  return (
    <div className="donutChart">
      <div className="donutVisual">
        <svg aria-label="参与方收益占比" viewBox="0 0 120 120">
          <circle className="donutTrack" cx="60" cy="60" pathLength={100} r="42" />
          {points.map((item, index) => {
            const share = Math.max(0, Math.min(item.numeric * 100, 100));
            const segment = (
              <circle
                className={`donutSegment segment${(index % 6) + 1}${activeParty === item.label ? " active" : ""}`}
                cx="60"
                cy="60"
                key={`${item.label}-${index}`}
                pathLength={100}
                r="42"
                strokeDasharray={`${share} ${100 - share}`}
                strokeDashoffset={offset}
              >
                <title>
                  {item.label} · {item.value}{item.amount && item.amount !== "暂无" ? ` · ${item.amount}` : ""}
                </title>
              </circle>
            );
            offset -= share;
            return segment;
          })}
        </svg>
        <div className="donutHitLayer">
          {points.slice(0, 5).map((item, index) => (
            <span
              aria-label={`${item.label} ${item.value}`}
              className={`donutHitButton hit${index + 1} dashboardInteractiveTip`}
              data-tooltip={`${item.label} · ${item.value}${item.amount && item.amount !== "暂无" ? ` · ${item.amount}` : ""}`}
              key={`${item.label}-hit-${index}`}
              role="img"
              tabIndex={0}
              onMouseEnter={() => onActiveParty(item.label)}
              onMouseLeave={() => onActiveParty("")}
            />
          ))}
        </div>
      </div>
      <div className="donutLegend">
        {points.slice(0, 5).map((item, index) => (
          <div
            className={`donutLegendItem dashboardInteractiveTip${activeParty === item.label ? " active" : ""}`}
            data-tooltip={`${item.label} · ${item.value}${item.amount && item.amount !== "暂无" ? ` · ${item.amount}` : ""}`}
            key={`${item.label}-${index}`}
            tabIndex={0}
            onMouseEnter={() => onActiveParty(item.label)}
            onMouseLeave={() => onActiveParty("")}
          >
            <span className={`legendDot segment${(index % 6) + 1}`} />
            <strong title={item.label}>{item.displayLabel}</strong>
            <small>{item.value}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarRankChart({
  activeParty = "",
  points,
  unit,
  onActiveParty,
}: {
  activeParty?: string;
  points: ChartPoint[];
  unit: string;
  onActiveParty?: (party: string) => void;
}) {
  if (!points.length) {
    return <EmptyChart />;
  }

  const max = Math.max(...points.map((item) => item.numeric), 0);
  return (
    <div className="rankChart">
      {points.map((item, index) => {
        const width = max > 0 ? Math.max(6, (item.numeric / max) * 100) : 6;
        return (
          <div
            className={`rankRow${activeParty === item.label ? " active" : ""}`}
            data-tooltip={`${item.label} · ${item.value} · 第 ${index + 1} 名`}
            key={`${item.label}-${index}`}
            tabIndex={0}
            onMouseEnter={() => onActiveParty?.(item.label)}
            onMouseLeave={() => onActiveParty?.("")}
          >
            <span title={item.label}>{item.displayLabel}</span>
            <div className="rankBarTrack">
              <div className="rankBar" style={{ width: `${width}%` }} />
            </div>
            <strong>{item.value}</strong>
          </div>
        );
      })}
      <small>{unit}</small>
    </div>
  );
}

function EmptyChart({ message = "暂无" }: { message?: string }) {
  return <div className="resultChartEmpty">{message}</div>;
}

function metricValue(metrics: Array<{ label: string; value: string }>, label: string) {
  return metrics.find((item) => item.label === label)?.value;
}

function readRow(row: DataRow | undefined, key: string) {
  if (!row) {
    return "暂无";
  }
  return formatDisplayValue(row[key], "amount");
}

function cleanValue(value: unknown) {
  if (value === undefined || value === null || value === "" || value === "后端未返回" || value === "后端摘要待补") {
    return "暂无";
  }
  return userFacingText(String(value));
}

type DisplayKind = "plain" | "number" | "amount" | "percent";

function toChartPoint(row: DataRow, labelKeys: string[], valueKey: string, kind: DisplayKind): ChartPoint | null {
  const rawValue = row[valueKey];
  const numeric = numericValue(rawValue);
  if (numeric === null) {
    return null;
  }
  const label = firstText(row, labelKeys);
  return {
    label,
    displayLabel: compactName(label),
    value: formatDisplayValue(rawValue, kind),
    numeric,
  };
}

function firstText(row: DataRow, keys: string[]) {
  for (const key of keys) {
    const value = cleanValue(row[key]);
    if (value !== "暂无") {
      return value;
    }
  }
  return "未命名";
}

function formatDisplayValue(value: unknown, kind: DisplayKind) {
  const cleaned = cleanValue(value);
  if (cleaned === "暂无") {
    return cleaned;
  }
  const numeric = numericValue(cleaned);
  if (numeric === null) {
    return cleaned;
  }
  if (kind === "percent") {
    return `${(numeric * 100).toLocaleString("zh-CN", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })}%`;
  }
  if (kind === "amount") {
    return numeric.toLocaleString("zh-CN", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
  }
  if (kind === "number") {
    return numeric.toLocaleString("zh-CN", {
      maximumFractionDigits: 2,
    });
  }
  return cleaned;
}

function compactName(value: string) {
  return value.length > 24 ? `${value.slice(0, 22)}...` : value;
}

function numericValue(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function sortChartPointDescending(left: ChartPoint, right: ChartPoint) {
  const diff = right.numeric - left.numeric;
  return diff || left.label.localeCompare(right.label, "zh-CN");
}

function isChartPoint(value: ChartPoint | null): value is ChartPoint {
  return value !== null;
}
