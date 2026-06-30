import { useMemo, useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import {
  ChartArea,
  CompactPageHeader,
  DetailDrawer,
  DrawerSection,
  EmptyGuide,
  ProductBarChart,
} from "../../ui";
import { userFacingText } from "../../ui/displayText";
import type { DataRow } from "../../domain/types";
import type { PageProps } from "../pageTypes";
import {
  BooleanBadge,
  DataMetricStrip,
  NextStepStrip,
  type DataMetricCard,
} from "./DataPageShared";

const donutColors = ["#2563eb", "#10b981", "#8b5cf6", "#f59e0b", "#64748b", "#0ea5e9"];

interface PartyListItem {
  partyId: string;
  name: string;
  type: string;
  typeCode: string;
  isDataProvider: boolean;
  includeInMdDshap: boolean;
  isActive: boolean;
  processingMethod: string;
  resourceCount: number;
  resourceSummary: string;
  status: string;
  summary: string;
}

interface ResourceListItem {
  resourceId: string;
  name: string;
  modality: string;
  rawModality: string;
  providerParty: string;
  partyId: string;
  sourcePartyId: string;
  externalPartyId: string;
}

interface PartyDraft {
  partyId?: string;
  partyName: string;
  partyType: string;
  includeInMdDshap: boolean;
  description: string;
}

function readCell(row: DataRow | undefined, key: string, fallback = "") {
  const value = row?.[key];
  return value === undefined || value === null || value === "" ? fallback : userFacingText(value);
}

function resourceFromRow(row: DataRow, index: number): ResourceListItem {
  return {
    resourceId: readCell(row, "resource_id", `resource_${index + 1}`),
    name: readCell(row, "resource_name", `资源 ${index + 1}`),
    modality: readCell(row, "modality", "未知模态数据"),
    rawModality: readCell(row, "raw_modality", ""),
    providerParty: readCell(row, "provider_party", ""),
    partyId: readCell(row, "party_id", ""),
    sourcePartyId: readCell(row, "source_party_id", ""),
    externalPartyId: readCell(row, "external_party_id", ""),
  };
}

function partyFromRow(row: DataRow, index: number, resources: ResourceListItem[]): PartyListItem {
  const typeCode = readCell(row, "party_type_code", "");
  const type = partyTypeDisplay(typeCode, readCell(row, "party_type", "其他主体"));
  const isDataProvider = typeCode === "DATA_PROVIDER" || isYes(readCell(row, "is_data_provider", ""));
  const includeInMdDshap = isDataProvider && isYes(readCell(row, "include_in_md_dshap", ""));
  const status = readCell(row, "status", "有效");
  const linkedResources = resources.filter((resource) => resourceBelongsToParty(resource, row));
  return {
    partyId: readCell(row, "party_id", `party_${index + 1}`),
    name: readCell(row, "party_name", `参与方 ${index + 1}`),
    type,
    typeCode,
    isDataProvider,
    includeInMdDshap,
    isActive: !isDisabledStatus(status),
    processingMethod: readCell(row, "processing_method", isDataProvider ? "贡献度 / 效用 / MD-DShap" : "合同比例分配"),
    resourceCount: linkedResources.length,
    resourceSummary: resourceSummaryForParty(linkedResources, typeCode, isDataProvider),
    status,
    summary: readCell(row, "contribution_summary", ""),
  };
}

export function DataPartiesPage({ route, snapshot, onAction, onNavigate }: PageProps) {
  const pageData = snapshot.pages[route.path];
  const resourcePageData = snapshot.pages["/data/resources"];
  const resources = useMemo(
    () => (resourcePageData?.rows ?? []).map(resourceFromRow),
    [resourcePageData?.rows],
  );
  const allParties = useMemo(
    () => pageData.rows.map((row, index) => partyFromRow(row, index, resources)),
    [pageData.rows, resources],
  );
  const parties = useMemo(
    () => currentPackageParties(allParties, resources),
    [allParties, resources],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("全部");
  const [drawer, setDrawer] = useState<"" | "form" | "contribution" | "link">("");
  const [partyDraft, setPartyDraft] = useState<PartyDraft>(() => newPartyDraft());

  const filteredParties = useMemo(
    () =>
      parties.filter((party) =>
        (typeFilter === "全部" || party.type === typeFilter) &&
        party.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
      ),
    [parties, searchQuery, typeFilter],
  );
  const typeOptions = useMemo(
    () => ["全部", ...Array.from(new Set(parties.map((party) => party.type)))],
    [parties],
  );
  const dataProviderCount = parties.filter((party) => party.isDataProvider).length;
  const nonDataProviderCount = parties.length - dataProviderCount;
  const weightPoolCount = parties.filter(
    (party) => party.isDataProvider && party.includeInMdDshap && party.isActive,
  ).length;
  const disabledCount = parties.filter((party) => !party.isActive).length;
  const summaryItems: DataMetricCard[] = [
    { label: "参与方", value: parties.length, hint: "全部参与主体", tone: parties.length ? "success" : "neutral", icon: "方" },
    { label: "数据源主体", value: dataProviderCount, hint: "提供数据的主体", tone: dataProviderCount ? "success" : "neutral", icon: "源" },
    { label: "非数据主体", value: nonDataProviderCount, hint: "不提供数据的主体", tone: nonDataProviderCount ? "neutral" : "success", icon: "合" },
    { label: "进入权重池", value: weightPoolCount, hint: "参与算法权重计算", tone: weightPoolCount ? "success" : "warning", icon: "权" },
    { label: "停用主体", value: disabledCount, hint: "当前停用主体", tone: disabledCount ? "warning" : "success", icon: "停" },
  ];
  const typeDistribution = buildTypeDistribution(parties);
  const resourceRankPoints = parties
    .filter((party) => party.resourceCount > 0)
    .sort((left, right) => right.resourceCount - left.resourceCount || left.name.localeCompare(right.name, "zh-CN"))
    .map((party) => ({
      label: party.name,
      value: String(party.resourceCount),
      numeric: party.resourceCount,
      meta: party.resourceSummary,
    }));

  return (
    <div className="pageWorkspace leanPage partiesPage">
      <CompactPageHeader
        title="参与方"
        description="维护参与主体、角色边界、资源归属和是否参与权重计算。"
        primaryAction={
          <button
            className="actionButton primary"
            type="button"
            onClick={() => {
              setPartyDraft(newPartyDraft());
              setDrawer("form");
            }}
          >
            新增参与方
          </button>
        }
        secondaryActions={
          <button
            className="actionButton secondary"
            type="button"
            onClick={() => {
              onAction(actionRegistry["PARTY-006"]);
              setDrawer("link");
            }}
          >
            批量关联资源
          </button>
        }
      />

      <DataMetricStrip items={summaryItems} />

      <section className="partyInsightGrid">
        <ChartArea title="参与方类型分布" source={parties.length ? "rows" : undefined}>
          <PartyTypeDonut points={typeDistribution} total={parties.length} />
        </ChartArea>
        <ChartArea title="资源关联排行" source={resourceRankPoints.length ? "rows" : undefined}>
          <ProductBarChart points={resourceRankPoints} unit="关联资源" emptyText="暂无关联资源" />
        </ChartArea>
      </section>

      <section className="leanTableSection">
        <div className="leanSectionHead">
          <div>
            <h2>主体列表</h2>
            <p>管理参与主体的类型、资源关联及是否进入算法权重池。</p>
            <p className="partyRuleInline">
              非数据主体默认不进入 MD-DShap 权重池，后续通过合同比例参与收益分配模拟。
            </p>
          </div>
          <div className="partyTableTools">
            <label>
              搜索主体名称
              <input
                placeholder="输入主体名称"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>
            <label>
              主体类型
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                {typeOptions.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <span>{filteredParties.length} / {parties.length} 条</span>
            <button className="textLinkButton" type="button" onClick={() => onNavigate("/allocation/md-dshap")}>
              查看权重结果
            </button>
          </div>
        </div>
        <div className="tableWrap">
          <table className="dataTable phase2Table">
            <thead>
              <tr>
                <th>主体名称</th>
                <th>主体类型</th>
                <th>是否数据源主体</th>
                <th>是否进入算法权重池</th>
                <th>关联资源数</th>
                <th>关联资源摘要</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredParties.length ? filteredParties.map((party) => {
                const nextStatus = party.isActive ? "DISABLED" : "ENABLED";
                const statusLabel = nextStatus === "ENABLED" ? "启用" : "停用";
                return (
                  <tr key={party.partyId}>
                    <td><strong>{party.name}</strong></td>
                    <td>{party.type}</td>
                    <td><BooleanBadge value={party.isDataProvider} /></td>
                    <td><BooleanBadge value={party.includeInMdDshap} /></td>
                    <td>{party.resourceCount}</td>
                    <td>{party.resourceSummary}</td>
                    <td title={party.summary}>
                      <span className={`stateDot ${party.isActive ? "success" : "neutral"}`}>{party.status}</span>
                    </td>
                    <td>
                      <div className="tableActions">
                        <button
                          type="button"
                          onClick={() => {
                            setPartyDraft(partyDraftFromItem(party));
                            setDrawer("form");
                          }}
                        >
                          编辑
                        </button>
                        <button
                          title="状态规则由系统守卫返回。"
                          type="button"
                          onClick={() =>
                            onAction(actionRegistry["PARTY-005"], {
                              kind: "party-status",
                              partyId: party.partyId,
                              status: nextStatus,
                              reason: "状态切换",
                            })
                          }
                        >
                          {statusLabel}
                        </button>
                        <button
                          disabled={!party.isDataProvider}
                          title={party.isDataProvider ? "关联数据资源" : "非数据主体不关联数据资源"}
                          type="button"
                          onClick={() => {
                            onAction(actionRegistry["PARTY-006"]);
                            setDrawer("link");
                          }}
                        >
                          关联资源
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={8}>
                    <EmptyGuide title="未找到匹配主体" description="请调整主体名称、主体类型或筛选条件。" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <NextStepStrip
        title="下一步建议"
        description="根据参与方配置完成情况，建议按以下步骤推进收益分配流程。"
        steps={[
          { title: "质量评估管理", description: "评估数据质量与合规情况", route: "/metering/quality", active: true },
          { title: "MD-DShap 计算管理", description: "计算各主体贡献度与权重", route: "/allocation/md-dshap" },
          { title: "收益分配模拟", description: "模拟分配结果与公平性验证", route: "/allocation/simulation" },
        ]}
        statusTitle="当前参与方配置就绪"
        statusDescription={`已有 ${weightPoolCount} 个主体进入权重池，可进行质量评估。`}
        onNavigate={onNavigate}
      />

      <DetailDrawer
        dirty
        footerNote="保存后会写入参与方记录和审计日志；非数据主体默认不进入算法权重池。"
        objectType="参与方配置"
        open={drawer === "form"}
        size="lg"
        statusTag="四步向导"
        title="新增 / 编辑参与方"
        variant="form"
        actions={[
          { label: "取消", onClick: () => setDrawer("") },
          {
            label: "保存参与方",
            type: "primary",
            onClick: () => {
              onAction(
                actionRegistry[partyDraft.partyId ? "PARTY-003" : "PARTY-002"],
                {
                  kind: "party-upsert",
                  partyId: partyDraft.partyId,
                  partyName: partyDraft.partyName,
                  partyType: partyDraft.partyType,
                  includeInMdDshap: partyDraft.partyType === "DATA_PROVIDER" && partyDraft.includeInMdDshap,
                  description: partyDraft.description,
                },
              );
              setDrawer("");
            },
          },
        ]}
        onClose={() => setDrawer("")}
      >
        <div className="wizardSteps">
          {["选择主体类型", "填写主体信息", "确认算法边界", "关联数据资源"].map((step, index) => (
            <article key={step}>
              <span>{index + 1}</span>
              <strong>{step}</strong>
              <p>
                {index === 0
                  ? "数据提供方默认进入算法权重池。"
                  : index === 1
                    ? "维护主体名称、合同角色和状态。"
                    : index === 2
                      ? "非数据主体默认不进入 MD-DShap。"
                      : "选择可归属的数据资源并确认拆分比例。"}
              </p>
            </article>
          ))}
        </div>
        <DrawerSection title="主体信息">
          <div className="formGrid">
            <label>
              主体名称
              <input
                value={partyDraft.partyName}
                onChange={(event) => setPartyDraft((current) => ({ ...current, partyName: event.target.value }))}
              />
            </label>
            <label>
              主体类型
              <select
                value={partyDraft.partyType}
                onChange={(event) =>
                  setPartyDraft((current) => ({
                    ...current,
                    partyType: event.target.value,
                    includeInMdDshap:
                      event.target.value === "DATA_PROVIDER" ? current.includeInMdDshap : false,
                  }))
                }
              >
                <option value="DATA_PROVIDER">数据提供方</option>
                <option value="TECH_SERVICE">技术服务方</option>
                <option value="OPERATOR">运营方</option>
                <option value="PILOT_BASE">中试基地</option>
                <option value="EXPERT_REVIEWER">专家方</option>
                <option value="CONTRACT_PARTY">合同主体</option>
              </select>
            </label>
            <label>
              是否数据源主体
              <input readOnly value={partyDraft.partyType === "DATA_PROVIDER" ? "是" : "否"} />
            </label>
            <label>
              是否进入算法权重池
              <select
                disabled={partyDraft.partyType !== "DATA_PROVIDER"}
                value={partyDraft.partyType === "DATA_PROVIDER" && partyDraft.includeInMdDshap ? "是" : "否"}
                onChange={(event) =>
                  setPartyDraft((current) => ({
                    ...current,
                    includeInMdDshap: event.target.value === "是",
                  }))
                }
              >
                <option>是</option>
                <option>否</option>
              </select>
            </label>
            <label className="fullSpan">
              说明
              <input
                value={partyDraft.description}
                onChange={(event) => setPartyDraft((current) => ({ ...current, description: event.target.value }))}
              />
            </label>
          </div>
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="资源关联用于解除后续评估阻断；保存动作写入关系审计。"
        objectType="资源关联"
        open={drawer === "link"}
        size="md"
        title="关联数据资源"
        variant="form"
        actions={[
          { label: "取消", onClick: () => setDrawer("") },
          { label: "保存关联", type: "primary", onClick: () => { onAction(actionRegistry["PARTY-006"]); setDrawer(""); } },
        ]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="可关联资源">
          <EmptyGuide
            title="关联配置由后端接口保存"
            description="当前页面已按现有资源归属聚合展示，写入关系仍走参与方关联资源接口。"
          />
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="贡献结果仅用于解释权重来源，不构成最终付款指令。"
        objectType="贡献摘要"
        open={drawer === "contribution"}
        size="lg"
        title="参与方贡献结果"
        variant="detail"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="贡献、效用和权重摘要">
          <EmptyGuide
            title="暂无贡献摘要"
            description="完成贡献与效用计算、权重计算后，可在这里查看参与方摘要。"
          />
        </DrawerSection>
      </DetailDrawer>
    </div>
  );
}

function newPartyDraft(): PartyDraft {
  return {
    partyName: `新参与方草稿-${Date.now().toString().slice(-6)}`,
    partyType: "DATA_PROVIDER",
    includeInMdDshap: true,
    description: "新增参与方草稿",
  };
}

function partyDraftFromItem(party: PartyListItem): PartyDraft {
  return {
    partyId: party.partyId,
    partyName: party.name,
    partyType: party.typeCode || "DATA_PROVIDER",
    includeInMdDshap: party.includeInMdDshap,
    description: party.summary,
  };
}

function currentPackageParties(parties: PartyListItem[], resources: ResourceListItem[]) {
  if (!resources.length) {
    return parties;
  }
  return parties.filter((party) => party.resourceCount > 0 || !party.isDataProvider);
}

function resourceBelongsToParty(resource: ResourceListItem, party: DataRow) {
  const partyIds = [
    readCell(party, "party_id", ""),
    readCell(party, "original_party_id", ""),
    readCell(party, "source_party_id", ""),
    readCell(party, "external_party_id", ""),
  ].filter(Boolean);
  const resourcePartyIds = [
    resource.partyId,
    resource.sourcePartyId,
    resource.externalPartyId,
  ].filter(Boolean);
  if (partyIds.some((id) => resourcePartyIds.includes(id))) {
    return true;
  }
  const partyName = readCell(party, "party_name", "");
  return Boolean(partyName && resource.providerParty === partyName);
}

function resourceSummaryForParty(
  linkedResources: ResourceListItem[],
  typeCode: string,
  isDataProvider: boolean,
) {
  if (linkedResources.length) {
    return Array.from(new Set(linkedResources.map((resource) => resource.modality))).join(" / ");
  }
  if (isDataProvider) {
    return "待关联资源";
  }
  if (typeCode === "OPERATOR") {
    return "运营 / 合同比例";
  }
  return "合同比例分配";
}

function buildTypeDistribution(parties: PartyListItem[]) {
  const total = parties.length || 1;
  const counts = new Map<string, number>();
  for (const party of parties) {
    const label = distributionTypeLabel(party);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({
      label,
      count,
      percent: count / total,
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "zh-CN"));
}

function distributionTypeLabel(party: PartyListItem) {
  if (party.isDataProvider) {
    return "数据源主体";
  }
  if (party.typeCode === "OPERATOR" || party.type.includes("运营")) {
    return "运营方";
  }
  if (["TECH_SERVICE", "SERVICE_PROVIDER"].includes(party.typeCode) || party.type.includes("技术")) {
    return "技术服务方";
  }
  if (party.typeCode === "PILOT_BASE" || party.type.includes("中试")) {
    return "中试基地";
  }
  if (party.typeCode === "EXPERT_REVIEWER" || party.typeCode === "EXPERT" || party.type.includes("专家")) {
    return "专家方";
  }
  if (party.typeCode === "CONTRACT_PARTY" || party.type.includes("合同")) {
    return "合同主体";
  }
  return party.type || "其他主体";
}

function PartyTypeDonut({
  points,
  total,
}: {
  points: Array<{ label: string; count: number; percent: number }>;
  total: number;
}) {
  if (!total) {
    return <p className="productEmptyChart">暂无参与方</p>;
  }
  const gradient = conicGradient(points);
  return (
    <div className="partyDonutLayout">
      <div className="partyDonut" style={{ background: gradient }}>
        <span>
          <strong>{total}</strong>
          <small>总计</small>
        </span>
      </div>
      <div className="partyDonutLegend">
        {points.map((point, index) => (
          <div key={point.label}>
            <i style={{ background: donutColors[index % donutColors.length] }} />
            <strong>{point.label}</strong>
            <small>{point.count}（{formatPercent(point.percent)}）</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function conicGradient(points: Array<{ percent: number }>) {
  let cursor = 0;
  const segments = points.map((point, index) => {
    const start = cursor;
    const end = cursor + point.percent * 100;
    cursor = end;
    return `${donutColors[index % donutColors.length]} ${start}% ${end}%`;
  });
  return `conic-gradient(${segments.join(", ")})`;
}

function formatPercent(value: number) {
  const percent = value * 100;
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(1)}%`;
}

function partyTypeDisplay(typeCode: string, fallback: string) {
  const labels: Record<string, string> = {
    DATA_PROVIDER: "数据提供方",
    OPERATOR: "运营方",
    TECH_SERVICE: "技术服务方",
    SERVICE_PROVIDER: "技术服务方",
    PILOT_BASE: "中试基地",
    EXPERT_REVIEWER: "专家方",
    EXPERT: "专家方",
    CONTRACT_PARTY: "合同主体",
  };
  return labels[typeCode] ?? fallback;
}

function isYes(value: string) {
  return /^(是|true|yes|1|enabled|active)$/i.test(value.trim());
}

function isDisabledStatus(value: string) {
  return /停用|禁用|disabled|inactive/i.test(value);
}
