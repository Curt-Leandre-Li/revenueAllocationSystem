import { useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import {
  ActionButton,
  ChartArea,
  CompactPageHeader,
  DetailDrawer,
  DrawerSection,
  EmptyGuide,
  ExportFieldList,
  ProductTimeline,
  SummaryStrip,
} from "../../ui";
import { cellText, pageMetrics, pageRows } from "../backendPageData";
import type { PageProps } from "../pageTypes";

export function AuditPage({ route, snapshot, onAction }: PageProps) {
  const [drawer, setDrawer] = useState<"" | "log" | "snapshot" | "export">("");
  const pageData = snapshot.pages[route.path];
  const logs = pageRows(pageData);
  const metrics = pageMetrics(pageData);
  const timelineItems = logs.map((log) => ({
    label: cellText(log, "operation"),
    value: cellText(log, "created_at"),
    numeric: null,
    meta: cellText(log, "status"),
  }));

  return (
    <div className="pageWorkspace phase2Page leanPage auditPage">
      <CompactPageHeader
        title="操作记录"
        description="查看操作、计算和导出记录，追溯关键快照与失败原因。"
        primaryAction={
          <ActionButton
            action={actionRegistry["AUD-002"]}
            onClick={(action) => onAction(action)}
          />
        }
        secondaryActions={
          <ActionButton
            action={actionRegistry["AUD-007"]}
            onClick={(action) => {
              onAction(action);
              setDrawer("export");
            }}
          />
        }
      />

      <SummaryStrip
        items={[
          metrics[0] ?? { label: "操作记录数", value: "暂无", hint: "待生成", tone: "neutral" },
          metrics[1] ?? { label: "失败记录数", value: "暂无", hint: "待生成", tone: "neutral" },
          metrics[2] ?? { label: "快照数量", value: "暂无", hint: "待生成", tone: "neutral" },
          { label: "导出记录数", value: "暂无", hint: "待生成", tone: "neutral" },
          { label: "计算记录数", value: "暂无", hint: "待生成", tone: "neutral" },
        ]}
      />

      <section className="chartGrid two">
        <ChartArea title="操作时间线">
          <ProductTimeline items={timelineItems} />
        </ChartArea>
        <ChartArea title="模块操作分布" />
      </section>

      <section className="leanTableSection">
        <div className="leanSectionHead">
          <div>
            <h2>记录列表</h2>
            <p>筛选条件用于查看记录，不改变已有快照。</p>
          </div>
          <div className="filterBar compactFilter">
            <label>
              模块
              <select defaultValue="全部">
                <option>全部</option>
                <option>数据管理</option>
                <option>收益分配</option>
                <option>报告导出</option>
              </select>
            </label>
            <label>
              操作人
              <select defaultValue="本地演示用户">
                <option>本地演示用户</option>
              </select>
            </label>
            <label>
              状态
              <select defaultValue="全部">
                <option>全部</option>
                <option>成功</option>
                <option>失败</option>
              </select>
            </label>
          </div>
        </div>

        <div className="tableWrap">
          <table className="dataTable phase2Table">
            <thead>
              <tr>
                <th>操作</th>
                <th>对象</th>
                <th>操作人</th>
                <th>状态</th>
                <th>时间</th>
                <th>摘要</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {logs.length > 0 ? (
                logs.map((log, index) => (
                  <tr key={`${cellText(log, "operation", "operation")}-${index}`}>
                    <td>{cellText(log, "operation")}</td>
                    <td>{cellText(log, "object_type")}</td>
                    <td>{cellText(log, "operator")}</td>
                    <td>
                      <span className={`tag ${cellText(log, "status") === "失败" ? "danger" : "success"}`}>
                        {cellText(log, "status")}
                      </span>
                    </td>
                    <td>{cellText(log, "created_at")}</td>
                    <td>{cellText(log, "summary")}</td>
                    <td>
                      <div className="rowAction">
                        <button
                          type="button"
                          onClick={() => {
                            onAction(actionRegistry["AUD-006"]);
                            setDrawer("log");
                          }}
                        >
                          详情
                        </button>
                        <button type="button" onClick={() => setDrawer("snapshot")}>
                          快照
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>
                    <EmptyGuide
                      title="暂无操作记录"
                      description="执行数据接入、计算或导出操作后，记录会在此展示。"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <DetailDrawer
        footerNote="记录详情用于审计追溯，不作为法律结算或付款依据。"
        objectType="记录详情"
        open={drawer === "log"}
        size="md"
        statusTag="只读"
        title="记录详情"
        variant="detail"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="详情摘要">
          <dl className="businessDetail compact">
            <div><dt>状态</dt><dd>待生成</dd></div>
            <div><dt>失败原因</dt><dd>以系统记录为准</dd></div>
            <div><dt>操作人</dt><dd>{snapshot.operator}</dd></div>
          </dl>
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="快照详情仅用于审计定位，工程字段默认折叠。"
        objectType="快照详情"
        open={drawer === "snapshot"}
        size="md"
        statusTag="只读"
        title="快照详情"
        variant="detail"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="快照摘要">
          <dl className="businessDetail compact">
            <div><dt>快照状态</dt><dd>待生成</dd></div>
            <div><dt>快照范围</dt><dd>以系统记录为准</dd></div>
          </dl>
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="导出审计日志会生成导出文件和报告记录；敏感原文不进入文件。"
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
