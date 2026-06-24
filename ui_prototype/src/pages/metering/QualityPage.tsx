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
  RiskNotice,
  WorkbenchCard,
} from "../../ui";
import { cellText, hasBackendRows, pageMetrics, pageRows } from "../backendPageData";
import type { PageProps } from "../pageTypes";

export function QualityPage({ route, snapshot, onAction }: PageProps) {
  const [drawer, setDrawer] = useState<"" | "weights" | "detail" | "export">("");
  const pageData = snapshot.pages["/metering/quality"];
  const rows = pageRows(pageData);
  const firstRow = rows[0];
  const metrics = pageMetrics(pageData);

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
        {metrics.map((item) => (
          <MetricCard item={item} key={item.label} />
        ))}
      </div>

      <RiskNotice compact />

      <div className="phase2bTwoCol">
        <WorkbenchCard
          title="质量评估工作台"
          description="质量评分、等级、因子和维度得分全部来自后端结果。"
          actions={
            <>
              <button
                className="actionButton secondary"
                disabled
                title="权重保存 payload 尚未完成接线；本阶段不做前端假保存。"
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
          <PreconditionPanel items={pageData.preconditions} />
        </WorkbenchCard>

        <ChartPanel
          title="质量维度图"
          description="需要后端 quality chart DTO；浏览器端不从明细重建图表。"
          source={pageData.chart?.chart_id}
        />
      </div>

      <WorkbenchCard title="维度得分与证据说明" description="仅展示后端 detail 返回字段。">
        {hasBackendRows(pageData) ? (
          <div className="tableWrap">
            <table className="dataTable phase2Table">
              <thead>
                <tr>
                  <th>维度</th>
                  <th>权重</th>
                  <th>得分</th>
                  <th>质量等级</th>
                  <th>证据</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${cellText(row, "dimension_code", "dimension")}-${index}`}>
                    <td>{cellText(row, "dimension_name")}</td>
                    <td>{cellText(row, "dimension_weight")}</td>
                    <td>{cellText(row, "dimension_score")}</td>
                    <td>{cellText(row, "quality_level")}</td>
                    <td>{cellText(row, "evidence")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyGuide
            title="后端未返回质量评估结果"
            description="请先完成数据接入并运行质量评估；页面不会显示硬编码质量分或维度得分。"
          />
        )}
      </WorkbenchCard>

      <DetailDrawer
        footerNote="权重合计校验由后端完成；本阶段不在前端计算权重合计。"
        objectType="质量权重"
        open={drawer === "weights"}
        size="lg"
        title="配置质量指标权重"
        variant="form"
        actions={[{ label: "关闭", onClick: () => setDrawer("") }]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="后端权重契约">
          <EmptyGuide
            title="权重保存暂未接入页面 payload"
            description="后端提供 /metering/quality/weights；Phase 1B 不用前端默认值或本地合计替代后端校验。"
          />
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="二级指标来自后端 details；工程快照编号保留在技术详情。"
        objectType="二级指标"
        open={drawer === "detail"}
        size="lg"
        title="二级指标得分"
        variant="detail"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="指标明细">
          {hasBackendRows(pageData) ? (
            <div className="tableWrap">
              <table className="dataTable phase2Table">
                <thead>
                  <tr>
                    <th>assessment_id</th>
                    <th>维度</th>
                    <th>得分</th>
                    <th>证据</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${cellText(row, "dimension_name", "dimension")}-${index}`}>
                      <td>{cellText(row, "assessment_id")}</td>
                      <td>{cellText(row, "dimension_name")}</td>
                      <td>{cellText(row, "dimension_score")}</td>
                      <td>{cellText(row, "evidence")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyGuide
              title="后端未返回质量明细"
              description="运行质量评估并刷新后显示后端 details。"
            />
          )}
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
              { key: "assessment_id", label: "评估 ID" },
            ]}
            note="导出内容以报告接口返回的 report_id、checksum 和生成时间为准。"
          />
        </DrawerSection>
        <DrawerSection title="当前后端结果">
          <p>assessment_id：{cellText(firstRow, "assessment_id")}</p>
          <p>evidence_summary：{cellText(firstRow, "evidence_summary")}</p>
        </DrawerSection>
      </DetailDrawer>
    </div>
  );
}
