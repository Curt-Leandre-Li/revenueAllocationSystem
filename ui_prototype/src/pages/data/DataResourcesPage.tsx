import { useMemo, useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import type { ResourceInventoryRecord } from "../../domain/types";
import {
  ActionButton,
  DetailDrawer,
  MetricCard,
  PageHeader,
  SectionCard,
  TechnicalDetails,
  WorkbenchCard,
} from "../../ui";
import { formatPercent, getMockWorkspace, isResourceBlocked } from "../phase2aUtils";
import type { PageProps } from "../pageTypes";

type FilterValue = "全部" | "是" | "否";

function resourceMatchesFilter(
  resource: ResourceInventoryRecord,
  modality: string,
  includeFilter: FilterValue,
  relationFilter: FilterValue,
  missingRisk: FilterValue,
) {
  const modalityMatched = modality === "全部" || resource.modality === modality;
  const includeMatched =
    includeFilter === "全部" ||
    (includeFilter === "是" ? resource.includeInCalculation : !resource.includeInCalculation);
  const relationMatched =
    relationFilter === "全部" ||
    (relationFilter === "是"
      ? resource.providerName !== "未关联"
      : resource.providerName === "未关联");
  const missingMatched =
    missingRisk === "全部" ||
    (missingRisk === "是" ? resource.missingRate >= 0.05 : resource.missingRate < 0.05);

  return modalityMatched && includeMatched && relationMatched && missingMatched;
}

export function DataResourcesPage({ route, snapshot, onAction }: PageProps) {
  const mock = getMockWorkspace(snapshot);
  const resources = mock.resources;
  const modalities = ["全部", ...Array.from(new Set(resources.map((item) => item.modality)))];
  const [modality, setModality] = useState("全部");
  const [includeFilter, setIncludeFilter] = useState<FilterValue>("全部");
  const [relationFilter, setRelationFilter] = useState<FilterValue>("全部");
  const [missingRisk, setMissingRisk] = useState<FilterValue>("全部");
  const [detailKey, setDetailKey] = useState("");
  const [bindingKey, setBindingKey] = useState("");
  const [ratioDraft, setRatioDraft] = useState<Record<string, number>>({});
  const [exportOpen, setExportOpen] = useState(false);

  const filteredResources = useMemo(
    () =>
      resources.filter((resource) =>
        resourceMatchesFilter(resource, modality, includeFilter, relationFilter, missingRisk),
      ),
    [resources, modality, includeFilter, relationFilter, missingRisk],
  );
  const selectedResource = resources.find((item) => item.resourceKey === detailKey);
  const bindingResource = resources.find((item) => item.resourceKey === bindingKey);
  const ratioTotal = Object.values(ratioDraft).reduce((sum, value) => sum + value, 0);
  const blockedCount = resources.filter(isResourceBlocked).length;
  const sensitiveCount = resources.reduce((sum, item) => sum + item.sensitiveFieldCount, 0);
  const highMissingCount = resources.filter((item) => item.missingRate >= 0.05).length;
  const metrics = [
    { label: "资源总数", value: String(resources.length), hint: "已识别资源", tone: "neutral" as const },
    {
      label: "进入计算",
      value: String(resources.filter((item) => item.includeInCalculation).length),
      hint: "用于质量/计量/权重链路",
      tone: "success" as const,
    },
    {
      label: "未关联主体",
      value: String(blockedCount),
      hint: "进入计算但缺少数据源主体",
      tone: blockedCount ? "warning" as const : "success" as const,
    },
    {
      label: "高缺失率",
      value: String(highMissingCount),
      hint: "缺失率不低于 5%",
      tone: highMissingCount ? "warning" as const : "success" as const,
    },
    {
      label: "涉敏字段",
      value: String(sensitiveCount),
      hint: "仅展示统计与标记",
      tone: sensitiveCount ? "warning" as const : "neutral" as const,
    },
  ];

  function openBinding(resource: ResourceInventoryRecord) {
    const draft = Object.fromEntries(mock.dataProviders.map((provider) => [provider.name, 0]));
    const preferredProvider =
      resource.providerName === "未关联"
        ? mock.dataProviders[0]?.name
        : resource.providerName.split(" ")[0];
    if (preferredProvider) {
      draft[preferredProvider] = 100;
    }
    setRatioDraft(draft);
    setBindingKey(resource.resourceKey);
  }

  function saveBinding() {
    if (!bindingResource || ratioTotal !== 100) {
      return;
    }
    const providerSummary = Object.entries(ratioDraft)
      .filter(([, ratio]) => ratio > 0)
      .map(([name, ratio]) => `${name} ${ratio}%`)
      .join(" + ");
    onAction(actionRegistry["RES-005"], {
      kind: "resource-binding",
      resourceKey: bindingResource.resourceKey,
      providerName: providerSummary,
      splitRatio: 100,
    });
    setBindingKey("");
  }

  return (
    <div className="pageWorkspace phase2Page resourcesPage">
      <PageHeader
        route={{
          ...route,
          label: "资源盘点和主体归属确认工作台",
          responsibility: "盘点资源、筛选风险、确认主体归属，并控制是否进入后续计算。",
        }}
        snapshot={snapshot}
      />

      <div className="metricGrid five">
        {metrics.map((item) => (
          <MetricCard item={item} key={item.label} />
        ))}
      </div>

      {blockedCount ? (
        <section className="blockingNotice">
          <strong>后续评估阻断</strong>
          <p>
            存在进入后续计算但未关联数据源主体的资源。补齐主体归属前，不应进入质量评估或
            MD-DShap。
          </p>
        </section>
      ) : null}

      <WorkbenchCard
        title="资源筛选"
        description="按模态、计算状态、主体归属和缺失率风险筛选资源。"
        actions={
          <ActionButton
            action={actionRegistry["RES-007"]}
            onClick={(action) => {
              onAction(action);
              setExportOpen(true);
            }}
          />
        }
      >
        <div className="filterBar">
          <label>
            模态
            <select value={modality} onChange={(event) => setModality(event.target.value)}>
              {modalities.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            是否进入计算
            <select
              value={includeFilter}
              onChange={(event) => setIncludeFilter(event.target.value as FilterValue)}
            >
              <option>全部</option>
              <option>是</option>
              <option>否</option>
            </select>
          </label>
          <label>
            是否已关联主体
            <select
              value={relationFilter}
              onChange={(event) => setRelationFilter(event.target.value as FilterValue)}
            >
              <option>全部</option>
              <option>是</option>
              <option>否</option>
            </select>
          </label>
          <label>
            缺失率风险
            <select
              value={missingRisk}
              onChange={(event) => setMissingRisk(event.target.value as FilterValue)}
            >
              <option>全部</option>
              <option>是</option>
              <option>否</option>
            </select>
          </label>
        </div>
      </WorkbenchCard>

      <section className="resourceTableCard">
        <div className="sectionHead">
          <h2>资源列表</h2>
          <p>工程字段不在主表展示，详情抽屉中提供技术详情。</p>
        </div>
        <div className="tableWrap">
          <table className="dataTable phase2Table">
            <thead>
              <tr>
                <th>资源名称</th>
                <th>模态</th>
                <th>字段数</th>
                <th>样本数</th>
                <th>缺失率</th>
                <th>是否进入后续计算</th>
                <th>关联主体</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredResources.map((resource) => (
                <tr key={resource.resourceKey}>
                  <td>
                    <strong>{resource.name}</strong>
                    <small className="cellHint">{resource.status}</small>
                  </td>
                  <td>{resource.modality}</td>
                  <td>{resource.fieldCount}</td>
                  <td>{resource.sampleCount.toLocaleString("zh-CN")}</td>
                  <td>
                    <span className={resource.missingRate >= 0.05 ? "tag warning" : "tag"}>
                      {formatPercent(resource.missingRate)}
                    </span>
                  </td>
                  <td>
                    <button
                      className={
                        resource.includeInCalculation ? "switchButton active" : "switchButton"
                      }
                      type="button"
                      onClick={() =>
                        onAction(actionRegistry["RES-005"], {
                          kind: "resource-calculation-toggle",
                          resourceKey: resource.resourceKey,
                          includeInCalculation: !resource.includeInCalculation,
                        })
                      }
                    >
                      {resource.includeInCalculation ? "进入" : "不进入"}
                    </button>
                  </td>
                  <td>
                    <span className={isResourceBlocked(resource) ? "tag danger" : "tag success"}>
                      {resource.providerName}
                    </span>
                  </td>
                  <td>
                    <div className="tableActions">
                      <button
                        type="button"
                        onClick={() => {
                          onAction(actionRegistry["RES-002"], {
                            kind: "resource-detail",
                            resourceKey: resource.resourceKey,
                          });
                          setDetailKey(resource.resourceKey);
                        }}
                      >
                        详情
                      </button>
                      <button type="button" onClick={() => openBinding(resource)}>
                        关联主体
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <DetailDrawer
        open={Boolean(selectedResource)}
        title="数据资源详情"
        onClose={() => setDetailKey("")}
      >
        {selectedResource ? (
          <div className="resourceDetail">
            <SectionCard title="资源概览">
              <dl className="businessDetail">
                <div>
                  <dt>资源名称</dt>
                  <dd>{selectedResource.name}</dd>
                </div>
                <div>
                  <dt>模态</dt>
                  <dd>{selectedResource.modality}</dd>
                </div>
                <div>
                  <dt>缺失率</dt>
                  <dd>{formatPercent(selectedResource.missingRate)}</dd>
                </div>
                <div>
                  <dt>是否进入后续计算</dt>
                  <dd>{selectedResource.includeInCalculation ? "是" : "否"}</dd>
                </div>
              </dl>
            </SectionCard>

            <SectionCard title="字段统计">
              <div className="statChips">
                {selectedResource.fieldStats.map((item) => (
                  <span key={item.label}>
                    {item.label}：<strong>{item.value}</strong>
                  </span>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="脱敏预览">
              <div className="previewRows">
                {selectedResource.previewRows.map((row, index) => (
                  <pre key={index}>{JSON.stringify(row, null, 2)}</pre>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="主体归属和计算设置">
              <p>
                当前主体：<strong>{selectedResource.providerName}</strong>
              </p>
              <p>
                计算设置：
                <strong>
                  {selectedResource.includeInCalculation
                    ? "进入后续质量评估、数元计量和 MD-DShap"
                    : "不进入后续计算"}
                </strong>
              </p>
            </SectionCard>

            <TechnicalDetails details={selectedResource.technicalDetails} />
          </div>
        ) : null}
      </DetailDrawer>

      {bindingResource ? (
        <div className="modalBackdrop" role="presentation">
          <section className="confirmModal wideModal" role="dialog" aria-modal="true">
            <h2>绑定数据源主体</h2>
            <p>
              资源：<strong>{bindingResource.name}</strong>
            </p>
            <div className="providerRatioGrid">
              {mock.dataProviders.map((provider) => (
                <label key={provider.name}>
                  <span>{provider.name}</span>
                  <input
                    min="0"
                    max="100"
                    type="number"
                    value={ratioDraft[provider.name] ?? 0}
                    onChange={(event) =>
                      setRatioDraft((current) => ({
                        ...current,
                        [provider.name]: Number(event.target.value),
                      }))
                    }
                  />
                </label>
              ))}
            </div>
            <p className={ratioTotal === 100 ? "ratioOk" : "ratioError"}>
              当前 split_ratio 合计：{ratioTotal}%（必须等于 100%）
            </p>
            <div className="modalActions">
              <button type="button" onClick={() => setBindingKey("")}>
                取消
              </button>
              <button
                className="primary"
                disabled={ratioTotal !== 100}
                type="button"
                onClick={saveBinding}
              >
                保存绑定
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <DetailDrawer
        open={exportOpen}
        title="资源摘要导出"
        onClose={() => setExportOpen(false)}
      >
        <p className="drawerIntro">
          已生成 resource_summary.csv/json 模拟导出记录和报告记录。
        </p>
        <ul className="plainList">
          <li>导出字段：资源名称、模态、字段数、样本数、缺失率、主体归属、计算设置</li>
          <li>安全边界：不导出敏感原文，仅导出脱敏统计</li>
          <li>记录位置：export_file 与 report_record 模拟记录</li>
        </ul>
      </DetailDrawer>
    </div>
  );
}
