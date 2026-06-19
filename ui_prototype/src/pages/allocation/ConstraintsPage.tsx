import { useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import {
  ActionButton,
  DetailDrawer,
  DrawerSection,
  MetricCard,
  PageHeader,
  TraceDrawer,
  WorkbenchCard,
} from "../../ui";
import type { DataRow } from "../../domain/types";
import type { PageProps } from "../pageTypes";

export function ConstraintsPage({ route, snapshot, onAction }: PageProps) {
  const [drawer, setDrawer] = useState<"" | "form" | "trace">("");
  const pageData = snapshot.pages[route.path];
  const constraintRows = pageData.rows;
  const metricValue = (label: string, fallback: string) =>
    pageData.metrics.find((item) => item.label === label)?.value ?? fallback;
  const firstConstraint = constraintRows[0];

  return (
    <div className="pageWorkspace phase2Page constraintsPage">
      <PageHeader
        route={{
          ...route,
          label: "合同约束管理",
          responsibility: "维护最小额、封顶、固定比例、优先分配等合同约束和应用结果。",
        }}
        snapshot={snapshot}
      />

      <div className="metricGrid five">
        <MetricCard item={{ label: "约束总数", value: metricValue("约束总数", "0"), hint: "来自后端", tone: "neutral" }} />
        <MetricCard item={{ label: "启用约束", value: metricValue("启用约束", "0"), hint: "ACTIVE 状态", tone: constraintRows.length ? "success" : "neutral" }} />
        <MetricCard item={{ label: "约束对象", value: metricValue("约束对象", "0"), hint: "主体级约束", tone: "neutral" }} />
        <MetricCard item={{ label: "检查结果", value: metricValue("检查结果", "暂无约束"), hint: "后端返回", tone: "neutral" }} />
        <MetricCard item={{ label: "被引用约束", value: metricValue("被引用约束", "后端追溯"), hint: "分配后查看轨迹", tone: "neutral" }} />
      </div>

      <WorkbenchCard
        title="约束列表"
        description="金额不能为负，比例必须在 0 到 1；合同约束按优先级执行。"
        actions={
          <>
            <ActionButton
              action={actionRegistry["CONS-002"]}
              onClick={(action) => {
                onAction(action);
                setDrawer("form");
              }}
            />
            <ActionButton
              action={actionRegistry["CONS-011"]}
              onClick={(action) => {
                onAction(action);
                setDrawer("trace");
              }}
            />
          </>
        }
      >
        <div className="tableWrap">
          <table className="dataTable phase2Table">
            <thead><tr><th>约束名称</th><th>约束对象</th><th>约束类型</th><th>约束值</th><th>优先级</th><th>生效状态</th><th>操作</th></tr></thead>
            <tbody>
              {constraintRows.length === 0 ? (
                <tr>
                  <td colSpan={7}>暂无后端合同约束记录；新增/编辑动作未执行时不会写入前端示例数据。</td>
                </tr>
              ) : constraintRows.map((item) => (
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
                          onAction(actionRegistry["CONS-003"]);
                          setDrawer("form");
                        }}
                      >
                        编辑
                      </button>
                      <button type="button" onClick={() => onAction(actionRegistry["CONS-004"])}>停用</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </WorkbenchCard>

      <div className="phase2bTwoCol">
        <WorkbenchCard title="约束检查结果" description="已被报告引用的约束只能停用，不能物理删除。">
          <div className="issueList">
            <article><strong>金额检查</strong><span>{constraintRows.length ? "后端已返回约束值。" : "暂无后端约束。"}</span></article>
            <article><strong>比例检查</strong><span>新增/编辑未接入时只显示暂不可用。</span></article>
            <article><strong>优先级检查</strong><span>{constraintRows.length ? "按后端 priority 展示。" : "等待后端约束记录。"}</span></article>
          </div>
        </WorkbenchCard>

        <WorkbenchCard title="约束类型说明" description="P0 支持主体级金额、比例和优先分配约束。">
          <div className="chipList">
            {["最小金额", "最大金额", "封顶金额", "保底金额", "固定比例", "优先分配"].map((item) => <span key={item}>{item}</span>)}
          </div>
        </WorkbenchCard>
      </div>

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
          { label: "保存约束", type: "primary", onClick: () => { onAction(actionRegistry["CONS-003"]); setDrawer(""); } },
        ]}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="约束配置">
          <div className="formGrid">
            <label>约束名称<input defaultValue={readCell(firstConstraint, "constraint_name", "")} /></label>
            <label>约束对象<input defaultValue={readCell(firstConstraint, "party_name", "")} /></label>
            <label>约束类型<select defaultValue={readCell(firstConstraint, "constraint_type", "MIN_AMOUNT")}><option value="MIN_AMOUNT">最小金额</option><option value="MAX_AMOUNT">最大金额</option><option value="CAP_AMOUNT">封顶金额</option><option value="FLOOR_AMOUNT">保底金额</option><option value="FIXED_RATIO">固定比例</option><option value="PRIORITY_ALLOCATION">优先分配</option></select></label>
            <label>约束值<input defaultValue={readCell(firstConstraint, "constraint_value", "")} /></label>
            <label>优先级<input defaultValue={readCell(firstConstraint, "priority", "")} /></label>
            <label>生效状态<select defaultValue={readCell(firstConstraint, "status", "启用")}><option>启用</option><option>停用</option></select></label>
          </div>
        </DrawerSection>
      </DetailDrawer>

      <TraceDrawer
        footerNote="每条约束应用结果写入 constraint_apply_trace；工程编号折叠展示。"
        formula="按优先级顺序应用：优先分配 -> 保底/封顶 -> 固定比例"
        objectType="约束检查"
        open={drawer === "trace"}
        output={{ 检查状态: constraintRows.length ? "已返回约束" : "暂无约束", 已应用约束数: constraintRows.length }}
        parameters={{ 金额规则: "金额非负", 比例规则: "0 到 1" }}
        title="约束检查结果"
        traceColumns={[
          { key: "constraint", label: "约束" },
          { key: "target", label: "对象" },
          { key: "result", label: "结果" },
          { key: "suggestion", label: "建议" },
        ]}
        traceRows={constraintRows.map((item) => ({
          constraint: readCell(item, "constraint_name", "未命名约束"),
          target: readCell(item, "party_name", "未指定"),
          result: readCell(item, "status", "-"),
          suggestion: "按后端约束记录执行",
        }))}
        onClose={() => setDrawer("")}
      />
    </div>
  );
}

function readCell(row: DataRow | undefined, key: string, fallback: string) {
  const value = row?.[key];
  return value === undefined || value === null || value === "" ? fallback : String(value);
}
