import { useEffect, useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import { projectStatusLabels } from "../../domain/status";
import type { AuditLogRecord, ReportRecord, SnapshotRecord } from "../../domain/types";
import {
  ActionButton,
  DetailDrawer,
  DrawerSection,
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

const homeSections = [
  { id: "overview", label: "首页总览" },
  { id: "process", label: "流程入口" },
  { id: "risk", label: "风险提示" },
  { id: "one-click", label: "一键计算" },
];

function RecentReportList({ reports }: { reports: ReportRecord[] }) {
  if (reports.length === 0) {
    return (
      <div className="compactList">
        <article>
          <strong>暂无报告记录</strong>
          <span>完成收益分配模拟后可生成报告</span>
          <small>等待生成</small>
        </article>
      </div>
    );
  }
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
  if (auditLogs.length === 0) {
    return (
      <div className="compactList">
        <article>
          <strong>暂无审计日志</strong>
          <span>执行数据接入、计算或导出后生成</span>
          <small>等待操作</small>
        </article>
      </div>
    );
  }
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
  const pageData = snapshot.pages[route.path];
  const pageMetrics = new Map(pageData.metrics.map((item) => [item.label, item]));
  const resources = mock.resources;
  const blockedResources = resources.filter(isResourceBlocked).length;
  const poolCount = mock.dataProviders.filter((party) => party.includeInMDDShap).length;
  const reportReady = mock.reports.length > 0 ? "已有报告" : "待生成";
  useEffect(() => {
    function scrollToHash() {
      const sectionId = window.location.hash.replace("#", "");
      if (!sectionId) {
        return;
      }
      window.setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 50);
    }

    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

  const metricItems = [
    {
      label: "数据包",
      value: pageMetrics.get("数据包")?.value ?? "2",
      hint: pageMetrics.get("数据包")?.hint ?? "演示数据与上传候选",
      tone: "neutral" as const,
    },
    {
      label: "数据资源",
      value: pageMetrics.get("数据资源")?.value ?? String(resources.length),
      hint: pageMetrics.get("数据资源")?.hint ?? `${resources.filter((item) => item.includeInCalculation).length} 个进入后续计算`,
      tone: "success" as const,
    },
    {
      label: "参与方",
      value: pageMetrics.get("参与方")?.value ?? "5",
      hint: pageMetrics.get("参与方")?.hint ?? "3 个数据源主体，2 个合同优先主体",
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
      hint: pageMetrics.get("报告状态")?.hint ?? "Markdown/CSV/JSON/JSONL",
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

      <nav className="inPageTabs" aria-label="系统首页内部区块">
        {homeSections.map((item) => (
          <a href={`#${item.id}`} key={item.id}>{item.label}</a>
        ))}
      </nav>

      <section className="homeSection" id="overview">
        <div className="sectionHeading">
          <span className="eyebrow">首页总览</span>
          <h2>项目状态与核心指标</h2>
        </div>

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
      </section>

      <section className="homeSection" id="process">
        <div className="sectionHeading">
          <span className="eyebrow">流程入口</span>
          <h2>完整链路推进入口</h2>
        </div>
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
      </section>

      <section className="homeSection" id="risk">
        <div className="sectionHeading">
          <span className="eyebrow">风险提示</span>
          <h2>模拟参考边界</h2>
        </div>
        <div className="dashboardGrid">
        <SectionCard title="风险提示" description="点击查看完整边界说明。">
          <RiskNotice compact />
          <button className="wideButton" type="button" onClick={() => setRiskOpen(true)}>
            打开风险说明抽屉
          </button>
        </SectionCard>
      </div>
      </section>

      <section className="homeSection" id="one-click">
        <div className="sectionHeading">
          <span className="eyebrow">一键计算</span>
          <h2>完整链路计算与结果摘要</h2>
        </div>
        <WorkbenchCard
          title="一键计算"
          description="启动前检查资源主体绑定、质量评估、效用输入和算法参与方集合。"
          actions={
            <ActionButton
              action={actionRegistry["SYS-004"]}
              onClick={(action) => onAction(action)}
            />
          }
        >
          <div className="oneClickGrid">
            <article>
              <strong>前置条件检查</strong>
              <span>{blockedResources ? "存在阻断" : "可继续执行"}</span>
              <p>{blockedResources ? "仍有进入计算资源未绑定数据源主体。" : "资源、主体、效用和权重池条件已满足演示计算。"}</p>
            </article>
            <article>
              <strong>失败节点</strong>
              <span>{blockedResources ? "资源主体归属" : "暂无失败节点"}</span>
              <p>失败节点会写入运行日志摘要，并保留阶段快照。</p>
            </article>
            <article>
              <strong>运行日志摘要</strong>
              <span>local_operator</span>
              <p>完整链路计算会生成审计日志、算法快照和报告记录。</p>
            </article>
            <article>
              <strong>结果摘要</strong>
              <span>{projectStatusLabels[snapshot.status]}</span>
              <p>结果仅作为模拟参考，不构成法律结算或付款指令。</p>
            </article>
          </div>
        </WorkbenchCard>
      </section>

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
        actions={[
          {
            label: "关闭",
            onClick: () => setRiskOpen(false),
          },
        ]}
        footerNote="风险说明用于限定模拟参考边界，不构成法律结算或付款依据。"
        objectType="风险说明"
        open={riskOpen}
        size="sm"
        statusTag="模拟参考"
        subtitle="适用于系统首页、报告导出和算法结果说明。"
        title="风险与合规边界"
        variant="risk"
        onClose={() => setRiskOpen(false)}
      >
        <RiskNotice />
        <DrawerSection title="本阶段不可作为">
          <ul className="plainList">
            <li>法律结算、法定结算或付款指令</li>
            <li>合同履约证明、税务、银行或电子签章依据</li>
            <li>生产级 RBAC、登录、PDF、异步队列能力证明</li>
          </ul>
        </DrawerSection>
      </DetailDrawer>
    </div>
  );
}
