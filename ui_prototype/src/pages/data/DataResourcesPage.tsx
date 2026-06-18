import { useMemo, useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import type { ResourceInventoryRecord } from "../../domain/types";
import {
  ActionButton,
  DetailDrawer,
  DrawerSection,
  ExportFieldList,
  MetricCard,
  PageHeader,
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
  const [bindingDirty, setBindingDirty] = useState(false);
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
    setBindingDirty(false);
    setDetailKey("");
    setExportOpen(false);
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
    setBindingDirty(false);
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
              setDetailKey("");
              setBindingKey("");
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
        footerNote="详情抽屉只展示业务概览；工程字段固定在底部技术详情中。"
        objectType="数据资源"
        open={Boolean(selectedResource)}
        size="lg"
        statusTag={selectedResource?.status}
        subtitle={selectedResource ? `${selectedResource.modality} / ${selectedResource.sampleCount.toLocaleString("zh-CN")} 条样本` : undefined}
        technicalDetails={
          selectedResource ? <TechnicalDetails details={selectedResource.technicalDetails} /> : null
        }
        title="数据资源详情"
        variant="detail"
        onClose={() => setDetailKey("")}
      >
        {selectedResource ? (
          <div className="resourceDetail">
            <DrawerSection title="资源概览">
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
            </DrawerSection>

            <DrawerSection title="字段统计" description="仅展示统计口径，不展示敏感原文。">
              <div className="statChips">
                {selectedResource.fieldStats.map((item) => (
                  <span key={item.label}>
                    {item.label}：<strong>{item.value}</strong>
                  </span>
                ))}
              </div>
            </DrawerSection>

            <DrawerSection title="脱敏预览" description="预览内容已脱敏，仅用于业务核对。">
              <div className="previewRows">
                {selectedResource.previewRows.map((row, index) => (
                  <dl className="businessDetail compact" key={index}>
                    {Object.entries(row).map(([key, value]) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                ))}
              </div>
            </DrawerSection>

            <DrawerSection title="主体归属和计算设置">
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
            </DrawerSection>
          </div>
        ) : null}
      </DetailDrawer>

      <DetailDrawer
        actions={[
          {
            label: "取消",
            onClick: () => setBindingKey(""),
          },
          {
            label: "保存绑定",
            type: "primary",
            disabled: ratioTotal !== 100,
            disabledReason: "拆分比例合计必须等于 100%",
            onClick: saveBinding,
          },
        ]}
        dirty={bindingDirty}
        footerNote="保存后会更新资源与数据源主体关系，并写入审计日志。"
        objectType="主体归属配置"
        open={Boolean(bindingResource)}
        size="lg"
        statusTag={ratioTotal === 100 ? "可保存" : "待校验"}
        subtitle={bindingResource ? `资源：${bindingResource.name}` : undefined}
        title="绑定数据源主体"
        variant="form"
        onClose={() => setBindingKey("")}
      >
        {bindingResource ? (
          <>
            <DrawerSection
              title="拆分比例"
              description="选择一个或多个数据提供方，拆分比例合计必须等于 100%。"
            >
            <div className="providerRatioGrid">
              {mock.dataProviders.map((provider) => (
                <label key={provider.name}>
                  <span>{provider.name}</span>
                  <input
                    min="0"
                    max="100"
                    type="number"
                    value={ratioDraft[provider.name] ?? 0}
                    onChange={(event) => {
                      setBindingDirty(true);
                      setRatioDraft((current) => ({
                        ...current,
                        [provider.name]: Number(event.target.value),
                      }));
                    }}
                  />
                </label>
              ))}
            </div>
            <p className={ratioTotal === 100 ? "ratioOk" : "ratioError"}>
              当前拆分比例合计：{ratioTotal}%（必须等于 100%）
            </p>
            </DrawerSection>

            <DrawerSection title="保存影响">
              <ul className="plainList">
                <li>更新 data_resource_party_relation 模拟记录。</li>
                <li>资源进入后续计算时，主体归属缺失阻断将解除。</li>
                <li>保存动作会写入审计日志。</li>
              </ul>
            </DrawerSection>
          </>
        ) : null}
      </DetailDrawer>

      <DetailDrawer
        footerNote="导出动作已生成模拟导出记录和报告记录；敏感原文不进入文件。"
        objectType="导出说明"
        open={exportOpen}
        size="md"
        statusTag="已生成"
        technicalDetails={
          <TechnicalDetails
            details={{
              file_name: "resource_summary_phase2a.csv",
              file_type: "CSV",
              checksum: "sha256:resource-summary-demo",
            }}
          />
        }
        title="资源摘要导出"
        variant="export"
        onClose={() => setExportOpen(false)}
      >
        <DrawerSection title="导出结果" description="已生成 resource_summary.csv/json 模拟导出记录和报告记录。">
          <ExportFieldList
            fields={[
              "resource_name",
              "modality",
              "field_count",
              "sample_count",
              "missing_rate",
              "provider_party",
              "include_in_calculation",
              { key: "sensitive_field_count", sensitive: true },
            ]}
            note="不导出敏感原文，仅导出脱敏统计。"
          />
        </DrawerSection>
      </DetailDrawer>
    </div>
  );
}
