import { useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import {
  ActionButton,
  DetailDrawer,
  DrawerSection,
  EmptyGuide,
  MetricCard,
  PageHeader,
  RiskNotice,
  WorkbenchCard,
} from "../../ui";
import type { DataRow } from "../../domain/types";
import type { PageProps } from "../pageTypes";

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
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function partyFromRow(row: DataRow, index: number): PartyListItem {
  const dataProvider = readCell(row, "is_data_provider", "后端未返回");
  const mds = readCell(row, "include_in_md_dshap", "后端未返回");
  const typeCode = readCell(row, "party_type_code", "后端未返回");
  return {
    partyId: readCell(row, "party_id", `backend_party_${index + 1}`),
    name: readCell(row, "party_name", "后端未返回"),
    type: readCell(row, "party_type", "未分类"),
    typeCode,
    dataProvider,
    mds,
    resources: readCell(row, "linked_resource_count", "后端未返回"),
    status: readCell(row, "status", "后端未返回"),
    summary: readCell(row, "contribution_summary", "后端未返回"),
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
        <MetricCard item={partyMetrics.get("参与方") ?? { label: "参与方", value: "后端未返回", hint: "需要 party summary DTO", tone: "neutral" }} />
        <MetricCard item={partyMetrics.get("数据源主体") ?? { label: "数据源主体", value: "后端摘要待补", hint: "不在前端聚合", tone: "neutral" }} />
        <MetricCard item={{ label: "非数据主体", value: "后端摘要待补", hint: "不在前端聚合", tone: "neutral" }} />
        <MetricCard item={partyMetrics.get("进入权重池") ?? { label: "权重池主体", value: "后端摘要待补", hint: "需要 participant-pool DTO", tone: "neutral" }} />
        <MetricCard item={{ label: "停用主体", value: "后端摘要待补", hint: "不在前端聚合", tone: "neutral" }} />
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
                          title="最后一个数据源主体、枚举合法性等规则由后端守卫返回。"
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
          <EmptyGuide
            title="后端未提供参与方中心资源关联 DTO"
            description="当前只保留资源页的主体关系入口；参与方页不再展示 mock 资源列表或假保存。"
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
            title="后端未提供参与方贡献摘要 DTO"
            description="贡献得分、效用值和权重摘要必须来自 contribution/utility/MD-DShap 后端结果；页面不再展示 mock 权重。"
          />
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
