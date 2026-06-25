import { useEffect, useMemo, useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import { dvasApi } from "../../domain/api";
import type { DataRow } from "../../domain/types";
import { cellText, hasBackendRows, pageMetrics, pageRows } from "../backendPageData";
import type { PageProps } from "../pageTypes";

interface WeightItem {
  metricCode: string;
  metricName: string;
  metricLevel: number;
  parentMetricCode: string;
  weight: string;
}

interface ResourceScoreRow {
  key: string;
  resourceName: string;
  ownerName: string;
  resourceType: string;
  totalScore: string;
  qualityLevel: string;
  minPrimaryMetric: string;
  updateTime: string;
  raw: DataRow;
}

type EvidenceTab = "overview" | "primary" | "secondary" | "evidence";
type ResourceSortKey = "score_desc" | "score_asc" | "level" | "lowest_metric";

export function QualityPage({ snapshot, onAction }: PageProps) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [allResourcesOpen, setAllResourcesOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);
  const [reassessOpen, setReassessOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<EvidenceTab>("evidence");
  const [selectedResource, setSelectedResource] = useState<ResourceScoreRow | null>(null);
  const [resourceSearch, setResourceSearch] = useState("");
  const [resourceSort, setResourceSort] = useState<ResourceSortKey>("score_desc");
  const [confirmReassess, setConfirmReassess] = useState(false);
  const [weights, setWeights] = useState<WeightItem[]>([]);
  const [weightDraft, setWeightDraft] = useState<WeightItem[]>([]);
  const [selectedPrimaryCode, setSelectedPrimaryCode] = useState("");
  const [weightStatus, setWeightStatus] = useState("");
  const [weightLoading, setWeightLoading] = useState(false);
  const [weightSaving, setWeightSaving] = useState(false);

  const pageData = snapshot.pages["/metering/quality"];
  const resourcePageData = snapshot.pages["/data/resources"];
  const packagePageData = snapshot.pages["/data/ingestion"];
  const rows = pageRows(pageData);
  const resourceRows = pageRows(resourcePageData);
  const packageRows = pageRows(packagePageData);
  const firstRow = rows[0];
  const metrics = pageMetrics(pageData);
  const metricMap = new Map(metrics.map((item) => [item.label, item]));
  const hasResults = hasBackendRows(pageData);
  const scoreValue = metricMap.get("质量总分")?.value ?? cellText(firstRow, "quality_score");
  const levelValue = metricMap.get("质量等级")?.value ?? cellText(firstRow, "quality_level");
  const packageName = cellText(packageRows[0], "package_name", snapshot.projectName);
  const resourceCountFromSummary =
    pageMetrics(resourcePageData).find((item) => item.label.includes("资源"))?.value ?? "暂无";
  const evaluatedResourceCount = hasResults ? resourceCountFromSummary : "暂无";
  const packageDetailRows = rows.filter(
    (row) => !rawCell(row, "resource_id") && rawCell(row, "metric_code"),
  );
  const resourceDetailRows = rows.filter(
    (row) => rawCell(row, "resource_id") && rawCell(row, "metric_code") && rawCell(row, "metric_level"),
  );
  const primaryDetails = packageDetailRows.filter((row) => cellText(row, "metric_level") === "1");
  const secondaryDetails = packageDetailRows.filter((row) => cellText(row, "metric_level") === "2");
  const primaryMetrics = useMemo(() => {
    const weightPrimary = weights.filter((item) => item.metricLevel === 1);
    if (weightPrimary.length) {
      return weightPrimary;
    }
    return primaryDetails.map((row) => ({
      metricCode: cellText(row, "metric_code", cellText(row, "dimension_code")),
      metricName: cellText(row, "metric_name", cellText(row, "dimension_name")),
      metricLevel: 1,
      parentMetricCode: "",
      weight: cellText(row, "dimension_weight"),
    }));
  }, [primaryDetails, weights]);
  const selectedPrimary = weightDraft.find((item) => item.metricCode === selectedPrimaryCode)
    ?? weightDraft.find((item) => item.metricLevel === 1)
    ?? null;
  const selectedSecondaryWeights = weightDraft.filter(
    (item) => item.metricLevel === 2 && item.parentMetricCode === selectedPrimary?.metricCode,
  );
  const primaryWeightTotal = sumWeight(weightDraft.filter((item) => item.metricLevel === 1));
  const secondaryWeightTotal = sumWeight(selectedSecondaryWeights);
  const resourceScoreRows = useMemo(
    () => buildResourceRows(rows, resourceRows),
    [resourceRows, rows],
  );
  const firstResource = selectedResource ?? resourceScoreRows[0] ?? null;
  const selectedResourceId = firstResource ? rawCell(firstResource.raw, "resource_id") || firstResource.key : "";
  const selectedResourceDetails = resourceDetailRows.filter(
    (row) => rawCell(row, "resource_id") === selectedResourceId,
  );
  const selectedPrimaryDetails = selectedResourceDetails.filter((row) => cellText(row, "metric_level") === "1");
  const selectedSecondaryDetails = selectedResourceDetails.filter((row) => cellText(row, "metric_level") === "2");
  const evidenceRows = primaryDetails.length ? primaryDetails : rows;
  const drawerOverviewRows = selectedResourceDetails.length ? selectedResourceDetails : rows;
  const drawerPrimaryRows = selectedPrimaryDetails.length ? selectedPrimaryDetails : primaryDetails;
  const drawerSecondaryRows = selectedSecondaryDetails.length ? selectedSecondaryDetails : secondaryDetails;
  const drawerEvidenceRows = selectedResourceDetails.length ? selectedResourceDetails : evidenceRows;
  const resourceScorePoints = resourceScoreRows
    .filter((row) => numericCellValue(row.totalScore) !== null)
    .slice(0, 8);
  const sortedResourceRows = useMemo(
    () => filterAndSortResourceRows(resourceScoreRows, resourceSearch, resourceSort),
    [resourceScoreRows, resourceSearch, resourceSort],
  );
  const heatmapResourceLimit = Math.min(resourceScoreRows.length, 6);
  const scoreOverviewLimit = Math.min(resourceScorePoints.length, 8);
  const drawerAssessmentId = firstResource
    ? cellText(firstResource.raw, "assessment_id", cellText(firstRow, "assessment_id"))
    : cellText(firstRow, "assessment_id");
  const drawerResourceId = firstResource ? selectedResourceId : "暂无";
  const drawerScoreValue = firstResource?.totalScore || scoreValue;
  const drawerLevelValue = firstResource?.qualityLevel || levelValue;
  const reassessPrechecks = [
    {
      label: "数据包已接入",
      passed: pageData.preconditions.some((item) => item.name === "输入快照" && item.status === "PASS"),
    },
    {
      label: "指标权重合法",
      passed: weights.length > 0,
    },
    {
      label: "可生成新版本",
      passed: true,
    },
  ];

  useEffect(() => {
    let active = true;
    setWeightLoading(true);
    dvasApi.getQualityWeights()
      .then((payload) => {
        if (!active) {
          return;
        }
        const parsed = parseWeightItems(payload);
        setWeights(parsed);
        setWeightDraft(parsed);
        setSelectedPrimaryCode(parsed.find((item) => item.metricLevel === 1)?.metricCode ?? "");
        setWeightStatus(parsed.length ? "" : "暂无权重配置");
      })
      .catch(() => {
        if (active) {
          setWeightStatus("暂未获取指标配置");
        }
      })
      .finally(() => {
        if (active) {
          setWeightLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  function openEvidence(resource?: ResourceScoreRow) {
    setSelectedResource(resource ?? firstResource);
    setActiveTab("evidence");
    setEvidenceOpen(true);
  }

  function openScoreDetail(resource: ResourceScoreRow) {
    setSelectedResource(resource);
    setActiveTab("primary");
    setEvidenceOpen(true);
    setAllResourcesOpen(false);
  }

  function updateWeight(metricCode: string, value: string) {
    setWeightDraft((current) =>
      current.map((item) => (item.metricCode === metricCode ? { ...item, weight: value } : item)),
    );
  }

  async function saveWeights() {
    if (Math.abs(primaryWeightTotal - 1) > 0.000001 || Math.abs(secondaryWeightTotal - 1) > 0.000001) {
      setWeightStatus("权重合计需为 1");
      return;
    }
    setWeightSaving(true);
    setWeightStatus("");
    try {
      const saved = await dvasApi.saveQualityWeights({
        items: weightDraft.map((item) => ({
          metric_code: item.metricCode,
          weight: Number(item.weight),
        })),
      });
      const parsed = parseWeightItems(saved);
      setWeights(parsed);
      setWeightDraft(parsed);
      setWeightStatus("配置已保存");
    } catch {
      setWeightStatus("保存失败，请稍后重试");
    } finally {
      setWeightSaving(false);
    }
  }

  function resetDraftToCurrent() {
    setWeightDraft(weights);
    setWeightStatus(weights.length ? "已恢复为当前配置" : "暂无可恢复配置");
  }

  function startReassess() {
    if (!confirmReassess) {
      return;
    }
    onAction(actionRegistry["QUAL-009"]);
    setReassessOpen(false);
    setConfirmReassess(false);
  }

  return (
    <div className="pageWorkspace qualityManagePage">
      <header className="qualityPageHeader">
        <div>
          <h1>评估数据质量</h1>
          <p>查看整体质量评分、每个数据资源的评分，以及一级/二级指标明细。</p>
        </div>
        <div className="qualityHeaderActions">
          <button type="button" onClick={() => openEvidence()}>
            查看证据
          </button>
          <button type="button" onClick={() => setWeightOpen(true)}>
            参数配置
          </button>
          <button className="primary" type="button" onClick={() => setReassessOpen(true)}>
            重新评估
          </button>
        </div>
      </header>

      <section className="qualityMetricStrip" aria-label="质量摘要">
        <QualityMetric label="当前数据包总评分" value={scoreValue} />
        <QualityMetric label="质量等级" value={levelValue} />
        <QualityMetric label="已评估资源数" value={evaluatedResourceCount} />
        <QualityMetric label="平均资源评分" value={cellText(firstRow, "avg_resource_score")} />
        <QualityMetric label="低分资源数" value={cellText(firstRow, "low_score_resource_count")} tone="risk" />
      </section>

      <section className="qualityChartRow">
        <article className="qualityPanel">
          <div className="qualityPanelHead">
            <div>
              <h2>数据资源评分总览</h2>
              <p>当前摘要展示前 {scoreOverviewLimit} 条，共 {resourceScoreRows.length} 条资源。</p>
            </div>
            <button type="button" onClick={() => setAllResourcesOpen(true)}>
              查看全部资源评分
            </button>
          </div>
          {resourceScorePoints.length ? (
            <div className="qualityResourceBars">
              {resourceScorePoints.map((row) => {
                const score = numericCellValue(row.totalScore);
                return (
                  <button
                    className="qualityResourceBar"
                    data-tooltip={`${row.resourceName} · 总分 ${row.totalScore} · 等级 ${row.qualityLevel} · ${row.ownerName}`}
                    key={row.key}
                    type="button"
                    onClick={() => openEvidence(row)}
                  >
                    <span title={row.resourceName}>{row.resourceName}</span>
                    <div><i style={{ width: `${Math.max(4, Math.min(score ?? 0, 100))}%` }} /></div>
                    <strong>{row.totalScore}</strong>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="qualityEmpty">暂无资源级评分</p>
          )}
        </article>

        <article className="qualityPanel">
          <div className="qualityPanelHead">
            <div>
              <h2>资源 × 一级指标热力图</h2>
              <p>当前热力图展示前 {heatmapResourceLimit} 条资源，悬停可查看后端真实分数。</p>
            </div>
            <button type="button" onClick={() => setAllResourcesOpen(true)}>
              查看全部资源评分
            </button>
          </div>
          <QualityHeatmap
            metrics={primaryMetrics}
            resources={resourceScoreRows}
            onSelect={openEvidence}
          />
        </article>
      </section>

      <section className="qualityPanel qualityTablePanel">
        <div className="qualityPanelHead">
          <h2>资源评分明细</h2>
        </div>
        <div className="qualityTableWrap">
          <table className="qualityTable">
            <thead>
              <tr>
                <th>数据资源名称</th>
                <th>所属参与方</th>
                <th>资源类型</th>
                <th>总评分</th>
                <th>质量等级</th>
                <th>最低一级指标</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {resourceScoreRows.length ? resourceScoreRows.map((row) => (
                <tr key={row.key}>
                  <td><strong>{row.resourceName}</strong></td>
                  <td>{row.ownerName}</td>
                  <td>{row.resourceType}</td>
                  <td>{row.totalScore}</td>
                  <td>{row.qualityLevel}</td>
                  <td>{row.minPrimaryMetric}</td>
                  <td>{row.updateTime}</td>
                  <td>
                    <div className="qualityRowActions">
                      <button type="button" onClick={() => openScoreDetail(row)}>查看评分</button>
                      <button type="button" onClick={() => openEvidence(row)}>查看证据</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8}>
                    <p className="qualityTableEmpty">暂无资源评分明细</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="qualityDisclaimer">
        本系统输出仅作为数据收益分配模拟与审计说明参考，不作为法律结算或付款依据。
      </p>

      {allResourcesOpen ? (
        <AllResourcesDrawer
          query={resourceSearch}
          resources={sortedResourceRows}
          sort={resourceSort}
          totalCount={resourceScoreRows.length}
          onClose={() => setAllResourcesOpen(false)}
          onQueryChange={setResourceSearch}
          onSelect={openScoreDetail}
          onSortChange={setResourceSort}
        />
      ) : null}

      {evidenceOpen ? (
        <aside className="qualityEvidenceDrawer" aria-label="证据说明">
          <div className="qualityEvidencePanel">
            <header>
              <div>
                <h2>资源评分详情</h2>
                <p>{firstResource?.resourceName ?? "暂无选中资源"}</p>
              </div>
              <button type="button" onClick={() => setEvidenceOpen(false)}>×</button>
            </header>
            <section className="qualityDrawerSummary">
              <QualityMiniMetric label="资源总评分" value={drawerScoreValue} />
              <QualityMiniMetric label="质量等级" value={drawerLevelValue} />
              <QualityMiniMetric label="评估时间" value={compactDateTime(cellText(firstRow, "created_at"))} />
            </section>
            <section className="qualityDrawerMeta">
              <p><span>assessment_id</span><strong>{displayText(drawerAssessmentId)}</strong></p>
              <p><span>resource_id</span><strong>{displayText(drawerResourceId)}</strong></p>
            </section>
            <nav className="qualityDrawerTabs">
              {[
                ["overview", "总览"],
                ["primary", "一级指标"],
                ["secondary", "二级指标"],
                ["evidence", "证据说明"],
              ].map(([key, label]) => (
                <button
                  className={activeTab === key ? "active" : ""}
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key as EvidenceTab)}
                >
                  {label}
                </button>
              ))}
            </nav>
            <div className="qualityDrawerBody">
              {activeTab === "overview" ? (
                <QualityDetailTable rows={drawerOverviewRows} mode="overview" />
              ) : null}
              {activeTab === "primary" ? (
                <QualityDetailTable rows={drawerPrimaryRows} mode="primary" />
              ) : null}
              {activeTab === "secondary" ? (
                <QualityDetailTable rows={drawerSecondaryRows} mode="secondary" />
              ) : null}
              {activeTab === "evidence" ? (
                <EvidenceTable rows={drawerEvidenceRows} />
              ) : null}
            </div>
            <footer>
              <button disabled title="当前版本暂未提供导出说明接口" type="button">导出说明</button>
              <button type="button" onClick={() => setEvidenceOpen(false)}>关闭</button>
            </footer>
          </div>
        </aside>
      ) : null}

      {weightOpen ? (
        <div className="qualityModalBackdrop" role="presentation">
          <section className="qualityWeightModal" role="dialog" aria-modal="true" aria-label="质量指标权重配置">
            <header>
              <h2>质量指标权重配置</h2>
              <button type="button" onClick={() => setWeightOpen(false)}>×</button>
            </header>
            <div className="qualityWeightBody">
              <section className="qualityWeightBlock">
                <h3>一级指标权重配置</h3>
                <WeightTable
                  items={weightDraft.filter((item) => item.metricLevel === 1)}
                  onSelect={(item) => setSelectedPrimaryCode(item.metricCode)}
                  onWeightChange={updateWeight}
                  selectedCode={selectedPrimary?.metricCode ?? ""}
                />
                <p className={Math.abs(primaryWeightTotal - 1) > 0.000001 ? "weightHint invalid" : "weightHint"}>
                  一级指标权重合计必须为 1
                </p>
              </section>
              <section className="qualityWeightBlock">
                <div className="qualityWeightAccordion">
                  <button type="button">
                    查看二级指标权重
                    <span>⌄</span>
                  </button>
                  {selectedPrimary ? (
                    <strong>{selectedPrimary.metricName}（权重 {formatWeight(selectedPrimary.weight)}）</strong>
                  ) : null}
                </div>
                <WeightTable
                  items={selectedSecondaryWeights}
                  onWeightChange={updateWeight}
                  selectedCode=""
                />
              </section>
            </div>
            <div className="qualityWeightTotal">
              <strong>当前合计：{secondaryWeightTotal.toFixed(2)}</strong>
              <span>{weightLoading ? "正在获取配置" : weightStatus}</span>
            </div>
            <footer>
              <button type="button" onClick={resetDraftToCurrent}>恢复默认</button>
              <button type="button" onClick={() => setWeightOpen(false)}>取消</button>
              <button className="primary" disabled={weightSaving || !weightDraft.length} type="button" onClick={saveWeights}>
                {weightSaving ? "保存中" : "保存配置"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {reassessOpen ? (
        <div className="qualityModalBackdrop" role="presentation">
          <section className="qualityReassessModal" role="dialog" aria-modal="true" aria-label="重新发起质量评估">
            <header>
              <h2>重新发起质量评估</h2>
              <button type="button" onClick={() => setReassessOpen(false)}>×</button>
            </header>
            <p>请确认以下信息，评估将生成新版本，不会覆盖历史结果。</p>
            <section className="qualityReassessSteps">
              <QualityStep
                index="1"
                title="评估对象"
                rows={[
                  ["数据包名称", packageName],
                  ["已选择资源数", String(resourceCountFromSummary)],
                ]}
              />
              <QualityStep
                index="2"
                title="评估版本"
                rows={[["版本说明", "将生成新评估版本"]]}
              />
              <QualityStep
                index="3"
                title="使用指标体系"
                rows={[
                  ["一级指标数量", cellText(firstRow, "primary_metric_count", String(primaryMetrics.length || "暂无"))],
                  ["二级指标数量", cellText(firstRow, "secondary_metric_count", String(secondaryDetails.length || "暂无"))],
                ]}
              />
              <QualityStep
                index="4"
                title="执行说明"
                rows={[["结果内容", "总评分、等级、维度得分和证据说明"]]}
              />
            </section>
            <section className="qualityPrecheck">
              <h3>预检查清单</h3>
              {reassessPrechecks.map((item) => (
                <div key={item.label}>
                  <span className={item.passed ? "passed" : ""}>{item.passed ? "✓" : "○"}</span>
                  <strong>{item.label}</strong>
                </div>
              ))}
            </section>
            <label className="qualityConfirmLine">
              <input
                checked={confirmReassess}
                type="checkbox"
                onChange={(event) => setConfirmReassess(event.target.checked)}
              />
              我已确认重新评估将生成新版本
            </label>
            <footer>
              <button disabled title="当前版本暂未提供历史版本入口" type="button">查看历史版本</button>
              <button type="button" onClick={() => setReassessOpen(false)}>取消</button>
              <button className="primary" disabled={!confirmReassess} type="button" onClick={startReassess}>
                开始评估
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function QualityMetric({ label, value, tone }: { label: string; value: string; tone?: "risk" }) {
  return (
    <article className={tone === "risk" ? "risk" : ""}>
      <span>{label}</span>
      <strong>{displayText(value)}</strong>
    </article>
  );
}

function QualityMiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{displayText(value)}</strong>
    </article>
  );
}

function AllResourcesDrawer({
  query,
  resources,
  sort,
  totalCount,
  onClose,
  onQueryChange,
  onSelect,
  onSortChange,
}: {
  query: string;
  resources: ResourceScoreRow[];
  sort: ResourceSortKey;
  totalCount: number;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onSelect: (resource: ResourceScoreRow) => void;
  onSortChange: (value: ResourceSortKey) => void;
}) {
  return (
    <aside className="qualityEvidenceDrawer" aria-label="全部资源评分">
      <div className="qualityEvidencePanel qualityResourceListPanel">
        <header>
          <div>
            <h2>全部资源评分</h2>
            <p>当前显示 {resources.length} / {totalCount} 条资源，评分字段均来自后端结果。</p>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </header>
        <section className="qualityResourceFilters">
          <label>
            <span>搜索资源名称</span>
            <input
              placeholder="输入资源名称"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </label>
          <label>
            <span>排序</span>
            <select
              value={sort}
              onChange={(event) => onSortChange(event.target.value as ResourceSortKey)}
            >
              <option value="score_desc">总评分从高到低</option>
              <option value="score_asc">总评分从低到高</option>
              <option value="level">质量等级</option>
              <option value="lowest_metric">最低一级指标</option>
            </select>
          </label>
        </section>
        <div className="qualityDrawerBody">
          <table className="qualityTable drawerTable">
            <thead>
              <tr>
                <th>数据资源名称</th>
                <th>所属参与方</th>
                <th>总评分</th>
                <th>质量等级</th>
                <th>最低一级指标</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {resources.length ? resources.map((row) => (
                <tr key={row.key}>
                  <td><strong>{row.resourceName}</strong></td>
                  <td>{row.ownerName}</td>
                  <td>{row.totalScore}</td>
                  <td>{row.qualityLevel}</td>
                  <td>{row.minPrimaryMetric}</td>
                  <td>
                    <button className="qualityInlineButton" type="button" onClick={() => onSelect(row)}>
                      查看评分
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6}>
                    <p className="qualityTableEmpty">没有匹配的资源</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer>
          <button type="button" onClick={onClose}>关闭</button>
        </footer>
      </div>
    </aside>
  );
}

function QualityHeatmap({
  metrics,
  resources,
  onSelect,
}: {
  metrics: WeightItem[];
  resources: ResourceScoreRow[];
  onSelect: (resource: ResourceScoreRow) => void;
}) {
  if (!metrics.length || !resources.length) {
    return <p className="qualityEmpty">暂无</p>;
  }
  const displayedResources = resources.slice(0, 6);
  const heatValues = displayedResources.flatMap((resource) =>
    metrics
      .map((metric) => Number(readMetricScore(resource.raw, metric.metricCode)))
      .filter((value) => Number.isFinite(value)),
  );
  const heatMin = heatValues.length ? Math.min(...heatValues) : 0;
  const heatMax = heatValues.length ? Math.max(...heatValues) : 100;
  return (
    <div className="qualityHeatmap">
      <div className="qualityHeatmapHead">
        <span />
        {metrics.map((metric) => (
          <strong key={metric.metricCode}>{metric.metricName}</strong>
        ))}
      </div>
      <div className="qualityHeatmapRows">
        {displayedResources.map((resource) => (
          <div className="qualityHeatmapRow" key={resource.key}>
            <span title={resource.resourceName}>{resource.resourceName}</span>
            {metrics.map((metric) => {
              const value = readMetricScore(resource.raw, metric.metricCode);
              return (
                <button
                  className={value === "暂无" ? "empty" : ""}
                  data-tooltip={`${resource.resourceName} · ${metric.metricName} · ${value}`}
                  key={`${resource.key}-${metric.metricCode}`}
                  style={{ opacity: heatOpacity(value, heatMin, heatMax) }}
                  title={`${resource.resourceName} · ${metric.metricName} · ${value}`}
                  type="button"
                  onClick={() => onSelect(resource)}
                >
                  {value === "暂无" ? "" : value}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="qualityHeatLegend">
        <span>低</span>
        <i />
        <span>高</span>
      </div>
    </div>
  );
}

function WeightTable({
  items,
  selectedCode,
  onSelect,
  onWeightChange,
}: {
  items: WeightItem[];
  selectedCode?: string;
  onSelect?: (item: WeightItem) => void;
  onWeightChange: (metricCode: string, value: string) => void;
}) {
  if (!items.length) {
    return <p className="qualityEmpty compact">暂无</p>;
  }
  return (
    <div className="qualityWeightTable">
      <div className="qualityWeightTableHead">
        <span>质量维度</span>
        <span>权重</span>
        <span>权重占比</span>
      </div>
      {items.map((item) => {
        const weight = Number(item.weight);
        const percent = Number.isFinite(weight) ? Math.max(0, Math.min(weight * 100, 100)) : 0;
        return (
          <div
            className={item.metricCode === selectedCode ? "selected" : ""}
            key={item.metricCode}
            role="button"
            tabIndex={0}
            onClick={() => onSelect?.(item)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect?.(item);
              }
            }}
          >
            <strong>{item.metricName}</strong>
            <input
              value={item.weight}
              onChange={(event) => onWeightChange(item.metricCode, event.target.value)}
              onClick={(event) => event.stopPropagation()}
            />
            <span className="qualityWeightBar"><i style={{ width: `${percent}%` }} /></span>
            <small>{percent.toFixed(0)}%</small>
          </div>
        );
      })}
    </div>
  );
}

function QualityDetailTable({ rows, mode }: { rows: DataRow[]; mode: "overview" | "primary" | "secondary" }) {
  const displayRows = mode === "overview" ? rows.slice(0, 12) : rows;
  if (!displayRows.length) {
    return <p className="qualityEmpty">暂无</p>;
  }
  return (
    <table className="qualityTable drawerTable">
      <thead>
        <tr>
          <th>指标</th>
          <th>权重</th>
          <th>得分</th>
          <th>加权得分</th>
          <th>证据说明</th>
        </tr>
      </thead>
      <tbody>
        {displayRows.map((row, index) => (
          <tr key={`${cellText(row, "metric_code", "metric")}-${index}`}>
            <td>{metricName(row)}</td>
            <td>{cellText(row, "dimension_weight")}</td>
            <td>{cellText(row, "dimension_score")}</td>
            <td>{cellText(row, "weighted_score")}</td>
            <td>{cellText(row, "evidence_text", cellText(row, "evidence"))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EvidenceTable({ rows }: { rows: DataRow[] }) {
  if (!rows.length) {
    return <p className="qualityEmpty">暂无</p>;
  }
  return (
    <table className="qualityTable drawerTable evidence">
      <thead>
        <tr>
          <th>指标</th>
          <th>证据摘要</th>
          <th>问题说明</th>
          <th>规则说明</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${cellText(row, "metric_code", "metric")}-${index}`}>
            <td>{metricName(row)}</td>
            <td>{cellText(row, "evidence_summary", cellText(row, "evidence"))}</td>
            <td>{cellText(row, "issue_summary")}</td>
            <td>{cellText(row, "rule_code")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function QualityStep({ index, title, rows }: { index: string; title: string; rows: string[][] }) {
  return (
    <article>
      <span>{index}</span>
      <div>
        <h3>{title}</h3>
        {rows.map(([label, value]) => (
          <p key={label}>
            <small>{label}</small>
            <strong>{displayText(value)}</strong>
          </p>
        ))}
      </div>
    </article>
  );
}

function buildResourceRows(qualityRows: DataRow[], resources: DataRow[]): ResourceScoreRow[] {
  const explicitQualityResources = qualityRows.filter(
    (row) => rawCell(row, "resource_name") && rawCell(row, "total_score"),
  );
  const sourceRows = explicitQualityResources.length ? explicitQualityResources : resources;
  return sourceRows.map((row, index) => ({
    key: rawCell(row, "resource_id") || rawCell(row, "detail_id") || `${index}`,
    resourceName: cellText(row, "resource_name", `数据资源 ${index + 1}`),
    ownerName: cellText(row, "owner_name", cellText(row, "provider_party")),
    resourceType: cellText(row, "resource_type", cellText(row, "modality")),
    totalScore: cellText(row, "total_score"),
    qualityLevel: cellText(row, "quality_level"),
    minPrimaryMetric: cellText(row, "min_primary_metric"),
    updateTime: cellText(row, "update_time", cellText(row, "updated_at")),
    raw: row,
  }));
}

function filterAndSortResourceRows(
  rows: ResourceScoreRow[],
  query: string,
  sort: ResourceSortKey,
) {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? rows.filter((row) => row.resourceName.toLowerCase().includes(normalizedQuery))
    : rows;
  return [...filtered].sort((left, right) => {
    if (sort === "score_asc") {
      return scoreForSort(left) - scoreForSort(right);
    }
    if (sort === "level") {
      const levelDiff = qualityLevelRank(left.qualityLevel) - qualityLevelRank(right.qualityLevel);
      return levelDiff || left.resourceName.localeCompare(right.resourceName, "zh-Hans");
    }
    if (sort === "lowest_metric") {
      return left.minPrimaryMetric.localeCompare(right.minPrimaryMetric, "zh-Hans")
        || left.resourceName.localeCompare(right.resourceName, "zh-Hans");
    }
    return scoreForSort(right) - scoreForSort(left);
  });
}

function scoreForSort(row: ResourceScoreRow) {
  return numericCellValue(row.totalScore) ?? -1;
}

function qualityLevelRank(level: string) {
  const normalized = level.trim().toUpperCase();
  if (normalized === "A") {
    return 1;
  }
  if (normalized === "B") {
    return 2;
  }
  if (normalized === "C") {
    return 3;
  }
  if (normalized === "D") {
    return 4;
  }
  return 9;
}

function parseWeightItems(payload: Record<string, unknown>): WeightItem[] {
  const items = Array.isArray(payload.items) ? payload.items : [];
  return items
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      metricCode: stringValue(item.metric_code ?? item.dimension_code),
      metricName: stringValue(item.metric_name ?? item.dimension_name),
      metricLevel: Number(item.metric_level) || 0,
      parentMetricCode: stringValue(item.parent_metric_code),
      weight: stringValue(item.weight),
    }));
}

function sumWeight(items: WeightItem[]) {
  let total = 0;
  for (const item of items) {
    const numeric = Number(item.weight);
    if (Number.isFinite(numeric)) {
      total += numeric;
    }
  }
  return total;
}

function metricName(row: DataRow) {
  return cellText(row, "metric_name", cellText(row, "dimension_name"));
}

function rawCell(row: DataRow | undefined, key: string) {
  const value = row?.[key];
  return value === undefined || value === null || value === "" ? "" : String(value);
}

function stringValue(value: unknown) {
  return value === undefined || value === null || value === "" ? "" : String(value);
}

function displayText(value: string | number | boolean | undefined | null) {
  return value === undefined || value === null || value === "" ? "暂无" : String(value);
}

function numericCellValue(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const numeric = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function formatWeight(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : "暂无";
}

function compactDateTime(value: string) {
  const normalized = displayText(value);
  if (!normalized || normalized === "暂无") {
    return "暂无";
  }
  return normalized.replace("T", " ").replace("Z", "").slice(0, 16);
}

function readMetricScore(row: DataRow, metricCode: string) {
  const candidates = [
    metricCode,
    metricCode.toLowerCase(),
    `${metricCode}_score`,
    `${metricCode.toLowerCase()}_score`,
    `score_${metricCode}`,
    `score_${metricCode.toLowerCase()}`,
  ];
  for (const key of candidates) {
    const value = rawCell(row, key);
    if (value) {
      return value;
    }
  }
  return "暂无";
}

function heatOpacity(value: string, minValue: number, maxValue: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0.16;
  }
  const range = maxValue - minValue;
  if (range > 0 && range <= 15) {
    return Math.max(0.32, Math.min(1, 0.32 + ((numeric - minValue) / range) * 0.68));
  }
  return Math.max(0.26, Math.min(1, numeric / 100));
}
