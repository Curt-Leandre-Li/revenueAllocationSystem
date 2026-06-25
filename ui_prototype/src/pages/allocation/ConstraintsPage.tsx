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
  TraceDrawer,
} from "../../ui";
import { userFacingText } from "../../ui/displayText";
import type { DataRow } from "../../domain/types";
import { numericCellValue } from "../backendPageData";
import type { PageProps } from "../pageTypes";

interface ConstraintDraft {
  constraintId?: string;
  partyId: string;
  partyName: string;
  constraintName: string;
  constraintType: string;
  valueType: string;
  constraintValue: number;
  priority: number;
  status: "ACTIVE" | "DISABLED";
  description: string;
}

export function ConstraintsPage({ route, snapshot, onAction }: PageProps) {
  const [drawer, setDrawer] = useState<"" | "form" | "trace">("");
  const pageData = snapshot.pages[route.path];
  const constraintRows = pageData.rows;
  const partyOptions = (snapshot.pages["/data/parties"]?.rows ?? []).map((item, index) => ({
    partyId: readCell(item, "party_id", `party_${index + 1}`),
    partyName: readCell(item, "party_name", `参与方 ${index + 1}`),
  }));
  const [constraintDraft, setConstraintDraft] = useState<ConstraintDraft>(() =>
    newConstraintDraft(partyOptions[0]),
  );
  const metricValue = (label: string, fallback: string) =>
    pageData.metrics.find((item) => item.label === label)?.value ?? fallback;
  const summaryItems = [
    { label: "约束数量", value: metricValue("约束总数", "暂无"), hint: "系统结果", tone: "neutral" as const },
    { label: "已生效约束", value: metricValue("启用约束", "暂无"), hint: "系统结果", tone: "neutral" as const },
    { label: "优先分配项", value: metricValue("优先分配项", "暂无"), hint: "系统摘要", tone: "neutral" as const },
    { label: "命中约束数", value: metricValue("命中约束数", "暂无"), hint: "系统摘要", tone: "neutral" as const },
    { label: "未通过检查数", value: metricValue("未通过检查数", "暂无"), hint: "系统摘要", tone: "neutral" as const },
  ];
  const valuePoints = constraintRows.map((row) => ({
    label: readCell(row, "constraint_name", "未命名约束"),
    value: readCell(row, "constraint_value", "暂无"),
    numeric: numericCellValue(row.constraint_value),
    meta: readCell(row, "constraint_type_label", readCell(row, "constraint_type", "")),
  }));

  return (
    <div className="pageWorkspace leanPage constraintsPage">
      <CompactPageHeader
        title="合同约束"
        description="维护合同约束，查看生效状态、检查结果和应用轨迹。"
        primaryAction={
          <ActionButton
            action={actionRegistry["CONS-002"]}
            onClick={() => {
              setConstraintDraft(newConstraintDraft(partyOptions[0]));
              setDrawer("form");
            }}
          />
        }
        secondaryActions={
          <button
            className="actionButton secondary"
            type="button"
            onClick={() => {
              onAction(actionRegistry["CONS-011"]);
              setDrawer("trace");
            }}
          >
            约束检查
          </button>
        }
      />

      <SummaryStrip items={summaryItems} />

      <section className="resultChartGrid secondary">
        <ChartArea title="约束类型分布" source={pageData.chart?.chart_id} />
        <ChartArea title="约束值排行" source={constraintRows.length ? "rows" : undefined}>
          <ProductBarChart points={valuePoints} unit="约束值" />
        </ChartArea>
      </section>

      <section className="leanTableSection">
        <div className="leanSectionHead">
          <div>
            <h2>约束列表</h2>
            <p>金额不能为负，比例必须在 0 到 1；合同约束按优先级执行。</p>
          </div>
        </div>
        <div className="tableWrap">
          <table className="dataTable phase2Table">
            <thead><tr><th>约束名称</th><th>约束对象</th><th>约束类型</th><th>约束值</th><th>优先级</th><th>生效状态</th><th>操作</th></tr></thead>
            <tbody>
              {constraintRows.length === 0 ? (
                <tr>
                  <td colSpan={7}>暂无合同约束记录。</td>
                </tr>
              ) : constraintRows.map((item) => {
                const nextStatus = readCell(item, "status", "") === "停用" ? "ACTIVE" : "DISABLED";
                return (
                  <tr key={readCell(item, "constraint_id", readCell(item, "constraint_name", "constraint"))}>
                    <td><strong>{readCell(item, "constraint_name", "未命名约束")}</strong></td>
                    <td>{readCell(item, "party_name", "未指定")}</td>
                    <td>{readCell(item, "constraint_type_label", readCell(item, "constraint_type", "-"))}</td>
                    <td>{readCell(item, "constraint_value", "-")}</td>
                    <td>{readCell(item, "priority", "-")}</td>
                    <td><span className={readCell(item, "status", "") === "启用" ? "tag success" : "tag"}>{readCell(item, "status", "-")}</span></td>
                    <td>
                      <div className="rowAction">
                        <button
                          type="button"
                          onClick={() => {
                            setConstraintDraft(constraintDraftFromRow(item, partyOptions[0]));
                            setDrawer("form");
                          }}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onAction(actionRegistry["CONS-004"], {
                              kind: "constraint-status",
                              constraintId: readCell(item, "constraint_id", ""),
                              status: nextStatus,
                              description: "状态切换",
                            })
                          }
                        >
                          {nextStatus === "ACTIVE" ? "启用" : "停用"}
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
        footerNote="保存后写入合同约束和变更审计；金额不能为负，比例必须在 0 到 1。"
        objectType="合同约束"
        open={drawer === "form"}
        size="lg"
        title="新增 / 编辑合同约束"
        variant="form"
        actions={[
          { label: "取消", onClick: () => setDrawer("") },
          {
            label: "保存约束",
            type: "primary",
            onClick: () => {
              onAction(
                actionRegistry[constraintDraft.constraintId ? "CONS-003" : "CONS-002"],
                {
                  kind: "constraint-upsert",
                  constraintId: constraintDraft.constraintId,
                  partyId: constraintDraft.partyId,
                  constraintName: constraintDraft.constraintName,
                  constraintType: constraintDraft.constraintType,
                  valueType: constraintDraft.valueType,
                  constraintValue: constraintDraft.constraintValue,
                  priority: constraintDraft.priority,
                  status: constraintDraft.status,
                  description: constraintDraft.description,
                },
              );
              setDrawer("");
            },
          },
        ]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="约束配置">
          <div className="formGrid">
            <label>约束名称<input value={constraintDraft.constraintName} onChange={(event) => setConstraintDraft((current) => ({ ...current, constraintName: event.target.value }))} /></label>
            <label>
              约束对象
              <select
                value={constraintDraft.partyId}
                onChange={(event) => {
                  const party = partyOptions.find((item) => item.partyId === event.target.value);
                  setConstraintDraft((current) => ({
                    ...current,
                    partyId: event.target.value,
                    partyName: party?.partyName ?? current.partyName,
                  }));
                }}
              >
                {partyOptions.length ? partyOptions.map((party) => (
                  <option key={party.partyId} value={party.partyId}>{party.partyName}</option>
                )) : <option value="">暂无参与方</option>}
              </select>
            </label>
            <label>
              约束类型
              <select
                value={constraintDraft.constraintType}
                onChange={(event) =>
                  setConstraintDraft((current) => ({
                    ...current,
                    constraintType: event.target.value,
                    valueType: event.target.value === "FIXED_RATIO" ? "RATIO" : "AMOUNT",
                  }))
                }
              >
                <option value="MIN_AMOUNT">最小金额</option>
                <option value="MAX_AMOUNT">最大金额</option>
                <option value="CAP_AMOUNT">封顶金额</option>
                <option value="FLOOR_AMOUNT">保底金额</option>
                <option value="FIXED_RATIO">固定比例</option>
                <option value="PRIORITY_ALLOCATION">优先分配</option>
              </select>
            </label>
            <label>约束值<input type="number" value={constraintDraft.constraintValue} onChange={(event) => setConstraintDraft((current) => ({ ...current, constraintValue: Number(event.target.value) }))} /></label>
            <label>优先级<input type="number" value={constraintDraft.priority} onChange={(event) => setConstraintDraft((current) => ({ ...current, priority: Number(event.target.value) }))} /></label>
            <label>
              生效状态
              <select value={constraintDraft.status} onChange={(event) => setConstraintDraft((current) => ({ ...current, status: event.target.value as ConstraintDraft["status"] }))}>
                <option value="ACTIVE">启用</option>
                <option value="DISABLED">停用</option>
              </select>
            </label>
          </div>
        </DrawerSection>
      </DetailDrawer>

      <TraceDrawer
        footerNote="约束检查轨迹用于审计说明，不作为法律结算或付款依据。"
        objectType="约束检查"
        open={drawer === "trace"}
        output={{ 检查结果: constraintRows.length ? "已返回约束记录" : "暂无约束记录" }}
        statusTag="只读"
        summary="展示约束检查结果和应用轨迹；不在页面计算约束差额。"
        technicalDetails={pageData.technicalDetails}
        title="约束检查详情"
        traceColumns={[
          { key: "constraint_name", label: "约束名称" },
          { key: "party_name", label: "约束对象" },
          { key: "constraint_type", label: "类型" },
          { key: "status", label: "状态" },
        ]}
        traceRows={constraintRows}
        onClose={() => setDrawer("")}
      />
    </div>
  );
}

function readCell(row: DataRow | undefined, key: string, fallback: string) {
  const value = row?.[key];
  return value === undefined || value === null || value === "" ? fallback : userFacingText(value);
}

function newConstraintDraft(fallbackParty?: { partyId: string; partyName: string }): ConstraintDraft {
  return {
    partyId: fallbackParty?.partyId ?? "",
    partyName: fallbackParty?.partyName ?? "",
    constraintName: `新约束草稿-${Date.now().toString().slice(-6)}`,
    constraintType: "MIN_AMOUNT",
    valueType: "AMOUNT",
    constraintValue: 0,
    priority: 100,
    status: "ACTIVE",
    description: "本地演示合同约束草稿",
  };
}

function constraintDraftFromRow(
  row: DataRow,
  fallbackParty?: { partyId: string; partyName: string },
): ConstraintDraft {
  return {
    constraintId:
      row.constraint_id === undefined || row.constraint_id === null || row.constraint_id === ""
        ? undefined
        : userFacingText(row.constraint_id),
    partyId: readCell(row, "party_id", fallbackParty?.partyId ?? ""),
    partyName: readCell(row, "party_name", fallbackParty?.partyName ?? ""),
    constraintName: readCell(row, "constraint_name", "未命名约束"),
    constraintType: readCell(row, "constraint_type", "MIN_AMOUNT"),
    valueType: readCell(row, "value_type", "AMOUNT"),
    constraintValue: Number(readCell(row, "constraint_value", "0")) || 0,
    priority: Number(readCell(row, "priority", "100")) || 100,
    status: readCell(row, "status", "启用") === "停用" ? "DISABLED" : "ACTIVE",
    description: readCell(row, "description", "本地演示合同约束草稿"),
  };
}
