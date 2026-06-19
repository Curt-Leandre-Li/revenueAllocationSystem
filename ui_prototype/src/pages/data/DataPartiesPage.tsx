import { useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import {
  ActionButton,
  DetailDrawer,
  DrawerSection,
  MetricCard,
  PageHeader,
  RiskNotice,
  WorkbenchCard,
} from "../../ui";
import type { DataRow } from "../../domain/types";
import { getMockWorkspace } from "../phase2aUtils";
import type { PageProps } from "../pageTypes";

const roleTabs = ["全部", "数据源主体", "运营方 / 技术服务方 / 中试基地", "专家方", "合同主体", "停用主体"];
interface PartyListItem {
  partyId: string;
  name: string;
  type: string;
  typeCode: string;
  dataProvider: string;
  mds: string;
  resources: number;
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

const fallbackParties: PartyListItem[] = [
  { partyId: "fallback_party_a", name: "数据源主体甲", type: "数据提供方", typeCode: "DATA_PROVIDER", dataProvider: "是", mds: "是", resources: 3, status: "有效" },
  { partyId: "fallback_party_b", name: "数据源主体乙", type: "数据提供方", typeCode: "DATA_PROVIDER", dataProvider: "是", mds: "是", resources: 2, status: "有效" },
  { partyId: "fallback_party_operator", name: "运营服务方", type: "运营方", typeCode: "OPERATOR", dataProvider: "否", mds: "否", resources: 0, status: "合同优先" },
  { partyId: "fallback_party_service", name: "技术服务方", type: "技术服务方", typeCode: "SERVICE_PROVIDER", dataProvider: "否", mds: "否", resources: 0, status: "合同优先" },
  { partyId: "fallback_party_expert", name: "外部专家组", type: "专家方", typeCode: "EXPERT", dataProvider: "否", mds: "否", resources: 0, status: "有效" },
].map((party) => ({
  ...party,
  summary: party.mds === "是" ? "数据贡献主体，进入权重层候选" : "非数据贡献主体，合同优先或约束处理",
}));

function readCell(row: DataRow, key: string, fallback = "") {
  const value = row[key];
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function partyFromRow(row: DataRow, index: number): PartyListItem {
  const dataProvider = readCell(row, "is_data_provider", "否");
  const mds = readCell(row, "include_in_md_dshap", dataProvider === "是" ? "是" : "否");
  const typeCode = readCell(row, "party_type_code", dataProvider === "是" ? "DATA_PROVIDER" : "SERVICE_PROVIDER");
  return {
    partyId: readCell(row, "party_id", `party_${index + 1}`),
    name: readCell(row, "party_name", `参与方 ${index + 1}`),
    type: readCell(row, "party_type", "未分类"),
    typeCode,
    dataProvider,
    mds,
    resources: Number(readCell(row, "linked_resource_count", "0")) || 0,
    status: readCell(row, "status", "有效"),
    summary: readCell(
      row,
      "contribution_summary",
      mds === "是" ? "数据贡献主体，进入权重层候选" : "非数据贡献主体，合同优先或约束处理",
    ),
  };
}

export function DataPartiesPage({ route, snapshot, onAction, onNavigate }: PageProps) {
  const mock = getMockWorkspace(snapshot);
  const pageData = snapshot.pages[route.path];
  const parties =
    pageData.rows.length > 0 ? pageData.rows.map(partyFromRow) : fallbackParties;
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
  const dataProviderCount = parties.filter((party) => party.dataProvider === "是").length;
  const mdsCount = parties.filter((party) => party.mds === "是").length;
  const disabledCount = parties.filter((party) => party.status === "停用").length;

  return (
    <div className="pageWorkspace phase2Page partiesPage">
      <PageHeader
        route={{
          ...route,
          label: "参与方管理",
          responsibility: "维护数据源主体与非数据贡献主体，确认算法权重池边界。",
        }}
        snapshot={snapshot}
      />

      <div className="metricGrid five">
        <MetricCard item={{ label: "主体总数", value: String(parties.length), hint: "含合同优先主体", tone: "neutral" }} />
        <MetricCard item={{ label: "数据源主体", value: String(dataProviderCount), hint: "默认进入算法权重池", tone: "success" }} />
        <MetricCard item={{ label: "非数据主体", value: String(parties.length - dataProviderCount), hint: "按合同优先处理", tone: "neutral" }} />
        <MetricCard item={{ label: "权重池主体", value: String(mdsCount || mock.dataProviders.filter((item) => item.includeInMDDShap).length), hint: "仅数据提供方", tone: "success" }} />
        <MetricCard item={{ label: "停用主体", value: String(disabledCount), hint: "不参与后续计算", tone: "neutral" }} />
      </div>

      <RiskNotice compact />

      <WorkbenchCard
        title="角色分组"
        description="非数据主体不进入 MD-DShap，优先通过合同、固定比例、上下限或优先分配处理。"
        actions={
          <ActionButton
            action={actionRegistry["PARTY-002"]}
            onClick={(action) => {
              setPartyDraft(newPartyDraft());
              setDrawer("form");
            }}
          />
        }
      >
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
      </WorkbenchCard>

      <div className="phase2bTwoCol">
        <WorkbenchCard
          title="主体列表"
          description="主体边界决定资源归属和算法权重池范围。"
        >
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
                          disabled={dataProviderCount <= 1 && party.dataProvider === "是"}
                          title={dataProviderCount <= 1 && party.dataProvider === "是" ? "最后一个数据源主体不能停用" : actionRegistry["PARTY-005"].sideEffect}
                          type="button"
                          onClick={() =>
                            onAction(actionRegistry["PARTY-005"], {
                              kind: "party-status",
                              partyId: party.partyId,
                              status: nextStatus,
                              reason: "前端 Phase 2C 状态切换",
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
        </WorkbenchCard>

        <WorkbenchCard
          title="算法边界提示"
          description="MD-DShap 只计算数据源主体权重，不输出付款指令。"
          actions={
            <button className="actionButton secondary" type="button" onClick={() => onNavigate("/allocation/md-dshap")}>
              查看 MD-DShap 权重池
            </button>
          }
        >
          <div className="boundaryList">
            <article>
              <strong>数据提供方</strong>
              <span>默认进入算法权重池</span>
            </article>
            <article>
              <strong>运营方 / 技术服务方 / 中试基地</strong>
              <span>默认按合同优先或固定比例处理</span>
            </article>
            <article>
              <strong>专家方</strong>
              <span>默认不进入 MD-DShap</span>
            </article>
          </div>
        </WorkbenchCard>
      </div>

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
          <div className="checkList">
            {mock.resources.slice(0, 4).map((resource) => (
              <label key={resource.resourceKey}>
                <input type="checkbox" defaultChecked={resource.providerName !== "未关联"} />
                <span>{resource.name} / {resource.modality}</span>
              </label>
            ))}
          </div>
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
          <div className="tableWrap">
            <table className="dataTable phase2Table">
              <thead><tr><th>主体</th><th>贡献得分</th><th>效用值</th><th>权重</th></tr></thead>
              <tbody>
                {mock.mdsWeights.map((weight) => (
                  <tr key={weight.partyName}>
                    <td>{weight.partyName}</td>
                    <td>{weight.marginalContribution.toFixed(6)}</td>
                    <td>{weight.utilityValue.toFixed(6)}</td>
                    <td>{weight.normalizedWeight.toFixed(6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DrawerSection>
      </DetailDrawer>
    </div>
  );
}

function newPartyDraft(): PartyDraft {
  return {
    partyName: `前端联调参与方-${Date.now().toString().slice(-6)}`,
    partyType: "DATA_PROVIDER",
    includeInMdDshap: true,
    description: "Phase 2C 前端真实后端写入校验",
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
