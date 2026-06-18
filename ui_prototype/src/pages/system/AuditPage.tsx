import { useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import {
  ActionButton,
  DetailDrawer,
  DrawerSection,
  ExportFieldList,
  MetricCard,
  PageHeader,
  TraceDrawer,
  WorkbenchCard,
} from "../../ui";
import { getMockWorkspace } from "../phase2aUtils";
import type { PageProps } from "../pageTypes";

export function AuditPage({ route, snapshot, onAction }: PageProps) {
  const [drawer, setDrawer] = useState<"" | "log" | "snapshot" | "export">("");
  const mock = getMockWorkspace(snapshot);
  const logs = mock.auditLogs.slice(0, 50);
  const snapshotTypeLabels: Record<string, string> = {
    INPUT: "输入快照",
    PARAMETER: "参数快照",
    OUTPUT: "输出快照",
    UTILITY_OUTPUT: "效用输出快照",
    ALGORITHM_OUTPUT: "算法输出快照",
    REPORT_OUTPUT: "报告输出快照",
  };

  return (
    <div className="pageWorkspace phase2Page auditPage">
      <PageHeader
        route={{
          ...route,
          label: "审计日志管理",
          responsibility: "查询操作、计算、导出日志并追溯输入、参数、输出和报告快照。",
        }}
        snapshot={snapshot}
      />

      <div className="metricGrid four">
        <MetricCard item={{ label: "最近日志", value: String(logs.length), hint: "默认最近 50 条", tone: "neutral" }} />
        <MetricCard item={{ label: "失败日志", value: "1", hint: "不允许遗漏", tone: "warning" }} />
        <MetricCard item={{ label: "快照记录", value: String(mock.snapshots.length), hint: "输入/参数/输出", tone: "success" }} />
        <MetricCard item={{ label: "导出记录", value: String(mock.exports.length), hint: "可生成审计导出", tone: "neutral" }} />
      </div>

      <WorkbenchCard
        title="日志查询"
        description="支持模块、操作人、状态和时间范围筛选。"
        actions={
          <>
            <ActionButton action={actionRegistry["AUD-002"]} onClick={(action) => onAction(action)} />
            <ActionButton
              action={actionRegistry["AUD-007"]}
              onClick={(action) => {
                onAction(action);
                setDrawer("export");
              }}
            />
          </>
        }
      >
        <div className="filterBar">
          <label>模块筛选<select defaultValue="全部"><option>全部</option><option>数据管理</option><option>收益分配</option><option>报告导出</option></select></label>
          <label>操作人筛选<select defaultValue="local_operator"><option>local_operator</option></select></label>
          <label>状态筛选<select defaultValue="全部"><option>全部</option><option>成功</option><option>失败</option></select></label>
          <label>时间范围<input defaultValue="2026-06-18" /></label>
        </div>
      </WorkbenchCard>

      <div className="phase2bTwoCol">
        <WorkbenchCard title="日志列表" description="计算类日志可追溯输入、参数和输出快照。">
          <div className="tableWrap">
            <table className="dataTable phase2Table">
              <thead><tr><th>操作</th><th>对象</th><th>操作人</th><th>状态</th><th>时间</th><th>摘要</th><th>操作</th></tr></thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={`${log.operation}-${log.createdAt}`}>
                    <td>{log.operation}</td>
                    <td>{log.objectType}</td>
                    <td>{log.operator}</td>
                    <td><span className={`tag ${log.status === "失败" ? "danger" : "success"}`}>{log.status}</span></td>
                    <td>{log.createdAt}</td>
                    <td>{log.summary}</td>
                    <td>
                      <div className="rowAction">
                        <button
                          type="button"
                          onClick={() => {
                            onAction(actionRegistry["AUD-006"]);
                            setDrawer("log");
                          }}
                        >
                          日志详情
                        </button>
                        <button type="button" onClick={() => setDrawer("snapshot")}>快照详情</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </WorkbenchCard>

        <WorkbenchCard title="快照详情" description="工程编号只在技术详情折叠展示。">
          <div className="compactList">
            {mock.snapshots.map((item) => (
              <article key={`${item.name}-${item.createdAt}`}>
                <strong>{item.name}</strong>
                <span>{snapshotTypeLabels[item.type] ?? item.type} / {item.status}</span>
                <small>{item.createdAt}</small>
              </article>
            ))}
          </div>
        </WorkbenchCard>
      </div>

      <TraceDrawer
        footerNote="日志详情用于审计追溯，不显示工程编号正文。"
        objectType="日志详情"
        open={drawer === "log"}
        output={{ 日志状态: "已读取", 失败原因: "无" }}
        parameters={{ 操作员: snapshot.operator, 状态筛选: "全部" }}
        statusTag="只读"
        summary="展示操作、对象、状态、失败原因和修复建议；失败日志会保留在最近列表中。"
        technicalDetails={{ input_snapshot_ref: "技术详情折叠", parameter_snapshot_ref: "技术详情折叠", output_snapshot_ref: "技术详情折叠" }}
        title="审计日志详情"
        traceColumns={[
          { key: "stage", label: "阶段" },
          { key: "status", label: "状态" },
          { key: "summary", label: "摘要" },
        ]}
        traceRows={[
          { stage: "输入快照", status: "已生成", summary: "记录操作输入" },
          { stage: "参数快照", status: "已生成", summary: "记录参数版本" },
          { stage: "输出快照", status: "已生成", summary: "记录输出结果" },
        ]}
        onClose={() => setDrawer("")}
      />

      <TraceDrawer
        footerNote="快照详情仅用于审计定位，工程编号在技术详情中折叠。"
        objectType="快照详情"
        open={drawer === "snapshot"}
        output={{ 快照状态: "已读取", 快照范围: "输入/参数/输出" }}
        statusTag="只读"
        summary="展示快照名称、类型、状态和生成时间。"
        technicalDetails={{ snapshot_ref: "技术详情折叠" }}
        title="快照详情"
        traceColumns={[
          { key: "name", label: "快照名称" },
          { key: "type", label: "类型" },
          { key: "status", label: "状态" },
        ]}
        traceRows={mock.snapshots.map((item) => ({ name: item.name, type: snapshotTypeLabels[item.type] ?? item.type, status: item.status }))}
        onClose={() => setDrawer("")}
      />

      <DetailDrawer
        footerNote="导出审计日志会生成 export_file/report_record；敏感原文不进入文件。"
        objectType="导出说明"
        open={drawer === "export"}
        size="md"
        title="导出审计日志"
        variant="export"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="导出字段">
          <ExportFieldList
            fields={[
              { key: "operation", label: "操作" },
              { key: "object_type", label: "对象类型" },
              { key: "operator", label: "操作人" },
              { key: "status", label: "状态" },
              { key: "created_at", label: "发生时间" },
              { key: "summary", label: "摘要" },
            ]}
          />
        </DrawerSection>
      </DetailDrawer>
    </div>
  );
}
