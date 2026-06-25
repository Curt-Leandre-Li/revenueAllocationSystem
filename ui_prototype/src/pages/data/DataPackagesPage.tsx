import { useRef, useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import {
  ChartArea,
  CompactPageHeader,
  DetailDrawer,
  DrawerSection,
  EmptyGuide,
  ProgressiveDisclosure,
  SummaryStrip,
  TechnicalDetails,
} from "../../ui";
import { userFacingText } from "../../ui/displayText";
import type { DataRow } from "../../domain/types";
import type { PageProps } from "../pageTypes";

interface PackageListItem {
  name: string;
  source: string;
  status: string;
  fileName: string;
  fileSize: string;
  receivedAt: string;
  active: boolean;
  inputSnapshotId: string;
  validationResultId: string;
  checksum: string;
  resourceCount: string;
  partyCount: string;
  repairSuggestion: string;
  errorField: string;
}

function readCell(row: DataRow, key: string, fallback = "") {
  const value = row[key];
  return value === undefined || value === null || value === "" ? fallback : userFacingText(value);
}

function packageFromRow(row: DataRow, index: number): PackageListItem {
  const status = readCell(row, "validation_status", "待校验");
  const accessStatus = readCell(row, "access_status");
  const active = status.includes("通过") || status.includes("有效") || accessStatus.includes("接入");
  return {
    name: readCell(row, "package_name", `数据包 ${index + 1}`),
    source: readCell(row, "source_type", "等待同步"),
    status,
    fileName: readCell(row, "file_name", "-"),
    fileSize: readCell(row, "file_size", "-"),
    receivedAt: readCell(row, "created_at", "-"),
    active,
    inputSnapshotId: readCell(row, "input_snapshot_id", ""),
    validationResultId: readCell(row, "validation_result_id", ""),
    checksum: readCell(row, "checksum", ""),
    resourceCount: readCell(row, "resource_count", "暂无"),
    partyCount: readCell(row, "party_count", "暂无"),
    repairSuggestion: readCell(row, "repair_suggestion", ""),
    errorField: readCell(row, "error_field", ""),
  };
}

export function DataPackagesPage({ route, snapshot, onAction, onNavigate }: PageProps) {
  const [drawer, setDrawer] = useState<"" | "preview" | "failure">("");
  const [uploadState, setUploadState] = useState("等待选择 UTF-8 JSON 文件");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pageData = snapshot.pages[route.path];
  const dataPackages = pageData.rows.map(packageFromRow);
  const metrics = pageData.metrics.length > 0
    ? pageData.metrics
    : [{ label: "数据接入摘要", value: "暂无", hint: "等待系统数据", tone: "warning" as const }];
  const selectedPackage = dataPackages[0];
  const metricMap = new Map(metrics.map((item) => [item.label, item]));
  const summaryItems = [
    metricMap.get("数据包") ?? { label: "数据包", value: "暂无", hint: "等待导入", tone: "neutral" as const },
    { label: "数据资源", value: selectedPackage?.resourceCount ?? "暂无", hint: "当前数据包", tone: "neutral" as const },
    { label: "参与方", value: selectedPackage?.partyCount ?? "暂无", hint: "当前数据包", tone: "neutral" as const },
    { label: "校验状态", value: selectedPackage?.status ?? "待导入", hint: selectedPackage?.receivedAt ?? "等待上传", tone: selectedPackage?.active ? "success" as const : "neutral" as const },
  ];
  const validationIssues =
    dataPackages
      .filter((item) => item.errorField || item.repairSuggestion)
      .map((item) => ({
        problem: item.status || "校验记录",
        location: item.errorField || "暂无字段位置",
        type: item.active ? "提醒" : "校验失败",
        suggestion: item.repairSuggestion || "暂无修复建议",
      }));
  const visibleIssues = validationIssues;

  async function handleFile(file?: File) {
    if (!file) {
      return;
    }
    if (!file.name.endsWith(".json")) {
      setUploadState("上传失败：仅支持 .json 文件，未生成有效数据包。");
      setDrawer("failure");
      return;
    }
    try {
      const payload = JSON.parse(await file.text()) as unknown;
      setUploadState(`${file.name} 已提交校验，等待系统返回校验结果。`);
      onAction(actionRegistry["DATA-003"], {
        kind: "data-package-upload",
        payload,
        fileName: file.name,
      });
    } catch (error) {
      setUploadState(
        `${file.name} 解析失败：${error instanceof Error ? error.message : "JSON 格式错误"}`,
      );
      setDrawer("failure");
    }
  }

  return (
    <div className="pageWorkspace leanPage dataPackagesPage">
      <CompactPageHeader
        title="导入数据"
        description="上传 JSON 文件，或使用示例数据快速开始一次收益分配测算。"
        primaryAction={
          <button className="actionButton primary" type="button" onClick={() => fileInputRef.current?.click()}>
            上传 JSON
          </button>
        }
        secondaryActions={
          <button className="actionButton secondary" type="button" onClick={() => onAction(actionRegistry["DATA-002"])}>
            使用示例数据
          </button>
        }
      />
      <input
        ref={fileInputRef}
        accept="application/json,.json"
        hidden
        type="file"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />

      <SummaryStrip items={summaryItems} />

      <section className="chartGrid two">
        <ChartArea title="接入结果" source={pageData.chart?.chart_id} />
        <ChartArea title="导入状态">
          <p className="productEmptyChart">{uploadState}</p>
        </ChartArea>
      </section>

      <section className="leanTableSection">
        <div className="leanSectionHead">
          <div>
            <h2>当前数据包</h2>
            <p>查看接入记录、校验状态和安全摘要。</p>
          </div>
          <button className="textLinkButton" type="button" onClick={() => onNavigate("/data/resources")}>
            下一步：查看数据资源
          </button>
        </div>
        <div className="tableWrap">
          <table className="dataTable phase2Table">
            <thead>
              <tr>
                <th>数据包名称</th>
                <th>来源</th>
                <th>校验状态</th>
                <th>文件名</th>
                <th>文件大小</th>
                <th>接入时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
            {dataPackages.length ? dataPackages.map((item) => (
                <tr key={item.name}>
                  <td><strong>{item.name}</strong></td>
                  <td>{item.source}</td>
                  <td><span className={`tag ${item.active ? "success" : "warning"}`}>{item.status}</span></td>
                  <td>{item.fileName}</td>
                  <td>{item.fileSize}</td>
                  <td>{item.receivedAt}</td>
                  <td>
                    <div className="rowAction">
                      <button type="button" onClick={() => setDrawer("preview")}>预览</button>
                      <button type="button" onClick={() => setDrawer("failure")}>失败详情</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7}>
                    <EmptyGuide
                      title="暂无数据包列表"
                      description="导入成功后会在此展示。"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ProgressiveDisclosure
        title="失败详情"
        summary={visibleIssues.length ? `${visibleIssues.length} 条待处理` : "暂无失败详情"}
      >
        {visibleIssues.length ? (
          <div className="issueList">
            {visibleIssues.map((issue) => (
              <article key={issue.location}>
                <strong>{issue.problem}</strong>
                <p>{issue.location} / {issue.type} / {issue.suggestion}</p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyGuide title="暂无失败详情" description="上传接口返回字段级错误后会在此展示。" />
        )}
        <button className="textLinkButton" type="button" onClick={() => setDrawer("failure")}>
          打开失败详情
        </button>
      </ProgressiveDisclosure>

      <DetailDrawer
        footerNote="预览只展示安全摘要，不展示敏感原文。"
        objectType="数据包预览"
        open={drawer === "preview"}
        size="lg"
        statusTag="安全摘要"
        title="数据包安全摘要"
        variant="detail"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="数据包概览">
          {selectedPackage ? (
            <dl className="businessDetail compact">
              <div><dt>数据包名称</dt><dd>{selectedPackage.name}</dd></div>
              <div><dt>校验状态</dt><dd>{selectedPackage.status}</dd></div>
              <div><dt>输入快照</dt><dd>{selectedPackage.inputSnapshotId || "暂无"}</dd></div>
              <div><dt>校验记录</dt><dd>{selectedPackage.validationResultId || "暂无"}</dd></div>
              <div><dt>checksum</dt><dd>{selectedPackage.checksum || "暂无"}</dd></div>
            </dl>
          ) : (
            <EmptyGuide
              title="暂无可预览数据包"
              description="暂无数据包记录，暂不展示样例安全摘要。"
            />
          )}
        </DrawerSection>
        <DrawerSection title="字段摘要">
          <EmptyGuide
            title="暂无字段摘要"
            description="字段、模态和缺失情况由系统结果展示，不从样例字段拼接。"
          />
        </DrawerSection>
        <TechnicalDetails
          details={{
            input_snapshot_id: selectedPackage?.inputSnapshotId || "暂无",
            upload_validation_result_id: selectedPackage?.validationResultId || "暂无",
          }}
        />
      </DetailDrawer>

      <DetailDrawer
        footerNote="上传失败不生成有效数据包；修复后重新上传会生成新的校验记录。"
        objectType="上传校验"
        open={drawer === "failure"}
        size="lg"
        statusTag="校验失败"
        title="上传失败详情"
        variant="risk"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="失败原因与修复建议">
          {visibleIssues.length ? (
            <div className="issueList">
              {visibleIssues.map((issue) => (
              <article key={issue.location}>
                <strong>{issue.problem}</strong>
                <dl className="businessDetail compact">
                  <div><dt>字段位置</dt><dd>{issue.location}</dd></div>
                  <div><dt>错误类型</dt><dd>{issue.type}</dd></div>
                  <div><dt>修复建议</dt><dd>{issue.suggestion}</dd></div>
                </dl>
              </article>
              ))}
            </div>
          ) : (
            <EmptyGuide
              title="暂无失败详情"
              description="本区域不再显示本地样例错误；上传接口返回字段级错误后再展示。"
            />
          )}
        </DrawerSection>
        <TechnicalDetails
          details={{
            upload_validation_result: visibleIssues.length ? "系统返回失败详情" : "暂无",
            rejected_package_status: selectedPackage?.active ? "状态非失败" : "暂无有效数据包",
          }}
        />
      </DetailDrawer>
    </div>
  );
}
