import { useRef, useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import {
  ActionButton,
  DetailDrawer,
  DrawerSection,
  EmptyGuide,
  MetricCard,
  PageHeader,
  RiskNotice,
  TechnicalDetails,
  WorkbenchCard,
} from "../../ui";
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
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function packageFromRow(row: DataRow, index: number): PackageListItem {
  const status = readCell(row, "validation_status", "后端未返回");
  const accessStatus = readCell(row, "access_status");
  const active = status.includes("通过") || status.includes("有效") || accessStatus.includes("接入");
  return {
    name: readCell(row, "package_name", `后端数据包 ${index + 1}`),
    source: readCell(row, "source_type", "后端未同步"),
    status,
    fileName: readCell(row, "file_name", "-"),
    fileSize: readCell(row, "file_size", "-"),
    receivedAt: readCell(row, "created_at", "-"),
    active,
    inputSnapshotId: readCell(row, "input_snapshot_id", ""),
    validationResultId: readCell(row, "validation_result_id", ""),
    checksum: readCell(row, "checksum", ""),
    resourceCount: readCell(row, "resource_count", "后端未返回"),
    partyCount: readCell(row, "party_count", "后端未返回"),
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
    : [{ label: "数据接入摘要", value: "后端未返回", hint: "等待后端 page DTO", tone: "warning" as const }];
  const selectedPackage = dataPackages[0];
  const validationIssues =
    dataPackages
      .filter((item) => item.errorField || item.repairSuggestion)
      .map((item) => ({
        problem: item.status || "后端校验记录",
        location: item.errorField || "后端未返回字段位置",
        type: item.active ? "提醒" : "校验失败",
        suggestion: item.repairSuggestion || "后端未返回修复建议",
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
      setUploadState(`${file.name} 已提交后端校验，等待接口返回校验结果。`);
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
    <div className="pageWorkspace phase2Page dataPackagesPage">
      <PageHeader
        route={{
          ...route,
          label: "数据接入管理",
          responsibility: "选择演示数据、上传 UTF-8 JSON、校验必要字段并生成输入快照。",
        }}
        snapshot={snapshot}
      />

      <div className="metricGrid four">
        {metrics.slice(0, 4).map((item) => (
          <MetricCard item={item} key={item.label} />
        ))}
      </div>

      <div className="phase2bTwoCol">
        <WorkbenchCard
          title="使用演示数据"
          description="初始化数据包、输入快照、资源清单、参与方和审计日志。"
          actions={
            <ActionButton action={actionRegistry["DATA-002"]} onClick={(action) => onAction(action)} />
          }
        >
          <div className="featureCardBody">
            <strong>适合快速体验完整链路</strong>
            <p>演示数据只用于模拟收益分配，不代表真实生产数据或真实医疗数据。</p>
            <button className="wideButton" type="button" onClick={() => onNavigate("/data/resources")}>
              查看识别后的数据资源
            </button>
          </div>
        </WorkbenchCard>

        <WorkbenchCard
          title="上传 JSON 文件"
          description="仅接收 UTF-8 JSON；失败结果写入上传校验记录，不生成有效数据包。"
          actions={
            <ActionButton
              action={actionRegistry["DATA-003"]}
              onClick={() => {
                fileInputRef.current?.click();
              }}
            />
          }
        >
          <div
            className="uploadDropZone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              handleFile(event.dataTransfer.files[0]);
            }}
          >
            <strong>拖拽 JSON 到此处，或点击上传按钮选择文件</strong>
            <span>{uploadState}</span>
            <input
              ref={fileInputRef}
              accept="application/json,.json"
              hidden
              type="file"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
          </div>
        </WorkbenchCard>
      </div>

      <RiskNotice compact />

      <div className="phase2bTwoCol">
        <WorkbenchCard
          title="最近接入结果"
          description="上传失败必须有问题、字段位置、错误类型和修复建议。"
          actions={
            <>
              <ActionButton
                action={actionRegistry["DATA-007"]}
                onClick={(action) => {
                  onAction(action);
                  setDrawer("preview");
                }}
              />
              <ActionButton
                action={actionRegistry["DATA-008"]}
                onClick={(action) => {
                  onAction(action);
                  setDrawer("failure");
                }}
              />
            </>
          }
        >
          <div className="validationSummary">
            {selectedPackage ? (
              <article className={selectedPackage.active ? "success" : "warning"}>
                <strong>{selectedPackage.name}</strong>
                <span>
                  {selectedPackage.status} / {selectedPackage.inputSnapshotId ? "后端已返回输入快照" : "后端未返回输入快照"}
                </span>
                <p>
                  资源数 {selectedPackage.resourceCount}；参与方数 {selectedPackage.partyCount}。
                </p>
              </article>
            ) : (
              <EmptyGuide
                title="后端未返回数据包"
                description="选择演示数据或上传 JSON 后，页面只展示后端返回的数据包记录。"
              />
            )}
            {visibleIssues[0] ? (
              <article className="warning">
                <strong>{visibleIssues[0].problem}</strong>
                <span>{visibleIssues[0].location} / {visibleIssues[0].type}</span>
                <p>{visibleIssues[0].suggestion}</p>
              </article>
            ) : (
              <article className="warning">
                <strong>后端未返回失败详情</strong>
                <span>上传校验 DTO / 后端字段</span>
                <p>前端不再使用本地样例错误伪造校验结果。</p>
              </article>
            )}
          </div>
        </WorkbenchCard>

        <WorkbenchCard
          title="下一步建议"
          description="数据接入成功后进入资源识别与主体归属确认。"
          actions={
            <button className="actionButton secondary" type="button" onClick={() => onNavigate("/data/resources")}>
              进入数据资源管理
            </button>
          }
        >
          <EmptyGuide
            title="优先补齐失败文件后再推进"
            description="上传失败不会污染有效数据包；修复 JSON 后重新上传即可生成新输入快照。"
          />
        </WorkbenchCard>
      </div>

      <WorkbenchCard
        title="数据包列表"
        description="停用数据包使用逻辑停用，并保留历史接入记录。"
      >
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
                      <button type="button" onClick={() => onAction(actionRegistry["DATA-009"])}>停用</button>
                      <button type="button" onClick={() => onAction(actionRegistry["DATA-002"])}>复制新版本</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7}>
                    <EmptyGuide
                      title="后端未返回数据包列表"
                      description="前端不会显示 demo_input.json 或候选文件作为成功兜底。"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </WorkbenchCard>

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
              <div><dt>输入快照</dt><dd>{selectedPackage.inputSnapshotId || "后端未返回"}</dd></div>
              <div><dt>校验记录</dt><dd>{selectedPackage.validationResultId || "后端未返回"}</dd></div>
              <div><dt>checksum</dt><dd>{selectedPackage.checksum || "后端未返回"}</dd></div>
            </dl>
          ) : (
            <EmptyGuide
              title="暂无可预览数据包"
              description="后端未返回数据包记录，前端不展示样例安全摘要。"
            />
          )}
        </DrawerSection>
        <DrawerSection title="字段摘要">
          <EmptyGuide
            title="后端未提供字段摘要 DTO"
            description="字段、模态和缺失情况应由后端返回，不由前端从样例字段拼接。"
          />
        </DrawerSection>
        <TechnicalDetails
          details={{
            input_snapshot_id: selectedPackage?.inputSnapshotId || "后端未返回",
            upload_validation_result_id: selectedPackage?.validationResultId || "后端未返回",
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
              title="后端未返回失败详情"
              description="本区域不再显示本地样例错误；上传接口返回字段级错误后再展示。"
            />
          )}
        </DrawerSection>
        <TechnicalDetails
          details={{
            upload_validation_result: visibleIssues.length ? "后端返回失败详情" : "后端未返回",
            rejected_package_status: selectedPackage?.active ? "后端状态非失败" : "后端未返回有效数据包",
          }}
        />
      </DetailDrawer>
    </div>
  );
}
