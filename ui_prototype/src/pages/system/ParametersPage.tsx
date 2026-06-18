import { useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import {
  ActionButton,
  DetailDrawer,
  DrawerSection,
  MetricCard,
  PageHeader,
  RiskNotice,
  WorkbenchCard,
} from "../../ui";
import type { PageProps } from "../pageTypes";

const parameterGroups = [
  { name: "质量权重", value: "完整性 0.30 / 准确性 0.25", status: "已生效" },
  { name: "算法默认参数", value: "MD_DSHAP / 512 轮 / epsilon 0.0001", status: "已生效" },
  { name: "风险提示文案", value: "模拟参考，非法律结算", status: "已生效" },
  { name: "精度规则", value: "金额 2 位，权重 6 位", status: "已生效" },
];

export function ParametersPage({ route, snapshot, onAction }: PageProps) {
  const [drawer, setDrawer] = useState<"" | "algorithm" | "risk" | "version">("");

  return (
    <div className="pageWorkspace phase2Page parametersPage">
      <PageHeader
        route={{
          ...route,
          label: "参数配置",
          responsibility: "维护质量权重、算法默认参数、风险文案、精度规则和参数版本。",
        }}
        snapshot={snapshot}
      />

      <div className="metricGrid four">
        <MetricCard item={{ label: "参数版本", value: "v5", hint: "只影响新计算", tone: "neutral" }} />
        <MetricCard item={{ label: "算法模式", value: "MD_DSHAP", hint: "默认模式", tone: "success" }} />
        <MetricCard item={{ label: "采样轮次", value: "512", hint: "必须 > 0", tone: "neutral" }} />
        <MetricCard item={{ label: "收敛阈值", value: "0.0001", hint: "必须 > 0", tone: "neutral" }} />
      </div>

      <RiskNotice compact />

      <WorkbenchCard
        title="参数组"
        description="高风险参数修改需要二次确认；保存版本只影响新计算，不回改历史结果。"
        actions={
          <>
            <button className="actionButton secondary" type="button" onClick={() => setDrawer("algorithm")}>MD-DShap 参数配置</button>
            <button className="actionButton secondary" type="button" onClick={() => setDrawer("risk")}>风险提示文案配置</button>
            <button className="actionButton secondary" type="button" onClick={() => onAction(actionRegistry["PARAM-001"])}>恢复默认</button>
            <ActionButton action={actionRegistry["PARAM-002"]} onClick={(action) => onAction(action)} />
          </>
        }
      >
        <div className="tableWrap">
          <table className="dataTable phase2Table">
            <thead><tr><th>参数组</th><th>当前值</th><th>生效状态</th><th>操作</th></tr></thead>
            <tbody>
              {parameterGroups.map((item) => (
                <tr key={item.name}>
                  <td><strong>{item.name}</strong></td>
                  <td>{item.value}</td>
                  <td><span className="tag success">{item.status}</span></td>
                  <td><button type="button" onClick={() => setDrawer("version")}>查看版本</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WorkbenchCard>

      <DetailDrawer
        dirty
        footerNote="默认 algorithm_mode 必须为 MD_DSHAP；epsilon 和 sample_rounds 必须大于 0。"
        objectType="算法参数"
        open={drawer === "algorithm"}
        size="md"
        title="MD-DShap 参数配置"
        variant="form"
        actions={[
          { label: "取消", onClick: () => setDrawer("") },
          { label: "保存参数", type: "primary", onClick: () => { onAction(actionRegistry["PARAM-004"]); setDrawer(""); } },
        ]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="算法默认值">
          <div className="formGrid">
            <label>算法模式<input defaultValue="MD_DSHAP" /></label>
            <label>采样轮次<input defaultValue="512" /></label>
            <label>收敛阈值<input defaultValue="0.0001" /></label>
            <label>保存边际明细<select defaultValue="是"><option>是</option><option>否</option></select></label>
          </div>
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        dirty
        footerNote="风险提示文案会出现在报告、导出和算法结果说明中。"
        objectType="风险文案"
        open={drawer === "risk"}
        size="md"
        title="风险提示文案配置"
        variant="form"
        actions={[
          { label: "取消", onClick: () => setDrawer("") },
          { label: "保存文案", type: "primary", onClick: () => { onAction(actionRegistry["PARAM-008"]); setDrawer(""); } },
        ]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="默认文案">
          <textarea defaultValue="本系统输出仅作数据收益分配模拟与审计说明参考，不作为法律结算、法定结算、付款指令或合同履约依据。" rows={5} />
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="参数版本只读展示；历史计算继续使用当时版本。"
        objectType="参数版本"
        open={drawer === "version"}
        size="md"
        title="参数版本详情"
        variant="detail"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="版本说明">
          <dl className="businessDetail compact">
            <div><dt>版本</dt><dd>v5</dd></div>
            <div><dt>生效范围</dt><dd>仅影响新计算</dd></div>
            <div><dt>变更摘要</dt><dd>调整 MD-DShap 采样轮次和风险提示文案</dd></div>
          </dl>
        </DrawerSection>
      </DetailDrawer>
    </div>
  );
}
