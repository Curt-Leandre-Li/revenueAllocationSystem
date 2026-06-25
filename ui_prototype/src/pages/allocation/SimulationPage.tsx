import { useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import {
  ChartArea,
  CompactPageHeader,
  DetailDrawer,
  DrawerSection,
  EmptyGuide,
  ExportFieldList,
  InlineNotice,
  PreconditionPanel,
  ProductDonutChart,
  ProductFlowChart,
  ProgressiveDisclosure,
  SummaryStrip,
  TraceDrawer,
  WorkspaceLayout,
} from "../../ui";
import {
  amountCell,
  cellText,
  hasBackendRows,
  numericCellValue,
  optionalCellText,
  pageMetrics,
  pageRows,
  percentCell,
  weightCell,
} from "../backendPageData";
import type { PageProps } from "../pageTypes";

export function SimulationPage({ route, snapshot, onAction, onNavigate }: PageProps) {
  const [drawer, setDrawer] = useState<"" | "revenue" | "priority" | "mode" | "compare" | "export" | "trace">("");
  const [totalRevenueInput, setTotalRevenueInput] = useState("");
  const [priorityAmountInput, setPriorityAmountInput] = useState("");
  const [allocationMode, setAllocationMode] = useState("MD_DSHAP_WEIGHT_WITH_CONSTRAINTS");
  const pageData = snapshot.pages["/allocation/simulation"];
  const rows = pageRows(pageData);
  const firstRow = rows[0];
  const metricMap = new Map(pageMetrics(pageData).map((item) => [item.label, item]));
  const currentAllocationId = optionalCellText(pageData.technicalDetails, "current_allocation_id");
  const canRunSimulation = totalRevenueInput.trim() !== "";
  const connected = snapshot.backend?.connected !== false;
  const summaryItems = [
    metricMap.get("总收益") ?? {
      label: "总收益",
      value: amountCell(firstRow, "total_revenue"),
      hint: "系统结果",
      tone: "neutral" as const,
    },
    metricMap.get("优先分配") ?? {
      label: "优先分配",
      value: amountCell(firstRow, "priority_allocation_amount"),
      hint: "系统结果",
      tone: "neutral" as const,
    },
    metricMap.get("数据源收益池") ?? {
      label: "数据源收益池",
      value: amountCell(firstRow, "data_provider_revenue_pool"),
      hint: "系统结果",
      tone: "neutral" as const,
    },
    metricMap.get("参与方数量") ?? {
      label: "参与方数量",
      value: optionalCellText(pageData.technicalDetails, "participant_count") || "暂无",
      hint: "系统摘要",
      tone: "neutral" as const,
    },
  ];
  const allocationPoints = rows.map((row) => ({
    label: cellText(row, "party_name"),
    value: amountCell(row, "post_constraint_amount"),
    numeric: numericCellValue(row.post_constraint_amount),
    meta: cellText(row, "scenario_status"),
  }));
  const sharePoints = rows.map((row) => ({
    label: cellText(row, "party_name"),
    value: percentCell(row, "normalized_weight"),
    numeric: numericCellValue(row.normalized_weight),
    meta: amountCell(row, "post_constraint_amount"),
  }));

  function runSimulation() {
    if (!canRunSimulation) {
      return;
    }
    onAction(actionRegistry["ALLOC-011"], {
      kind: "allocation-run",
      totalRevenue: Number(totalRevenueInput),
      priorityAllocationAmount: priorityAmountInput.trim()
        ? Number(priorityAmountInput)
        : undefined,
      allocationMode,
    });
  }

  return (
    <div className="pageWorkspace leanPage simulationPage">
      <CompactPageHeader
        title="模拟收益分配"
        description="基于权重结果和合同约束生成分配模拟结果。"
        primaryAction={
          <button
            className="actionButton primary"
            disabled={!canRunSimulation}
            title={canRunSimulation ? "提交本次模拟请求" : "请先输入总收益；页面不使用默认收益兜底。"}
            type="button"
            onClick={runSimulation}
          >
            执行分配模拟
          </button>
        }
        secondaryActions={
          <>
            <button className="actionButton secondary" type="button" onClick={() => setDrawer("revenue")}>
              配置收益
            </button>
            <button className="actionButton secondary" type="button" onClick={() => setDrawer("trace")}>
              约束详情
            </button>
          </>
        }
      />

      {connected ? null : <InlineNotice tone="warning">系统未连接，结果刷新和操作提交暂不可用。</InlineNotice>}
      <SummaryStrip items={summaryItems} />

      <section className="resultChartGrid primary">
        <ChartArea title="收益流向" source={hasBackendRows(pageData) ? "rows" : pageData.chart?.chart_id}>
          <ProductFlowChart
            total={amountCell(firstRow, "total_revenue")}
            priority={amountCell(firstRow, "priority_allocation_amount")}
            pool={amountCell(firstRow, "data_provider_revenue_pool")}
            parties={allocationPoints}
          />
        </ChartArea>
        <ChartArea title="参与方收益占比" source={hasBackendRows(pageData) ? "rows" : pageData.chart?.chart_id}>
          <ProductDonutChart points={sharePoints} />
        </ChartArea>
      </section>

      <WorkspaceLayout
        main={
          <>
            <section className="simulationLeanInputs" aria-label="收益分配模拟请求参数">
              <label>
                <span>总收益</span>
                <input
                  value={totalRevenueInput}
                  type="number"
                  min="0"
                  placeholder="输入后提交"
                  onChange={(event) => setTotalRevenueInput(event.target.value)}
                />
              </label>
              <label>
                <span>合同优先分配</span>
                <input
                  value={priorityAmountInput}
                  type="number"
                  min="0"
                  placeholder="可选"
                  onChange={(event) => setPriorityAmountInput(event.target.value)}
                />
              </label>
              <label>
                <span>分配模式</span>
                <select
                  value={allocationMode}
                  onChange={(event) => setAllocationMode(event.target.value)}
                >
                  <option value="MD_DSHAP_WEIGHT_WITH_CONSTRAINTS">MD-DShap 权重分配</option>
                </select>
              </label>
            </section>

            <section className="leanTableSection">
              <div className="leanSectionHead">
                <div>
                  <h2>分配结果</h2>
                  <p>展示参与方权重、约束前后金额和调整原因。</p>
                </div>
                <button className="textLinkButton" type="button" onClick={() => setDrawer("compare")}>
                  查看方案对比
                </button>
              </div>
          {hasBackendRows(pageData) ? (
            <div className="tableWrap">
              <table className="dataTable phase2Table">
                <thead>
                  <tr>
                    <th>参与方</th>
                    <th>权重</th>
                    <th>约束前金额</th>
                    <th>约束后金额</th>
                    <th>调整金额</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${cellText(row, "party_name", "party")}-${index}`}>
                      <td><strong>{cellText(row, "party_name")}</strong></td>
                      <td>{weightCell(row, "normalized_weight")}</td>
                      <td>{amountCell(row, "pre_constraint_amount")}</td>
                      <td>{amountCell(row, "post_constraint_amount")}</td>
                      <td>{amountCell(row, "constraint_adjustment_amount")}</td>
                      <td><span className="tag success">{cellText(row, "scenario_status")}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyGuide
              title="暂无分配结果"
              description="请先完成 MD-DShap 权重计算并执行收益分配模拟；页面不会使用示例金额。"
            />
          )}
            </section>
          </>
        }
        aside={
          <>
            <ProgressiveDisclosure title="运行与约束" summary="默认折叠">
              <div className="progressiveStack">
                <PreconditionPanel items={pageData.preconditions} onNavigate={onNavigate} />
                <p>约束轨迹、收益池和调整原因以系统返回记录为准。</p>
                <dl className="businessDetail compact">
                  <div><dt>当前方案</dt><dd>{currentAllocationId || "暂无"}</dd></div>
                  <div><dt>分配模式</dt><dd>{cellText(firstRow, "allocation_mode")}</dd></div>
                </dl>
                <button className="textLinkButton" type="button" onClick={() => setDrawer("trace")}>
                  打开约束轨迹
                </button>
              </div>
            </ProgressiveDisclosure>
          </>
        }
      />

      <DetailDrawer
        dirty={Boolean(totalRevenueInput)}
        footerNote="总收益必须大于等于 0；实际校验和收益池计算由系统完成。"
        objectType="收益输入"
        open={drawer === "revenue"}
        size="md"
        title="配置总收益"
        variant="form"
        actions={[
          { label: "取消", onClick: () => setDrawer("") },
          { label: "应用到本次模拟请求", type: "primary", onClick: () => setDrawer("") },
        ]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="收益输入">
          <div className="formGrid">
            <label>
              总收益
              <input
                value={totalRevenueInput}
                type="number"
                min="0"
                onChange={(event) => setTotalRevenueInput(event.target.value)}
              />
            </label>
          </div>
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        dirty={Boolean(priorityAmountInput)}
        footerNote="优先分配金额不得超过总收益；该规则由系统返回错误信封。"
        objectType="合同优先"
        open={drawer === "priority"}
        size="md"
        title="配置合同优先分配"
        variant="form"
        actions={[
          { label: "取消", onClick: () => setDrawer("") },
          { label: "应用到本次模拟请求", type: "primary", onClick: () => setDrawer("") },
        ]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="合同优先分配">
          <div className="formGrid">
            <label>
              priority_allocation_amount
              <input
                value={priorityAmountInput}
                type="number"
                min="0"
                onChange={(event) => setPriorityAmountInput(event.target.value)}
              />
            </label>
          </div>
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="MD-DShap 是默认模式，基础 Shapley 仅作为小规模 baseline_check。"
        objectType="分配模式"
        open={drawer === "mode"}
        size="md"
        title="选择分配模式"
        variant="form"
        actions={[
          { label: "取消", onClick: () => setDrawer("") },
          { label: "应用到本次模拟请求", type: "primary", onClick: () => setDrawer("") },
        ]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="模式选择">
          <div className="checkList">
            <label>
              <input
                checked={allocationMode === "MD_DSHAP_WEIGHT_WITH_CONSTRAINTS"}
                name="mode"
                type="radio"
                onChange={() => setAllocationMode("MD_DSHAP_WEIGHT_WITH_CONSTRAINTS")}
              />
              <span>MD-DShap 权重分配</span>
            </label>
          </div>
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="方案对比用于解释约束影响，不构成付款指令。"
        objectType="方案对比"
        open={drawer === "compare"}
        size="lg"
        title="分配方案对比"
        variant="detail"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="约束前后金额">
          {hasBackendRows(pageData) ? (
            <div className="tableWrap">
              <table className="dataTable phase2Table">
                <thead>
                  <tr>
                    <th>参与方</th>
                    <th>约束前金额</th>
                    <th>约束后金额</th>
                    <th>调整金额</th>
                    <th>调整原因</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${cellText(row, "party_name", "party")}-${index}`}>
                      <td>{cellText(row, "party_name")}</td>
                      <td>{amountCell(row, "pre_constraint_amount")}</td>
                      <td>{amountCell(row, "post_constraint_amount")}</td>
                      <td>{amountCell(row, "constraint_adjustment_amount")}</td>
                      <td>{cellText(row, "adjustment_reason")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyGuide
              title="暂无对比数据"
              description="执行收益分配模拟后展示结果行；调整金额字段需要系统返回。"
            />
          )}
        </DrawerSection>
      </DetailDrawer>

      <TraceDrawer
        footerNote="约束轨迹写入 constraint_apply_trace；当前页面不从结果行推导 trace。"
        objectType="约束轨迹"
        open={drawer === "trace"}
        output={{ 轨迹状态: "暂无页面级约束轨迹" }}
        title="约束应用轨迹"
        technicalDetails={pageData.technicalDetails}
        onClose={() => setDrawer("")}
      />

      <DetailDrawer
        footerNote="导出文件包含模拟参考免责声明，不覆盖历史文件。"
        objectType="导出说明"
        open={drawer === "export"}
        size="md"
        title="导出分配结果"
        variant="export"
        onClose={() => setDrawer("")}
      >
        <ExportFieldList
          fields={[
            { key: "party_name", label: "参与方" },
            { key: "normalized_weight", label: "归一化权重" },
            { key: "pre_constraint_amount", label: "约束前金额" },
            { key: "post_constraint_amount", label: "约束后金额" },
            { key: "constraint_adjustment_amount", label: "调整金额" },
          ]}
        />
        <DrawerSection title="导出 metadata">
          <p>report_id、checksum、生成时间以系统导出响应和报告记录为准。</p>
        </DrawerSection>
      </DetailDrawer>
    </div>
  );
}
