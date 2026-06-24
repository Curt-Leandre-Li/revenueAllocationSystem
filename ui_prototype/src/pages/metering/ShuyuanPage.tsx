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
  PreconditionPanel,
  WorkbenchCard,
} from "../../ui";
import {
  amountCell,
  cellText,
  hasBackendRows,
  pageMetrics,
  pageRows,
  weightCell,
} from "../backendPageData";
import type { PageProps } from "../pageTypes";

export function ShuyuanPage({ route, snapshot, onAction }: PageProps) {
  const [drawer, setDrawer] = useState<"" | "base" | "calls" | "detail" | "export">("");
  const pageData = snapshot.pages["/metering/shuyuan"];
  const rows = pageRows(pageData);
  const firstRow = rows[0];
  const metrics = pageMetrics(pageData);

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
        {metrics.map((item) => (
          <MetricCard item={item} key={item.label} />
        ))}
      </div>

      <div className="phase2bTwoCol">
        <WorkbenchCard
          title="计量工作台"
          description="base_price、coefficients、call_count 和 metering_amount 只展示后端返回值。"
          actions={
            <>
              <button
                className="actionButton secondary"
                disabled
                title="参数保存 payload 尚未完成接线；本阶段不做前端假保存。"
                type="button"
                onClick={() => setDrawer("base")}
              >
                配置基准数元
              </button>
              <button
                className="actionButton secondary"
                disabled
                title="调用量保存 payload 尚未完成接线；本阶段不做前端默认调用量。"
                type="button"
                onClick={() => setDrawer("calls")}
              >
                录入调用量
              </button>
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
          <PreconditionPanel items={pageData.preconditions} />
        </WorkbenchCard>

        <ChartPanel
          title="数元计量图"
          description="资源级/参与方级金额和调用量排行需要后端 chart DTO。"
          source={pageData.chart?.chart_id}
        />
      </div>

      <WorkbenchCard title="资源级明细" description="按后端 detail 行展示，不从样本数推导调用量或金额。">
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
                    <td>{cellText(row, "call_count")}</td>
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
            title="后端未返回数元计量结果"
            description="请先完成质量评估并运行数元计量；页面不会使用样本数推导调用量或金额。"
          />
        )}
      </WorkbenchCard>

      <DetailDrawer
        footerNote="参数保存必须由后端校验；本阶段不提供本地默认参数。"
        objectType="计量参数"
        open={drawer === "base"}
        size="md"
        title="配置基准数元"
        variant="form"
        actions={[{ label: "关闭", onClick: () => setDrawer("") }]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="后端参数契约">
          <EmptyGuide
            title="参数保存暂未接入页面 payload"
            description="后端提供 /metering/shuyuan/parameters；Phase 1B 不用前端系数或公式结果替代。"
          />
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="调用量可以为 0，但调用量默认值必须来自后端 draft 或用户输入。"
        objectType="调用量录入"
        open={drawer === "calls"}
        size="lg"
        title="录入资源调用量"
        variant="form"
        actions={[{ label: "关闭", onClick: () => setDrawer("") }]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="后端调用量契约">
          <EmptyGuide
            title="调用量保存暂未接入页面 payload"
            description="后端提供 /metering/shuyuan/call-counts；页面不再从 sample_count 生成默认调用量。"
          />
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="明细只展示后端业务字段；工程快照在审计模块查看。"
        objectType="计量明细"
        open={drawer === "detail"}
        size="lg"
        title="数元计量明细"
        variant="detail"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="后端明细">
          {hasBackendRows(pageData) ? (
            <div className="tableWrap">
              <table className="dataTable phase2Table">
                <thead>
                  <tr>
                    <th>metering_id</th>
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
                      <td>{cellText(row, "metering_id")}</td>
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
            <EmptyGuide
              title="后端未返回计量明细"
              description="运行数元计量并刷新后显示后端 details。"
            />
          )}
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
            { key: "base_shuyuan_price", label: "基准数元价" },
            { key: "metering_amount", label: "计量金额" },
          ]}
        />
        <DrawerSection title="当前后端结果">
          <p>metering_id：{cellText(firstRow, "metering_id")}</p>
          <p>evidence：{cellText(firstRow, "evidence")}</p>
        </DrawerSection>
      </DetailDrawer>
    </div>
  );
}
