import { useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import {
  ActionButton,
  DetailDrawer,
  DrawerSection,
  ExportFieldList,
  MetricCard,
  PageHeader,
  RiskNotice,
  TraceDrawer,
  WorkbenchCard,
} from "../../ui";
import { formatAmount, getMockWorkspace } from "../phase2aUtils";
import type { PageProps } from "../pageTypes";

const allocationRows = [
  { party: "数据源主体甲", before: 194376, after: 184500, weight: "0.462800", status: "已应用约束" },
  { party: "数据源主体乙", before: 136038, after: 137250, weight: "0.323900", status: "已应用约束" },
  { party: "数据源主体丙", before: 89586, after: 98250, weight: "0.213300", status: "已应用约束" },
];

export function SimulationPage({ route, snapshot, onAction }: PageProps) {
  const [drawer, setDrawer] = useState<"" | "revenue" | "priority" | "mode" | "compare" | "export" | "trace">("");
  const mock = getMockWorkspace(snapshot);
  const backendRows = snapshot.pages["/allocation/simulation"].rows;
  const displayRows = backendRows.length
    ? backendRows.map((row) => ({
        party: readCell(row, "party_name", "数据源主体"),
        before: readNumber(row, "pre_constraint_amount"),
        after: readNumber(row, "post_constraint_amount"),
        weight: readCell(row, "normalized_weight", "0.000000"),
        status: readCell(row, "scenario_status", "已生成"),
      }))
    : allocationRows;
  const totalRevenue = backendRows.length
    ? readNumber(backendRows[0], "total_revenue")
    : mock.currentRevenuePool;
  const priorityAmount = backendRows.length
    ? readNumber(backendRows[0], "priority_allocation_amount")
    : 64000;
  const dataPool = backendRows.length
    ? readNumber(backendRows[0], "data_provider_revenue_pool")
    : totalRevenue - priorityAmount;

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
        <MetricCard item={{ label: "总收益", value: formatAmount(totalRevenue), hint: "必须 >= 0", tone: "neutral" }} />
        <MetricCard item={{ label: "合同优先分配", value: formatAmount(priorityAmount), hint: "先于数据源收益池扣除", tone: "warning" }} />
        <MetricCard item={{ label: "数据源收益池", value: formatAmount(dataPool), hint: "按权重和约束分配", tone: "success" }} />
        <MetricCard item={{ label: "分配模式", value: "MD-DShap", hint: "权重不是付款指令", tone: "neutral" }} />
        <MetricCard item={{ label: "锁定状态", value: "未锁定", hint: "锁定后只能复制新版本", tone: "neutral" }} />
      </div>

      <RiskNotice compact />

      <WorkbenchCard
        title="收益输入与模拟动作"
        description="先扣合同优先，再形成数据源收益池，最后按模式和约束生成模拟方案。"
        actions={
          <>
            <button className="actionButton secondary" type="button" onClick={() => setDrawer("revenue")}>配置总收益</button>
            <button className="actionButton secondary" type="button" onClick={() => setDrawer("priority")}>配置合同优先分配</button>
            <button className="actionButton secondary" type="button" onClick={() => setDrawer("mode")}>选择分配模式</button>
            <ActionButton action={actionRegistry["ALLOC-011"]} onClick={(action) => onAction(action)} />
            <ActionButton
              action={actionRegistry["ALLOC-013"]}
              onClick={(action) => {
                onAction(action);
                setDrawer("compare");
              }}
            />
            <ActionButton action={actionRegistry["ALLOC-015"]} onClick={(action) => onAction(action)} />
            <ActionButton
              action={actionRegistry["ALLOC-016"]}
              onClick={(action) => {
                onAction(action);
                setDrawer("export");
              }}
            />
          </>
        }
      >
        <div className="allocationFormula">
          总收益 - 合同优先分配 = 数据源收益池；再按 MD-DShap 权重模拟分配并应用合同约束。
        </div>
      </WorkbenchCard>

      <div className="phase2bTwoCol">
        <WorkbenchCard title="分配结果表" description="约束后金额为模拟参考，不是最终付款指令。">
          <div className="tableWrap">
            <table className="dataTable phase2Table">
              <thead><tr><th>参与方</th><th>权重</th><th>约束前金额</th><th>约束后金额</th><th>状态</th></tr></thead>
              <tbody>
                {displayRows.map((row) => (
                  <tr key={row.party}>
                    <td><strong>{row.party}</strong></td>
                    <td>{row.weight}</td>
                    <td>{formatAmount(row.before)}</td>
                    <td>{formatAmount(row.after)}</td>
                    <td><span className="tag success">{row.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </WorkbenchCard>

        <WorkbenchCard
          title="约束应用轨迹"
          description="合同约束按优先级执行，应用结果写入约束轨迹。"
          actions={<button className="actionButton secondary" type="button" onClick={() => setDrawer("trace")}>查看约束轨迹</button>}
        >
          <div className="compactList">
            <article><strong>优先分配</strong><span>运营服务方 40,000.00</span><small>优先级 1</small></article>
            <article><strong>最低金额</strong><span>数据源主体丙不低于 95,000.00</span><small>优先级 2</small></article>
          </div>
        </WorkbenchCard>
      </div>

      <DetailDrawer
        dirty
        footerNote="总收益必须大于等于 0；保存只影响新模拟。"
        objectType="收益输入"
        open={drawer === "revenue"}
        size="md"
        title="配置总收益"
        variant="form"
        actions={[
          { label: "取消", onClick: () => setDrawer("") },
          { label: "保存总收益", type: "primary", onClick: () => { onAction(actionRegistry["ALLOC-003"]); setDrawer(""); } },
        ]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="收益输入">
          <div className="formGrid"><label>总收益<input defaultValue={String(totalRevenue)} /></label></div>
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        dirty
        footerNote="优先分配总额不得超过总收益。"
        objectType="合同优先"
        open={drawer === "priority"}
        size="md"
        title="配置合同优先分配"
        variant="form"
        actions={[
          { label: "取消", onClick: () => setDrawer("") },
          { label: "保存优先分配", type: "primary", onClick: () => { onAction(actionRegistry["ALLOC-005"]); setDrawer(""); } },
        ]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="合同优先分配">
          <div className="formGrid">
            <label>运营服务方<input defaultValue="40000" /></label>
            <label>技术服务方<input defaultValue="24000" /></label>
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
          { label: "保存模式", type: "primary", onClick: () => { onAction(actionRegistry["ALLOC-007"]); setDrawer(""); } },
        ]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="模式选择">
          <div className="checkList">
            <label><input type="radio" name="mode" defaultChecked /> <span>MD-DShap 权重分配</span></label>
            <label><input type="radio" name="mode" /> <span>加权贡献分配</span></label>
            <label><input type="radio" name="mode" /> <span>合同比例分配</span></label>
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
          <div className="dimensionGrid">
            {displayRows.map((row) => (
              <article key={row.party}>
                <strong>{row.party}</strong>
                <span>{formatAmount(row.after - row.before)}</span>
                <p>约束后金额 {formatAmount(row.after)}</p>
              </article>
            ))}
          </div>
        </DrawerSection>
      </DetailDrawer>

      <TraceDrawer
        footerNote="约束轨迹写入 constraint_apply_trace；工程编号折叠展示。"
        formula="约束后金额 = 按优先级依次应用合同优先、保底、封顶和固定比例"
        objectType="约束轨迹"
        open={drawer === "trace"}
        output={{ 约束状态: "已应用", 最终合计: formatAmount(totalRevenue) }}
        parameters={{ 优先分配规则: "合同优先", 保底规则: "最低金额" }}
        title="约束应用轨迹"
        traceColumns={[
          { key: "rule", label: "约束规则" },
          { key: "target", label: "对象" },
          { key: "before", label: "应用前" },
          { key: "after", label: "应用后" },
        ]}
        traceRows={[
          { rule: "优先分配", target: "运营服务方", before: "0.00", after: "40,000.00" },
          { rule: "保底金额", target: "数据源主体丙", before: "89,586.00", after: "98,250.00" },
        ]}
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
            { key: "before_amount", label: "约束前金额" },
            { key: "after_amount", label: "约束后金额" },
          ]}
        />
      </DetailDrawer>
    </div>
  );
}

function readCell(row: Record<string, string | number | boolean>, key: string, fallback: string) {
  const value = row[key];
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function readNumber(row: Record<string, string | number | boolean>, key: string) {
  const value = Number(row[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}
