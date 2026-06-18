import { useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import {
  ActionButton,
  DetailDrawer,
  DrawerSection,
  MetricCard,
  PageHeader,
  TraceDrawer,
  WorkbenchCard,
} from "../../ui";
import { formatWeight, getMockWorkspace } from "../phase2aUtils";
import type { PageProps } from "../pageTypes";

const contributionRows = [
  { party: "数据源主体甲", validUnits: 18400, contribution: 0.4562, normalized: 0.4628, utility: 0.524316 },
  { party: "数据源主体乙", validUnits: 12600, contribution: 0.3194, normalized: 0.3239, utility: 0.363744 },
  { party: "数据源主体丙", validUnits: 8200, contribution: 0.2103, normalized: 0.2133, utility: 0.241918 },
];

export function UtilityPage({ route, snapshot, onAction }: PageProps) {
  const [drawer, setDrawer] = useState<"" | "factor" | "function" | "trace">("");
  const mock = getMockWorkspace(snapshot);

  return (
    <div className="pageWorkspace phase2Page utilityPage">
      <PageHeader
        route={{
          ...route,
          label: "贡献度与效用计算",
          responsibility: "计算贡献度、归一化贡献和效用值，为 MD-DShap 提供输入。",
        }}
        snapshot={snapshot}
      />

      <div className="metricGrid four">
        <MetricCard item={{ label: "贡献因子状态", value: "已配置", hint: "使用 / 覆盖 / 稀缺", tone: "success" }} />
        <MetricCard item={{ label: "归一化贡献", value: "1.000000", hint: "总贡献非 0", tone: "success" }} />
        <MetricCard item={{ label: "效用函数", value: "DAUS", hint: "来源已披露", tone: "neutral" }} />
        <MetricCard item={{ label: "效用记录", value: "3", hint: "进入 MD-DShap 输入", tone: "success" }} />
      </div>

      <div className="phase2bTwoCol">
        <WorkbenchCard
          title="贡献因子配置"
          description="有效单元数必须大于等于 0，使用权重、覆盖权重、稀缺权重必须大于 0。"
          actions={
            <>
              <button className="actionButton secondary" type="button" onClick={() => setDrawer("factor")}>配置贡献因子</button>
              <ActionButton action={actionRegistry["UTIL-006"]} onClick={(action) => onAction(action)} />
            </>
          }
        >
          <div className="factorGrid">
            <article><span>使用权重</span><strong>0.420000</strong></article>
            <article><span>覆盖权重</span><strong>0.330000</strong></article>
            <article><span>稀缺权重</span><strong>0.250000</strong></article>
          </div>
        </WorkbenchCard>

        <WorkbenchCard
          title="效用函数"
          description="效用函数来源必须披露，用于生成 v(S,t) 或 MD-DShap 输入。"
          actions={
            <>
              <button className="actionButton secondary" type="button" onClick={() => setDrawer("function")}>配置效用函数</button>
              <ActionButton action={actionRegistry["UTIL-008"]} onClick={(action) => onAction(action)} />
              <ActionButton
                action={actionRegistry["UTIL-009"]}
                onClick={(action) => {
                  onAction(action);
                  setDrawer("trace");
                }}
              />
            </>
          }
        >
          <div className="formulaBox">
            效用值 = 归一化贡献 x 质量因子 x 场景效用
          </div>
        </WorkbenchCard>
      </div>

      <WorkbenchCard title="参与方效用表" description="效用值是 MD-DShap 的输入，不是最终付款指令。">
        <div className="tableWrap">
          <table className="dataTable phase2Table">
            <thead><tr><th>参与方</th><th>有效单元</th><th>贡献度得分</th><th>归一化贡献</th><th>效用值</th></tr></thead>
            <tbody>
              {contributionRows.map((row) => (
                <tr key={row.party}>
                  <td><strong>{row.party}</strong></td>
                  <td>{row.validUnits.toLocaleString("zh-CN")}</td>
                  <td>{formatWeight(row.contribution)}</td>
                  <td>{formatWeight(row.normalized)}</td>
                  <td>{formatWeight(row.utility)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WorkbenchCard>

      <DetailDrawer
        dirty
        footerNote="总贡献为 0 时不能归一化；保存后生成参数快照。"
        objectType="贡献因子"
        open={drawer === "factor"}
        size="md"
        title="配置贡献因子"
        variant="form"
        actions={[
          { label: "取消", onClick: () => setDrawer("") },
          { label: "保存贡献因子", type: "primary", onClick: () => { onAction(actionRegistry["UTIL-001"]); setDrawer(""); } },
        ]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="贡献权重">
          <div className="formGrid">
            <label>使用权重<input defaultValue="0.420000" /></label>
            <label>覆盖权重<input defaultValue="0.330000" /></label>
            <label>稀缺权重<input defaultValue="0.250000" /></label>
          </div>
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        dirty
        footerNote="保存后写入效用函数快照，后续计算使用新版本。"
        objectType="效用函数"
        open={drawer === "function"}
        size="md"
        title="配置效用函数"
        variant="form"
        actions={[
          { label: "取消", onClick: () => setDrawer("") },
          { label: "保存函数", type: "primary", onClick: () => { onAction(actionRegistry["UTIL-007"]); setDrawer(""); } },
        ]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="函数来源">
          <div className="formGrid">
            <label>函数名称<input defaultValue="DAUS utility v1" /></label>
            <label>披露说明<input defaultValue="贡献、质量、使用和场景信号组合" /></label>
          </div>
        </DrawerSection>
      </DetailDrawer>

      <TraceDrawer
        footerNote="效用 trace 写入 utility_trace；工程编号在技术详情中折叠。"
        formula="效用值 = 归一化贡献 x 质量因子 x 场景效用"
        objectType="效用轨迹"
        open={drawer === "trace"}
        output={{ 效用合计: "1.129978", 轨迹状态: "已生成" }}
        parameters={{ 使用权重: 0.42, 覆盖权重: 0.33, 稀缺权重: 0.25 }}
        statusTag="已生成"
        summary="展示贡献度归一化、质量因子和场景效用对最终效用值的影响。"
        technicalDetails={{ utility_trace_ref: "技术详情仅用于审计追溯", output_snapshot_ref: "已折叠" }}
        title="效用计算过程"
        traceColumns={[
          { key: "party", label: "参与方" },
          { key: "normalized", label: "归一化贡献" },
          { key: "quality", label: "质量因子" },
          { key: "utility", label: "效用值" },
        ]}
        traceRows={mock.mdsParticipants.map((item) => ({
          party: item.name,
          normalized: formatWeight(item.contributionScore),
          quality: formatWeight(item.qualityFactor),
          utility: formatWeight(item.utilityValue),
        }))}
        onClose={() => setDrawer("")}
      />
    </div>
  );
}
