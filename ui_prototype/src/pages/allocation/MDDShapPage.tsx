import { useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import {
  ActionButton,
  DetailDrawer,
  MetricCard,
  PageHeader,
  PreconditionPanel,
  RiskNotice,
  SectionCard,
  TechnicalDetails,
  WorkbenchCard,
} from "../../ui";
import {
  formatPercent,
  formatWeight,
  getMockWorkspace,
  isResourceBlocked,
} from "../phase2aUtils";
import type { PageProps } from "../pageTypes";

type DrawerName = "progress" | "trace" | "weights" | "complexity" | "audit" | "export" | "";

export function MDDShapPage({ route, snapshot, onAction }: PageProps) {
  const mock = getMockWorkspace(snapshot);
  const [drawer, setDrawer] = useState<DrawerName>("");
  const [seed, setSeed] = useState(20260618);
  const [sampleRounds, setSampleRounds] = useState(512);
  const [epsilon, setEpsilon] = useState(0.0001);
  const [saveMarginalDetail, setSaveMarginalDetail] = useState(true);
  const blockedResources = mock.resources.filter(isResourceBlocked).length;
  const hasWeights = mock.mdsWeights.length > 0;
  const weightTotal = mock.mdsWeights.reduce((sum, item) => sum + item.normalizedWeight, 0);
  const latestTask = mock.mdsTasks[0];
  const preconditions = [
    {
      name: "数据包",
      status: "PASS" as const,
      targetPath: "/data/packages" as const,
      message: "已生成有效输入快照。",
    },
    {
      name: "资源主体绑定",
      status: blockedResources ? "BLOCKED" as const : "PASS" as const,
      targetPath: "/data/resources" as const,
      message: blockedResources
        ? `${blockedResources} 个进入计算资源未关联数据源主体。`
        : "进入计算资源均已确认数据源主体。",
    },
    {
      name: "质量评估",
      status: "PASS" as const,
      targetPath: "/measure/quality" as const,
      message: "质量因子已生成。",
    },
    {
      name: "贡献效用",
      status: "PASS" as const,
      targetPath: "/measure/utility" as const,
      message: "贡献度和效用值已生成。",
    },
    {
      name: "算法参与方集合",
      status: mock.mdsParticipants.length ? "PASS" as const : "BLOCKED" as const,
      targetPath: "/data/parties" as const,
      message: "仅包含已进入算法权重池且类型为数据提供方的主体。",
    },
  ];
  const canRun = preconditions.every((item) => item.status === "PASS");
  const metrics = [
    { label: "算法模式", value: "MD_DSHAP", hint: "默认权重计算策略", tone: "success" as const },
    {
      label: "参与方集合",
      value: String(mock.mdsParticipants.length),
      hint: "仅数据提供方",
      tone: "neutral" as const,
    },
    {
      label: "任务状态",
      value: latestTask.status,
      hint: `${latestTask.progress}% 完成`,
      tone: latestTask.status === "已完成" ? "success" as const : "warning" as const,
    },
    {
      label: "权重合计",
      value: hasWeights ? formatWeight(weightTotal) : "待计算",
      hint: "必须等于 1.000000",
      tone: hasWeights && Math.abs(weightTotal - 1) < 0.000001 ? "success" as const : "warning" as const,
    },
  ];

  function runCalculation() {
    onAction(actionRegistry["MDS-011"], {
      kind: "mds-parameters",
      seed,
      sampleRounds,
      epsilon,
      saveMarginalDetail,
    });
  }

  return (
    <div className="pageWorkspace phase2Page mdsPage">
      <PageHeader
        route={{
          ...route,
          label: "MD-DShap 算法权重计算管理页",
          responsibility: "管理算法前置检查、参数、任务、权重结果、边际贡献和审计说明。",
        }}
        snapshot={snapshot}
      />

      <RiskNotice compact />

      <div className="metricGrid four">
        {metrics.map((item) => (
          <MetricCard item={item} key={item.label} />
        ))}
      </div>

      <div className="mdsGrid">
        <WorkbenchCard
          title="算法模式"
          description="MD-DShap 输出权重，不是最终付款指令。"
          actions={
            <>
              <ActionButton
                action={actionRegistry["MDS-011"]}
                disabledReason={canRun ? "" : "前置条件未通过"}
                onClick={runCalculation}
              />
              <ActionButton
                action={actionRegistry["MDS-016"]}
                disabledReason={hasWeights ? "" : "尚无历史任务"}
                onClick={(action) => onAction(action)}
              />
            </>
          }
        >
          <div className="algorithmModeCard">
            <strong>MD_DSHAP</strong>
            <p>默认多维任务 Shapley 近似计算，结合效用输入、质量因子和任务集合。</p>
            <span>基础 Shapley 仅用于 baseline_check，不作为默认最终分配模式。</span>
          </div>
        </WorkbenchCard>

        <SectionCard title="前置条件检查" description="任一阻断项未通过时不应启动权重计算。">
          <PreconditionPanel items={preconditions} />
        </SectionCard>
      </div>

      <div className="mdsGrid">
        <WorkbenchCard
          title="参数面板"
          description="本阶段使用演示参数，后续接入参数版本服务。"
        >
          <div className="paramGrid">
            <label>
              seed
              <input value={seed} type="number" onChange={(event) => setSeed(Number(event.target.value))} />
            </label>
            <label>
              sample_rounds
              <input
                value={sampleRounds}
                type="number"
                onChange={(event) => setSampleRounds(Number(event.target.value))}
              />
            </label>
            <label>
              epsilon
              <input
                step="0.0001"
                value={epsilon}
                type="number"
                onChange={(event) => setEpsilon(Number(event.target.value))}
              />
            </label>
            <label className="checkboxLine">
              <input
                checked={saveMarginalDetail}
                type="checkbox"
                onChange={(event) => setSaveMarginalDetail(event.target.checked)}
              />
              保存边际贡献明细
            </label>
          </div>
        </WorkbenchCard>

        <WorkbenchCard
          title="任务集合"
          description="任务集合来自效用输入和资源贡献，不包含非数据主体。"
        >
          <div className="taskSet">
            <span>资源效用任务集</span>
            <strong>{mock.resources.filter((item) => item.includeInCalculation).length} 个资源</strong>
            <p>采样轮次 {sampleRounds}，收敛阈值 {epsilon}</p>
          </div>
        </WorkbenchCard>
      </div>

      <section className="participantPanel">
        <div className="sectionHead">
          <h2>算法参与方集合</h2>
          <p>仅包含已标记进入算法权重池且参与方类型为数据提供方的主体。</p>
        </div>
        <div className="tableWrap">
          <table className="dataTable phase2Table">
            <thead>
              <tr>
                <th>参与方</th>
                <th>参与方类型</th>
                <th>贡献分</th>
                <th>效用值</th>
                <th>质量因子</th>
                <th>是否进入算法权重池</th>
              </tr>
            </thead>
            <tbody>
              {mock.mdsParticipants.map((participant) => (
                <tr key={participant.name}>
                  <td>{participant.name}</td>
                  <td>数据提供方</td>
                  <td>{formatWeight(participant.contributionScore)}</td>
                  <td>{formatWeight(participant.utilityValue)}</td>
                  <td>{formatWeight(participant.qualityFactor)}</td>
                  <td><span className="tag success">是</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mdsGrid">
        <WorkbenchCard
          title="计算进度"
          description="任务执行会生成任务记录、权重结果、边际贡献轨迹、算法审计快照和审计日志。"
          actions={
            <>
              <ActionButton
                action={actionRegistry["MDS-012"]}
                onClick={(action) => {
                  onAction(action);
                  setDrawer("progress");
                }}
              />
              <ActionButton
                action={actionRegistry["MDS-013"]}
                onClick={(action) => {
                  onAction(action);
                  setDrawer("trace");
                }}
              />
              <ActionButton
                action={actionRegistry["MDS-015"]}
                onClick={(action) => {
                  onAction(action);
                  setDrawer("complexity");
                }}
              />
            </>
          }
        >
          <div className="progressBlock">
            <div>
              <strong>{latestTask.taskName}</strong>
              <span>{latestTask.status}</span>
            </div>
            <div className="progressTrack">
              <span style={{ width: `${latestTask.progress}%` }} />
            </div>
            <small>{latestTask.progress}% 完成 / 创建时间 {latestTask.createdAt}</small>
          </div>
        </WorkbenchCard>

        <WorkbenchCard
          title="参与方权重表"
          description="权重保留 6 位小数，合计必须为 1。"
          actions={
            <>
              <ActionButton
                action={actionRegistry["MDS-014"]}
                onClick={(action) => {
                  onAction(action);
                  setDrawer("weights");
                }}
              />
              <ActionButton
                action={actionRegistry["MDS-017"]}
                onClick={(action) => {
                  onAction(action);
                  setDrawer("export");
                }}
              />
              <ActionButton
                action={actionRegistry["MDS-018"]}
                onClick={(action) => {
                  onAction(action);
                  setDrawer("audit");
                }}
              />
            </>
          }
        >
          <div className="tableWrap">
            <table className="dataTable phase2Table">
              <thead>
                <tr>
                  <th>参与方</th>
                  <th>归一化权重</th>
                  <th>边际贡献</th>
                  <th>效用值</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {(hasWeights ? mock.mdsWeights : []).map((weight) => (
                  <tr key={weight.partyName}>
                    <td>{weight.partyName}</td>
                    <td>{formatWeight(weight.normalizedWeight)}</td>
                    <td>{formatWeight(weight.marginalContribution)}</td>
                    <td>{formatWeight(weight.utilityValue)}</td>
                    <td>{weight.status}</td>
                  </tr>
                ))}
                {!hasWeights ? (
                  <tr>
                    <td colSpan={5}>尚未生成权重，点击“启动 MD-DShap”后显示。</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="weightTotal">
            权重合计：<strong>{hasWeights ? formatWeight(weightTotal) : "待计算"}</strong>
          </p>
        </WorkbenchCard>
      </div>

      <section className="nonPaymentNotice">
        <strong>算法边界</strong>
        <p>MD-DShap 输出的是数据源主体权重，不是最终付款指令、真实财务结算或合同履约依据。</p>
      </section>

      <DetailDrawer open={drawer === "progress"} title="计算进度" onClose={() => setDrawer("")}>
        <div className="progressDetail">
          <strong>{latestTask.taskName}</strong>
          <p>算法模式：{latestTask.algorithmMode}</p>
          <p>状态：{latestTask.status}</p>
          <p>进度：{latestTask.progress}%</p>
          <TechnicalDetails
            details={{
              task_id: "mds-task-phase2a",
              output_snapshot_id: "snapshot-mds-output-phase2a",
              algorithm_version: "md-dshap-demo-v1",
            }}
          />
        </div>
      </DetailDrawer>

      <DetailDrawer open={drawer === "trace"} title="边际贡献明细" onClose={() => setDrawer("")}>
        <div className="tableWrap">
          <table className="dataTable phase2Table">
            <thead>
              <tr>
                <th>coalition</th>
                <th>参与方</th>
                <th>v_before</th>
                <th>v_after</th>
                <th>marginal_contribution</th>
              </tr>
            </thead>
            <tbody>
              {mock.mdsTraces.map((trace) => (
                <tr key={`${trace.coalition}-${trace.partyName}`}>
                  <td>{trace.coalition}</td>
                  <td>{trace.partyName}</td>
                  <td>{formatWeight(trace.vBefore)}</td>
                  <td>{formatWeight(trace.vAfter)}</td>
                  <td>{formatWeight(trace.marginalContribution)}</td>
                </tr>
              ))}
              {mock.mdsTraces.length === 0 ? (
                <tr>
                  <td colSpan={5}>尚未生成边际贡献明细。</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </DetailDrawer>

      <DetailDrawer open={drawer === "weights"} title="参与方权重" onClose={() => setDrawer("")}>
        <p className="drawerIntro">权重合计必须为 1.000000，页面显示 6 位小数。</p>
        <ul className="plainList">
          {mock.mdsWeights.map((weight) => (
            <li key={weight.partyName}>
              {weight.partyName}：{formatWeight(weight.normalizedWeight)}
            </li>
          ))}
        </ul>
      </DetailDrawer>

      <DetailDrawer open={drawer === "complexity"} title="复杂度优化说明" onClose={() => setDrawer("")}>
        <ul className="plainList">
          <li>使用多维任务集合减少全排列枚举压力。</li>
          <li>通过 sample_rounds 控制近似采样轮次，通过 epsilon 控制收敛阈值。</li>
          <li>保存边际贡献明细时仅保存脱敏后的 coalition 与效用差值。</li>
          <li>Basic Shapley 仅用于 baseline_check，不作为默认最终模式。</li>
        </ul>
      </DetailDrawer>

      <DetailDrawer open={drawer === "export"} title="算法结果导出" onClose={() => setDrawer("")}>
        <p className="drawerIntro">已生成 md_dshap_weights_phase2a.json 模拟导出记录。</p>
        <ul className="plainList">
          <li>字段范围：算法模式、参与方权重、边际贡献摘要、参数版本</li>
          <li>记录类型：export_file + report_record</li>
          <li>结果边界：模拟参考，不是付款指令</li>
        </ul>
      </DetailDrawer>

      <DetailDrawer open={drawer === "audit"} title="算法审计说明" onClose={() => setDrawer("")}>
        <p className="drawerIntro">已生成 md_dshap_audit_report 模拟记录。</p>
        <ul className="plainList">
          <li>包含算法版本、参数、输入快照、输出快照和模拟边界</li>
          <li>保留重新计算任务版本，不覆盖历史 task</li>
          <li>所有导出和审计说明均为模拟参考</li>
        </ul>
      </DetailDrawer>
    </div>
  );
}
