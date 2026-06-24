import { useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import {
  ActionButton,
  ChartPanel,
  DetailDrawer,
  DrawerSection,
  EmptyGuide,
  MetricCard,
  PageHeader,
  PreconditionPanel,
  TraceDrawer,
  WorkbenchCard,
} from "../../ui";
import {
  cellText,
  hasBackendRows,
  pageMetrics,
  pageRows,
  weightCell,
} from "../backendPageData";
import type { PageProps } from "../pageTypes";

export function UtilityPage({ route, snapshot, onAction }: PageProps) {
  const [drawer, setDrawer] = useState<"" | "factor" | "function" | "trace">("");
  const pageData = snapshot.pages["/metering/utility"];
  const rows = pageRows(pageData);
  const metrics = pageMetrics(pageData);

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
        {metrics.map((item) => (
          <MetricCard item={item} key={item.label} />
        ))}
      </div>

      <div className="phase2bTwoCol">
        <WorkbenchCard
          title="贡献与效用工作台"
          description="贡献度、归一化贡献和效用值全部来自后端计算结果。"
          actions={
            <>
              <button
                className="actionButton secondary"
                disabled
                title="贡献因子保存 payload 尚未完成接线；本阶段不做前端假保存。"
                type="button"
                onClick={() => setDrawer("factor")}
              >
                配置贡献因子
              </button>
              <ActionButton action={actionRegistry["UTIL-006"]} onClick={(action) => onAction(action)} />
              <button
                className="actionButton secondary"
                disabled
                title="效用函数保存 payload 尚未完成接线；本阶段不写前端默认函数。"
                type="button"
                onClick={() => setDrawer("function")}
              >
                配置效用函数
              </button>
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
          <PreconditionPanel items={pageData.preconditions} />
        </WorkbenchCard>

        <ChartPanel
          title="贡献度与效用图"
          description="贡献排行、效用排行和 trace 摘要需要后端 chart DTO。"
          source={pageData.chart?.chart_id}
        />
      </div>

      <WorkbenchCard title="参与方效用表" description="表格只展示后端 utility trace 行。">
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
                    <td>{weightCell(row, "normalized_contribution")}</td>
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
            title="后端未返回效用 trace"
            description="请先完成数元计量、贡献度计算和效用计算；页面不会写死贡献度或效用值。"
          />
        )}
      </WorkbenchCard>

      <DetailDrawer
        footerNote="贡献因子由后端保存并校验；总贡献为 0 等规则由后端返回。"
        objectType="贡献因子"
        open={drawer === "factor"}
        size="md"
        title="配置贡献因子"
        variant="form"
        actions={[{ label: "关闭", onClick: () => setDrawer("") }]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="后端贡献因子契约">
          <EmptyGuide
            title="贡献因子保存暂未接入页面 payload"
            description="后端提供 /metering/utility/contribution-factors；Phase 1B 不提供前端默认因子。"
          />
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="效用函数来源必须由后端或参数快照披露。"
        objectType="效用函数"
        open={drawer === "function"}
        size="md"
        title="配置效用函数"
        variant="form"
        actions={[{ label: "关闭", onClick: () => setDrawer("") }]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="后端效用函数契约">
          <EmptyGuide
            title="效用函数保存暂未接入页面 payload"
            description="后端提供 /metering/utility/function；页面不写入本地默认函数或模拟成功。"
          />
        </DrawerSection>
      </DetailDrawer>

      <TraceDrawer
        footerNote="效用 trace 写入 utility_trace；工程编号在技术详情中折叠。"
        objectType="效用轨迹"
        open={drawer === "trace"}
        output={{
          轨迹状态: hasBackendRows(pageData) ? "后端已返回" : "后端未返回",
        }}
        statusTag={hasBackendRows(pageData) ? "后端结果" : "缺少数据"}
        summary="只展示后端 utility trace；不在前端重建贡献度、归一化贡献或效用值。"
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
