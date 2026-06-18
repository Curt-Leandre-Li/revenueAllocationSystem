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
import type { PageProps } from "../pageTypes";

const dataPackages = [
  {
    name: "演示项目数据包",
    source: "演示数据",
    status: "校验通过",
    fileName: "demo_input.json",
    fileSize: "1.8 MB",
    receivedAt: "2026-06-18 09:30",
    active: true,
  },
  {
    name: "上传候选数据包",
    source: "本地 JSON",
    status: "待校验",
    fileName: "candidate_input.json",
    fileSize: "942 KB",
    receivedAt: "待上传",
    active: false,
  },
];

const validationIssues = [
  {
    problem: "participants 缺失",
    location: "participants[2].party_type",
    type: "必要字段缺失",
    suggestion: "补充主体类型，并确认是否为数据提供方。",
  },
  {
    problem: "总收益不能为负",
    location: "revenue.total_revenue",
    type: "数值范围错误",
    suggestion: "将总收益调整为 0 或正数后重新上传。",
  },
  {
    problem: "参与方名称重复",
    location: "participants[*].party_name",
    type: "唯一性冲突",
    suggestion: "合并重复主体或改为不同主体名称。",
  },
];

export function DataPackagesPage({ route, snapshot, onAction, onNavigate }: PageProps) {
  const [drawer, setDrawer] = useState<"" | "preview" | "failure">("");
  const [uploadState, setUploadState] = useState("等待选择 UTF-8 JSON 文件");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file?: File) {
    if (!file) {
      return;
    }
    if (!file.name.endsWith(".json")) {
      setUploadState("上传失败：仅支持 .json 文件，未生成有效数据包。");
      setDrawer("failure");
      return;
    }
    setUploadState(`${file.name} 已进入本地校验队列，校验通过后生成输入快照。`);
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
        <MetricCard item={{ label: "数据包", value: "2", hint: "演示与上传候选", tone: "neutral" }} />
        <MetricCard item={{ label: "校验通过", value: "1", hint: "可生成输入快照", tone: "success" }} />
        <MetricCard item={{ label: "校验失败", value: "1", hint: "包含字段修复建议", tone: "warning" }} />
        <MetricCard item={{ label: "输入快照", value: "1", hint: "最近一次有效接入", tone: "success" }} />
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
              onClick={(action) => {
                onAction(action);
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
            <article className="success">
              <strong>演示项目数据包</strong>
              <span>校验通过 / 已生成输入快照</span>
              <p>包含资源清单、参与方、质量输入和收益池。</p>
            </article>
            <article className="warning">
              <strong>上传候选数据包</strong>
              <span>校验失败 / 未生成有效数据包</span>
              <p>存在必要字段缺失、负收益和重复参与方。</p>
            </article>
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
              {dataPackages.map((item) => (
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
              ))}
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
          <dl className="businessDetail compact">
            <div><dt>数据包名称</dt><dd>演示项目数据包</dd></div>
            <div><dt>校验状态</dt><dd>校验通过</dd></div>
            <div><dt>资源数量</dt><dd>4</dd></div>
            <div><dt>参与方数量</dt><dd>5</dd></div>
          </dl>
        </DrawerSection>
        <DrawerSection title="字段摘要">
          <div className="chipList">
            {["资源名称", "资源模态", "主体名称", "收益池", "质量输入", "效用输入"].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </DrawerSection>
        <TechnicalDetails
          details={{
            input_snapshot_id: "仅技术详情展示",
            upload_validation_result: "校验通过",
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
          <div className="issueList">
            {validationIssues.map((issue) => (
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
        </DrawerSection>
        <TechnicalDetails
          details={{
            upload_validation_result: "失败记录仅用于审计追溯",
            rejected_package_status: "未生成有效数据包",
          }}
        />
      </DetailDrawer>
    </div>
  );
}
