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
  ProductTimeline,
  SummaryStrip,
} from "../../ui";
import { cellText, numericCellValue, pageMetrics, pageRows } from "../backendPageData";
import type { PageProps } from "../pageTypes";

export function ReportsPage({ route, snapshot, onAction }: PageProps) {
  const [drawer, setDrawer] = useState<"" | "fields" | "record">("");
  const pageData = snapshot.pages[route.path];
  const reportRows = pageRows(pageData);
  const metrics = pageMetrics(pageData);
  const latestReport = reportRows[0];
  const hasReports = reportRows.length > 0;
  const metricMap = new Map(metrics.map((item) => [item.label, item]));
  const summaryItems = [
    metricMap.get("报告数量") ?? { label: "报告数量", value: hasReports ? String(reportRows.length) : "暂无", hint: "系统结果", tone: "neutral" as const },
    metricMap.get("导出文件数") ?? { label: "导出文件数", value: cellText(pageData.technicalDetails, "export_file_count", "暂无"), hint: "系统摘要", tone: "neutral" as const },
    metricMap.get("最近生成时间") ?? { label: "最近生成时间", value: cellText(latestReport, "created_at", "暂无"), hint: "系统字段", tone: "neutral" as const },
    metricMap.get("已确认方案") ?? { label: "已确认方案", value: cellText(pageData.technicalDetails, "confirmed_allocation_count", "暂无"), hint: "系统摘要", tone: "neutral" as const },
    metricMap.get("checksum 记录") ?? { label: "checksum 记录", value: cellText(pageData.technicalDetails, "checksum_count", "暂无"), hint: "系统摘要", tone: "neutral" as const },
  ];
  const fileTypePoints = reportRows.map((row) => ({
    label: cellText(row, "report_type"),
    value: "1",
    numeric: numericCellValue(1),
    meta: cellText(row, "report_status"),
  }));
  const timelineItems = reportRows.map((row) => ({
    label: cellText(row, "report_name"),
    value: cellText(row, "created_at"),
    numeric: null,
    meta: cellText(row, "report_status"),
  }));

  return (
    <div className="pageWorkspace leanPage reportsPage">
      <CompactPageHeader
        title="报告导出"
        description="生成说明报告，披露先合同优先、后数据源收益池分配的模拟参考口径。"
        primaryAction={<ActionButton action={actionRegistry["REP-001"]} onClick={(action) => onAction(action)} />}
        secondaryActions={
          <button className="actionButton secondary" type="button" onClick={() => setDrawer("fields")}>
            导出字段
          </button>
        }
      />

      <SummaryStrip items={summaryItems} />

      <section className="resultChartGrid secondary">
        <ChartArea title="导出文件类型" source={hasReports ? "rows" : undefined}>
          <ProductBarChart points={fileTypePoints} unit="文件" />
        </ChartArea>
        <ChartArea title="报告生成时间线" source={hasReports ? "rows" : undefined}>
          <ProductTimeline items={timelineItems} />
        </ChartArea>
      </section>

      <section className="leanTableSection">
        <div className="leanSectionHead">
          <div>
            <h2>报告列表</h2>
            <p>报告编号、校验摘要和生成时间以系统记录为准。</p>
          </div>
          <div className="cardActions">
            {(["REP-002", "REP-004", "REP-005", "REP-006", "REP-009"] as const).map((id) => (
              <ActionButton
                action={actionRegistry[id]}
                key={id}
                onClick={(action) => {
                  onAction(action);
                  setDrawer("fields");
                }}
              />
            ))}
            <ActionButton
              action={actionRegistry["REP-003"]}
              disabledReason="P1 暂未启用"
              onClick={(action) => onAction(action)}
            />
          </div>
        </div>
        {hasReports ? (
          <div className="tableWrap">
            <table className="dataTable phase2Table">
              <thead><tr><th>报告名称</th><th>类型</th><th>状态</th><th>生成时间</th><th>report_id</th><th>checksum</th><th>操作</th></tr></thead>
              <tbody>
                {reportRows.map((item) => (
                  <tr key={`${cellText(item, "report_name")}-${cellText(item, "created_at")}`}>
                    <td><strong>{cellText(item, "report_name")}</strong></td>
                    <td>{cellText(item, "report_type")}</td>
                    <td>{cellText(item, "report_status")}</td>
                    <td>{cellText(item, "created_at")}</td>
                    <td>{cellText(item, "report_id")}</td>
                    <td>{cellText(item, "checksum")}</td>
                    <td><button type="button" onClick={() => setDrawer("record")}>详情</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyGuide
            title="暂无报告记录"
            description="完成收益分配模拟后，可生成 Markdown、CSV、JSON 或 JSONL 报告。"
          />
        )}
      </section>

      <DetailDrawer
        footerNote="报告需说明：先根据合同约定向非数据源主体执行优先分配并受上限约束，扣除后形成数据源主体收益池，再按 MD-DShap 权重分配。"
        objectType="导出字段"
        open={drawer === "fields"}
        size="md"
        title="导出字段清单"
        variant="export"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="本次导出字段">
          <ExportFieldList
            fields={[
              { key: "project_name", label: "项目名称" },
              { key: "resource_name", label: "资源名称" },
              { key: "party_name", label: "参与方" },
              { key: "subject_track", label: "主体轨道" },
              { key: "contract_priority_allocations", label: "合同优先明细" },
              { key: "data_provider_revenue_pool", label: "数据源收益池" },
              { key: "normalized_weight", label: "分配权重" },
              { key: "allocation_amount", label: "模拟分配金额" },
              { key: "disclaimer", label: "模拟参考声明" },
            ]}
            note="工程字段、敏感原文和内部快照编号不进入主导出文件。"
          />
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="历史报告文件不静默覆盖，重复导出会生成新记录。"
        objectType="导出记录"
        open={drawer === "record"}
        size="md"
        title="导出记录详情"
        variant="detail"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="文件说明">
          {latestReport ? (
            <dl className="businessDetail compact">
              <div><dt>文件名称</dt><dd>{cellText(latestReport, "report_name")}</dd></div>
              <div><dt>文件类型</dt><dd>{cellText(latestReport, "report_type")}</dd></div>
              <div><dt>状态</dt><dd>{cellText(latestReport, "report_status")}</dd></div>
              <div><dt>生成时间</dt><dd>{cellText(latestReport, "created_at")}</dd></div>
              <div><dt>report_id</dt><dd>{cellText(latestReport, "report_id")}</dd></div>
              <div><dt>checksum</dt><dd>{cellText(latestReport, "checksum")}</dd></div>
            </dl>
          ) : (
            <EmptyGuide title="暂无导出记录" description="页面不会用默认文件名或已生成状态伪造导出成功。" />
          )}
        </DrawerSection>
      </DetailDrawer>
    </div>
  );
}
