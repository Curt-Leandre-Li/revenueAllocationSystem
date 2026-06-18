import { useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import { projectStatusLabels } from "../../domain/status";
import type { AuditLogRecord, ReportRecord, SnapshotRecord } from "../../domain/types";
import {
  ActionButton,
  DetailDrawer,
  MetricCard,
  PageHeader,
  RiskNotice,
  SectionCard,
  StatusStepper,
  WorkbenchCard,
} from "../../ui";
import { formatAmount, getMockWorkspace, isResourceBlocked } from "../phase2aUtils";
import type { PageProps } from "../pageTypes";

const processSteps = [
  "数据接入",
  "资源识别",
  "参与方维护",
  "质量评估",
  "数元计量",
  "效用计算",
  "MD-DShap",
  "收益分配",
  "报告审计",
];

function RecentReportList({ reports }: { reports: ReportRecord[] }) {
  return (
    <div className="compactList">
      {reports.slice(0, 3).map((report) => (
        <article key={`${report.name}-${report.createdAt}`}>
          <strong>{report.name}</strong>
          <span>{report.type} / {report.status}</span>
          <small>{report.createdAt}</small>
        </article>
      ))}
    </div>
  );
}

function RecentAuditList({ auditLogs }: { auditLogs: AuditLogRecord[] }) {
  return (
    <div className="compactList">
      {auditLogs.slice(0, 4).map((log) => (
        <article key={`${log.operation}-${log.createdAt}`}>
          <strong>{log.operation}</strong>
          <span>{log.summary}</span>
          <small>{log.createdAt} / {log.operator}</small>
        </article>
      ))}
    </div>
  );
}

function SnapshotTimeline({ snapshots }: { snapshots: SnapshotRecord[] }) {
  return (
    <div className="timelineList">
      {snapshots.slice(0, 5).map((snapshot) => (
        <div key={`${snapshot.name}-${snapshot.createdAt}`}>
          <span />
          <strong>{snapshot.name}</strong>
          <small>{snapshot.status} / {snapshot.createdAt}</small>
        </div>
      ))}
    </div>
  );
}

export function OverviewPage({
  route,
  snapshot,
  onAction,
  onNavigate,
}: PageProps) {
  const [riskOpen, setRiskOpen] = useState(false);
  const mock = getMockWorkspace(snapshot);
  const resources = mock.resources;
  const blockedResources = resources.filter(isResourceBlocked).length;
  const poolCount = mock.dataProviders.filter((party) => party.includeInMDDShap).length;
  const reportReady = mock.reports.length > 0 ? "已有报告" : "待生成";
  const metricItems = [
    {
      label: "数据包",
      value: "2",
      hint: "演示数据与上传候选",
      tone: "neutral" as const,
    },
    {
      label: "数据资源",
      value: String(resources.length),
      hint: `${resources.filter((item) => item.includeInCalculation).length} 个进入后续计算`,
      tone: "success" as const,
    },
    {
      label: "参与方",
      value: "5",
      hint: "3 个数据源主体，2 个合同优先主体",
      tone: "neutral" as const,
    },
    {
      label: "算法权重池",
      value: String(poolCount),
      hint: "仅数据提供方进入",
      tone: blockedResources ? "warning" as const : "success" as const,
    },
    {
      label: "当前收益池",
      value: formatAmount(mock.currentRevenuePool),
      hint: "模拟数据源收益池",
      tone: "neutral" as const,
    },
    {
      label: "报告状态",
      value: reportReady,
      hint: "Markdown/CSV/JSON/JSONL",
      tone: "success" as const,
    },
  ];

  return (
    <div className="pageWorkspace phase2Page overviewPage">
      <PageHeader
        route={{
          ...route,
          label: "系统首页驾驶舱",
          responsibility: "面向业务操作员的项目状态、流程进度、风险与产出总览。",
        }}
        snapshot={snapshot}
      />

      <div className="dashboardHero">
        <section className="projectSnapshot">
          <div>
            <span className="eyebrow">当前项目</span>
            <h2>{snapshot.projectName}</h2>
            <p>{snapshot.scenarioName}</p>
          </div>
          <div className="statusPill">{projectStatusLabels[snapshot.status]}</div>
          <dl>
            <div>
              <dt>操作员</dt>
              <dd>{snapshot.operator}</dd>
            </div>
            <div>
              <dt>最近同步</dt>
              <dd>{snapshot.updatedAt}</dd>
            </div>
            <div>
              <dt>模拟边界</dt>
              <dd>非法律结算</dd>
            </div>
          </dl>
        </section>

        <WorkbenchCard
          title="下一步操作"
          description={
            blockedResources
              ? "先补齐资源主体归属，再启动完整链路计算。"
              : "前置条件基本满足，可继续执行完整链路或查看报告。"
          }
          actions={
            <>
              <ActionButton
                action={actionRegistry["SYS-002"]}
                onClick={(action) => onAction(action)}
              />
              <button
                className="actionButton secondary"
                type="button"
                onClick={() => onNavigate("/data/packages")}
              >
                进入数据接入
              </button>
              <ActionButton
                action={actionRegistry["SYS-004"]}
                onClick={(action) => onAction(action)}
              />
              <button
                className="actionButton secondary"
                type="button"
                onClick={() => onNavigate("/reports")}
              >
                查看报告
              </button>
            </>
          }
        >
          <div className="nextActionBody">
            <strong>{blockedResources ? "资源主体绑定未完成" : "可启动完整链路计算"}</strong>
            <p>
              计算会生成阶段快照、算法权重记录和审计日志；输出仅作模拟参考。
            </p>
          </div>
        </WorkbenchCard>
      </div>

      <StatusStepper current={snapshot.status} />

      <div className="metricGrid six">
        {metricItems.map((item) => (
          <MetricCard item={item} key={item.label} />
        ))}
      </div>

      <div className="dashboardGrid">
        <WorkbenchCard
          title="流程进度"
          description="完整链路按数据、计量、权重、分配、报告顺序推进。"
        >
          <div className="processRail">
            {processSteps.map((step, index) => (
              <div
                className={
                  index < 6 ? "done" : index === 6 ? "current" : "pending"
                }
                key={step}
              >
                <span>{index + 1}</span>
                <strong>{step}</strong>
              </div>
            ))}
          </div>
        </WorkbenchCard>

        <SectionCard title="风险提示" description="点击查看完整边界说明。">
          <RiskNotice compact />
          <button className="wideButton" type="button" onClick={() => setRiskOpen(true)}>
            打开风险说明抽屉
          </button>
        </SectionCard>
      </div>

      <div className="dashboardGrid">
        <SectionCard title="最近报告" description="报告记录包含字段范围和版本，不覆盖历史。">
          <RecentReportList reports={mock.reports} />
        </SectionCard>

        <SectionCard title="最近审计记录" description="关键操作生成审计日志。">
          <RecentAuditList auditLogs={mock.auditLogs} />
        </SectionCard>

        <SectionCard title="快照轨迹" description="阶段性输入、参数和输出快照。">
          <SnapshotTimeline snapshots={mock.snapshots} />
        </SectionCard>
      </div>

      <DetailDrawer
        open={riskOpen}
        title="风险与合规边界"
        onClose={() => setRiskOpen(false)}
      >
        <RiskNotice />
        <div className="drawerSection">
          <h3>本阶段不可作为</h3>
          <ul className="plainList">
            <li>法律结算、法定结算或付款指令</li>
            <li>合同履约证明、税务、银行或电子签章依据</li>
            <li>生产级 RBAC、登录、PDF、异步队列能力证明</li>
          </ul>
        </div>
      </DetailDrawer>
    </div>
  );
}
