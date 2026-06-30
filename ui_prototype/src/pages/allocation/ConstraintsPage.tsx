import { useEffect, useMemo, useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import { contractRatioStatusLabel } from "../../domain/status";
import type { DataRow, RoutePath } from "../../domain/types";
import {
  CompactPageHeader,
  DetailDrawer,
  DrawerSection,
  InlineNotice,
  SummaryStrip,
} from "../../ui";
import type { PageProps } from "../pageTypes";
import {
  displayPartyName,
  formatPercent,
  formatYuan,
  useAllocationContext,
} from "./allocationContext";

type DrawerMode = "" | "pool" | "party";

interface RatioItemDraft {
  localId: string;
  itemId?: string;
  partyId: string;
  percent: string;
  basisText: string;
}

interface RatioDraft {
  poolPercent: string;
  items: RatioItemDraft[];
}

interface PartyRatioDraft {
  index: number | null;
  partyId: string;
  percent: string;
  basisText: string;
}

export function ConstraintsPage({ route, snapshot, onAction, onNavigate }: PageProps) {
  const allocation = useAllocationContext(snapshot);
  const pageData = snapshot.pages[route.path];
  const rows = pageData.rows;
  const details = pageData.technicalDetails;
  const configured = readBool(details, "configured");
  const canSimulate = readBool(details, "can_simulate");
  const blockingReasons = parseStringList(readCell(details, "blocking_reasons_json"));
  const summary = parseRecord(readCell(details, "allocation_summary_json"));
  const currency = readCell(details, "currency", "CNY");
  const totalRevenue = readCell(details, "total_revenue");
  const planId = readCell(details, "plan_id");
  const contractStatus = readCell(details, "status", "EMPTY");
  const [draft, setDraft] = useState<RatioDraft>(() => draftFromRows(rows, details));
  const [dirty, setDirty] = useState(false);
  const [drawer, setDrawer] = useState<DrawerMode>("");
  const [partyDraft, setPartyDraft] = useState<PartyRatioDraft>(() =>
    emptyPartyDraft(allocation.nonDataParties[0]?.partyId ?? ""),
  );
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    setDraft(draftFromRows(rows, details));
    setDirty(false);
    setLocalError("");
  }, [planId, rows, details]);

  const displayRows = dirty ? draftRowsFromDraft(draft, allocation.nonDataParties) : rows;
  const poolRow = displayRows.find((row) => readCell(row, "bucket_type") === "DATA_PROVIDER_POOL");
  const nonDataRows = displayRows.filter((row) => readCell(row, "bucket_type") === "NON_DATA_PARTY");
  const usedPartyIds = new Set(draft.items.map((item) => item.partyId).filter(Boolean));
  const validation = validateDraft(draft, totalRevenue, allocation.nonDataParties.map((party) => party.partyId));
  const canSave = validation.length === 0 && snapshot.backend?.connected !== false;

  const summaryItems = [
    {
      label: "合同规则状态",
      value: contractRatioStatusLabel(contractStatus),
      hint: configured ? "后端已返回保存方案" : "后端未返回保存方案",
      tone: configured ? "success" as const : "warning" as const,
    },
    {
      label: "合同比例合计",
      value: formatPercentValue(readCell(details, "ratio_sum")),
      hint: "必须等于 100.0000%",
      tone: readCell(details, "ratio_sum") === "1.000000" ? "success" as const : "warning" as const,
    },
    {
      label: "数据源收益池比例",
      value: formatPercentValue(readCell(details, "data_provider_pool_ratio")),
      hint: "后端 contract-ratio 字段",
      tone: readCell(details, "data_provider_pool_ratio") ? "success" as const : "warning" as const,
    },
    {
      label: "可执行模拟",
      value: canSimulate ? "是" : "否",
      hint: "以后端 can_simulate 为准",
      tone: canSimulate ? "success" as const : "warning" as const,
    },
  ];

  async function savePlan(navigate = false) {
    const errors = validateDraft(draft, totalRevenue, allocation.nonDataParties.map((party) => party.partyId));
    if (errors.length) {
      setLocalError(errors.join("；"));
      return;
    }
    setLocalError("");
    await onAction({ ...actionRegistry["CONS-003"], requiresConfirmation: false }, {
      kind: "contract-ratio-save",
      totalRevenue,
      currency,
      dataProviderPoolRatio: percentToRatio(draft.poolPercent),
      items: draft.items.map((item) => ({
        bucketType: "NON_DATA_PARTY" as const,
        partyId: item.partyId,
        ratio: percentToRatio(item.percent),
        basisText: item.basisText.trim() || undefined,
      })),
    });
    setDirty(false);
    if (navigate) {
      onNavigate("/allocation/simulation" as RoutePath);
    }
  }

  async function clearPlan() {
    const ok = window.confirm("清空当前项目合同比例分配方案？");
    if (!ok) {
      return;
    }
    await onAction({ ...actionRegistry["CONS-004"], requiresConfirmation: false }, {
      kind: "contract-ratio-clear",
    });
    setDirty(false);
  }

  function openPoolDrawer() {
    setDrawer("pool");
  }

  function openAddPartyDrawer() {
    const nextParty = allocation.nonDataParties.find((party) => !usedPartyIds.has(party.partyId));
    setPartyDraft(emptyPartyDraft(nextParty?.partyId ?? allocation.nonDataParties[0]?.partyId ?? ""));
    setDrawer("party");
  }

  function openEditPartyDrawer(index: number) {
    const item = draft.items[index];
    setPartyDraft({
      index,
      partyId: item.partyId,
      percent: item.percent,
      basisText: item.basisText,
    });
    setDrawer("party");
  }

  function applyPartyDraft() {
    if (!partyDraft.partyId) {
      setLocalError("请选择非数据主体");
      return;
    }
    if (!isValidPercent(partyDraft.percent, true)) {
      setLocalError("请输入 0 到 100 之间的合同比例");
      return;
    }
    setDraft((current) => {
      const nextItem: RatioItemDraft = {
        localId: partyDraft.index === null
          ? `local_${Date.now()}`
          : current.items[partyDraft.index]?.localId ?? `local_${Date.now()}`,
        itemId: partyDraft.index === null ? undefined : current.items[partyDraft.index]?.itemId,
        partyId: partyDraft.partyId,
        percent: partyDraft.percent,
        basisText: partyDraft.basisText,
      };
      if (partyDraft.index === null) {
        return { ...current, items: [...current.items, nextItem] };
      }
      return {
        ...current,
        items: current.items.map((item, index) => index === partyDraft.index ? nextItem : item),
      };
    });
    setDirty(true);
    setDrawer("");
    setLocalError("");
  }

  function removePartyDraft(index: number) {
    setDraft((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
    setDirty(true);
  }

  const partyOptionsForDrawer = useMemo(() => {
    const currentPartyId = partyDraft.index === null ? "" : partyDraft.partyId;
    return allocation.nonDataParties.filter((party) => !usedPartyIds.has(party.partyId) || party.partyId === currentPartyId);
  }, [allocation.nonDataParties, partyDraft.index, partyDraft.partyId, usedPartyIds]);

  return (
    <div className="pageWorkspace leanPage contractRatioPage allocationRefinePage">
      <CompactPageHeader
        title="合同分配规则"
        description="配置合同比例方案。系统先按合同比例划分非数据主体金额与数据源收益池，数据源收益池再按 MD-DShap 权重分配给数据源主体。"
        primaryAction={
          <button
            className="actionButton primary"
            disabled={!canSave}
            title={canSave ? "保存合同比例方案" : validation.join("；")}
            type="button"
            onClick={() => savePlan(false)}
          >
            保存合同比例方案
          </button>
        }
        secondaryActions={
          <>
            <button className="actionButton secondary" type="button" onClick={openPoolDrawer}>
              编辑数据源池比例
            </button>
            <button
              className="actionButton secondary"
              disabled={!allocation.nonDataParties.length}
              type="button"
              onClick={openAddPartyDrawer}
            >
              新增非数据主体比例
            </button>
          </>
        }
      />

      <InlineNotice tone="warning" title="模拟参考边界">
        合同分配规则仅用于收益分配模拟参考，不构成法律结算、付款指令或合同履约结果。
      </InlineNotice>

      <SummaryStrip items={summaryItems} />

      {dirty ? (
        <InlineNotice tone="warning" title="有未保存修改">
          当前输入仅为临时编辑状态，保存成功后以系统返回的金额、比例和状态为准。
        </InlineNotice>
      ) : null}

      {dirty && validation.length ? (
        <InlineNotice tone="danger" title="保存前需补齐">
          <ul>
            {validation.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </InlineNotice>
      ) : null}

      {localError ? (
        <InlineNotice tone="danger" title="本地校验未通过">
          {localError}
        </InlineNotice>
      ) : null}

      <section className="contractRatioGrid">
        <article className="allocationPanel tablePanel contractRatioTablePanel">
          <div className="allocationPanelHead">
            <div>
              <h2>合同比例分配方案</h2>
            </div>
          </div>

          {displayRows.length ? (
            <div className="tableWrap">
              <table className="dataTable phase2Table contractRatioTable">
                <thead>
                  <tr>
                    <th>分配对象</th>
                    <th>对象类型</th>
                    <th>合同比例</th>
                    <th>预计金额</th>
                    <th>金额来源</th>
                    <th>说明</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {poolRow ? (
                    <tr>
                      <td><strong>{readCell(poolRow, "party_name")}</strong></td>
                      <td><span className="tag info">DATA_PROVIDER_POOL</span></td>
                      <td>{formatPercentValue(readCell(poolRow, "ratio"))}</td>
                      <td>{formatCurrency(readCell(poolRow, "calculated_amount"), currency)}</td>
                      <td>{readCell(poolRow, "amount_source") || "-"}</td>
                      <td>{readCell(poolRow, "basis_text") || "-"}</td>
                      <td><button type="button" onClick={openPoolDrawer}>编辑</button></td>
                    </tr>
                  ) : null}
                  {nonDataRows.map((row, index) => (
                    <tr key={readCell(row, "item_id", `${readCell(row, "party_id")}-${index}`)}>
                      <td><strong>{readCell(row, "party_name")}</strong></td>
                      <td>{readCell(row, "party_type") || "-"}</td>
                      <td>{formatPercentValue(readCell(row, "ratio"))}</td>
                      <td>{formatCurrency(readCell(row, "calculated_amount"), currency)}</td>
                      <td>{readCell(row, "amount_source") || "-"}</td>
                      <td>{readCell(row, "basis_text") || "-"}</td>
                      <td>
                        <div className="rowAction">
                          <button type="button" onClick={() => openEditPartyDrawer(index)}>编辑</button>
                          <button type="button" onClick={() => removePartyDraft(index)}>移除</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="operationEmptyState contractRatioEmpty">
              <strong>当前项目尚未保存合同比例分配方案。</strong>
              <p>请先编辑数据源收益池比例，并新增需要按合同比例获得金额的非数据主体。</p>
              <div>
                <button className="actionButton secondary" type="button" onClick={openPoolDrawer}>
                  编辑数据源池比例
                </button>
                <button
                  className="actionButton primary"
                  disabled={!allocation.nonDataParties.length}
                  type="button"
                  onClick={openAddPartyDrawer}
                >
                  新增非数据主体比例
                </button>
              </div>
            </div>
          )}

          <div className="contractDraftPanel">
            <div>
              <span>临时比例合计</span>
              <strong>{draftRatioSum(draft).toFixed(4)}%</strong>
            </div>
            <div>
              <span>数据源收益池</span>
              <strong>{draft.poolPercent ? `${Number(draft.poolPercent).toFixed(4)}%` : "未输入"}</strong>
            </div>
            <div>
              <span>非数据主体行</span>
              <strong>{draft.items.length}</strong>
            </div>
          </div>
        </article>

        <aside className="allocationPanel contractPreviewPanel">
          <div className="allocationPanelHead">
            <h2>收益流向预览</h2>
            <button type="button" onClick={() => onNavigate("/allocation/simulation" as RoutePath)}>
              去模拟页
            </button>
          </div>
          <dl className="summaryRows">
            <div>
              <dt>总收益</dt>
              <dd>{formatCurrency(totalRevenue, currency)}</dd>
            </div>
            <div>
              <dt>数据源收益池金额</dt>
              <dd>{formatCurrency(readCell(details, "data_provider_revenue_pool"), currency)}</dd>
            </div>
            <div>
              <dt>非数据主体合同金额</dt>
              <dd>{formatCurrency(readCell(summary, "non_data_contract_amount"), currency)}</dd>
            </div>
            <div>
              <dt>MD-DShap 权重任务</dt>
              <dd>{readCell(summary, "weight_task_id") || "后端未返回"}</dd>
            </div>
            <div>
              <dt>权重合计</dt>
              <dd>{readCell(summary, "weight_sum") || "后端未返回"}</dd>
            </div>
          </dl>
          <div className="contractFlowRail" aria-label="收益分配流程">
            <FlowNode label="总收益" value={formatCurrency(totalRevenue, currency)} />
            <FlowNode label="合同比例划分" value={formatPercentValue(readCell(details, "ratio_sum"))} />
            <FlowNode label="数据源收益池" value={formatCurrency(readCell(details, "data_provider_revenue_pool"), currency)} />
            <FlowNode label="MD-DShap 权重分配" value={readCell(summary, "weight_sum") || "待完成"} />
            <FlowNode label="最终结果" value={canSimulate ? "可生成" : "待补齐"} muted={!canSimulate} />
          </div>
          <div className={canSimulate ? "contractCheck ok" : "contractCheck warn"}>
            <strong>{canSimulate ? "满足收益分配模拟条件" : "暂不可执行收益分配模拟"}</strong>
            {blockingReasons.length ? (
              <ul>
                {blockingReasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
            ) : (
              <p>合同比例方案、总收益和 MD-DShap 权重均以后端返回为准。</p>
            )}
          </div>
        </aside>
      </section>

      <footer className="contractStickyActions">
        <button className="actionButton danger" disabled={!configured && !dirty} type="button" onClick={clearPlan}>
          清空配置
        </button>
        <div>
          <button className="actionButton secondary" disabled={!canSave} type="button" onClick={() => savePlan(false)}>
            保存合同比例方案
          </button>
          <button className="actionButton primary" disabled={!canSave} type="button" onClick={() => savePlan(true)}>
            保存并去收益分配模拟
          </button>
        </div>
      </footer>

      <DetailDrawer
        dirty={dirty}
        footerNote="比例输入按百分比展示，提交给系统前转换为 0 到 1 的六位小数字符串。"
        objectType="数据源收益池比例"
        open={drawer === "pool"}
        size="md"
        title="编辑数据源收益池比例"
        variant="form"
        actions={[
          { label: "取消", onClick: () => setDrawer("") },
          { label: "保存输入", type: "primary", onClick: () => {
            setDirty(true);
            setDrawer("");
          } },
        ]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="比例输入">
          <div className="formGrid">
            <label>
              数据源收益池比例（%）
              <input
                value={draft.poolPercent}
                inputMode="decimal"
                placeholder="输入百分比"
                onChange={(event) => {
                  setDraft((current) => ({ ...current, poolPercent: event.target.value }));
                  setDirty(true);
                }}
              />
            </label>
          </div>
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        dirty={Boolean(partyDraft.percent || partyDraft.basisText)}
        footerNote="候选对象仅包含后端返回的非数据主体；保存后正式金额以系统返回为准。"
        objectType="非数据主体比例"
        open={drawer === "party"}
        size="md"
        title={partyDraft.index === null ? "新增非数据主体比例" : "编辑非数据主体比例"}
        variant="form"
        actions={[
          { label: "取消", onClick: () => setDrawer("") },
          { label: "保存输入", type: "primary", disabled: !partyDraft.partyId, onClick: applyPartyDraft },
        ]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="主体与比例">
          <div className="formGrid">
            <label>
              非数据主体
              <select
                value={partyDraft.partyId}
                onChange={(event) => setPartyDraft((current) => ({ ...current, partyId: event.target.value }))}
              >
                {partyOptionsForDrawer.length ? partyOptionsForDrawer.map((party) => (
                  <option key={party.partyId} value={party.partyId}>
                    {displayPartyName(party.partyName)} / {party.partyTypeLabel}
                  </option>
                )) : <option value="">无可选非数据主体</option>}
              </select>
            </label>
            <label>
              合同比例（%）
              <input
                value={partyDraft.percent}
                inputMode="decimal"
                placeholder="输入百分比"
                onChange={(event) => setPartyDraft((current) => ({ ...current, percent: event.target.value }))}
              />
            </label>
            <label className="wide">
              说明
              <textarea
                value={partyDraft.basisText}
                onChange={(event) => setPartyDraft((current) => ({ ...current, basisText: event.target.value }))}
              />
            </label>
          </div>
        </DrawerSection>
      </DetailDrawer>
    </div>
  );
}

function FlowNode({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={muted ? "muted" : ""}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function draftFromRows(rows: DataRow[], details: DataRow): RatioDraft {
  const poolRatio =
    rows.find((row) => readCell(row, "bucket_type") === "DATA_PROVIDER_POOL")?.ratio ??
    readCell(details, "data_provider_pool_ratio");
  return {
    poolPercent: ratioToPercentInput(String(poolRatio ?? "")),
    items: rows
      .filter((row) => readCell(row, "bucket_type") === "NON_DATA_PARTY")
      .map((row, index) => ({
        localId: readCell(row, "item_id", `item_${index}`),
        itemId: readCell(row, "item_id"),
        partyId: readCell(row, "party_id"),
        percent: ratioToPercentInput(readCell(row, "ratio")),
        basisText: readCell(row, "basis_text"),
      })),
  };
}

function draftRowsFromDraft(
  draft: RatioDraft,
  nonDataParties: Array<{
    partyId: string;
    partyName: string;
    partyTypeCode: string;
    partyTypeLabel: string;
  }>,
): DataRow[] {
  const rows: DataRow[] = [];
  if (draft.poolPercent.trim()) {
    rows.push({
      item_id: "draft_pool",
      bucket_type: "DATA_PROVIDER_POOL",
      party_id: "",
      party_name: "数据源收益池",
      party_type: "DATA_PROVIDER_POOL",
      ratio: percentToDisplayRatio(draft.poolPercent),
      calculated_amount: "",
      amount_source: "保存后由后端计算",
      basis_text: "数据源主体收益池，保存后按 MD-DShap 权重分配",
    });
  }
  for (const [index, item] of draft.items.entries()) {
    const party = nonDataParties.find((candidate) => candidate.partyId === item.partyId);
    rows.push({
      item_id: item.localId || `draft_item_${index}`,
      bucket_type: "NON_DATA_PARTY",
      party_id: item.partyId,
      party_name: party ? displayPartyName(party.partyName) : item.partyId || "未选择主体",
      party_type: party?.partyTypeCode || party?.partyTypeLabel || "NON_DATA_PARTY",
      ratio: percentToDisplayRatio(item.percent),
      calculated_amount: "",
      amount_source: "保存后由后端计算",
      basis_text: item.basisText || "待保存",
      sort_no: index + 2,
    });
  }
  return rows;
}

function emptyPartyDraft(partyId: string): PartyRatioDraft {
  return { index: null, partyId, percent: "", basisText: "" };
}

function validateDraft(draft: RatioDraft, totalRevenue: string, nonDataPartyIds: string[]) {
  const errors: string[] = [];
  if (!totalRevenue) {
    errors.push("后端未返回 total_revenue，不能保存方案");
  }
  if (!isValidPercent(draft.poolPercent, true)) {
    errors.push("数据源收益池比例必须大于 0 且不超过 100");
  }
  const partyIds = new Set<string>();
  for (const [index, item] of draft.items.entries()) {
    if (!item.partyId || !nonDataPartyIds.includes(item.partyId)) {
      errors.push(`第 ${index + 1} 行必须选择非数据主体`);
    }
    if (partyIds.has(item.partyId)) {
      errors.push("同一非数据主体不能重复配置");
    }
    partyIds.add(item.partyId);
    if (!isValidPercent(item.percent, false)) {
      errors.push(`第 ${index + 1} 行合同比例必须大于等于 0 且不超过 100`);
    }
  }
  if (Math.abs(draftRatioSum(draft) - 100) > 0.0001) {
    errors.push("合同比例合计必须等于 100.0000%");
  }
  return errors;
}

function draftRatioSum(draft: RatioDraft) {
  return Number(draft.poolPercent || 0) + draft.items.reduce((total, item) => total + Number(item.percent || 0), 0);
}

function isValidPercent(raw: string, requirePositive: boolean) {
  if (!raw.trim()) {
    return false;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return false;
  }
  return requirePositive ? value > 0 && value <= 100 : value >= 0 && value <= 100;
}

function ratioToPercentInput(raw: string) {
  if (!raw) {
    return "";
  }
  const ratio = Number(raw);
  if (!Number.isFinite(ratio)) {
    return "";
  }
  return (ratio * 100).toFixed(4);
}

function percentToRatio(raw: string) {
  return (Number(raw) / 100).toFixed(6);
}

function percentToDisplayRatio(raw: string) {
  const value = Number(raw);
  return Number.isFinite(value) ? (value / 100).toFixed(6) : "";
}

function formatPercentValue(raw: string) {
  const value = Number(raw);
  return Number.isFinite(value)
    ? `${(value * 100).toLocaleString("zh-CN", {
        maximumFractionDigits: 4,
        minimumFractionDigits: 4,
      })}%`
    : "后端未返回";
}

function formatCurrency(raw: string, currency: string) {
  if (!raw.trim()) {
    return "后端未返回";
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return "后端未返回";
  }
  return `${formatYuan(value)} ${currency}`;
}

function readCell(row: DataRow | Record<string, unknown> | undefined, key: string, fallback = "") {
  const value = row?.[key];
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return String(value);
}

function readBool(row: DataRow | undefined, key: string) {
  return ["true", "是", "1", "SAVED", "LOCKED"].includes(readCell(row, key));
}

function parseStringList(raw: string) {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function parseRecord(raw: string): Record<string, unknown> {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}
