import { useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import {
  ActionButton,
  ChartArea,
  CompactPageHeader,
  DetailDrawer,
  DrawerSection,
  EmptyGuide,
  ProductBarChart,
  SummaryStrip,
} from "../../ui";
import { userFacingText } from "../../ui/displayText";
import type { DataRow } from "../../domain/types";
import type { PageProps } from "../pageTypes";
import { numericCellValue } from "../backendPageData";

const roleTabs = ["全部", "数据源主体", "运营方 / 技术服务方 / 中试基地", "专家方", "合同主体", "停用主体"];
interface PartyListItem {
  partyId: string;
  name: string;
  type: string;
  typeCode: string;
  dataProvider: string;
  mds: string;
  resources: string;
  status: string;
  summary: string;
}

interface PartyDraft {
  partyId?: string;
  partyName: string;
  partyType: string;
  includeInMdDshap: boolean;
  description: string;
}

function readCell(row: DataRow, key: string, fallback = "") {
  const value = row[key];
  return value === undefined || value === null || value === "" ? fallback : userFacingText(value);
}

function partyFromRow(row: DataRow, index: number): PartyListItem {
  const dataProvider = readCell(row, "is_data_provider", "暂无");
  const mds = readCell(row, "include_in_md_dshap", "暂无");
  const typeCode = readCell(row, "party_type_code", "暂无");
  return {
    partyId: readCell(row, "party_id", `party_${index + 1}`),
    name: readCell(row, "party_name", "暂无"),
    type: readCell(row, "party_type", "未分类"),
    typeCode,
    dataProvider,
    mds,
    resources: readCell(row, "linked_resource_count", "暂无"),
    status: readCell(row, "status", "暂无"),
    summary: readCell(row, "contribution_summary", "暂无"),
  };
}

export function DataPartiesPage({ route, snapshot, onAction, onNavigate }: PageProps) {
  const pageData = snapshot.pages[route.path];
  const parties = pageData.rows.map(partyFromRow);
  const partyMetrics = new Map(pageData.metrics.map((item) => [item.label, item]));
  const [activeTab, setActiveTab] = useState("全部");
  const [drawer, setDrawer] = useState<"" | "form" | "contribution" | "link">("");
  const [partyDraft, setPartyDraft] = useState<PartyDraft>(() => newPartyDraft());
  const filteredParties =
    activeTab === "全部"
      ? parties
      : activeTab === "数据源主体"
        ? parties.filter((party) => party.dataProvider === "是")
        : activeTab === "停用主体"
        ? parties.filter((party) => party.status === "停用")
          : parties.filter((party) => activeTab.includes(party.type) || party.status === "合同优先");
  const summaryItems = [
    partyMetrics.get("参与方") ?? { label: "参与方", value: "暂无", hint: "待生成", tone: "neutral" as const },
    partyMetrics.get("数据源主体") ?? { label: "数据源主体", value: "暂无", hint: "系统摘要", tone: "neutral" as const },
    { label: "非数据主体", value: "暂无", hint: "系统摘要", tone: "neutral" as const },
    partyMetrics.get("进入权重池") ?? { label: "权重池主体", value: "暂无", hint: "系统摘要", tone: "neutral" as const },
    { label: "停用主体", value: "暂无", hint: "系统摘要", tone: "neutral" as const },
  ];
  const resourceRankPoints = parties.map((party) => ({
    label: party.name,
    value: party.resources,
    numeric: numericCellValue(party.resources),
    meta: party.type,
  }));

  return (
    <div className="pageWorkspace leanPage partiesPage">
      <CompactPageHeader
        title="参与方"
        description="维护参与主体、角色边界、关联资源和是否参与权重计算。"
        primaryAction={
          <ActionButton
            action={actionRegistry["PARTY-002"]}
            onClick={() => {
              setPartyDraft(newPartyDraft());
              setDrawer("form");
            }}
          />
        }
      />

      <SummaryStrip items={summaryItems} />

      <section className="leanFilterBar">
        <div className="tabStrip">
          {roleTabs.map((tab) => (
            <button
              className={tab === activeTab ? "active" : ""}
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </section>

      <section className="resultChartGrid secondary">
        <ChartArea title="参与方类型分布" source={pageData.chart?.chart_id} />
        <ChartArea title="资源关联排行" source={parties.length ? "rows" : undefined}>
          <ProductBarChart points={resourceRankPoints} unit="关联资源" />
        </ChartArea>
      </section>

      <section className="leanTableSection">
        <div className="leanSectionHead">
          <div>
            <h2>主体列表</h2>
            <p>主体边界决定资源归属和权重计算范围。</p>
          </div>
          <button className="textLinkButton" type="button" onClick={() => onNavigate("/allocation/md-dshap")}>
            查看权重结果
          </button>
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
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredParties.map((party) => {
                  const nextStatus = party.status === "停用" ? "ENABLED" : "DISABLED";
                  const statusLabel = nextStatus === "ENABLED" ? "启用" : "停用";
                  return (
                  <tr key={party.partyId}>
                    <td><strong>{party.name}</strong></td>
                    <td>{party.type}</td>
                    <td>{party.dataProvider}</td>
                    <td><span className={`tag ${party.mds === "是" ? "success" : "neutral"}`}>{party.mds}</span></td>
                    <td>{party.resources}</td>
                    <td title={party.summary}>{party.status}</td>
                    <td>
                      <div className="rowAction">
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
                          type="button"
                          onClick={() => {
                            onAction(actionRegistry["PARTY-006"]);
                            setDrawer("link");
                          }}
                        >
                          关联资源
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onAction(actionRegistry["PARTY-008"]);
                            setDrawer("contribution");
                          }}
                        >
                          贡献结果
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
      </section>

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
                  includeInMdDshap: partyDraft.includeInMdDshap,
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
                <option value="SERVICE_PROVIDER">技术服务方</option>
                <option value="OPERATOR">运营方</option>
                <option value="EXPERT">专家方</option>
              </select>
            </label>
            <label>
              是否数据源主体
              <input readOnly value={partyDraft.partyType === "DATA_PROVIDER" ? "是" : "否"} />
            </label>
            <label>
              是否进入算法权重池
              <select
                value={partyDraft.includeInMdDshap ? "是" : "否"}
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
            title="暂无可选资源"
            description="当前请先在数据资源页维护主体关系；这里不会显示未生成的资源列表。"
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
    description: "本地演示新增参与方草稿",
  };
}

function partyDraftFromItem(party: PartyListItem): PartyDraft {
  return {
    partyId: party.partyId,
    partyName: party.name,
    partyType: party.typeCode,
    includeInMdDshap: party.mds === "是",
    description: party.summary,
  };
}
