import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import { dvasApi } from "../../domain/api";
import type { DataRow, RoutePath } from "../../domain/types";
import {
  cellText,
  hasBackendRows,
  numericCellValue,
  pageRows,
  percentCell,
  weightCell,
} from "../backendPageData";
import type { PageProps } from "../pageTypes";

type MdsDrawer = "" | "detail" | "marginal" | "audit";
type MdsModal = "" | "start" | "config";
type MdsDetailTab = "weight" | "task" | "marginal" | "audit";
type MdsTraceFilter = "all" | string;

interface MdsWeightRow {
  key: string;
  resultId: string;
  taskId: string;
  partyId: string;
  partyName: string;
  participantWeightText: string;
  normalizedWeightText: string;
  baselineWeightText: string;
  diffText: string;
  utilityText: string;
  normalizedWeight: number | null;
  taskSetText: string;
  statusText: string;
  raw: DataRow;
}

interface MdsTraceRow {
  key: string;
  taskId: string;
  partyId: string;
  partyName: string;
  taskKey: string;
  iterationNo: string;
  coalitionBefore: string;
  vBefore: string;
  vAfter: string;
  marginalContribution: string;
  seed: string;
  raw: Record<string, unknown>;
}

interface MdsConfigDraft {
  seed: string;
  sampleRounds: string;
  epsilon: string;
  baselineEnabled: boolean;
  saveMarginalDetail: boolean;
}

interface MdsChartTooltip {
  x: number;
  y: number;
  row: MdsWeightRow;
  title: string;
}

const colors = ["#1d65f3", "#0ea66f", "#f59e0b", "#7c3aed", "#0f9bb6", "#5b8def"];

