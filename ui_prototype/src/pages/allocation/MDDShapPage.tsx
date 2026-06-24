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
  SectionCard,
  TechnicalDetails,
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

type DrawerName = "progress" | "trace" | "weights" | "complexity" | "audit" | "export" | "";

export function MDDShapPage({ route, snapshot, onAction }: PageProps) {
  const [drawer, setDrawer] = useState<DrawerName>("");
  const [seed, setSeed] = useState(20260618);
  const [sampleRounds, setSampleRounds] = useState(512);
  const [epsilon, setEpsilon] = useState(0.0001);
  const [saveMarginalDetail, setSaveMarginalDetail] = useState(true);
  const pageData = snapshot.pages["/allocation/md-dshap"];
  const rows = pageRows(pageData);
  const metrics = pageMetrics(pageData);
  const firstRow = rows[0];

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
              <ActionButton action={actionRegistry["MDS-011"]} onClick={runCalculation} />
              <ActionButton
                action={actionRegistry["MDS-016"]}
                disabledReason={hasBackendRows(pageData) ? "" : "尚无后端历史任务结果"}
                onClick={(action) => onAction(action)}
              />
            </>
          }
        >
          <div className="algorithmModeCard">
            <strong>{cellText(firstRow, "algorithm_mode", "MD_DSHAP")}</strong>
            <p>默认多维任务 Shapley 近似计算，权重由后端任务结果返回。</p>
            <span>基础 Shapley 仅用于 baseline_check，不作为默认最终分配模式。</span>
          </div>
        </WorkbenchCard>

        <SectionCard title="前置条件检查" description="任一阻断项未通过时不应启动权重计算。">
          <PreconditionPanel items={pageData.preconditions} />
        </SectionCard>
      </div>

      <div className="mdsGrid">
        <WorkbenchCard
          title="参数面板"
          description="参数作为后端任务请求输入；结果仍以后端返回为准。"
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

        <ChartPanel
          title="参与方权重图"
          description="权重条形图和边际贡献热力表需要后端 chart DTO。"
          source={pageData.chart?.chart_id}
        />
      </div>

      <div className="mdsGrid">
        <WorkbenchCard
          title="计算进度"
          description="任务状态、快照和算法版本只展示后端任务字段。"
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
          <dl className="businessDetail compact">
            <div>
              <dt>task_status</dt>
              <dd>{cellText(firstRow, "task_status")}</dd>
            </div>
            <div>
              <dt>sample_rounds</dt>
              <dd>{cellText(firstRow, "sample_rounds")}</dd>
            </div>
            <div>
              <dt>epsilon</dt>
              <dd>{cellText(firstRow, "epsilon")}</dd>
            </div>
          </dl>
        </WorkbenchCard>

        <WorkbenchCard
          title="参与方权重表"
          description="权重只做 6 位展示；合计与归一化校验由后端返回。"
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
                disabledReason="缺少纯权重结果导出契约"
                onClick={(action) => {
                  onAction(action);
                  setDrawer("export");
                }}
              />
              <ActionButton
                action={actionRegistry["MDS-018"]}
                onClick={(action) => {
                  onAction(action, { kind: "mds-audit-export" });
                  setDrawer("audit");
                }}
              />
            </>
          }
        >
          {hasBackendRows(pageData) ? (
            <div className="tableWrap">
              <table className="dataTable phase2Table">
                <thead>
                  <tr>
                    <th>参与方</th>
                    <th>participant_weight</th>
                    <th>normalized_weight</th>
                    <th>weight_diff</th>
                    <th>任务状态</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${cellText(row, "party_name", "party")}-${index}`}>
                      <td>{cellText(row, "party_name")}</td>
                      <td>{weightCell(row, "participant_weight")}</td>
                      <td>{weightCell(row, "normalized_weight")}</td>
                      <td>{weightCell(row, "marginal_contribution")}</td>
                      <td>{cellText(row, "task_status")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyGuide
              title="后端未返回 MD-DShap 权重结果"
              description="请先完成效用计算并启动 MD-DShap；页面不会计算权重合计或补造权重。"
            />
          )}
        </WorkbenchCard>
      </div>

      <section className="nonPaymentNotice">
        <strong>算法边界</strong>
        <p>MD-DShap 输出的是数据源主体权重，不是最终付款指令、真实财务结算或合同履约依据。</p>
      </section>

      <TraceDrawer
        footerNote="进度 trace 仅用于说明模拟计算链路，不作为付款或结算依据。"
        input={{
          参与方集合: cellText(firstRow, "participant_set"),
          任务集合: cellText(firstRow, "task_set"),
        }}
        objectType="算法任务"
        open={drawer === "progress"}
        output={{
          任务状态: cellText(firstRow, "task_status"),
          权重合计: "后端未返回 weight_sum",
        }}
        parameters={{
          seed,
          sample_rounds: sampleRounds,
          epsilon,
          save_marginal_detail: saveMarginalDetail ? "是" : "否",
        }}
        statusTag={cellText(firstRow, "task_status", "缺少后端任务")}
        summary="展示后端任务字段；不在前端推导进度百分比、权重合计或快照状态。"
        technicalDetails={pageData.technicalDetails}
        title="计算进度"
        onClose={() => setDrawer("")}
      />

      <TraceDrawer
        footerNote="边际贡献 trace 必须来自后端 marginal-traces；无页面级 trace rows 时显示缺口。"
        objectType="边际贡献"
        open={drawer === "trace"}
        output={{
          trace_rows: "后端页面 DTO 未返回",
        }}
        statusTag="等待后端 trace DTO"
        summary="当前页面不再从权重结果重建边际贡献。"
        technicalDetails={pageData.technicalDetails}
        title="边际贡献明细"
        onClose={() => setDrawer("")}
      />

      <DetailDrawer
        footerNote="权重合计由后端校验；权重不是付款指令。"
        objectType="权重结果"
        open={drawer === "weights"}
        size="lg"
        statusTag={hasBackendRows(pageData) ? "后端结果" : "缺少数据"}
        title="参与方权重"
        variant="detail"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="权重结果" description="页面显示 6 位小数，不做合计或归一化。">
          {hasBackendRows(pageData) ? (
            <ul className="plainList">
              {rows.map((row, index) => (
                <li key={`${cellText(row, "party_name", "party")}-${index}`}>
                  {cellText(row, "party_name")}：{weightCell(row, "normalized_weight")}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyGuide
              title="后端未返回权重结果"
              description="启动 MD-DShap 后显示后端 task results。"
            />
          )}
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="复杂度说明来自后端任务或审计 DTO；当前仅提示缺口。"
        objectType="算法说明"
        open={drawer === "complexity"}
        size="md"
        statusTag="后端 DTO 缺口"
        title="复杂度优化说明"
        variant="risk"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="后端缺口">
          <EmptyGuide
            title="后端未返回复杂度说明 DTO"
            description="需要算法审计 DTO 返回 sample_rounds、epsilon、算法版本、复杂度说明和快照引用。"
          />
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="缺少纯权重导出契约时不显示已生成文件。"
        objectType="导出说明"
        open={drawer === "export"}
        size="md"
        statusTag="未启用"
        title="算法结果导出"
        variant="export"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="后端缺口">
          <EmptyGuide
            title="纯权重结果导出未接入"
            description="请使用算法审计导出，或让后端补充权重结果导出契约及 report_id/checksum。"
          />
          <ExportFieldList
            fields={[
              "algorithm_mode",
              "party_name",
              "normalized_weight",
              "participant_weight",
              "weight_diff",
            ]}
            note="字段范围仅为契约说明，不代表已生成文件。"
          />
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="审计说明仅解释算法输入、参数、输出和模拟边界。"
        objectType="算法审计说明"
        open={drawer === "audit"}
        size="lg"
        statusTag="后端导出"
        technicalDetails={<TechnicalDetails details={pageData.technicalDetails} />}
        title="算法审计说明"
        variant="export"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="审计内容">
          <p>算法审计导出调用后端接口；report_id、checksum 和生成时间以报告记录为准。</p>
        </DrawerSection>
      </DetailDrawer>
    </div>
  );
}
