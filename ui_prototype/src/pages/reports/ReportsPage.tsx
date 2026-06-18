import { useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import {
  ActionButton,
  DetailDrawer,
  DrawerSection,
  ExportFieldList,
  PageHeader,
  RiskNotice,
  SectionCard,
  WorkbenchCard,
} from "../../ui";
import { getMockWorkspace } from "../phase2aUtils";
import type { PageProps } from "../pageTypes";

const reportTabs = ["报告预览", "导出文件", "字段清单", "导出记录"];

export function ReportsPage({ route, snapshot, onAction }: PageProps) {
  const [drawer, setDrawer] = useState<"" | "fields" | "record">("");
  const mock = getMockWorkspace(snapshot);
  const latestReport = mock.reports[0];

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
            <h2>{latestReport?.name ?? "收益分配模拟报告"}</h2>
            <p>
              本报告汇总数据包、资源主体归属、质量评估、数元计量、MD-DShap 权重和收益分配模拟结果。
              所有结果仅作模拟参考，不构成法律结算、法定结算或付款指令。
            </p>
            <dl className="businessDetail compact">
              <div>
                <dt>报告状态</dt>
                <dd>{latestReport?.status ?? "待生成"}</dd>
              </div>
              <div>
                <dt>字段范围</dt>
                <dd>{latestReport?.fieldScope ?? "资源、计量、权重、分配和审计摘要"}</dd>
              </div>
              <div>
                <dt>最近生成</dt>
                <dd>{latestReport?.createdAt ?? "尚未生成"}</dd>
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
            {mock.exports.map((item) => (
              <article key={`${item.fileName}-${item.createdAt}`}>
                <strong>{item.fileName}</strong>
                <span>{item.fileType} / {item.status}</span>
                <small>{item.createdAt} / {item.fieldScope}</small>
                <button type="button" onClick={() => setDrawer("record")}>查看详情</button>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="历史版本" description="报告和导出文件按生成时间保留。">
          <div className="compactList">
            {mock.reports.map((item) => (
              <article key={`${item.name}-${item.createdAt}`}>
                <strong>{item.name}</strong>
                <span>{item.type} / {item.status}</span>
                <small>{item.createdAt}</small>
              </article>
            ))}
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
          <dl className="businessDetail compact">
            <div><dt>文件名称</dt><dd>{mock.exports[0]?.fileName ?? "resource_summary.csv"}</dd></div>
            <div><dt>文件类型</dt><dd>{mock.exports[0]?.fileType ?? "CSV"}</dd></div>
            <div><dt>状态</dt><dd>{mock.exports[0]?.status ?? "已生成"}</dd></div>
            <div><dt>字段范围</dt><dd>{mock.exports[0]?.fieldScope ?? "业务摘要字段"}</dd></div>
          </dl>
        </DrawerSection>
      </DetailDrawer>
    </div>
  );
}
