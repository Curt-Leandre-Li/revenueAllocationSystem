import { useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import {
  ActionButton,
  ChartArea,
  CompactPageHeader,
  DetailDrawer,
  DrawerSection,
  EmptyGuide,
  ExportFieldList,
  ProductBarChart,
  ProductDonutChart,
  ProgressiveDisclosure,
  SummaryStrip,
  TraceDrawer,
} from "../../ui";
import {
  cellText,
  hasBackendRows,
  numericCellValue,
  pageMetrics,
  pageRows,
  percentCell,
  weightCell,
} from "../backendPageData";
import type { PageProps } from "../pageTypes";

type DrawerName = "params" | "trace" | "weights" | "audit" | "export" | "";

export function MDDShapPage({ route, snapshot, onAction }: PageProps) {
  const [drawer, setDrawer] = useState<DrawerName>("");
  const [seed, setSeed] = useState(20260618);
  const [sampleRounds, setSampleRounds] = useState(512);
  const [epsilon, setEpsilon] = useState(0.0001);
  const [saveMarginalDetail, setSaveMarginalDetail] = useState(true);
  const pageData = snapshot.pages[route.path];
  const rows = pageRows(pageData);
  const metrics = pageMetrics(pageData);
  const firstRow = rows[0];
  const metricMap = new Map(metrics.map((item) => [item.label, item]));
  const weightPoints = rows.map((row) => ({
    label: cellText(row, "party_name"),
    value: percentCell(row, "normalized_weight"),
    numeric: numericCellValue(row.normalized_weight),
    meta: cellText(row, "task_status"),
  }));
  const marginalPoints = rows.map((row) => ({
    label: cellText(row, "party_name"),
    value: weightCell(row, "marginal_contribution"),
    numeric: numericCellValue(row.marginal_contribution),
    meta: cellText(row, "task_status"),
  }));
  const summaryItems = [
    metricMap.get("参与计算主体") ?? { label: "参与计算主体", value: cellText(pageData.technicalDetails, "participant_count", "暂无"), hint: "系统摘要", tone: "neutral" as const },
    metricMap.get("权重结果") ?? { label: "权重结果", value: hasBackendRows(pageData) ? String(rows.length) : "暂无", hint: "系统结果", tone: "neutral" as const },
    metricMap.get("最高权重主体") ?? { label: "最高权重主体", value: cellText(firstRow, "party_name"), hint: "系统字段", tone: "neutral" as const },
    metricMap.get("任务状态") ?? { label: "任务状态", value: cellText(firstRow, "task_status"), hint: "系统字段", tone: "neutral" as const },
    metricMap.get("审计快照") ?? { label: "审计快照", value: cellText(pageData.technicalDetails, "snapshot_count", "暂无"), hint: "系统摘要", tone: "neutral" as const },
  ];

  function runCalculation() {
    onAction(actionRegistry["MDS-011"], {
      kind: "mds-parameters",
      seed,
      sampleRounds,
      epsilon,
      saveMarginalDetail,
    });
  }

  return (
    <div className="pageWorkspace leanPage mdsPage">
      <CompactPageHeader
        title="分配权重"
        description="查看用于收益分配模拟的权重结果和边际贡献说明。"
        primaryAction={<ActionButton action={actionRegistry["MDS-011"]} onClick={runCalculation} />}
        secondaryActions={
          <button className="actionButton secondary" type="button" onClick={() => setDrawer("params")}>
            计算参数
          </button>
        }
      />

      <SummaryStrip items={summaryItems} />

      <section className="resultChartGrid secondary">
        <ChartArea title="分配权重排行" source={hasBackendRows(pageData) ? "rows" : undefined}>
          <ProductBarChart points={weightPoints} unit="权重" />
        </ChartArea>
        <ChartArea title="权重占比" source={hasBackendRows(pageData) ? "rows" : undefined}>
          <ProductDonutChart points={weightPoints} />
        </ChartArea>
      </section>

      <section className="resultChartGrid secondary">
        <ChartArea title="边际贡献排行" source={hasBackendRows(pageData) ? "rows" : undefined}>
          <ProductBarChart points={marginalPoints} unit="边际贡献" />
        </ChartArea>
        <ProgressiveDisclosure title="参数与审计" summary="默认折叠">
          <div className="progressiveStack">
            <dl className="businessDetail compact">
              <div><dt>任务状态</dt><dd>{cellText(firstRow, "task_status")}</dd></div>
              <div><dt>采样轮次</dt><dd>{cellText(firstRow, "sample_rounds")}</dd></div>
              <div><dt>收敛阈值</dt><dd>{cellText(firstRow, "epsilon")}</dd></div>
            </dl>
            <button className="textLinkButton" type="button" onClick={() => setDrawer("trace")}>
              查看边际贡献说明
            </button>
          </div>
        </ProgressiveDisclosure>
      </section>

      <section className="leanTableSection">
        <div className="leanSectionHead">
          <div>
            <h2>权重结果</h2>
            <p>权重只做展示；合计与归一化校验由系统返回。</p>
          </div>
          <button
            className="textLinkButton"
            type="button"
            onClick={() => {
              onAction(actionRegistry["MDS-018"], { kind: "mds-audit-export" });
              setDrawer("audit");
            }}
          >
            算法审计
          </button>
        </div>
        {hasBackendRows(pageData) ? (
          <div className="tableWrap">
            <table className="dataTable phase2Table">
              <thead>
                <tr>
                  <th>参与方</th>
                  <th>原始权重</th>
                  <th>分配权重</th>
                  <th>边际贡献</th>
                  <th>任务状态</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${cellText(row, "party_name", "party")}-${index}`}>
                    <td>{cellText(row, "party_name")}</td>
                    <td>{weightCell(row, "participant_weight")}</td>
                    <td>{percentCell(row, "normalized_weight")}</td>
                    <td>{weightCell(row, "marginal_contribution")}</td>
                    <td>{cellText(row, "task_status")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyGuide
            title="暂无权重结果"
            description="请先完成效用计算并启动权重计算；页面不会计算权重合计或补造权重。"
          />
        )}
      </section>

      <DetailDrawer
        footerNote="参数作为计算请求输入；结果仍以系统返回为准。"
        objectType="计算参数"
        open={drawer === "params"}
        size="md"
        title="计算参数"
        variant="form"
        actions={[
          { label: "关闭", onClick: () => setDrawer("") },
          { label: "执行计算", type: "primary", onClick: () => { runCalculation(); setDrawer(""); } },
        ]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="参数">
          <div className="paramGrid">
            <label>seed<input value={seed} type="number" onChange={(event) => setSeed(Number(event.target.value))} /></label>
            <label>sample rounds<input value={sampleRounds} type="number" onChange={(event) => setSampleRounds(Number(event.target.value))} /></label>
            <label>epsilon<input step="0.0001" value={epsilon} type="number" onChange={(event) => setEpsilon(Number(event.target.value))} /></label>
            <label className="checkboxLine">
              <input checked={saveMarginalDetail} type="checkbox" onChange={(event) => setSaveMarginalDetail(event.target.checked)} />
              保存边际贡献明细
            </label>
          </div>
        </DrawerSection>
      </DetailDrawer>

      <TraceDrawer
        footerNote="边际贡献说明仅用于解释模拟计算链路，不作为付款或结算依据。"
        input={{ 参与方集合: cellText(firstRow, "participant_set"), 任务集合: cellText(firstRow, "task_set") }}
        objectType="边际贡献"
        open={drawer === "trace"}
        output={{ 任务状态: cellText(firstRow, "task_status") }}
        parameters={{ seed, sample_rounds: sampleRounds, epsilon, save_marginal_detail: saveMarginalDetail ? "是" : "否" }}
        statusTag={cellText(firstRow, "task_status", "缺少数据")}
        summary="展示系统任务字段；不在页面推导进度百分比、权重合计或快照状态。"
        technicalDetails={pageData.technicalDetails}
        title="边际贡献说明"
        traceColumns={[
          { key: "party_name", label: "参与方" },
          { key: "normalized_weight", label: "分配权重" },
          { key: "marginal_contribution", label: "边际贡献" },
          { key: "task_status", label: "任务状态" },
        ]}
        traceRows={rows}
        onClose={() => setDrawer("")}
      />

      <DetailDrawer
        footerNote="缺少独立权重导出结果时不显示已生成文件。"
        objectType="导出说明"
        open={drawer === "export"}
        size="md"
        statusTag="未启用"
        title="算法结果导出"
        variant="export"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="导出字段">
          <ExportFieldList
            fields={["algorithm_mode", "party_name", "normalized_weight", "participant_weight"]}
            note="字段范围仅为说明，不代表已生成文件。"
          />
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="审计说明仅解释算法输入、参数、输出和模拟边界。"
        objectType="算法审计说明"
        open={drawer === "audit"}
        size="lg"
        statusTag="导出说明"
        title="算法审计说明"
        variant="export"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="审计内容">
          <p>算法审计导出后，报告编号、校验摘要和生成时间以报告记录为准。</p>
        </DrawerSection>
      </DetailDrawer>
    </div>
  );
}
