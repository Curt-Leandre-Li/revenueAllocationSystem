import { useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import {
  ActionButton,
  ChartArea,
  CompactPageHeader,
  DetailDrawer,
  DrawerSection,
  EmptyGuide,
  ProductBarChart,
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

export function UtilityPage({ route, snapshot, onAction }: PageProps) {
  const [drawer, setDrawer] = useState<"" | "factor" | "function" | "trace">("");
  const pageData = snapshot.pages[route.path];
  const rows = pageRows(pageData);
  const metrics = pageMetrics(pageData);
  const firstRow = rows[0];
  const metricMap = new Map(metrics.map((item) => [item.label, item]));
  const summaryItems = [
    metricMap.get("贡献记录") ?? { label: "贡献记录", value: cellText(pageData.technicalDetails, "trace_count", "暂无"), hint: "系统摘要", tone: "neutral" as const },
    metricMap.get("最高贡献主体") ?? { label: "最高贡献主体", value: cellText(firstRow, "party_name"), hint: "系统字段", tone: "neutral" as const },
    metricMap.get("最高效用值") ?? { label: "最高效用值", value: weightCell(firstRow, "utility_value"), hint: "系统字段", tone: "neutral" as const },
    metricMap.get("trace 数量") ?? { label: "trace 数量", value: cellText(pageData.technicalDetails, "trace_count", "暂无"), hint: "系统摘要", tone: "neutral" as const },
    metricMap.get("函数版本") ?? { label: "函数版本", value: cellText(firstRow, "utility_function_version"), hint: "系统字段", tone: "neutral" as const },
  ];
  const contributionPoints = rows.map((row) => ({
    label: cellText(row, "party_name"),
    value: percentCell(row, "normalized_contribution"),
    numeric: numericCellValue(row.normalized_contribution),
    meta: cellText(row, "trace_id"),
  }));
  const utilityPoints = rows.map((row) => ({
    label: cellText(row, "party_name"),
    value: weightCell(row, "utility_value"),
    numeric: numericCellValue(row.utility_value),
    meta: cellText(row, "trace_id"),
  }));

  return (
    <div className="pageWorkspace leanPage utilityPage">
      <CompactPageHeader
        title="贡献与效用"
        description="查看参与方贡献、效用结果和计算追溯。"
        primaryAction={<ActionButton action={actionRegistry["UTIL-006"]} onClick={(action) => onAction(action)} />}
        secondaryActions={
          <button
            className="actionButton secondary"
            type="button"
            onClick={() => {
              onAction(actionRegistry["UTIL-009"]);
              setDrawer("trace");
            }}
          >
            查看轨迹
          </button>
        }
      />

      <SummaryStrip items={summaryItems} />

      <section className="resultChartGrid secondary">
        <ChartArea title="贡献度排行" source={hasBackendRows(pageData) ? "rows" : undefined}>
          <ProductBarChart points={contributionPoints} unit="贡献度" />
        </ChartArea>
        <ChartArea title="效用值排行" source={hasBackendRows(pageData) ? "rows" : undefined}>
          <ProductBarChart points={utilityPoints} unit="效用值" />
        </ChartArea>
      </section>

      <section className="leanTableSection">
        <div className="leanSectionHead">
          <div>
            <h2>贡献与效用表</h2>
            <p>表格只展示系统返回的效用轨迹行。</p>
          </div>
        </div>
        {hasBackendRows(pageData) ? (
          <div className="tableWrap">
            <table className="dataTable phase2Table">
              <thead>
                <tr>
                  <th>参与方</th>
                  <th>归一化贡献</th>
                  <th>质量因子</th>
                  <th>使用因子</th>
                  <th>场景因子</th>
                  <th>效用值</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${cellText(row, "trace_id", "trace")}-${index}`}>
                    <td><strong>{cellText(row, "party_name")}</strong></td>
                    <td>{percentCell(row, "normalized_contribution")}</td>
                    <td>{weightCell(row, "quality_factor")}</td>
                    <td>{weightCell(row, "usage_factor")}</td>
                    <td>{weightCell(row, "scenario_factor")}</td>
                    <td>{weightCell(row, "utility_value")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyGuide
            title="暂无效用轨迹"
            description="请先完成数元计量、贡献度计算和效用计算；页面不会写死贡献度或效用值。"
          />
        )}
      </section>

      <DetailDrawer
        footerNote="贡献因子由系统保存并校验；总贡献为 0 等规则由系统返回。"
        objectType="贡献因子"
        open={drawer === "factor"}
        size="md"
        title="配置贡献因子"
        variant="form"
        actions={[{ label: "关闭", onClick: () => setDrawer("") }]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="暂未启用">
          <EmptyGuide title="贡献因子保存暂未启用" description="不提供页面默认因子。" />
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="效用函数来源必须由系统或参数快照披露。"
        objectType="效用函数"
        open={drawer === "function"}
        size="md"
        title="配置效用函数"
        variant="form"
        actions={[{ label: "关闭", onClick: () => setDrawer("") }]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="暂未启用">
          <EmptyGuide title="效用函数保存暂未启用" description="页面不写入本地默认函数或模拟成功。" />
        </DrawerSection>
      </DetailDrawer>

      <TraceDrawer
        footerNote="效用轨迹用于说明计算过程，工程编号在技术详情中折叠。"
        objectType="效用轨迹"
        open={drawer === "trace"}
        output={{
          轨迹状态: hasBackendRows(pageData) ? "已返回" : "暂无",
        }}
        statusTag={hasBackendRows(pageData) ? "系统结果" : "缺少数据"}
        summary="只展示系统效用轨迹；不在页面重建贡献度、归一化贡献或效用值。"
        technicalDetails={pageData.technicalDetails}
        title="效用计算过程"
        traceColumns={[
          { key: "party_name", label: "参与方" },
          { key: "normalized_contribution", label: "归一化贡献" },
          { key: "quality_factor", label: "质量因子" },
          { key: "utility_value", label: "效用值" },
        ]}
        traceRows={rows}
        onClose={() => setDrawer("")}
      />
    </div>
  );
}