export function MDDShapPage({ route, snapshot, onAction, onNavigate }: PageProps) {
  const pageData = snapshot.pages[route.path];
  const technicalDetails = pageData?.technicalDetails ?? {};
  const rows = useMemo(() => pageRows(pageData).map(toWeightRow), [pageData]);
  const traces = useMemo(
    () => parseTraceRows(rawValue(technicalDetails, "marginal_traces_json")),
    [technicalDetails],
  );
  const [selectedKey, setSelectedKey] = useState("");
  const [hoverKey, setHoverKey] = useState("");
  const [drawer, setDrawer] = useState<MdsDrawer>("");
  const [modal, setModal] = useState<MdsModal>("");
  const [detailTab, setDetailTab] = useState<MdsDetailTab>("weight");
  const [traceFilter, setTraceFilter] = useState<MdsTraceFilter>("all");
  const [confirmedStart, setConfirmedStart] = useState(false);
  const [working, setWorking] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [configDraft, setConfigDraft] = useState<MdsConfigDraft>(() =>
    buildConfigDraft(technicalDetails),
  );

  const selectedRow =
    rows.find((row) => row.key === selectedKey) ?? rows[0] ?? null;
  const activeKey = hoverKey || selectedKey;
  const selectedTraces = selectedRow
    ? traces.filter(
        (trace) =>
          trace.partyId === selectedRow.partyId || trace.partyName === selectedRow.partyName,
      )
    : [];
  const filteredTraces =
    traceFilter === "all"
      ? traces
      : traces.filter((trace) => trace.partyId === traceFilter || trace.partyName === traceFilter);
  const hasWeights = hasBackendRows(pageData);
  const taskId =
    rawValue(technicalDetails, "current_algorithm_task_id") || selectedRow?.taskId || "";

  useEffect(() => {
    setConfigDraft(buildConfigDraft(technicalDetails));
  }, [technicalDetails]);

  function selectRow(row: MdsWeightRow) {
    setSelectedKey(row.key);
  }

  function hoverRow(row: MdsWeightRow) {
    setHoverKey(row.key);
  }

  function clearHover() {
    setHoverKey("");
  }

  function openDetail(row: MdsWeightRow, tab: MdsDetailTab = "weight") {
    selectRow(row);
    setDetailTab(tab);
    setDrawer("detail");
  }

  async function saveConfig() {
    setWorking(true);
    setStatusText("");
    try {
      await dvasApi.saveMdDshapConfig({
        algorithm_mode: "MD_DSHAP",
        seed: numberOrString(configDraft.seed),
        sample_rounds: numberOrString(configDraft.sampleRounds),
        epsilon: numberOrString(configDraft.epsilon),
        baseline_enabled: configDraft.baselineEnabled,
      });
      setStatusText("配置已保存，将用于新一轮计算。");
      onAction({ ...actionRegistry["MDS-012"], requiresConfirmation: false, label: "刷新权重配置" });
    } catch {
      setStatusText("保存失败，请检查参数后重试。");
    } finally {
      setWorking(false);
    }
  }

  async function startCalculation() {
    if (!confirmedStart) {
      return;
    }
    setWorking(true);
    setStatusText("");
    try {
      await dvasApi.runMdDshap({
        algorithm_mode: "MD_DSHAP",
        seed: numberOrString(configDraft.seed),
        sample_rounds: numberOrString(configDraft.sampleRounds),
        epsilon: numberOrString(configDraft.epsilon),
        baseline_enabled: configDraft.baselineEnabled,
        save_marginal_detail: configDraft.saveMarginalDetail,
      });
      setModal("");
      setConfirmedStart(false);
      onAction({ ...actionRegistry["MDS-012"], requiresConfirmation: false, label: "刷新权重结果" });
    } catch {
      setStatusText("计算未完成，请检查前置结果和参数配置。");
    } finally {
      setWorking(false);
    }
  }

  function exportAudit() {
    if (!taskId) {
      setStatusText("暂无可导出的审计任务。");
      return;
    }
    onAction(actionRegistry["MDS-018"], { kind: "mds-audit-export", taskId: String(taskId) });
  }

  const overlayOpen = Boolean(drawer || modal);

  return (
    <div className={`pageWorkspace mdsWorkbenchPage${overlayOpen ? " mdsOverlayActive" : ""}`}>
      <header className="mdsPageHeader">
        <div>
          <h1>MD-DShap 权重计算</h1>
          <p>基于效用结果计算参与方归一化权重，并保留边际贡献与审计说明。</p>
        </div>
        <div className="mdsHeaderActions">
          <button type="button" onClick={() => setDrawer("audit")}>查看审计</button>
          <button type="button" onClick={() => setDrawer("marginal")}>查看边际贡献</button>
          <button type="button" onClick={() => setModal("config")}>配置参数</button>
          <button className="primary" type="button" onClick={() => setModal("start")}>启动计算</button>
        </div>
      </header>

      <section className="mdsMetricGrid" aria-label="MD-DShap 权重摘要">
        <MdsMetricCard title="进入权重池主体数" value={summaryValue(technicalDetails, ["participant_pool_total", "result_count"], "待生成")} />
        <MdsMetricCard title="当前算法模式" value={formatAlgorithmMode(summaryValue(technicalDetails, ["algorithm_mode"], "待生成"))} />
        <MdsMetricCard title="计算状态" value={formatTaskStatus(summaryValue(technicalDetails, ["task_status"], "待生成"))} />
        <MdsMetricCard title="归一化权重合计" value={summaryValue(technicalDetails, ["weight_sum"], "暂无")} />
        <MdsMetricCard title="最高权重主体" value={summaryValue(technicalDetails, ["top_weight_party_name"], "暂无")} />
      </section>

      <section className="mdsVisualGrid">
        <article className="mdsPanel mdsFlowPanel">
          <div className="mdsPanelHead">
            <div>
              <h2>权重流向</h2>
              <p>展示数据源主体、任务集合与归一化权重之间的关系。</p>
            </div>
          </div>
          <MdsFlowChart
            activeKey={activeKey}
            rows={rows}
            onHover={hoverRow}
            onHoverEnd={clearHover}
            onOpenDetail={openDetail}
            onSelect={selectRow}
          />
        </article>

        <article className="mdsPanel mdsDonutPanel">
          <div className="mdsPanelHead">
            <div>
              <h2>权重占比分布</h2>
              <p>各参与方归一化权重占比。</p>
            </div>
          </div>
          <MdsWeightDonut
            activeKey={activeKey}
            rows={rows}
            selectedKey={selectedKey}
            onClearSelection={() => setSelectedKey("")}
            onHover={hoverRow}
            onHoverEnd={clearHover}
            onOpenDetail={openDetail}
            onSelect={selectRow}
          />
        </article>
      </section>

      <section className="mdsPanel mdsTablePanel">
        <div className="mdsPanelHead">
          <div>
            <h2>权重结果</h2>
            <p>归一化权重用于后续收益分配模拟，不代表法律结算比例。</p>
          </div>
          <button type="button" onClick={() => setDrawer("marginal")}>查看摘要明细</button>
        </div>
        <div className="mdsTableWrap">
          <table className="mdsTable">
            <thead>
              <tr>
                <th>参与方</th>
                <th>效用值</th>
                <th>原始权重</th>
                <th>归一化权重</th>
                <th>基线权重</th>
                <th>差异</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((row) => (
                <tr
                  className={activeKey === row.key ? "selected" : ""}
                  key={row.key}
                  onClick={() => selectRow(row)}
                  onMouseEnter={() => hoverRow(row)}
                  onMouseLeave={clearHover}
                >
                  <td><strong>{row.partyName}</strong></td>
                  <td>{row.utilityText}</td>
                  <td>{row.participantWeightText}</td>
                  <td><span className="mdsWeightText">{row.normalizedWeightText}</span></td>
                  <td>{row.baselineWeightText}</td>
                  <td><span className={diffClass(row.diffText)}>{row.diffText}</span></td>
                  <td>
                    <div className="mdsRowActions">
                      <button type="button" onClick={(event) => {
                        event.stopPropagation();
                        openDetail(row);
                      }}>查看详情</button>
                      <button type="button" onClick={(event) => {
                        event.stopPropagation();
                        openDetail(row, "marginal");
                      }}>查看边际贡献</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7}><p className="mdsEmpty">暂无</p></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="mdsStepFooter">
        <button type="button" onClick={() => onNavigate("/metering/utility" as RoutePath)}>
          ← 上一步：贡献与效用计算
        </button>
        <button
          className="primary"
          disabled={!hasWeights}
          title={hasWeights ? "进入收益分配模拟" : "请先完成权重计算"}
          type="button"
          onClick={() => onNavigate("/allocation/simulation" as RoutePath)}
        >
          下一步：进入收益分配模拟 →
        </button>
      </footer>

      <p className="mdsDisclaimer">
        本系统输出仅作为数据收益分配模拟与审计说明参考，不作为法律结算或付款依据。
      </p>

      {drawer === "detail" && selectedRow ? (
        <MdsParticipantDrawer
          row={selectedRow}
          selectedTab={detailTab}
          taskInfo={technicalDetails}
          traces={selectedTraces}
          onClose={() => setDrawer("")}
          onExportAudit={exportAudit}
          onTabChange={setDetailTab}
        />
      ) : null}

      {drawer === "marginal" ? (
        <MdsMarginalDrawer
          filter={traceFilter}
          rows={rows}
          traces={filteredTraces}
          onClose={() => setDrawer("")}
          onFilterChange={setTraceFilter}
        />
      ) : null}

      {drawer === "audit" ? (
        <MdsAuditDrawer
          canExport={Boolean(taskId)}
          taskInfo={technicalDetails}
          onClose={() => setDrawer("")}
          onExport={exportAudit}
        />
      ) : null}

      {modal === "config" ? (
        <MdsConfigModal
          draft={configDraft}
          saving={working}
          status={statusText}
          onChange={setConfigDraft}
          onClose={() => {
            setModal("");
            setStatusText("");
          }}
          onReset={() => {
            setConfigDraft(buildConfigDraft(technicalDetails));
            setStatusText("已恢复为当前配置值。");
          }}
          onSave={saveConfig}
        />
      ) : null}

      {modal === "start" ? (
        <MdsStartModal
          checked={confirmedStart}
          draft={configDraft}
          hasWeights={hasWeights}
          participantCount={summaryValue(technicalDetails, ["participant_pool_total", "result_count"], "暂无")}
          projectName={summaryValue(technicalDetails, ["current_project_name"], snapshot.projectName)}
          status={statusText}
          taskSetCount={summaryValue(technicalDetails, ["task_set_count"], taskSetCountFromRows(rows))}
          working={working}
          onCheckedChange={setConfirmedStart}
          onClose={() => {
            setModal("");
            setStatusText("");
          }}
          onHistory={() => setStatusText("历史任务入口暂未启用。")}
          onStart={startCalculation}
        />
      ) : null}
    </div>
  );
}

function MdsMetricCard({ title, value }: { title: string; value: string }) {
  return (
    <article className="mdsMetricCard">
      <span>{title}</span>
      <strong>{value || "暂无"}</strong>
    </article>
  );
}

function MdsFlowChart({
  activeKey,
  rows,
  onHover,
  onHoverEnd,
  onOpenDetail,
  onSelect,
}: {
  activeKey: string;
  rows: MdsWeightRow[];
  onHover: (row: MdsWeightRow) => void;
  onHoverEnd: () => void;
  onOpenDetail: (row: MdsWeightRow) => void;
  onSelect: (row: MdsWeightRow) => void;
}) {
  const [tooltip, setTooltip] = useState<MdsChartTooltip | null>(null);
  if (!rows.length) {
    return <p className="mdsEmpty chart">权重流向图待生成</p>;
  }
  const height = Math.max(350, 104 + rows.length * 58);
  const top = 70;
  const bottom = height - 58;
  const gap = rows.length > 1 ? (bottom - top) / (rows.length - 1) : 0;
  const leftNodeX = 34;
  const leftOutX = 54;
  const middleInX = 352;
  const middleNodeX = 365;
  const middleOutX = 386;
  const rightInX = 636;
  const rightNodeX = 646;

  function pointY(index: number) {
    return rows.length > 1 ? top + index * gap : height / 2;
  }

  function linkWidth(row: MdsWeightRow) {
    if (row.normalizedWeight === null) {
      return 10;
    }
    return Math.max(8, Math.min(58, row.normalizedWeight * 74));
  }

  function moveTooltip(event: MouseEvent<SVGElement>, row: MdsWeightRow, title: string) {
    const owner = event.currentTarget.ownerSVGElement ?? event.currentTarget;
    const rect = owner.getBoundingClientRect();
    setTooltip({
      x: event.clientX - rect.left + 18,
      y: event.clientY - rect.top + 18,
      row,
      title,
    });
    onHover(row);
  }

  return (
    <div className="mdsFlowChart" aria-label="权重流向图">
      <svg
        className="mdsSankeySvg"
        role="img"
        viewBox={`0 0 760 ${height}`}
        onMouseLeave={() => {
          setTooltip(null);
          onHoverEnd();
        }}
      >
        <defs>
          <filter id="mdsSankeyShadow" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="10" floodColor="#10233f" floodOpacity="0.12" stdDeviation="10" />
          </filter>
        </defs>
        <g className="mdsSankeyColumns">
          <text x="34" y="28">参与方主体</text>
          <text x="344" y="28">数据资源类型 / 任务集合</text>
          <text x="625" y="28">归一化权重结果</text>
        </g>
        {rows.map((row, index) => {
          const y = pointY(index);
          const middleY = y + (index % 2 === 0 ? -12 : 12);
          const width = linkWidth(row);
          const color = colors[index % colors.length];
          const active = row.key === activeKey;
          return (
            <g
              className={`mdsSankeyGroup${active ? " active" : ""}`}
              key={row.key}
              tabIndex={0}
              onBlur={onHoverEnd}
              onClick={() => onOpenDetail(row)}
              onFocus={() => onHover(row)}
              onMouseEnter={() => onHover(row)}
            >
              <path
                className="mdsSankeyLink"
                d={sankeyRibbonPath(leftOutX, y, middleInX, middleY, width)}
                fill={color}
                onMouseEnter={(event) => moveTooltip(event, row, "主体到任务集合")}
                onMouseMove={(event) => moveTooltip(event, row, "主体到任务集合")}
              />
              <path
                className="mdsSankeyLink tail"
                d={sankeyRibbonPath(middleOutX, middleY, rightInX, y, Math.max(7, width * 0.78))}
                fill={color}
                onMouseEnter={(event) => moveTooltip(event, row, "任务集合到权重结果")}
                onMouseMove={(event) => moveTooltip(event, row, "任务集合到权重结果")}
              />
              <rect
                className="mdsSankeyNode"
                fill={color}
                height={Math.max(28, width + 10)}
                rx="3"
                width="14"
                x={leftNodeX}
                y={y - Math.max(28, width + 10) / 2}
              />
              <rect
                className="mdsSankeyNode middle"
                fill={color}
                height={Math.max(30, width * 0.88 + 10)}
                rx="3"
                width="16"
                x={middleNodeX}
                y={middleY - Math.max(30, width * 0.88 + 10) / 2}
              />
              <rect
                className="mdsSankeyNode result"
                fill={color}
                height={Math.max(24, width * 0.62 + 8)}
                rx="3"
                width="10"
                x={rightNodeX}
                y={y - Math.max(24, width * 0.62 + 8) / 2}
              />
              <text className="mdsSankeyLabel source" x="62" y={y + 4}>{row.partyName}</text>
              <text className="mdsSankeyLabel task" x="390" y={middleY + 4}>{row.taskSetText}</text>
              <text className="mdsSankeyLabel result" x="664" y={y - 4}>{shortPartyName(row.partyName)}</text>
              <text className="mdsSankeyValue" x="664" y={y + 15}>{row.normalizedWeightText}</text>
            </g>
          );
        })}
      </svg>
      {tooltip ? (
        <div className="mdsChartTooltip mdsSankeyTooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <strong>{tooltip.title}</strong>
          <span>主体：{tooltip.row.partyName}</span>
          <span>任务集合：{tooltip.row.taskSetText}</span>
          <span>权重输入值：{tooltip.row.participantWeightText}</span>
          <span>归一化权重：{tooltip.row.normalizedWeightText}</span>
        </div>
      ) : null}
      <p className="mdsFlowHint">连线宽度映射系统返回的权重输入强度；右侧为归一化权重结果。</p>
    </div>
  );
}

function MdsWeightDonut({
  activeKey,
  rows,
  selectedKey,
  onClearSelection,
  onHover,
  onHoverEnd,
  onOpenDetail,
  onSelect,
}: {
  activeKey: string;
  rows: MdsWeightRow[];
  selectedKey: string;
  onClearSelection: () => void;
  onHover: (row: MdsWeightRow) => void;
  onHoverEnd: () => void;
  onOpenDetail: (row: MdsWeightRow) => void;
  onSelect: (row: MdsWeightRow) => void;
}) {
  const [tooltip, setTooltip] = useState<MdsChartTooltip | null>(null);
  const segments = rows.filter((row) => row.normalizedWeight !== null && row.normalizedWeight > 0);
  if (!segments.length) {
    return <p className="mdsEmpty chart">暂无</p>;
  }
  const activeRow = rows.find((row) => row.key === activeKey) ?? null;
  let cursor = -90;

  function moveTooltip(event: MouseEvent<SVGPathElement | SVGCircleElement>, row: MdsWeightRow) {
    const owner = event.currentTarget.ownerSVGElement ?? event.currentTarget;
    const rect = owner.getBoundingClientRect();
    setTooltip({
      x: event.clientX - rect.left + 18,
      y: event.clientY - rect.top + 18,
      row,
      title: "归一化权重",
    });
    onHover(row);
  }

  return (
    <div className="mdsDonutWrap" onClick={onClearSelection}>
      <div className="mdsDonutStage">
        <svg className="mdsDonutSvg" role="img" viewBox="0 0 260 260" aria-label="权重占比环图">
          <circle className="mdsDonutTrack" cx="130" cy="130" r="88" />
          {segments.map((row, index) => {
            const start = cursor;
            const span = Math.max(0, (row.normalizedWeight ?? 0) * 360);
            const end = start + span;
            cursor = end;
            const isActive = row.key === activeKey;
            const midAngle = start + span / 2;
            const offset = isActive ? 8 : 0;
            const rad = (midAngle * Math.PI) / 180;
            const color = colors[index % colors.length];
            return (
              <path
                className={`mdsDonutSegment${isActive ? " active" : ""}`}
                d={donutSegmentPath(130, 130, 66, isActive ? 106 : 100, start, end)}
                fill={color}
                key={row.key}
                transform={`translate(${Math.cos(rad) * offset} ${Math.sin(rad) * offset})`}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(row);
                }}
                onMouseEnter={(event) => moveTooltip(event, row)}
                onMouseLeave={() => {
                  setTooltip(null);
                  onHoverEnd();
                }}
                onMouseMove={(event) => moveTooltip(event, row)}
              />
            );
          })}
          <circle className="mdsDonutHole" cx="130" cy="130" r="62" />
          <text className="mdsDonutCenterLabel" x="130" y="124">{activeRow ? shortPartyName(activeRow.partyName) : "权重"}</text>
          <text className="mdsDonutCenterValue" x="130" y="146">{activeRow ? activeRow.normalizedWeightText : "占比"}</text>
        </svg>
        {tooltip ? (
          <div className="mdsChartTooltip mdsDonutTooltip" style={{ left: tooltip.x, top: tooltip.y }}>
            <strong>{tooltip.row.partyName}</strong>
            <span>归一化权重：{tooltip.row.normalizedWeightText}</span>
            <span>原始权重：{tooltip.row.participantWeightText}</span>
          </div>
        ) : null}
      </div>
      <div className="mdsDonutLegend">
        {rows.map((row, index) => (
          <button
            className={row.key === activeKey || row.key === selectedKey ? "active" : ""}
            key={row.key}
            title={`${row.partyName} · ${row.normalizedWeightText}`}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(row);
            }}
            onDoubleClick={() => onOpenDetail(row)}
            onMouseEnter={() => onHover(row)}
            onMouseLeave={onHoverEnd}
          >
            <i style={{ backgroundColor: colors[index % colors.length] }} />
            <span>{row.partyName}</span>
            <strong>{row.normalizedWeightText}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

function MdsParticipantDrawer({
  row,
  selectedTab,
  taskInfo,
  traces,
  onClose,
  onExportAudit,
  onTabChange,
}: {
  row: MdsWeightRow;
  selectedTab: MdsDetailTab;
  taskInfo: DataRow;
  traces: MdsTraceRow[];
  onClose: () => void;
  onExportAudit: () => void;
  onTabChange: (tab: MdsDetailTab) => void;
}) {
  const taskWeights = parseJsonRecord(rawValue(row.raw, "task_level_weight_json"));
  const tabs: Array<[MdsDetailTab, string]> = [
    ["weight", "权重结果"],
    ["task", "任务维度"],
    ["marginal", "边际贡献"],
    ["audit", "审计说明"],
  ];
  return (
    <aside className="mdsDrawer" aria-label="参与方权重详情">
      <section className="mdsDrawerPanel">
        <header>
          <div>
            <h2>参与方权重详情</h2>
            <p>{row.partyName}</p>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </header>
        <div className="mdsDrawerSummary">
          <article><span>归一化权重</span><strong>{row.normalizedWeightText}</strong></article>
          <article><span>原始权重</span><strong>{row.participantWeightText}</strong></article>
          <article><span>效用值</span><strong>{row.utilityText}</strong></article>
          <article><span>任务版本</span><strong>{summaryValue(row.raw, ["algorithm_version"], "暂无")}</strong></article>
        </div>
        <nav className="mdsTabs">
          {tabs.map(([key, label]) => (
            <button
              className={selectedTab === key ? "active" : ""}
              key={key}
              type="button"
              onClick={() => onTabChange(key)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="mdsDrawerBody">
          {selectedTab === "weight" ? (
            <MdsFieldGrid
              fields={[
                ["参与方权重", row.participantWeightText],
                ["归一化权重", row.normalizedWeightText],
                ["基线权重", row.baselineWeightText],
                ["差异", row.diffText],
                ["近似说明", cellText(row.raw, "approximation_note")],
              ]}
            />
          ) : null}
          {selectedTab === "task" ? (
            Object.keys(taskWeights).length ? (
              <MdsFieldGrid
                fields={Object.entries(taskWeights).map(([key, value]) => [
                  formatTaskKey(key),
                  formatMaybeWeight(value),
                ])}
              />
            ) : (
              <p className="mdsEmpty">暂无任务维度权重</p>
            )
          ) : null}
          {selectedTab === "marginal" ? <MdsTraceTable traces={traces} compact /> : null}
          {selectedTab === "audit" ? (
            <MdsFieldGrid
              fields={[
                ["算法模式", formatAlgorithmMode(summaryValue(taskInfo, ["algorithm_mode"], "暂无"))],
                ["算法版本", summaryValue(taskInfo, ["algorithm_version"], "暂无")],
                ["输入快照", summaryValue(taskInfo, ["parameter_snapshot_id"], "暂无")],
                ["输出快照", summaryValue(taskInfo, ["result_snapshot_id"], "暂无")],
                ["审计快照", summaryValue(taskInfo, ["algorithm_audit_snapshot_id"], "暂无")],
                ["近似假设", summaryValue(taskInfo, ["approximation_note"], "暂无")],
              ]}
            />
          ) : null}
        </div>
        <footer>
          <button type="button" onClick={onExportAudit}>导出审计说明</button>
          <button className="primary" type="button" onClick={onClose}>关闭</button>
        </footer>
      </section>
    </aside>
  );
}

function MdsMarginalDrawer({
  filter,
  rows,
  traces,
  onClose,
  onFilterChange,
}: {
  filter: MdsTraceFilter;
  rows: MdsWeightRow[];
  traces: MdsTraceRow[];
  onClose: () => void;
  onFilterChange: (filter: MdsTraceFilter) => void;
}) {
  return (
    <aside className="mdsDrawer" aria-label="边际贡献明细">
      <section className="mdsDrawerPanel wide">
        <header>
          <div>
            <h2>边际贡献明细</h2>
            <p>边际贡献用于解释权重形成过程。</p>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </header>
        <div className="mdsFilterBar">
          <label>
            参与方
            <select value={filter} onChange={(event) => onFilterChange(event.target.value)}>
              <option value="all">全部</option>
              {rows.map((row) => (
                <option key={row.key} value={row.partyId || row.partyName}>{row.partyName}</option>
              ))}
            </select>
          </label>
          <span>任务：效用结果任务集合</span>
          <span>轮次：当前结果</span>
        </div>
        <MdsTraceTable traces={traces} />
        <footer>
          <button className="primary" type="button" onClick={onClose}>关闭</button>
        </footer>
      </section>
    </aside>
  );
}

function MdsAuditDrawer({
  canExport,
  taskInfo,
  onClose,
  onExport,
}: {
  canExport: boolean;
  taskInfo: DataRow;
  onClose: () => void;
  onExport: () => void;
}) {
  const participantSet = parseJsonArray(rawValue(taskInfo, "participant_set_json"));
  const taskSet = parseJsonLooseArray(rawValue(taskInfo, "task_set_json"));
  return (
    <aside className="mdsDrawer" aria-label="算法审计说明">
      <section className="mdsDrawerPanel">
        <header>
          <div>
            <h2>算法审计说明</h2>
            <p>算法输入、参数、输出与模拟边界。</p>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </header>
        <div className="mdsDrawerBody">
          <MdsFieldGrid
            fields={[
              ["算法模式", formatAlgorithmMode(summaryValue(taskInfo, ["algorithm_mode"], "暂无"))],
              ["算法版本", summaryValue(taskInfo, ["algorithm_version"], "暂无")],
              ["参与方集合", participantSet.length ? `${participantSet.length} 个主体` : "暂无"],
              ["任务集合", taskSet.length ? taskSet.map((item) => formatTaskKey(String(item))).join("、") : "暂无"],
              ["效用函数来源", "贡献与效用计算结果"],
              ["随机种子", summaryValue(taskInfo, ["seed"], "暂无")],
              ["采样轮次", summaryValue(taskInfo, ["sample_rounds"], "暂无")],
              ["收敛阈值", summaryValue(taskInfo, ["epsilon"], "暂无")],
              ["近似假设", summaryValue(taskInfo, ["approximation_note"], "暂无")],
            ]}
          />
          <p className="mdsDrawerNote">
            MD-DShap 仅输出权重层结果，后续收益分配仍受合同约束和模拟方案控制。
          </p>
        </div>
        <footer>
          <button disabled={!canExport} title={canExport ? "" : "暂无可导出的审计任务"} type="button" onClick={onExport}>导出审计说明</button>
          <button className="primary" type="button" onClick={onClose}>关闭</button>
        </footer>
      </section>
    </aside>
  );
}

function MdsConfigModal({
  draft,
  saving,
  status,
  onChange,
  onClose,
  onReset,
  onSave,
}: {
  draft: MdsConfigDraft;
  saving: boolean;
  status: string;
  onChange: (draft: MdsConfigDraft) => void;
  onClose: () => void;
  onReset: () => void;
  onSave: () => void;
}) {
  return (
    <div className="mdsModalBackdrop">
      <section className="mdsConfigModal" role="dialog" aria-modal="true" aria-label="MD-DShap 参数配置">
        <header>
          <div>
            <h2>MD-DShap 参数配置</h2>
            <p>参数修改只影响新一轮计算。</p>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </header>
        <section className="mdsConfigBlock">
          <h3>算法参数</h3>
          <div className="mdsConfigGrid">
            <label>
              算法模式
              <input readOnly value="MD-DShap" />
            </label>
            <label>
              是否启用基线校验
              <select
                value={draft.baselineEnabled ? "true" : "false"}
                onChange={(event) => onChange({ ...draft, baselineEnabled: event.target.value === "true" })}
              >
                <option value="true">启用</option>
                <option value="false">不启用</option>
              </select>
            </label>
            <label>
              随机种子
              <input value={draft.seed} type="number" onChange={(event) => onChange({ ...draft, seed: event.target.value })} />
            </label>
            <label>
              采样轮次
              <input value={draft.sampleRounds} type="number" onChange={(event) => onChange({ ...draft, sampleRounds: event.target.value })} />
            </label>
            <label>
              收敛阈值
              <input value={draft.epsilon} step="0.000001" type="number" onChange={(event) => onChange({ ...draft, epsilon: event.target.value })} />
            </label>
            <label>
              保存边际贡献明细
              <select
                value={draft.saveMarginalDetail ? "true" : "false"}
                onChange={(event) => onChange({ ...draft, saveMarginalDetail: event.target.value === "true" })}
              >
                <option value="true">本次计算保存</option>
                <option value="false">本次计算不保存</option>
              </select>
            </label>
          </div>
          <p>基础 Shapley 仅作基线校验，不作为默认最终分配模式。</p>
        </section>
        {status ? <p className="mdsStatusText">{status}</p> : null}
        <footer>
          <button type="button" onClick={onReset}>恢复默认</button>
          <button type="button" onClick={onClose}>取消</button>
          <button className="primary" disabled={saving} type="button" onClick={onSave}>
            {saving ? "保存中" : "保存配置"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function MdsStartModal({
  checked,
  draft,
  hasWeights,
  participantCount,
  projectName,
  status,
  taskSetCount,
  working,
  onCheckedChange,
  onClose,
  onHistory,
  onStart,
}: {
  checked: boolean;
  draft: MdsConfigDraft;
  hasWeights: boolean;
  participantCount: string;
  projectName: string;
  status: string;
  taskSetCount: string;
  working: boolean;
  onCheckedChange: (checked: boolean) => void;
  onClose: () => void;
  onHistory: () => void;
  onStart: () => void;
}) {
  const prechecks = [
    ["有效用值", hasWeights ? "已生成" : "待确认"],
    ["有数据源主体", participantCount === "暂无" ? "待确认" : "已就绪"],
    ["参与方集合合法", participantCount === "暂无" ? "待确认" : "已就绪"],
    ["参数合法", "待系统校验"],
  ];
  return (
    <div className="mdsModalBackdrop">
      <section className="mdsStartModal" role="dialog" aria-modal="true" aria-label="启动 MD-DShap 权重计算">
        <header>
          <div>
            <h2>启动 MD-DShap 权重计算</h2>
            <p>将生成新的权重结果版本。</p>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </header>
        <div className="mdsStartSteps">
          <article><span>1</span><h3>计算对象</h3><p>当前项目：{projectName}</p><small>进入权重池主体数：{participantCount}；任务集合数量：{taskSetCount}</small></article>
          <article><span>2</span><h3>前置结果</h3><p>质量评估、数元计量、贡献与效用完成后可启动。</p><small>未满足时系统会拒绝计算请求。</small></article>
          <article><span>3</span><h3>使用配置</h3><p>算法模式：MD-DShap；随机种子：{draft.seed || "暂无"}</p><small>采样轮次：{draft.sampleRounds || "暂无"}；基线：{draft.baselineEnabled ? "启用" : "不启用"}</small></article>
          <article><span>4</span><h3>执行结果</h3><p>将生成权重结果、边际贡献明细和算法审计快照。</p><small>新结果不会由页面本地生成。</small></article>
        </div>
        <section className="mdsPrecheck">
          <h3>预检查</h3>
          <div>
            {prechecks.map(([label, value]) => (
              <p key={label}><span>✓</span><strong>{label}</strong><small>{value}</small></p>
            ))}
          </div>
        </section>
        <label className="mdsConfirmLine">
          <input checked={checked} type="checkbox" onChange={(event) => onCheckedChange(event.target.checked)} />
          我已确认本次计算将生成新的权重结果版本
        </label>
        {status ? <p className="mdsStatusText">{status}</p> : null}
        <footer>
          <button type="button" onClick={onHistory}>查看历史任务</button>
          <button type="button" onClick={onClose}>取消</button>
          <button className="primary" disabled={!checked || working} type="button" onClick={onStart}>
            {working ? "计算中" : "开始计算"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function MdsFieldGrid({ fields }: { fields: Array<[string, string]> }) {
  return (
    <div className="mdsFieldGrid">
      {fields.map(([label, value]) => (
        <article key={label}>
          <span>{label}</span>
          <strong>{value || "暂无"}</strong>
        </article>
      ))}
    </div>
  );
}

function MdsTraceTable({ traces, compact = false }: { traces: MdsTraceRow[]; compact?: boolean }) {
  if (!traces.length) {
    return <p className="mdsEmpty">暂无边际贡献明细</p>;
  }
  return (
    <div className="mdsDrawerTableWrap">
      <table className={`mdsDrawerTable${compact ? " compact" : ""}`}>
        <thead>
          <tr>
            <th>任务</th>
            <th>轮次</th>
            <th>加入前集合</th>
            <th>前值</th>
            <th>后值</th>
            <th>边际贡献</th>
            <th>种子</th>
          </tr>
        </thead>
        <tbody>
          {traces.map((trace) => (
            <tr key={trace.key}>
              <td>{formatTaskKey(trace.taskKey)}</td>
              <td>{trace.iterationNo}</td>
              <td>{trace.coalitionBefore}</td>
              <td>{trace.vBefore}</td>
              <td>{trace.vAfter}</td>
              <td>{trace.marginalContribution}</td>
              <td>{trace.seed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function toWeightRow(row: DataRow, index: number): MdsWeightRow {
  const resultId = cellText(row, "result_id", "");
  const partyId = cellText(row, "party_id", "");
  const partyName = cellText(row, "party_name", "数据源主体");
  const taskId = cellText(row, "task_id", "");
  const normalizedWeight = numericCellValue(row.normalized_weight);
  return {
    key: resultId || partyId || `${partyName}-${index}`,
    resultId,
    taskId,
    partyId,
    partyName,
    participantWeightText: weightCell(row, "participant_weight"),
    normalizedWeightText: percentCell(row, "normalized_weight"),
    baselineWeightText: optionalValue(row, "baseline_weight") ? weightCell(row, "baseline_weight") : "未启用基线",
    diffText: optionalValue(row, "weight_diff") ? percentCell(row, "weight_diff") : "暂无",
    utilityText: weightCell(row, "utility_value"),
    normalizedWeight,
    taskSetText: friendlyTaskSet(stringFromUnknown(rawValue(row, "task_set_json"))),
    statusText: formatTaskStatus(cellText(row, "task_status")),
    raw: row,
  };
}

function parseTraceRows(raw: unknown): MdsTraceRow[] {
  return parseJsonArray(raw).map((item, index) => ({
    key: stringFromUnknown(item.trace_id) || `${stringFromUnknown(item.party_id)}-${index}`,
    taskId: stringFromUnknown(item.task_id),
    partyId: stringFromUnknown(item.party_id),
    partyName: stringFromUnknown(item.party_name) || "数据源主体",
    taskKey: stringFromUnknown(item.task_key),
    iterationNo: stringFromUnknown(item.iteration_no) || "暂无",
    coalitionBefore: Array.isArray(item.coalition_before)
      ? item.coalition_before.join("、") || "空集"
      : stringFromUnknown(item.coalition_before) || "空集",
    vBefore: formatMaybeWeight(item.v_before),
    vAfter: formatMaybeWeight(item.v_after),
    marginalContribution: formatMaybeWeight(item.marginal_contribution),
    seed: stringFromUnknown(item.seed) || "暂无",
    raw: item,
  }));
}

function buildConfigDraft(row: DataRow): MdsConfigDraft {
  return {
    seed: summaryValue(row, ["seed"], "42"),
    sampleRounds: summaryValue(row, ["sample_rounds"], "64"),
    epsilon: summaryValue(row, ["epsilon"], "0.000001"),
    baselineEnabled: stringFromUnknown(row.baseline_enabled).toLowerCase() !== "false",
    saveMarginalDetail: true,
  };
}

function parseJsonArray(raw: unknown): Record<string, unknown>[] {
  const text = stringFromUnknown(raw);
  if (!text) {
    return [];
  }
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
  } catch {
    return [];
  }
}

function parseJsonLooseArray(raw: unknown): unknown[] {
  const text = stringFromUnknown(raw);
  if (!text) {
    return [];
  }
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonRecord(raw: unknown): Record<string, unknown> {
  const text = stringFromUnknown(raw);
  if (!text) {
    return {};
  }
  try {
    const parsed = JSON.parse(text);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function rawValue(row: DataRow | undefined, key: string) {
  if (!row) {
    return "";
  }
  return row[key] ?? "";
}

function optionalValue(row: DataRow | undefined, key: string) {
  if (!row) {
    return "";
  }
  const value = row[key];
  return value === undefined || value === null ? "" : String(value);
}

function summaryValue(row: DataRow, keys: string[], defaultText = "暂无") {
  for (const key of keys) {
    const value = rawValue(row, key);
    if (value !== undefined && value !== null && String(value) !== "") {
      return String(value);
    }
  }
  return defaultText;
}

function stringFromUnknown(value: unknown) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value);
}

function numberOrString(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

function formatMaybeWeight(value: unknown) {
  const numeric = numericCellValue(value);
  return numeric !== null ? numeric.toFixed(6) : stringFromUnknown(value) || "暂无";
}

function formatAlgorithmMode(value: string) {
  if (value === "MD_DSHAP" || value === "MD-DShap") {
    return "MD-DShap";
  }
  if (value === "BASELINE_SHAPLEY") {
    return "基线校验";
  }
  return value || "暂无";
}

function formatTaskStatus(value: string) {
  const map: Record<string, string> = {
    COMPLETED: "成功",
    FAILED: "失败",
    RUNNING: "计算中",
    PENDING: "等待计算",
  };
  return map[value] ?? value;
}

function formatTaskKey(value: string) {
  if (!value) {
    return "暂无";
  }
  if (value === "P0_DETERMINISTIC_UTILITY") {
    return "效用结果任务集合";
  }
  return value;
}

function friendlyTaskSet(raw: string) {
  const taskSet = parseJsonArray(raw);
  if (taskSet.length) {
    return taskSet.map((item) => formatTaskKey(String(item))).join("、");
  }
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => formatTaskKey(String(item))).join("、") || "效用结果任务集合";
      }
    } catch {
      return "效用结果任务集合";
    }
  }
  return raw ? formatTaskKey(raw) : "效用结果任务集合";
}

function taskSetCountFromRows(rows: MdsWeightRow[]) {
  const first = rows[0];
  if (!first) {
    return "暂无";
  }
  const raw = rawValue(first.raw, "task_set_json");
  const parsed = parseJsonArray(raw);
  if (parsed.length) {
    return String(parsed.length);
  }
  try {
    const value = JSON.parse(String(raw));
    return Array.isArray(value) ? String(value.length) : "暂无";
  } catch {
    return "暂无";
  }
}

function diffClass(value: string) {
  if (value === "暂无") {
    return "muted";
  }
  const numeric = numericCellValue(value.replace("%", ""));
  if (numeric === null) {
    return "muted";
  }
  if (numeric > 0) {
    return "positive";
  }
  if (numeric < 0) {
    return "negative";
  }
  return "muted";
}

function sankeyRibbonPath(x0: number, y0: number, x1: number, y1: number, width: number) {
  const control = Math.max(80, Math.abs(x1 - x0) * 0.52);
  const half = width / 2;
  return [
    `M ${x0} ${y0 - half}`,
    `C ${x0 + control} ${y0 - half} ${x1 - control} ${y1 - half} ${x1} ${y1 - half}`,
    `L ${x1} ${y1 + half}`,
    `C ${x1 - control} ${y1 + half} ${x0 + control} ${y0 + half} ${x0} ${y0 + half}`,
    "Z",
  ].join(" ");
}

function donutSegmentPath(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
) {
  const safeEnd = Math.min(endAngle, startAngle + 359.99);
  const outerStart = polarPoint(cx, cy, outerRadius, startAngle);
  const outerEnd = polarPoint(cx, cy, outerRadius, safeEnd);
  const innerEnd = polarPoint(cx, cy, innerRadius, safeEnd);
  const innerStart = polarPoint(cx, cy, innerRadius, startAngle);
  const largeArcFlag = safeEnd - startAngle > 180 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function polarPoint(cx: number, cy: number, radius: number, angle: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function shortPartyName(value: string) {
  if (value.length <= 8) {
    return value;
  }
  return `${value.slice(0, 7)}…`;
}
