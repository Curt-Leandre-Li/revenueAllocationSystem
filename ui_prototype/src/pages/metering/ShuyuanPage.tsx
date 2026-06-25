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
  SummaryStrip,
} from "../../ui";
import {
  amountCell,
  cellText,
  hasBackendRows,
  numberCell,
  numericCellValue,
  pageMetrics,
  pageRows,
  weightCell,
} from "../backendPageData";
import type { PageProps } from "../pageTypes";

export function ShuyuanPage({ route, snapshot, onAction }: PageProps) {
  const [drawer, setDrawer] = useState<"" | "base" | "calls" | "detail" | "export">("");
  const pageData = snapshot.pages[route.path];
  const rows = pageRows(pageData);
  const firstRow = rows[0];
  const metrics = pageMetrics(pageData);
  const metricMap = new Map(metrics.map((item) => [item.label, item]));
  const summaryItems = [
    metricMap.get("项目总计量金额") ?? { label: "数元统计总额", value: amountCell(firstRow, "metering_amount"), hint: "系统结果", tone: "neutral" as const },
    metricMap.get("基准价") ?? { label: "基准价", value: weightCell(firstRow, "base_shuyuan_price"), hint: "系统字段", tone: "neutral" as const },
    metricMap.get("调用量") ?? { label: "调用量", value: numberCell(firstRow, "call_count"), hint: "系统字段", tone: "neutral" as const },
    metricMap.get("已计量资源") ?? { label: "已计量资源", value: cellText(pageData.technicalDetails, "metered_resource_count", "暂无"), hint: "系统摘要", tone: "neutral" as const },
    metricMap.get("已计量主体") ?? { label: "已计量主体", value: cellText(pageData.technicalDetails, "metered_party_count", "暂无"), hint: "系统摘要", tone: "neutral" as const },
  ];
  const valueRankPoints = rankRowsByBackendNumber(rows, "metering_amount").map((row) => ({
    label: cellText(row, "resource_name"),
    value: amountCell(row, "metering_amount"),
    numeric: numericCellValue(row.metering_amount),
    meta: cellText(row, "party_name"),
  }));
  const callRankPoints = rankRowsByBackendNumber(rows, "call_count").map((row) => ({
    label: cellText(row, "resource_name"),
    value: numberCell(row, "call_count"),
    numeric: numericCellValue(row.call_count),
    meta: cellText(row, "party_name"),
  }));

  return (
    <div className="pageWorkspace leanPage shuyuanPage">
      <CompactPageHeader
        title="数元计量"
        description="查看基准价、调用量、计量结果和资源级明细。"
        primaryAction={
          <ActionButton action={actionRegistry["DU-009"]} onClick={(action) => onAction(action)} />
        }
        secondaryActions={
          <button
            className="actionButton secondary"
            type="button"
            onClick={() => {
              onAction(actionRegistry["DU-010"]);
              setDrawer("detail");
            }}
          >
            查看明细
          </button>
        }
      />

      <SummaryStrip items={summaryItems} />

      <section className="resultChartGrid secondary">
        <ChartArea title="数据价值排行" source={hasBackendRows(pageData) ? "rows" : undefined}>
          <ProductBarChart points={valueRankPoints} unit="金额" />
        </ChartArea>
        <ChartArea title="调用量排行" source={hasBackendRows(pageData) ? "rows" : undefined}>
          <ProductBarChart points={callRankPoints} unit="调用量" />
        </ChartArea>
      </section>

      <section className="leanTableSection">
        <div className="leanSectionHead">
          <div>
            <h2>计量明细</h2>
            <p>按系统明细行展示，不从样本数推导调用量或金额。</p>
          </div>
          <button
            className="textLinkButton"
            type="button"
            onClick={() => {
              onAction(actionRegistry["REP-004"]);
              setDrawer("export");
            }}
          >
            导出计量结果
          </button>
        </div>
        {hasBackendRows(pageData) ? (
          <div className="tableWrap">
            <table className="dataTable phase2Table">
              <thead>
                <tr>
                  <th>资源名称</th>
                  <th>参与方</th>
                  <th>调用量</th>
                  <th>基准数元价</th>
                  <th>质量系数</th>
                  <th>计量金额</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${cellText(row, "resource_id", "resource")}-${index}`}>
                    <td>{cellText(row, "resource_name")}</td>
                    <td>{cellText(row, "party_name")}</td>
                    <td>{numberCell(row, "call_count")}</td>
                    <td>{weightCell(row, "base_shuyuan_price")}</td>
                    <td>{weightCell(row, "quality_coefficient")}</td>
                    <td>{amountCell(row, "metering_amount")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyGuide
            title="暂无计量结果"
            description="请先完成质量评估并运行数元计量；页面不会使用样本数推导调用量或金额。"
          />
        )}
      </section>

      <DetailDrawer
        footerNote="参数保存必须由系统校验；本阶段不提供本地默认参数。"
        objectType="计量参数"
        open={drawer === "base"}
        size="md"
        title="配置基准数元"
        variant="form"
        actions={[{ label: "关闭", onClick: () => setDrawer("") }]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="暂未启用">
          <EmptyGuide
            title="参数保存暂未启用"
            description="不使用页面系数或公式结果替代系统校验。"
          />
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="调用量可以为 0，但默认值必须来自系统草稿或用户输入。"
        objectType="调用量录入"
        open={drawer === "calls"}
        size="lg"
        title="录入资源调用量"
        variant="form"
        actions={[{ label: "关闭", onClick: () => setDrawer("") }]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="暂未启用">
          <EmptyGuide
            title="调用量保存暂未启用"
            description="页面不再从样本数生成默认调用量。"
          />
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="明细只展示系统业务字段；工程快照在审计模块查看。"
        objectType="计量明细"
        open={drawer === "detail"}
        size="lg"
        title="数元计量明细"
        variant="detail"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="明细">
          {hasBackendRows(pageData) ? (
            <div className="tableWrap">
              <table className="dataTable phase2Table">
                <thead>
                  <tr>
                    <th>资源</th>
                    <th>场景系数</th>
                    <th>技术系数</th>
                    <th>专家系数</th>
                    <th>发展系数</th>
                    <th>金额</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${cellText(row, "metering_id", "metering")}-${index}`}>
                      <td>{cellText(row, "resource_name")}</td>
                      <td>{weightCell(row, "scenario_coefficient")}</td>
                      <td>{weightCell(row, "technology_coefficient")}</td>
                      <td>{weightCell(row, "expert_coefficient")}</td>
                      <td>{weightCell(row, "development_coefficient")}</td>
                      <td>{amountCell(row, "metering_amount")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyGuide title="暂无计量明细" description="运行数元计量并刷新后显示系统明细。" />
          )}
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="导出计量结果会生成报告记录和导出文件。"
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
            { key: "base_shuyuan_price", label: "基准数元价" },
            { key: "metering_amount", label: "计量金额" },
          ]}
        />
        <DrawerSection title="当前结果">
          <p>计量记录：{cellText(firstRow, "metering_id")}</p>
          <p>证据说明：{cellText(firstRow, "evidence")}</p>
        </DrawerSection>
      </DetailDrawer>
    </div>
  );
}

function rankRowsByBackendNumber(rows: ReturnType<typeof pageRows>, key: string) {
  return rows
    .map((row, index) => ({ row, index, value: numericCellValue(row[key]) }))
    .sort((left, right) => {
      if (left.value === null && right.value === null) {
        return left.index - right.index;
      }
      if (left.value === null) {
        return 1;
      }
      if (right.value === null) {
        return -1;
      }
      return right.value - left.value || left.index - right.index;
    })
    .map((item) => item.row);
}
