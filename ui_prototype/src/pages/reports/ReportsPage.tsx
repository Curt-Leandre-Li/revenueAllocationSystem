import { useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import {
  ActionButton,
  DetailDrawer,
  DrawerSection,
  EmptyGuide,
  ExportFieldList,
  PageHeader,
  RiskNotice,
  SectionCard,
  WorkbenchCard,
} from "../../ui";
import { cellText, pageRows } from "../backendPageData";
import type { PageProps } from "../pageTypes";

const reportTabs = ["报告预览", "导出文件", "字段清单", "导出记录"];

export function ReportsPage({ route, snapshot, onAction }: PageProps) {
  const [drawer, setDrawer] = useState<"" | "fields" | "record">("");
  const reportRows = pageRows(snapshot.pages[route.path]);
  const latestReport = reportRows[0];
  const hasReports = reportRows.length > 0;

  return (
    <div className="pageWorkspace phase2Page reportsPage">
      <PageHeader
        route={{
          ...route,
          label: "报告生成与导出",
          responsibility:
            "预览报告并导出 Markdown、CSV、JSON、JSONL；PDF 生成为 P1 功能。",
        }}
        snapshot={snapshot}
      />

      <nav className="inPageTabs" aria-label="报告页面内部区块">
        {reportTabs.map((tab) => (
          <a href={`#reports-${tab}`} key={tab}>{tab}</a>
        ))}
      </nav>

      <div className="reportsGrid">
        <WorkbenchCard
          title="报告预览"
          description="预览当前模拟项目的报告摘要，报告正文必须包含模拟参考免责声明。"
          actions={
            <>
              <ActionButton action={actionRegistry["REP-001"]} onClick={(action) => onAction(action)} />
              <ActionButton
                action={actionRegistry["REP-003"]}
                disabledReason="PDF 生成为 P1 功能，P0 支持 Markdown、CSV、JSON、JSONL。"
                onClick={(action) => onAction(action)}
              />
            </>
          }
        >
          <article className="reportPreview" id="reports-报告预览">
            <span>报告名称</span>
            <h2>{cellText(latestReport, "report_name", "尚未生成报告")}</h2>
            <p>
              {hasReports
                ? "本报告汇总数据包、资源主体归属、质量评估、数元计量、MD-DShap 权重和收益分配模拟结果。所有结果仅作模拟参考，不构成法律结算、法定结算或付款指令。"
                : "当前后端未返回报告记录。完成收益分配模拟后，可在此生成 Markdown、CSV、JSON 或 JSONL 报告。"}
            </p>
            <dl className="businessDetail compact">
              <div>
                <dt>报告状态</dt>
                <dd>{cellText(latestReport, "report_status", "待生成")}</dd>
              </div>
              <div>
                <dt>字段范围</dt>
                <dd>{cellText(latestReport, "field_scope")}</dd>
              </div>
              <div>
                <dt>最近生成</dt>
                <dd>{cellText(latestReport, "created_at", "尚未生成")}</dd>
              </div>
            </dl>
          </article>
        </WorkbenchCard>

        <SectionCard title="免责声明" description="所有导出文件必须保留该边界。">
          <RiskNotice compact />
          <p className="mutedText">
            PDF 生成为 P1 功能，P0 支持 Markdown、CSV、JSON、JSONL。
          </p>
        </SectionCard>
      </div>

      <div className="reportsGrid">
        <WorkbenchCard
          title="导出文件清单"
          description="P0 支持 Markdown、CSV、JSON、JSONL；历史文件不覆盖。"
          actions={
            <>
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
            </>
          }
        >
          <div className="exportCards" id="reports-导出文件">
            {["Markdown", "CSV", "JSON", "JSONL"].map((type) => (
              <article key={type}>
                <strong>{type}</strong>
                <span>可导出</span>
                <p>生成独立文件、报告记录和校验摘要。</p>
              </article>
            ))}
            <article className="p1Only">
              <strong>PDF</strong>
              <span>P1 禁用</span>
              <p>PDF 生成为 P1 功能，P0 不提供。</p>
            </article>
          </div>
        </WorkbenchCard>

        <SectionCard title="字段清单" description="导出字段使用业务标签，不包含敏感原文。">
          <div id="reports-字段清单">
            <ExportFieldList
              fields={[
                { key: "resource_name", label: "资源名称" },
                { key: "modality", label: "资源模态" },
                { key: "provider_name", label: "数据源主体" },
                { key: "include_in_calculation", label: "是否进入后续计算" },
                { key: "include_in_md_dshap", label: "是否进入算法权重池" },
                { key: "normalized_weight", label: "归一化权重" },
                { key: "allocation_amount", label: "模拟分配金额" },
                { key: "report_status", label: "报告状态" },
              ]}
              note="工程字段和敏感原文不进入主导出清单。"
            />
          </div>
        </SectionCard>
      </div>

      <div className="reportsGrid">
        <SectionCard title="导出记录" description="展示最近导出文件，不覆盖历史版本。">
          <div className="compactList" id="reports-导出记录">
            {hasReports ? (
              reportRows.map((item) => (
                <article key={`${cellText(item, "report_name")}-${cellText(item, "created_at")}`}>
                  <strong>{cellText(item, "report_name")}</strong>
                  <span>{cellText(item, "report_type")} / {cellText(item, "report_status")}</span>
                  <small>{cellText(item, "created_at")} / {cellText(item, "field_scope")}</small>
                  <button type="button" onClick={() => setDrawer("record")}>查看详情</button>
                </article>
              ))
            ) : (
              <EmptyGuide
                title="暂无导出记录"
                description="后端未返回报告或导出记录；生成 P0 格式报告后会在此展示。"
              />
            )}
          </div>
        </SectionCard>

        <SectionCard title="历史版本" description="报告和导出文件按生成时间保留。">
          <div className="compactList">
            {hasReports ? (
              reportRows.map((item) => (
                <article key={`${cellText(item, "report_name")}-${cellText(item, "created_at")}`}>
                  <strong>{cellText(item, "report_name")}</strong>
                  <span>{cellText(item, "report_type")} / {cellText(item, "report_status")}</span>
                  <small>{cellText(item, "created_at")}</small>
                </article>
              ))
            ) : (
              <EmptyGuide
                title="暂无报告记录"
                description="完成收益分配模拟并生成报告后，历史版本会在此展示。"
              />
            )}
          </div>
        </SectionCard>
      </div>

      <DetailDrawer
        footerNote="导出前展示字段清单；导出文件必须包含模拟参考、非法律结算免责声明。"
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
              { key: "normalized_weight", label: "归一化权重" },
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
              <div><dt>字段范围</dt><dd>{cellText(latestReport, "field_scope")}</dd></div>
              <div><dt>report_id</dt><dd>{cellText(latestReport, "report_id")}</dd></div>
              <div><dt>checksum</dt><dd>{cellText(latestReport, "checksum")}</dd></div>
            </dl>
          ) : (
            <EmptyGuide
              title="后端未返回导出记录"
              description="前端不会用默认文件名或已生成状态伪造导出成功。"
            />
          )}
        </DrawerSection>
      </DetailDrawer>
    </div>
  );
}
