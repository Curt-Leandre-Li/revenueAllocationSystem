import { useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import {
  ActionButton,
  ChartPanel,
  DetailDrawer,
  DrawerSection,
  EmptyGuide,
  ExportFieldList,
  MetricCard,
  PageHeader,
  RiskNotice,
  TraceDrawer,
  WorkbenchCard,
} from "../../ui";
import {
  amountCell,
  cellText,
  hasBackendRows,
  optionalCellText,
  pageMetrics,
  pageRows,
  weightCell,
} from "../backendPageData";
import type { PageProps } from "../pageTypes";

export function SimulationPage({ route, snapshot, onAction }: PageProps) {
  const [drawer, setDrawer] = useState<"" | "revenue" | "priority" | "mode" | "compare" | "export" | "trace">("");
  const [totalRevenueInput, setTotalRevenueInput] = useState("");
  const [priorityAmountInput, setPriorityAmountInput] = useState("");
  const [allocationMode, setAllocationMode] = useState("MD_DSHAP_WEIGHT_WITH_CONSTRAINTS");
  const pageData = snapshot.pages["/allocation/simulation"];
  const rows = pageRows(pageData);
  const metrics = pageMetrics(pageData);
  const currentAllocationId = optionalCellText(pageData.technicalDetails, "current_allocation_id");
  const canRunSimulation = totalRevenueInput.trim() !== "";

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
    <div className="pageWorkspace phase2Page simulationPage">
      <PageHeader
        route={{
          ...route,
          label: "收益分配模拟",
          responsibility: "配置总收益、合同优先分配、数据源收益池和合同约束，生成模拟分配结果。",
        }}
        snapshot={snapshot}
      />

      <div className="metricGrid five">
        {metrics.map((item) => (
          <MetricCard item={item} key={item.label} />
        ))}
      </div>

      <RiskNotice compact />

      <WorkbenchCard
        title="收益输入与模拟动作"
        description="总收益、优先分配、收益池和约束应用均由后端校验和计算。"
        actions={
          <>
            <button className="actionButton secondary" type="button" onClick={() => setDrawer("revenue")}>配置总收益</button>
            <button className="actionButton secondary" type="button" onClick={() => setDrawer("priority")}>配置合同优先分配</button>
            <button className="actionButton secondary" type="button" onClick={() => setDrawer("mode")}>选择分配模式</button>
            <button
              className="actionButton primary"
              disabled={!canRunSimulation}
              title={canRunSimulation ? "调用后端 ALLOC-011" : "请先输入总收益；前端不使用默认收益兜底。"}
              type="button"
              onClick={runSimulation}
            >
              <span>ALLOC-011</span>
              执行模拟
            </button>
            <ActionButton
              action={actionRegistry["ALLOC-013"]}
              disabledReason={hasBackendRows(pageData) ? "" : "后端未返回分配结果"}
              onClick={(action) => {
                onAction(action);
                setDrawer("compare");
              }}
            />
            <ActionButton
              action={actionRegistry["ALLOC-015"]}
              disabledReason={currentAllocationId ? "" : "缺少 current_allocation_id"}
              onClick={(action) => onAction(action)}
            />
            <ActionButton
              action={actionRegistry["ALLOC-016"]}
              disabledReason={currentAllocationId ? "" : "缺少 current_allocation_id"}
              onClick={(action) => {
                onAction(action);
                setDrawer("export");
              }}
            />
          </>
        }
      >
        <div className="allocationFormula">
          收益池、约束前金额、约束后金额和调整原因必须来自后端 allocation result / trace DTO。
        </div>
      </WorkbenchCard>

      <div className="phase2bTwoCol">
        <WorkbenchCard title="分配结果表" description="约束后金额为模拟参考，不是最终付款指令。">
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
              title="后端未返回分配结果"
              description="请先完成 MD-DShap 权重计算并执行收益分配模拟；页面不会使用示例金额。"
            />
          )}
        </WorkbenchCard>

        <ChartPanel
          title="收益流向与约束对比"
          description="总收益、优先分配、收益池、约束前后对比需要后端 flow/compare DTO。"
          source={pageData.chart?.chart_id}
        />
      </div>

      <WorkbenchCard
        title="约束应用轨迹"
        description="合同约束按优先级执行，轨迹必须来自后端 constraint_apply_trace。"
        actions={<button className="actionButton secondary" type="button" onClick={() => setDrawer("trace")}>查看约束轨迹</button>}
      >
        <EmptyGuide
          title="后端未返回约束轨迹 DTO"
          description="当前 allocation results 只展示结果行；前端不再用约束前后金额差推导轨迹。"
        />
      </WorkbenchCard>

      <DetailDrawer
        dirty={Boolean(totalRevenueInput)}
        footerNote="总收益必须大于等于 0；实际校验和收益池计算由后端完成。"
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
        footerNote="优先分配金额不得超过总收益；该规则由后端返回错误信封。"
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
              title="后端未返回对比数据"
              description="执行后端收益分配模拟后展示结果行；差额字段需要后端返回 constraint_adjustment_amount。"
            />
          )}
        </DrawerSection>
      </DetailDrawer>

      <TraceDrawer
        footerNote="约束轨迹写入 constraint_apply_trace；当前页面不从结果行推导 trace。"
        objectType="约束轨迹"
        open={drawer === "trace"}
        output={{ 轨迹状态: "后端未返回页面级 trace DTO" }}
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
          <p>report_id、checksum、生成时间以后端导出响应和报告记录为准。</p>
        </DrawerSection>
      </DetailDrawer>
    </div>
  );
}
