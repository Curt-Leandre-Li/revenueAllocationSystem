import { useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import {
  ActionButton,
  DetailDrawer,
  DrawerSection,
  ExportFieldList,
  MetricCard,
  PageHeader,
  WorkbenchCard,
} from "../../ui";
import { formatAmount, getMockWorkspace } from "../phase2aUtils";
import type { PageProps } from "../pageTypes";

const factors = [
  { label: "场景系数", value: "1.120000" },
  { label: "质量系数", value: "1.063200" },
  { label: "技术系数", value: "1.080000" },
  { label: "专家系数", value: "1.030000" },
  { label: "发展系数", value: "1.050000" },
];

export function ShuyuanPage({ route, snapshot, onAction }: PageProps) {
  const [drawer, setDrawer] = useState<"" | "base" | "calls" | "detail" | "export">("");
  const mock = getMockWorkspace(snapshot);
  const totalAmount = 126840;

  return (
    <div className="pageWorkspace phase2Page shuyuanPage">
      <PageHeader
        route={{
          ...route,
          label: "数元计量管理",
          responsibility: "配置基础单价、调用次数和多维系数，执行资源级数元计量。",
        }}
        snapshot={snapshot}
      />

      <div className="metricGrid five">
        <MetricCard item={{ label: "项目总计量金额", value: formatAmount(totalAmount), hint: "保留 2 位小数", tone: "success" }} />
        <MetricCard item={{ label: "基准数元价", value: "2.500000", hint: "必须大于 0", tone: "neutral" }} />
        <MetricCard item={{ label: "资源调用量", value: "48,200", hint: "call_count >= 0", tone: "neutral" }} />
        <MetricCard item={{ label: "质量系数", value: "1.063200", hint: "来自质量评估", tone: "success" }} />
        <MetricCard item={{ label: "计量版本", value: "v2", hint: "执行后生成快照", tone: "neutral" }} />
      </div>

      <div className="phase2bTwoCol">
        <WorkbenchCard
          title="计量公式"
          description="call_count = 0 合法，对应资源级金额为 0。"
          actions={
            <>
              <button className="actionButton secondary" type="button" onClick={() => setDrawer("base")}>配置基准数元</button>
              <button className="actionButton secondary" type="button" onClick={() => setDrawer("calls")}>录入调用量</button>
              <ActionButton action={actionRegistry["DU-009"]} onClick={(action) => onAction(action)} />
              <ActionButton
                action={actionRegistry["DU-010"]}
                onClick={(action) => {
                  onAction(action);
                  setDrawer("detail");
                }}
              />
              <button
                className="actionButton secondary"
                type="button"
                onClick={() => {
                  onAction(actionRegistry["REP-004"]);
                  setDrawer("export");
                }}
              >
                导出计量结果
              </button>
            </>
          }
        >
          <div className="formulaBox">
            数元金额 = 基准数元价 x 调用量 x 场景系数 x 质量系数 x 技术系数 x 专家系数 x 发展系数
          </div>
        </WorkbenchCard>

        <WorkbenchCard title="多维系数" description="所有系数必须大于 0，显示 6 位小数。">
          <div className="factorGrid">
            {factors.map((factor) => (
              <article key={factor.label}>
                <span>{factor.label}</span>
                <strong>{factor.value}</strong>
              </article>
            ))}
          </div>
        </WorkbenchCard>
      </div>

      <div className="phase2bTwoCol">
        <WorkbenchCard title="资源级明细" description="按资源计算金额，进入参与方汇总。">
          <div className="tableWrap">
            <table className="dataTable phase2Table">
              <thead><tr><th>资源名称</th><th>调用量</th><th>质量系数</th><th>计量金额</th></tr></thead>
              <tbody>
                {mock.resources.slice(0, 4).map((resource, index) => (
                  <tr key={resource.resourceKey}>
                    <td>{resource.name}</td>
                    <td>{index === 1 ? 0 : (resource.sampleCount * 2).toLocaleString("zh-CN")}</td>
                    <td>{index === 1 ? "1.000000" : "1.063200"}</td>
                    <td>{formatAmount(index === 1 ? 0 : resource.sampleCount * 2.5)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </WorkbenchCard>

        <WorkbenchCard title="参与方汇总" description="按资源主体归属汇总计量金额。">
          <div className="compactList">
            {mock.dataProviders.map((party, index) => (
              <article key={party.name}>
                <strong>{party.name}</strong>
                <span>{party.linkedResourceCount} 个关联资源</span>
                <small>计量金额 {formatAmount(42000 - index * 8600)}</small>
              </article>
            ))}
          </div>
        </WorkbenchCard>
      </div>

      <DetailDrawer
        dirty
        footerNote="保存后写入计量参数；只影响新计算。"
        objectType="计量参数"
        open={drawer === "base"}
        size="md"
        title="配置基准数元"
        variant="form"
        actions={[
          { label: "取消", onClick: () => setDrawer("") },
          { label: "保存参数", type: "primary", onClick: () => { onAction(actionRegistry["DU-002"]); setDrawer(""); } },
        ]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="基准价与系数">
          <div className="formGrid">
            <label>基准数元价<input defaultValue="2.500000" /></label>
            {factors.map((factor) => (
              <label key={factor.label}>{factor.label}<input defaultValue={factor.value} /></label>
            ))}
          </div>
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        dirty
        footerNote="调用量可以为 0，金额随之为 0；保存后写入调用量输入。"
        objectType="调用量录入"
        open={drawer === "calls"}
        size="lg"
        title="录入资源调用量"
        variant="form"
        actions={[
          { label: "取消", onClick: () => setDrawer("") },
          { label: "保存调用量", type: "primary", onClick: () => { onAction(actionRegistry["DU-003"]); setDrawer(""); } },
        ]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="资源调用量">
          <div className="formGrid">
            {mock.resources.slice(0, 4).map((resource, index) => (
              <label key={resource.resourceKey}>{resource.name}<input defaultValue={index === 1 ? "0" : String(resource.sampleCount * 2)} /></label>
            ))}
          </div>
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="明细只展示业务字段；工程快照在审计模块查看。"
        objectType="计量明细"
        open={drawer === "detail"}
        size="lg"
        title="数元计量明细"
        variant="detail"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="公式解释">
          <p>各系数均大于 0；调用量为 0 时金额为 0，仍保留资源明细行。</p>
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="导出计量结果会生成 report_record/export_file。"
        objectType="导出说明"
        open={drawer === "export"}
        size="md"
        title="导出计量结果"
        variant="export"
        onClose={() => setDrawer("")}
      >
        <ExportFieldList
          fields={[
            { key: "resource_name", label: "资源名称" },
            { key: "call_count", label: "调用量" },
            { key: "base_price", label: "基准数元价" },
            { key: "metering_amount", label: "计量金额" },
          ]}
        />
      </DetailDrawer>
    </div>
  );
}
