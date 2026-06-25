import { useEffect, useMemo, useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import { dvasApi } from "../../domain/api";
import type { DataRow } from "../../domain/types";
import {
  cellText,
  hasBackendRows,
  numericCellValue,
  pageRows,
  percentCell,
  weightCell,
} from "../backendPageData";
import type { PageProps } from "../pageTypes";

type UtilityDrawer = "" | "explain" | "detail" | "basis";
type ExplainTab = "overview" | "factor" | "formula" | "version";

interface UtilityViewRow {
  key: string;
  partyName: string;
  contributionText: string;
  qualityText: string;
  usageText: string;
  scenarioText: string;
  utilityText: string;
  contribution: number | null;
  quality: number | null;
  usage: number | null;
  scenario: number | null;
  utility: number | null;
  raw: DataRow;
}

interface FactorDraft {
  key: "usageFactor" | "scenarioFactor";
  label: string;
  value: string;
}

interface ReadonlyFactorDisplay {
  label: string;
  value: string;
  note: string;
}

export function UtilityPage({ route, snapshot, onAction }: PageProps) {
  const pageData = snapshot.pages[route.path];
  const rows = pageRows(pageData);
  const firstRow = rows[0];
  const utilityRows = useMemo(() => rows.map(toUtilityViewRow), [rows]);
  const [selectedKey, setSelectedKey] = useState("");
  const [drawer, setDrawer] = useState<UtilityDrawer>("");
  const [explainTab, setExplainTab] = useState<ExplainTab>("factor");
  const [configOpen, setConfigOpen] = useState(false);
  const [recalcOpen, setRecalcOpen] = useState(false);
  const [confirmRecalc, setConfirmRecalc] = useState(false);
  const [factorDraft, setFactorDraft] = useState<FactorDraft[]>(() => buildFactorDraft(firstRow));
  const [scenario, setScenario] = useState("高质量数据生成");
  const [mode, setMode] = useState("标准模式");
  const [configStatus, setConfigStatus] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [recalcStatus, setRecalcStatus] = useState("");
  const [recalculating, setRecalculating] = useState(false);

  const selectedRow =
    utilityRows.find((row) => row.key === selectedKey) ?? utilityRows[0] ?? null;
  const versionLabel = formatVersion(
    cellText(firstRow, "version_no", cellText(pageData.technicalDetails, "version_no")),
  );
  const participantCount = utilityRows.length ? `${utilityRows.length}` : "暂无";
  const readonlyFactors = useMemo(() => buildReadonlyFactorDisplay(firstRow), [firstRow]);
  const topContributionName = summaryText(pageData.technicalDetails, [
    "top_contribution_party_name",
    "highest_contribution_party_name",
  ]);
  const topContributionValue = summaryPercent(pageData.technicalDetails, [
    "top_contribution_value",
    "highest_contribution_value",
  ]);
  const topUtilityName = summaryText(pageData.technicalDetails, [
    "top_utility_party_name",
    "highest_utility_party_name",
  ]);
  const topUtilityValue = summaryWeight(pageData.technicalDetails, [
    "top_utility_value",
    "highest_utility_value",
  ]);
  const averageUtility = summaryWeight(pageData.technicalDetails, [
    "average_utility_value",
    "avg_utility_value",
  ]);
  const formulaText =
    cellText(firstRow, "formula_text") === "暂无"
      ? "归一化贡献 × 质量因子 × 使用因子 × 场景因子 = 效用值"
      : cellText(firstRow, "formula_text");
  const hasRows = hasBackendRows(pageData);

  useEffect(() => {
    setFactorDraft(buildFactorDraft(firstRow));
  }, [firstRow]);

  function openExplain() {
    setExplainTab("factor");
    setDrawer("explain");
  }

  function openRowDrawer(nextDrawer: UtilityDrawer, row: UtilityViewRow) {
    setSelectedKey(row.key);
    setDrawer(nextDrawer);
  }

  function updateFactor(key: FactorDraft["key"], value: string) {
    setFactorDraft((current) =>
      current.map((item) => (item.key === key ? { ...item, value } : item)),
    );
  }

  async function saveConfig() {
    setSavingConfig(true);
    setConfigStatus("");
    try {
      await dvasApi.saveUtilityFunction({
        configurable_factors: factorDraft.map((item) => ({
          factor_name: item.label,
          display_percent: item.value,
        })),
        factor_sources: {
          contribution: "贡献结果来自上游贡献度计算",
          quality: "质量因子来自质量评估结果",
        },
        scenario,
        mode,
        version_source: versionLabel,
      });
      setConfigStatus("配置已保存，将用于新一轮计算。");
    } catch {
      setConfigStatus("保存失败，请稍后重试。");
    } finally {
      setSavingConfig(false);
    }
  }

  async function startRecalculate() {
    if (!confirmRecalc) {
      return;
    }
    setRecalculating(true);
    setRecalcStatus("");
    try {
      await dvasApi.runContribution();
      await dvasApi.runUtility();
      setRecalcOpen(false);
      setConfirmRecalc(false);
      onAction({ ...actionRegistry["UTIL-009"], requiresConfirmation: false, label: "刷新结果" });
    } catch {
      setRecalcStatus("计算未完成，请检查前置步骤后重试。");
    } finally {
      setRecalculating(false);
    }
  }

  const overlayOpen = Boolean(drawer || configOpen || recalcOpen);

  return (
    <div className={`pageWorkspace utilityWorkbenchPage${overlayOpen ? " utilityOverlayActive" : ""}`}>
      <header className="utilityPageHeader">
        <div>
          <h1>贡献与效用计算</h1>
          <p>查看参与方贡献、效用结果及形成逻辑。</p>
        </div>
        <div className="utilityHeaderActions">
          <button type="button" onClick={openExplain}>查看计算说明</button>
          <button type="button" onClick={() => setConfigOpen(true)}>参数配置</button>
          <button className="primary" type="button" onClick={() => setRecalcOpen(true)}>重新计算</button>
        </div>
      </header>

      <section className="utilityMetricGrid" aria-label="贡献与效用摘要">
        <UtilityMetricCard icon="people" title="参与方数量" value={participantCount} subValue={hasRows ? "个" : ""} />
        <UtilityMetricCard
          icon="trophy"
          title="最高贡献主体"
          value={topContributionName}
          subValue={topContributionValue === "暂无" ? "" : topContributionValue}
        />
        <UtilityMetricCard
          icon="trend"
          title="最高效用主体"
          value={topUtilityName}
          subValue={topUtilityValue === "暂无" ? "" : topUtilityValue}
        />
        <UtilityMetricCard icon="pie" title="平均效用值" value={averageUtility} />
        <UtilityMetricCard icon="code" title="当前函数版本" value={versionLabel} />
      </section>

      <section className="utilityChartGrid">
        <article className="utilityPanel">
          <h2>贡献 → 效用变化图</h2>
          <UtilitySlopeChart
            rows={utilityRows}
            selectedKey={selectedRow?.key ?? ""}
            onSelect={(row) => setSelectedKey(row.key)}
          />
        </article>
        <article className="utilityPanel">
          <h2>参与方表现分布</h2>
          <UtilityBubbleChart
            rows={utilityRows}
            selectedKey={selectedRow?.key ?? ""}
            onSelect={(row) => setSelectedKey(row.key)}
          />
        </article>
      </section>

      <section className="utilityFormulaStrip" aria-label="效用形成逻辑">
        <h2>效用形成逻辑</h2>
        <div className="utilityFormulaItems">
          <span>归一化贡献</span>
          <b>×</b>
          <span>质量因子</span>
          <b>×</b>
          <span>使用因子</span>
          <b>×</b>
          <span className="warm">场景因子</span>
          <b>=</b>
          <span className="result">效用值</span>
        </div>
        <p>效用值用于后续权重与收益分配计算</p>
      </section>

      <section className="utilityPanel utilityTablePanel">
        <div className="utilityPanelHead">
          <h2>参与方明细</h2>
        </div>
        <div className="utilityTableWrap">
          <table className="utilityTable">
            <thead>
              <tr>
                <th>参与方</th>
                <th>归一化贡献</th>
                <th>质量因子</th>
                <th>使用因子</th>
                <th>场景因子</th>
                <th>效用值</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {utilityRows.length ? utilityRows.map((row) => (
                <tr
                  className={selectedRow?.key === row.key ? "selected" : ""}
                  key={row.key}
                  onClick={() => setSelectedKey(row.key)}
                >
                  <td><strong>{row.partyName}</strong></td>
                  <td>{row.contributionText}</td>
                  <td>{row.qualityText}</td>
                  <td>{row.usageText}</td>
                  <td>{row.scenarioText}</td>
                  <td>{row.utilityText}</td>
                  <td>
                    <div className="utilityRowActions">
                      <button type="button" onClick={(event) => {
                        event.stopPropagation();
                        openRowDrawer("detail", row);
                      }}>查看详情</button>
                      <button type="button" onClick={(event) => {
                        event.stopPropagation();
                        openRowDrawer("basis", row);
                      }}>查看依据</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7}><p className="utilityEmpty">暂无</p></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="utilityDisclaimer">
        本系统输出仅作为数据收益分配模拟与审计说明参考，不作为法律结算或付款依据。
      </p>

      {drawer === "explain" ? (
        <UtilityExplainDrawer
          participantCount={participantCount}
          selectedTab={explainTab}
          topParty={topUtilityName}
          versionLabel={versionLabel}
          onClose={() => setDrawer("")}
          onTabChange={setExplainTab}
        />
      ) : null}

      {drawer === "detail" && selectedRow ? (
        <UtilityRowDrawer
          mode="detail"
          row={selectedRow}
          versionLabel={versionLabel}
          formulaText={formulaText}
          onClose={() => setDrawer("")}
        />
      ) : null}

      {drawer === "basis" && selectedRow ? (
        <UtilityRowDrawer
          mode="basis"
          row={selectedRow}
          versionLabel={versionLabel}
          formulaText={formulaText}
          onClose={() => setDrawer("")}
        />
      ) : null}

      {configOpen ? (
        <UtilityConfigModal
          factorDraft={factorDraft}
          mode={mode}
          readonlyFactors={readonlyFactors}
          saving={savingConfig}
          scenario={scenario}
          status={configStatus}
          versionLabel={versionLabel}
          onClose={() => setConfigOpen(false)}
          onModeChange={setMode}
          onReset={() => {
            setFactorDraft(buildFactorDraft(firstRow));
            setConfigStatus("已恢复为当前显示值。");
          }}
          onSave={saveConfig}
          onScenarioChange={setScenario}
          onUpdateFactor={updateFactor}
        />
      ) : null}

      {recalcOpen ? (
        <UtilityRecalculateModal
          checked={confirmRecalc}
          participantCount={participantCount}
          packageName={snapshot.scenarioName || snapshot.projectName}
          scenario={scenario}
          status={recalcStatus}
          versionLabel={versionLabel}
          working={recalculating}
          onCheckedChange={setConfirmRecalc}
          onClose={() => setRecalcOpen(false)}
          onHistory={() => setRecalcStatus("历史版本入口暂未启用。")}
          onStart={startRecalculate}
        />
      ) : null}
    </div>
  );
}

function UtilityMetricCard({
  icon,
  title,
  value,
  subValue,
}: {
  icon: "people" | "trophy" | "trend" | "pie" | "code";
  title: string;
  value: string;
  subValue?: string;
}) {
  return (
    <article className={`utilityMetricCard ${icon}`}>
      <span className="utilityMetricIcon">{metricGlyphs[icon]}</span>
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        {subValue ? <small>{subValue}</small> : null}
      </div>
    </article>
  );
}

const metricGlyphs = {
  people: "人",
  trophy: "奖",
  trend: "效",
  pie: "均",
  code: "版",
};

function UtilitySlopeChart({
  rows,
  selectedKey,
  onSelect,
}: {
  rows: UtilityViewRow[];
  selectedKey: string;
  onSelect: (row: UtilityViewRow) => void;
}) {
  const visibleRows = rows.slice(0, 6);
  if (!visibleRows.length) {
    return <p className="utilityEmpty chart">暂无</p>;
  }

  const top = 42;
  const rowGap = 42;
  const leftX = 282;
  const rightX = 462;
  const height = Math.max(250, top * 2 + rowGap * visibleRows.length);
  return (
    <div className="utilitySlopeChart">
      <div className="utilitySlopeLabels">
        <span />
        <span>归一化贡献</span>
        <span>效用值</span>
      </div>
      <svg viewBox={`0 0 560 ${height}`} aria-label="贡献到效用变化">
        {visibleRows.map((row, index) => {
          const y = top + index * rowGap;
          const active = row.key === selectedKey;
          return (
            <g
              className={active ? "active" : ""}
              key={row.key}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(row)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(row);
                }
              }}
            >
              <title>{tooltipText(row)}</title>
              <text className="party" x="12" y={y + 4}>{row.partyName}</text>
              <text className="value" x="192" y={y + 4}>{row.contributionText}</text>
              <line x1={leftX} x2={rightX} y1={y} y2={y + utilityDelta(row)} />
              <circle cx={leftX} cy={y} r="6" />
              <circle cx={rightX} cy={y + utilityDelta(row)} r="6" />
              <text className="utility" x="496" y={y + utilityDelta(row) + 4}>{row.utilityText}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function UtilityBubbleChart({
  rows,
  selectedKey,
  onSelect,
}: {
  rows: UtilityViewRow[];
  selectedKey: string;
  onSelect: (row: UtilityViewRow) => void;
}) {
  const visibleRows = rows.slice(0, 6);
  if (!visibleRows.length) {
    return <p className="utilityEmpty chart">暂无</p>;
  }
  return (
    <div className="utilityBubbleWrap">
      <div className="utilityBubblePlot" aria-label="参与方表现分布">
        <span className="axisLabel y">效用值</span>
        <span className="axisLabel x">归一化贡献</span>
        {visibleRows.map((row) => {
          const x = clampPercent(row.contribution, 0.7);
          const y = 100 - clampPercent(row.utility, 0.65);
          const active = row.key === selectedKey;
          return (
            <button
              className={`utilityBubblePoint quality${qualityBucket(row.quality)}${active ? " active" : ""}`}
              data-tooltip={tooltipText(row)}
              key={row.key}
              style={{ left: `${x}%`, top: `${y}%` }}
              type="button"
              onClick={() => onSelect(row)}
            >
              <span>{row.partyName}</span>
            </button>
          );
        })}
      </div>
      <aside className="utilityBubbleLegend">
        <strong>数据规模</strong>
        <p><i className="large" />大</p>
        <p><i className="medium" />中</p>
        <p><i className="small" />小</p>
        <strong>质量因子</strong>
        <p><b className="quality5" />高</p>
        <p><b className="quality4" />较高</p>
        <p><b className="quality3" />中</p>
        <p><b className="quality2" />较低</p>
        <p><b className="quality1" />低</p>
      </aside>
    </div>
  );
}

function UtilityExplainDrawer({
  participantCount,
  selectedTab,
  topParty,
  versionLabel,
  onClose,
  onTabChange,
}: {
  participantCount: string;
  selectedTab: ExplainTab;
  topParty: string;
  versionLabel: string;
  onClose: () => void;
  onTabChange: (tab: ExplainTab) => void;
}) {
  const tabs: Array<[ExplainTab, string]> = [
    ["overview", "总览"],
    ["factor", "因子说明"],
    ["formula", "计算口径"],
    ["version", "版本记录"],
  ];
  return (
    <aside className="utilityDrawer" aria-label="计算说明">
      <section className="utilityDrawerPanel explain">
        <header>
          <div>
            <h2>计算说明</h2>
            <p>贡献与效用形成逻辑与参数口径</p>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </header>
        <div className="utilityDrawerSummary">
          <article><span>当前版本</span><strong>{versionLabel}</strong></article>
          <article><span>参与方数量</span><strong>{participantCount}</strong></article>
          <article><span>最高效用主体</span><strong>{topParty}</strong></article>
        </div>
        <nav className="utilityDrawerTabs">
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
        <div className="utilityExplainBody">
          {selectedTab === "factor" ? <UtilityFactorCards /> : null}
          {selectedTab === "overview" ? (
            <p className="utilityExplainText">效用值用于解释贡献结果进入后续权重与收益分配前的形成过程。</p>
          ) : null}
          {selectedTab === "formula" ? (
            <div className="utilityFormulaCompact">
              <span>归一化贡献</span><b>×</b><span>质量因子</span><b>×</b><span>使用因子</span><b>×</b><span>场景因子</span><b>=</b><span>效用值</span>
            </div>
          ) : null}
          {selectedTab === "version" ? (
            <p className="utilityExplainText">当前页面展示当前版本结果；历史版本入口按后续版本扩展。</p>
          ) : null}
        </div>
        <div className="utilityDrawerFormula">
          <span>归一化贡献</span><b>×</b><span>质量因子</span><b>×</b><span>使用因子</span><b>×</b><span>场景因子</span><b>=</b><span>效用值</span>
        </div>
        <footer>
          <button disabled title="当前版本暂未启用" type="button">导出说明</button>
          <button className="primary" type="button" onClick={onClose}>关闭</button>
        </footer>
      </section>
    </aside>
  );
}

function UtilityFactorCards() {
  const factors = [
    ["归一化贡献", "衡量参与方在数据资源贡献中的相对比例，归一化处理后总和为 100%。"],
    ["质量因子", "来自质量评估结果，用于修正贡献。"],
    ["使用因子", "反映数据被实际使用的程度与频率。"],
    ["场景因子", "反映数据在具体业务场景中的重要性与价值。"],
  ];
  return (
    <div className="utilityFactorCards">
      {factors.map(([title, body], index) => (
        <article key={title}>
          <span>{index + 1}</span>
          <div>
            <h3>{title}</h3>
            <p>{body}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function UtilityRowDrawer({
  mode,
  row,
  versionLabel,
  formulaText,
  onClose,
}: {
  mode: "detail" | "basis";
  row: UtilityViewRow;
  versionLabel: string;
  formulaText: string;
  onClose: () => void;
}) {
  const title = mode === "detail" ? "参与方详情" : "计算依据";
  return (
    <aside className="utilityDrawer" aria-label={title}>
      <section className="utilityDrawerPanel compact">
        <header>
          <div>
            <h2>{title}</h2>
            <p>{row.partyName}</p>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </header>
        {mode === "detail" ? (
          <>
            <div className="utilityDetailGrid">
              <article><span>归一化贡献</span><strong>{row.contributionText}</strong></article>
              <article><span>质量因子</span><strong>{row.qualityText}</strong></article>
              <article><span>使用因子</span><strong>{row.usageText}</strong></article>
              <article><span>场景因子</span><strong>{row.scenarioText}</strong></article>
              <article><span>效用值</span><strong>{row.utilityText}</strong></article>
            </div>
            <div className="utilityStepFlow">
              <span>归一化贡献</span><i />
              <span>质量修正</span><i />
              <span>使用修正</span><i />
              <span>场景修正</span><i />
              <span>最终效用值</span>
            </div>
            <p className="utilityExplainText">{formulaText}</p>
          </>
        ) : (
          <div className="utilityBasisList">
            <p><span>贡献来源</span><strong>{row.contributionText}</strong></p>
            <p><span>质量修正来源</span><strong>{row.qualityText}</strong></p>
            <p><span>使用因子来源</span><strong>{row.usageText}</strong></p>
            <p><span>场景因子来源</span><strong>{row.scenarioText}</strong></p>
            <p><span>参数版本</span><strong>{versionLabel}</strong></p>
            <p><span>结果版本</span><strong>{cellText(row.raw, "created_at")}</strong></p>
          </div>
        )}
        <footer>
          <button className="primary" type="button" onClick={onClose}>关闭</button>
        </footer>
      </section>
    </aside>
  );
}

function UtilityConfigModal({
  factorDraft,
  mode,
  readonlyFactors,
  saving,
  scenario,
  status,
  versionLabel,
  onClose,
  onModeChange,
  onReset,
  onSave,
  onScenarioChange,
  onUpdateFactor,
}: {
  factorDraft: FactorDraft[];
  mode: string;
  readonlyFactors: ReadonlyFactorDisplay[];
  saving: boolean;
  scenario: string;
  status: string;
  versionLabel: string;
  onClose: () => void;
  onModeChange: (value: string) => void;
  onReset: () => void;
  onSave: () => void;
  onScenarioChange: (value: string) => void;
  onUpdateFactor: (key: FactorDraft["key"], value: string) => void;
}) {
  return (
    <div className="utilityModalBackdrop">
      <section className="utilityConfigModal" role="dialog" aria-modal="true" aria-label="贡献与效用参数配置">
        <header>
          <div>
            <h2>贡献与效用参数配置</h2>
            <p>查看效用形成来源，并配置新一轮效用计算参数。</p>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </header>
        <section className="utilityConfigBlock">
          <div className="utilityBlockHead">
            <h3>来源口径</h3>
            <span>贡献与质量结果不可在此直接编辑</span>
          </div>
          <div className="utilityReadonlyFactors">
            {readonlyFactors.map((item) => (
              <article key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.note}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="utilityConfigBlock">
          <div className="utilityBlockHead">
            <h3>可配置项</h3>
            <span>使用因子和场景因子可用于新一轮效用计算</span>
          </div>
          <p className="utilityConfigHint">贡献结果来自上游贡献度计算；质量因子来自质量评估结果。</p>
          <div className="utilityFactorConfig">
            {factorDraft.map((item) => (
              <label key={item.key}>
                <span>{item.label}</span>
                <input
                  value={item.value}
                  onChange={(event) => onUpdateFactor(item.key, event.target.value)}
                />
                <input
                  min="0"
                  max="100"
                  type="range"
                  value={sliderValue(item.value)}
                  onChange={(event) => onUpdateFactor(item.key, event.target.value)}
                />
                <strong>{formatPercentDraft(item.value)}</strong>
              </label>
            ))}
          </div>
        </section>
        <section className="utilityConfigBlock scenario">
          <h3>场景配置</h3>
          <label>
            <span>应用场景</span>
            <select value={scenario} onChange={(event) => onScenarioChange(event.target.value)}>
              <option>高质量数据生成</option>
              <option>标准数据价值评估</option>
            </select>
          </label>
          <label>
            <span>使用模式</span>
            <select value={mode} onChange={(event) => onModeChange(event.target.value)}>
              <option>标准模式</option>
              <option>审计说明模式</option>
            </select>
          </label>
        </section>
        <section className="utilityConfigBlock">
          <h3>版本与校验</h3>
          <div className="utilityVersionSource">
            <article>
              <span>效用函数版本</span>
              <strong>{versionLabel}</strong>
            </article>
            <article>
              <span>配置来源</span>
              <strong>当前效用结果</strong>
            </article>
          </div>
          <div className="utilityCheckGrid">
            <UtilityCheckItem label="参数结构完整" />
            <UtilityCheckItem label="权重口径合法" />
            <UtilityCheckItem label="可保存为新版本" />
          </div>
        </section>
        {status ? <p className="utilityStatusText">{status}</p> : null}
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

function UtilityRecalculateModal({
  checked,
  packageName,
  participantCount,
  scenario,
  status,
  versionLabel,
  working,
  onCheckedChange,
  onClose,
  onHistory,
  onStart,
}: {
  checked: boolean;
  packageName: string;
  participantCount: string;
  scenario: string;
  status: string;
  versionLabel: string;
  working: boolean;
  onCheckedChange: (checked: boolean) => void;
  onClose: () => void;
  onHistory: () => void;
  onStart: () => void;
}) {
  return (
    <div className="utilityModalBackdrop">
      <section className="utilityRecalcModal" role="dialog" aria-modal="true" aria-label="重新计算贡献与效用">
        <header>
          <div>
            <h2>重新计算贡献与效用</h2>
            <p>将生成新的计算结果，不覆盖历史版本。</p>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </header>
        <section className="utilityRecalcSteps">
          <UtilityStep
            index="1"
            title="计算对象"
            rows={[
              ["数据包名称", packageName],
              ["参与方数量", participantCount],
            ]}
          />
          <UtilityStep
            index="2"
            title="使用配置"
            rows={[
              ["当前函数版本", versionLabel],
              ["场景", scenario],
            ]}
          />
          <UtilityStep
            index="3"
            title="执行结果"
            rows={[["生成内容", "贡献度、效用值、计算依据和结果快照"]]}
          />
        </section>
        <section className="utilityPrecheck">
          <h3>预检查</h3>
          <UtilityCheckItem label="参与方数据已就绪" />
          <UtilityCheckItem label="因子参数已配置" />
          <UtilityCheckItem label="可生成新版本" />
        </section>
        <label className="utilityConfirm">
          <input
            checked={checked}
            type="checkbox"
            onChange={(event) => onCheckedChange(event.target.checked)}
          />
          我已确认重新计算将生成新的结果版本
        </label>
        {status ? <p className="utilityStatusText">{status}</p> : null}
        <footer>
          <button className="ghost" type="button" onClick={onHistory}>查看历史版本</button>
          <button type="button" onClick={onClose}>取消</button>
          <button className="primary" disabled={!checked || working} type="button" onClick={onStart}>
            {working ? "计算中" : "开始计算"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function UtilityStep({ index, title, rows }: { index: string; title: string; rows: string[][] }) {
  return (
    <article>
      <span>{index}</span>
      <div>
        <h3>{title}</h3>
        {rows.map(([label, value]) => (
          <p key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </p>
        ))}
      </div>
    </article>
  );
}

function UtilityCheckItem({ label }: { label: string }) {
  return (
    <div className="utilityCheckItem">
      <span>✓</span>
      <strong>{label}</strong>
      <small>通过</small>
    </div>
  );
}

function toUtilityViewRow(row: DataRow, index: number): UtilityViewRow {
  const contribution = numericCellValue(row.normalized_contribution);
  const quality = numericCellValue(row.quality_factor);
  const usage = numericCellValue(row.usage_factor);
  const scenario = numericCellValue(row.scenario_factor);
  const utility = numericCellValue(row.utility_value);
  return {
    key: cellText(row, "trace_id", `${index}`),
    partyName: cellText(row, "party_name"),
    contributionText: percentCell(row, "normalized_contribution"),
    qualityText: weightCell(row, "quality_factor"),
    usageText: weightCell(row, "usage_factor"),
    scenarioText: weightCell(row, "scenario_factor"),
    utilityText: weightCell(row, "utility_value"),
    contribution,
    quality,
    usage,
    scenario,
    utility,
    raw: row,
  };
}

function buildFactorDraft(row: DataRow | undefined): FactorDraft[] {
  return [
    {
      key: "usageFactor",
      label: "使用因子",
      value: percentNumber(row, "usage_factor"),
    },
    {
      key: "scenarioFactor",
      label: "场景因子",
      value: percentNumber(row, "scenario_factor"),
    },
  ];
}

function buildReadonlyFactorDisplay(row: DataRow | undefined): ReadonlyFactorDisplay[] {
  return [
    {
      label: "归一化贡献",
      value: percentCell(row, "normalized_contribution"),
      note: "贡献结果来自上游贡献度计算",
    },
    {
      label: "质量因子",
      value: weightCell(row, "quality_factor"),
      note: "质量因子来自质量评估结果",
    },
  ];
}

function summaryText(row: DataRow | undefined, keys: string[]) {
  for (const key of keys) {
    const value = cellText(row, key);
    if (value !== "暂无") {
      return value;
    }
  }
  return "暂无";
}

function summaryPercent(row: DataRow | undefined, keys: string[]) {
  for (const key of keys) {
    const value = percentCell(row, key);
    if (value !== "暂无") {
      return value;
    }
  }
  return "暂无";
}

function summaryWeight(row: DataRow | undefined, keys: string[]) {
  for (const key of keys) {
    const value = weightCell(row, key);
    if (value !== "暂无") {
      return value;
    }
  }
  return "暂无";
}

function percentNumber(row: DataRow | undefined, key: string) {
  const numeric = numericCellValue(row?.[key]);
  if (numeric === null) {
    return "";
  }
  return trimNumeric(numeric * 100);
}

function trimNumeric(value: number) {
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function formatVersion(value: string) {
  if (!value || value === "暂无") {
    return "暂无";
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `V${numeric}.0` : value;
}

function sliderValue(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(numeric, 100)) : 0;
}

function formatPercentDraft(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${trimNumeric(numeric)}%` : "暂无";
}

function tooltipText(row: UtilityViewRow) {
  return `${row.partyName} · 归一化贡献 ${row.contributionText} · 质量因子 ${row.qualityText} · 使用因子 ${row.usageText} · 场景因子 ${row.scenarioText} · 效用值 ${row.utilityText}`;
}

function utilityDelta(row: UtilityViewRow) {
  if (row.contribution === null || row.utility === null) {
    return 0;
  }
  return Math.max(-26, Math.min(26, (row.contribution - row.utility) * 80));
}

function clampPercent(value: number | null, max: number) {
  if (value === null || max <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function qualityBucket(value: number | null) {
  if (value === null) {
    return 3;
  }
  if (value >= 0.99) {
    return 5;
  }
  if (value >= 0.98) {
    return 4;
  }
  if (value >= 0.97) {
    return 3;
  }
  if (value >= 0.96) {
    return 2;
  }
  return 1;
}
