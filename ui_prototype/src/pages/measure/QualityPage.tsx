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
  WorkbenchCard,
} from "../../ui";
import type { PageProps } from "../pageTypes";

const dimensionScores = [
  { name: "完整性", score: 92, weight: "0.300000", evidence: "缺失率低于 5%" },
  { name: "准确性", score: 88, weight: "0.250000", evidence: "异常值规则通过" },
  { name: "时效性", score: 84, weight: "0.200000", evidence: "时间窗口满足场景要求" },
  { name: "可用性", score: 91, weight: "0.250000", evidence: "资源主体归属完整" },
];

export function QualityPage({ route, snapshot, onAction }: PageProps) {
  const [drawer, setDrawer] = useState<"" | "weights" | "detail" | "export">("");

  return (
    <div className="pageWorkspace phase2Page qualityPage">
      <PageHeader
        route={{
          ...route,
          label: "质量评估管理",
          responsibility: "配置质量权重、运行评估、展示总分、证据、预警和版本。",
        }}
        snapshot={snapshot}
      />

      <div className="metricGrid five">
        <MetricCard item={{ label: "质量总分", value: "88.75", hint: "加权综合得分", tone: "success" }} />
        <MetricCard item={{ label: "质量等级", value: "A", hint: "可进入后续计量", tone: "success" }} />
        <MetricCard item={{ label: "质量因子", value: "1.063200", hint: "用于数元计量", tone: "neutral" }} />
        <MetricCard item={{ label: "权重状态", value: "已配置", hint: "一级权重合计 1", tone: "success" }} />
        <MetricCard item={{ label: "评估版本", value: "v3", hint: "重评不覆盖历史", tone: "neutral" }} />
      </div>

      <RiskNotice compact />

      <div className="phase2bTwoCol">
        <WorkbenchCard
          title="质量评估工作台"
          description="一级权重合计必须为 1，二级权重在所属一级下合计为 1。"
          actions={
            <>
              <button
                className="actionButton secondary"
                type="button"
                onClick={() => setDrawer("weights")}
              >
                配置质量指标权重
              </button>
              <ActionButton action={actionRegistry["QUAL-003"]} onClick={(action) => onAction(action)} />
              <ActionButton
                action={actionRegistry["QUAL-006"]}
                onClick={(action) => {
                  onAction(action);
                  setDrawer("detail");
                }}
              />
              <ActionButton action={actionRegistry["QUAL-009"]} onClick={(action) => onAction(action)} />
              <button
                className="actionButton secondary"
                type="button"
                onClick={() => {
                  onAction(actionRegistry["REP-002"]);
                  setDrawer("export");
                }}
              >
                导出质量报告
              </button>
            </>
          }
        >
          <div className="scorePanel">
            <div>
              <span>质量总分</span>
              <strong>88.75</strong>
              <p>质量因子 1.063200，本版本可作为数元计量输入。</p>
            </div>
            <div className="progressTrack"><span style={{ width: "88.75%" }} /></div>
          </div>
        </WorkbenchCard>

        <WorkbenchCard title="低质量风险" description="低质量资源会降低计量系数并进入风险提示。">
          <div className="issueList">
            <article>
              <strong>随机文本摘要</strong>
              <span>缺失率 6.1%，建议补齐主体标注和字段说明。</span>
            </article>
            <article>
              <strong>影像特征向量</strong>
              <span>样本时间窗口稳定，可进入后续评估。</span>
            </article>
          </div>
        </WorkbenchCard>
      </div>

      <WorkbenchCard title="维度得分与证据说明" description="得分证据只展示业务指标，工程编号进入技术详情。">
        <div className="dimensionGrid">
          {dimensionScores.map((item) => (
            <article key={item.name}>
              <strong>{item.name}</strong>
              <span>{item.score}</span>
              <small>权重 {item.weight}</small>
              <p>{item.evidence}</p>
            </article>
          ))}
        </div>
      </WorkbenchCard>

      <DetailDrawer
        dirty
        footerNote="保存后会创建质量参数版本；只影响新评估，不回改历史结果。"
        objectType="质量权重"
        open={drawer === "weights"}
        size="lg"
        title="配置质量指标权重"
        variant="form"
        actions={[
          { label: "取消", onClick: () => setDrawer("") },
          { label: "保存权重", type: "primary", onClick: () => { onAction(actionRegistry["QUAL-002"]); setDrawer(""); } },
        ]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="一级指标权重">
          <div className="formGrid">
            {dimensionScores.map((item) => (
              <label key={item.name}>{item.name}<input defaultValue={item.weight} /></label>
            ))}
          </div>
          <p className="successText">当前一级权重合计：1.000000</p>
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="二级指标用于解释质量得分，不展示工程快照编号。"
        objectType="二级指标"
        open={drawer === "detail"}
        size="lg"
        title="二级指标得分"
        variant="detail"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="指标明细">
          <div className="tableWrap">
            <table className="dataTable phase2Table">
              <thead><tr><th>一级维度</th><th>二级指标</th><th>得分</th><th>证据</th></tr></thead>
              <tbody>
                {dimensionScores.map((item) => (
                  <tr key={item.name}>
                    <td>{item.name}</td>
                    <td>{item.name}二级指标</td>
                    <td>{item.score}</td>
                    <td>{item.evidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="导出质量报告会生成 report_record/export_file，敏感原文不进入文件。"
        objectType="导出说明"
        open={drawer === "export"}
        size="md"
        title="导出质量报告"
        variant="export"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="导出字段">
          <ExportFieldList
            fields={[
              { key: "quality_score", label: "质量总分" },
              { key: "quality_level", label: "质量等级" },
              { key: "quality_factor", label: "质量因子" },
              { key: "assessment_version", label: "评估版本" },
            ]}
            note="不导出工程编号和敏感原文。"
          />
        </DrawerSection>
      </DetailDrawer>
    </div>
  );
}
