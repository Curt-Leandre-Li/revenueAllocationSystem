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
import type { PageProps } from "../pageTypes";

const constraints = [
  { name: "运营服务优先分配", target: "运营服务方", type: "PRIORITY_ALLOCATION", value: "40,000.00", priority: 1, status: "启用" },
  { name: "数据源主体丙最低额", target: "数据源主体丙", type: "FLOOR_AMOUNT", value: "95,000.00", priority: 2, status: "启用" },
  { name: "单主体封顶", target: "数据源主体甲", type: "CAP_AMOUNT", value: "190,000.00", priority: 3, status: "启用" },
];

const constraintTypeLabels: Record<string, string> = {
  MIN_AMOUNT: "最小金额",
  MAX_AMOUNT: "最大金额",
  CAP_AMOUNT: "封顶金额",
  FLOOR_AMOUNT: "保底金额",
  FIXED_RATIO: "固定比例",
  PRIORITY_ALLOCATION: "优先分配",
};

export function ConstraintsPage({ route, snapshot, onAction }: PageProps) {
  const [drawer, setDrawer] = useState<"" | "form" | "trace">("");

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
        <MetricCard item={{ label: "约束总数", value: String(constraints.length), hint: "含优先分配", tone: "neutral" }} />
        <MetricCard item={{ label: "启用约束", value: "3", hint: "按优先级执行", tone: "success" }} />
        <MetricCard item={{ label: "约束对象", value: "3", hint: "主体级约束", tone: "neutral" }} />
        <MetricCard item={{ label: "检查结果", value: "通过", hint: "无负金额", tone: "success" }} />
        <MetricCard item={{ label: "被引用约束", value: "1", hint: "只能停用", tone: "warning" }} />
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
              {constraints.map((item) => (
                <tr key={item.name}>
                  <td><strong>{item.name}</strong></td>
                  <td>{item.target}</td>
                  <td>{constraintTypeLabels[item.type] ?? item.type}</td>
                  <td>{item.value}</td>
                  <td>{item.priority}</td>
                  <td><span className="tag success">{item.status}</span></td>
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
            <article><strong>金额检查</strong><span>所有金额均为非负。</span></article>
            <article><strong>比例检查</strong><span>固定比例均在 0 到 1。</span></article>
            <article><strong>优先级检查</strong><span>无重复优先级阻断。</span></article>
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
            <label>约束名称<input defaultValue="数据源主体最低额" /></label>
            <label>约束对象<input defaultValue="数据源主体丙" /></label>
            <label>约束类型<select defaultValue="FLOOR_AMOUNT"><option value="MIN_AMOUNT">最小金额</option><option value="MAX_AMOUNT">最大金额</option><option value="CAP_AMOUNT">封顶金额</option><option value="FLOOR_AMOUNT">保底金额</option><option value="FIXED_RATIO">固定比例</option><option value="PRIORITY_ALLOCATION">优先分配</option></select></label>
            <label>约束值<input defaultValue="95000" /></label>
            <label>优先级<input defaultValue="2" /></label>
            <label>生效状态<select defaultValue="启用"><option>启用</option><option>停用</option></select></label>
          </div>
        </DrawerSection>
      </DetailDrawer>

      <TraceDrawer
        footerNote="每条约束应用结果写入 constraint_apply_trace；工程编号折叠展示。"
        formula="按优先级顺序应用：优先分配 -> 保底/封顶 -> 固定比例"
        objectType="约束检查"
        open={drawer === "trace"}
        output={{ 检查状态: "通过", 已应用约束数: constraints.length }}
        parameters={{ 金额规则: "金额非负", 比例规则: "0 到 1" }}
        title="约束检查结果"
        traceColumns={[
          { key: "constraint", label: "约束" },
          { key: "target", label: "对象" },
          { key: "result", label: "结果" },
          { key: "suggestion", label: "建议" },
        ]}
        traceRows={[
          { constraint: "运营服务优先分配", target: "运营服务方", result: "通过", suggestion: "继续保留" },
          { constraint: "数据源主体丙最低额", target: "数据源主体丙", result: "通过", suggestion: "执行分配时应用" },
        ]}
        onClose={() => setDrawer("")}
      />
    </div>
  );
}
