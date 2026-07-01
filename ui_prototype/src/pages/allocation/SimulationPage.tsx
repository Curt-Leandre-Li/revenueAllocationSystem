import { actionRegistry } from "../../domain/actionRegistry";
import type { DataRow, RoutePath } from "../../domain/types";
import {
  CompactPageHeader,
  InlineNotice,
  SummaryStrip,
} from "../../ui";
import {
  pageRows,
} from "../backendPageData";
import type { PageProps } from "../pageTypes";
import {
  formatInteger,
  formatPercent,
  formatYuan,
  formatWeight,
  useAllocationContext,
} from "./allocationContext";

export function SimulationPage({ snapshot, onAction, onNavigate }: PageProps) {
  const allocation = useAllocationContext(snapshot);
  const pageData = snapshot.pages["/allocation/simulation"];
  const connected = snapshot.backend?.connected !== false;
  const canRunSimulation = connected && allocation.readiness.canSimulate;
  const runBlockReasons = connected
    ? allocation.readiness.simulateBlockReasons
    : ["系统未连接，无法提交收益分配模拟"];
  const resultRows = pageRows(pageData);
  const hasResults = resultRows.length > 0;
  const contractRatioConfigured = Boolean(allocation.readiness.contractRatioConfigured);

  function runSimulation() {
    if (!canRunSimulation) {
      return;
    }
    onAction(actionRegistry["ALLOC-011"], {
      kind: "allocation-run",
    });
  }

  const summaryItems = [
    {
      label: "总收益",
      value: formatYuan(allocation.readiness.totalRevenue),
      hint: "来自后端 allocation summary",
      tone: allocation.readiness.totalRevenue !== null ? "success" as const : "warning" as const,
    },
    {
      label: "合同比例方案",
      value: contractRatioConfigured ? "已配置" : "未配置",
      hint: `比例合计 ${formatPercent(allocation.readiness.contractRatioSum, "后端未返回")}`,
      tone: contractRatioConfigured ? "success" as const : "warning" as const,
    },
    {
      label: "数据源收益池",
      value: formatYuan(allocation.readiness.dataProviderRevenuePool),
      hint: "后端 data_provider_revenue_pool",
      tone: allocation.readiness.dataProviderRevenuePool !== null ? "success" as const : "warning" as const,
    },
    {
      label: "非数据主体合同金额",
      value: formatYuan(allocation.readiness.priorityTotalAmount, "0 元"),
      hint: "后端 non_data_contract_amount",
      tone: "neutral" as const,
    },
    {
      label: "MD-DShap 权重",
      value: allocation.readiness.hasMdsWeights ? "已完成" : "待完成",
      hint: `权重合计 ${formatWeight(allocation.readiness.weightSum, "待计算")}`,
      tone: allocation.readiness.hasMdsWeights ? "success" as const : "warning" as const,
    },
  ];

  return (
    <div className="pageWorkspace leanPage simulationPage allocationRefinePage contractSimulationPage">
      <CompactPageHeader
        title="收益分配模拟"
        description="读取已保存的合同比例方案：总收益先划分为非数据主体合同金额与数据源收益池，数据源收益池再按 MD-DShap 权重分配给数据源主体。"
        primaryAction={
          <button
            className="actionButton primary"
            disabled={!canRunSimulation}
            title={canRunSimulation ? "执行收益分配模拟" : runBlockReasons.join("；")}
            type="button"
            onClick={runSimulation}
          >
            执行分配模拟
          </button>
        }
        secondaryActions={
          <button className="actionButton secondary" type="button" onClick={() => onNavigate("/allocation/constraints" as RoutePath)}>
            去配置合同分配规则
          </button>
        }
      />

      {canRunSimulation ? null : (
        <InlineNotice tone="warning" title="当前暂不可执行">
          {runBlockReasons.join("；")}
        </InlineNotice>
      )}

      <SummaryStrip items={summaryItems} />

      <section className="allocationDashboardGrid contractSimulationGrid">
        <article className="allocationPanel precheck">
          <div className="allocationPanelHead">
            <h2>分配前置检查</h2>
            <span>{canRunSimulation ? "可执行" : "待处理"}</span>
          </div>
          <ul className="allocationChecklist">
            <CheckItem
              ok={contractRatioConfigured}
              label="合同比例方案"
              value={contractRatioConfigured ? "已保存" : "请先配置并保存合同比例分配方案"}
              actionLabel="去配置"
              onAction={() => onNavigate("/allocation/constraints" as RoutePath)}
            />
            <CheckItem
              ok={allocation.readiness.hasMdsWeights && allocation.readiness.mdsWeightSumValid}
              label="MD-DShap 权重"
              value={
                allocation.readiness.hasMdsWeights
                  ? `已完成，${formatInteger(allocation.readiness.dataProviderCount, "0")} 个主体，权重合计 ${formatWeight(allocation.readiness.weightSum)}`
                  : "请先完成权重计算"
              }
              actionLabel="去 MD-DShap"
              onAction={() => onNavigate("/allocation/md-dshap" as RoutePath)}
            />
            <CheckItem
              ok={allocation.readiness.totalRevenue !== null}
              label="总收益"
              value={formatYuan(allocation.readiness.totalRevenue)}
            />
            <CheckItem
              ok={allocation.readiness.dataProviderRevenuePool !== null}
              label="数据源收益池"
              value={formatYuan(allocation.readiness.dataProviderRevenuePool)}
            />
            <CheckItem
              ok={hasResults}
              label="执行状态"
              value={hasResults ? "已生成模拟结果" : "待执行"}
            />
          </ul>
        </article>

        <div className="allocationSideStack simulationFlowStack">
          <article className="allocationPanel flowPlan">
            <div className="allocationPanelHead">
              <h2>收益流向</h2>
              <span>{hasResults ? "已生成结果" : "计划流向"}</span>
            </div>
            <div className="planFlowBlocks contractFlowBlocks">
              <PlanBlock label="总收益" value={formatInteger(allocation.readiness.totalRevenue)} />
              <PlanBlock label="合同比例划分" value={formatPercent(allocation.readiness.contractRatioSum, "待配置")} />
              <PlanBlock label="数据源收益池" value={formatInteger(allocation.readiness.dataProviderRevenuePool)} />
              <PlanBlock label="MD-DShap 权重分配" value={`${formatInteger(allocation.readiness.dataProviderCount, "0")} 个主体`} />
              <PlanBlock label="最终结果" value={hasResults ? `${resultRows.length} 行` : "待生成"} muted={!hasResults} />
            </div>
          </article>

          <article className="allocationPanel constraintEvidence">
            <div className="allocationPanelHead">
              <h2>合同比例与金额来源</h2>
              <span>{allocation.constraintCheck.statusText}</span>
            </div>
            <div className="constraintEvidenceBody">
              <dl>
                <div>
                  <dt>金额来源 trace 行数</dt>
                  <dd>
                    {allocation.constraintCheck.hitCount === null
                      ? "后端未返回"
                      : formatInteger(allocation.constraintCheck.hitCount, "0")}
                  </dd>
                </div>
                <div>
                  <dt>调整金额</dt>
                  <dd>
                    {allocation.constraintCheck.adjustmentAmount === null
                      ? "后端未返回"
                      : formatYuan(allocation.constraintCheck.adjustmentAmount, "0 元")}
                  </dd>
                </div>
                <div>
                  <dt>路径状态</dt>
                  <dd>{constraintStateLabel(allocation.constraintCheck.state)}</dd>
                </div>
              </dl>
            </div>
          </article>
        </div>
      </section>

      <section className="allocationPanel tablePanel">
        <div className="allocationPanelHead">
          <h2>模拟结果</h2>
          <span>{hasResults ? "后端返回" : "待执行后生成"}</span>
        </div>
        {hasResults ? (
          <div className="tableWrap">
            <table className="dataTable phase2Table">
              <thead>
                <tr>
                  <th>主体名称</th>
                  <th>主体类型</th>
                  <th>金额来源</th>
                  <th>合同比例</th>
                  <th>归一化权重</th>
                  <th>基础金额池</th>
                  <th>最终金额</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                {resultRows.map((row, index) => (
                  <ResultRow key={`${readRow(row, "party_id")}-${index}`} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="operationEmptyState">
            <strong>当前尚未生成收益分配模拟结果。</strong>
            <p>保存合同比例方案并完成 MD-DShap 权重后，可执行模拟并查看所有主体最终金额。</p>
            <div>
              <button className="actionButton secondary" type="button" onClick={() => onNavigate("/allocation/constraints" as RoutePath)}>
                去配置合同分配规则
              </button>
              <button className="actionButton primary" disabled={!canRunSimulation} type="button" onClick={runSimulation}>
                执行分配模拟
              </button>
            </div>
          </div>
        )}
      </section>

      <footer className="allocationNextStep">
        <div>
          <strong>下一步建议</strong>
          <p>执行模拟后检查 amount_source、最终金额合计和报告导出字段。</p>
        </div>
        <div className={canRunSimulation ? "nextStepStatus success" : "nextStepStatus warning"}>
          <strong>
            {hasResults
              ? "分配结果已生成，可锁定方案或导出报告。"
              : canRunSimulation
                ? "当前已满足执行条件，可执行收益分配模拟。"
                : `当前暂不可执行，请先完成：${runBlockReasons.join("；")}`}
          </strong>
          {hasResults ? (
            <div className="nextStepActions">
              <button type="button" onClick={() => onAction(actionRegistry["ALLOC-015"])}>锁定方案</button>
              <button type="button" onClick={() => onAction(actionRegistry["ALLOC-016"])}>导出报告</button>
            </div>
          ) : (
            <button
              disabled={!canRunSimulation}
              title={canRunSimulation ? "执行收益分配模拟" : runBlockReasons.join("；")}
              type="button"
              onClick={runSimulation}
            >
              执行分配模拟
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

function constraintStateLabel(state: string) {
  const labels: Record<string, string> = {
    not_run: "待执行",
    contract_ratio: "合同比例主路径",
    no_hits: "历史兼容约束未命中",
    has_hits: "历史兼容约束已命中",
    unknown: "后端未返回 trace",
  };
  return labels[state] ?? "后端未返回";
}

function CheckItem({
  ok,
  label,
  value,
  actionLabel,
  onAction,
}: {
  ok: boolean;
  label: string;
  value: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <li className={ok ? "ok" : "warn"}>
      <i>{ok ? "✓" : "!"}</i>
      <span>{label}</span>
      <strong>{value}</strong>
      {actionLabel && onAction ? <button type="button" onClick={onAction}>{actionLabel}</button> : null}
    </li>
  );
}

function PlanBlock({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={muted ? "muted" : ""}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ResultRow({ row }: { row: DataRow }) {
  const ratio = numberValue(row.contract_ratio);
  const weight = numberValue(row.normalized_weight);
  return (
    <tr>
      <td><strong>{readRow(row, "party_name", "主体")}</strong></td>
      <td>{readRow(row, "party_type", "-")}</td>
      <td>{readRow(row, "amount_source", "-")}</td>
      <td>{ratio === null ? "-" : formatPercent(ratio)}</td>
      <td>{weight === null ? "-" : formatWeight(weight)}</td>
      <td>{formatYuan(numberValue(row.base_pool_amount), "后端未返回")}</td>
      <td><strong>{formatYuan(numberValue(row.final_amount), "后端未返回")}</strong></td>
      <td>{readRow(row, "explanation", readRow(row, "adjustment_reason", "-"))}</td>
    </tr>
  );
}

function readRow(row: DataRow, key: string, fallback = "") {
  const value = row[key];
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return String(value);
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}
