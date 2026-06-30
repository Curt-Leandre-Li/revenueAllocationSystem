import { useEffect, useMemo, useRef, useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import { dvasApi } from "../../domain/api";
import {
  CompactPageHeader,
  DetailDrawer,
  DrawerSection,
  EmptyGuide,
  TechnicalDetails,
} from "../../ui";
import { userFacingText } from "../../ui/displayText";
import type { DataRow } from "../../domain/types";
import type { PageProps } from "../pageTypes";
import {
  DataMetricStrip,
  NextStepStrip,
  StatusBadge,
  WorkflowStepper,
  type DataMetricCard,
  type WorkflowStep,
} from "./DataPageShared";

interface PackageListItem {
  packageId: string;
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
  errorCode: string;
  errorMessage: string;
  repairSuggestion: string;
  errorField: string;
  validationFieldErrorsJson: string;
  validationResultJson: string;
}

interface ValidationIssue {
  problem: string;
  location: string;
  type: string;
  suggestion: string;
  detail: string;
}

function readCell(row: DataRow | undefined, key: string, fallback = "") {
  const value = row?.[key];
  return value === undefined || value === null || value === "" ? fallback : userFacingText(value);
}

function packageFromRow(row: DataRow, index: number): PackageListItem {
  const status = readCell(row, "validation_status", "待校验");
  const accessStatus = readCell(row, "access_status");
  const active = isPassedStatus(status) || isPassedStatus(accessStatus);
  return {
    packageId: readCell(row, "package_id", ""),
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
    resourceCount: readCell(row, "resource_count", "0"),
    partyCount: readCell(row, "party_count", "0"),
    errorCode: readCell(row, "error_code", ""),
    errorMessage: readCell(row, "error_message", ""),
    repairSuggestion: readCell(row, "repair_suggestion", ""),
    errorField: readCell(row, "error_field", ""),
    validationFieldErrorsJson: readCell(row, "validation_field_errors_json", "[]"),
    validationResultJson: readCell(row, "validation_result_json", "{}"),
  };
}

function parseJsonArray(value: string): Array<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") : [];
  } catch {
    return [];
  }
}

function validationIssuesFromPackage(item: PackageListItem | undefined): ValidationIssue[] {
  if (!item || item.active) {
    return [];
  }
  const fieldErrors = parseJsonArray(item.validationFieldErrorsJson);
  if (fieldErrors.length) {
    return fieldErrors.map((fieldError, index) => ({
      problem: item.errorCode || item.status || "上传校验失败",
      location: String(fieldError.field || item.errorField || `field_errors[${index}]`),
      type: item.active ? "提醒" : "校验失败",
      suggestion: String(fieldError.reason || item.repairSuggestion || item.errorMessage || "暂无修复建议"),
      detail: item.validationResultJson,
    }));
  }
  const hasFailureCode = Boolean(item.errorCode && item.errorCode !== "OK");
  if (item.errorField || item.repairSuggestion || item.errorMessage || hasFailureCode) {
    return [
      {
        problem: item.errorCode || item.status || "上传校验失败",
        location: item.errorField || "暂无字段位置",
        type: "校验失败",
        suggestion: item.repairSuggestion || item.errorMessage || "暂无修复建议",
        detail: item.validationResultJson,
      },
    ];
  }
  return [];
}

function packageMatchesSearch(item: PackageListItem, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return [
    item.packageId,
    item.name,
    item.source,
    item.status,
    item.fileName,
    item.fileSize,
    item.receivedAt,
    item.checksum,
  ].some((value) => value.toLowerCase().includes(normalized));
}

function uploadProgressForState(
  currentPackage: PackageListItem | undefined,
  pendingUploadFileName: string,
) {
  if (pendingUploadFileName) {
    return {
      label: "校验中",
      hint: "等待系统返回",
      percent: 60,
      tone: "warning" as const,
    };
  }
  if (currentPackage?.active) {
    return {
      label: "已完成",
      hint: "当前数据包可用",
      percent: 100,
      tone: "success" as const,
    };
  }
  if (currentPackage) {
    return {
      label: "未通过",
      hint: "查看失败详情",
      percent: 100,
      tone: "warning" as const,
    };
  }
  return {
    label: "待导入",
    hint: "等待选择 UTF-8 JSON 文件",
    percent: 0,
    tone: "neutral" as const,
  };
}

function workflowStepsForState(
  currentPackage: PackageListItem | undefined,
  pendingUploadFileName: string,
): WorkflowStep[] {
  if (pendingUploadFileName) {
    return [
      { title: "上传文件", hint: "文件已提交", state: "done" },
      { title: "校验结构", hint: "系统校验中", state: "current" },
      { title: "生成资源 / 参与方", hint: "等待解析", state: "pending" },
      { title: "可进入下一步", hint: "等待数据包可用", state: "pending" },
    ];
  }
  if (currentPackage?.active) {
    return [
      { title: "上传文件", hint: "文件已上传", state: "done" },
      { title: "校验结构", hint: "校验通过", state: "done" },
      { title: "生成资源 / 参与方", hint: "已解析完成", state: "done" },
      { title: "可进入下一步", hint: "当前数据包可用", state: "done" },
    ];
  }
  if (currentPackage) {
    return [
      { title: "上传文件", hint: "文件已上传", state: "done" },
      { title: "校验结构", hint: "校验未通过", state: "failed" },
      { title: "生成资源 / 参与方", hint: "未生成", state: "pending" },
      { title: "可进入下一步", hint: "不可用", state: "pending" },
    ];
  }
  return [
    { title: "上传文件", hint: "等待上传", state: "current" },
    { title: "校验结构", hint: "等待校验", state: "pending" },
    { title: "生成资源 / 参与方", hint: "等待解析", state: "pending" },
    { title: "可进入下一步", hint: "等待数据包", state: "pending" },
  ];
}

export function DataPackagesPage({ route, snapshot, onAction, onNavigate }: PageProps) {
  const [drawer, setDrawer] = useState<"" | "preview" | "failure">("");
  const [uploadState, setUploadState] = useState("等待选择 UTF-8 JSON 文件");
  const [pendingUploadFileName, setPendingUploadFileName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [packageScope, setPackageScope] = useState<"permitted" | "mine">("permitted");
  const [myPackageIds, setMyPackageIds] = useState<Set<string> | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const xlsxInputRef = useRef<HTMLInputElement>(null);
  const pageData = snapshot.pages[route.path];
  const dataPackages = pageData.rows.map(packageFromRow);
  const visiblePackages =
    packageScope === "mine" && myPackageIds
      ? dataPackages.filter((item) => myPackageIds.has(item.packageId))
      : dataPackages;
  const filteredPackages = useMemo(
    () => visiblePackages.filter((item) => packageMatchesSearch(item, searchQuery)),
    [visiblePackages, searchQuery],
  );
  const currentPackageId = readCell(pageData.technicalDetails, "current_package_id", "");
  const currentPackage =
    dataPackages.find((item) => item.packageId === currentPackageId) ??
    dataPackages[dataPackages.length - 1];
  const selectedPackage =
    dataPackages.find((item) => item.packageId === selectedPackageId) ?? currentPackage;
  const uploadProgress = uploadProgressForState(currentPackage, pendingUploadFileName);
  const currentUploadState = pendingUploadFileName
    ? uploadState
    : currentPackage
      ? currentPackage.active
        ? `${currentPackage.fileName} 校验通过，数据包已生成。`
        : `${currentPackage.fileName} 校验未通过，请查看失败详情。`
      : uploadState;
  const currentIssues = validationIssuesFromPackage(currentPackage);
  const drawerIssues = validationIssuesFromPackage(selectedPackage);

  useEffect(() => {
    if (packageScope !== "mine") {
      return undefined;
    }
    let mounted = true;
    void dvasApi.listMyUploads("mine").then(
      (response) => {
        if (!mounted) {
          return;
        }
        setMyPackageIds(new Set(response.items.map((item) => String(item.package_id ?? ""))));
      },
      () => {
        if (mounted) {
          setMyPackageIds(new Set());
        }
      },
    );
    return () => {
      mounted = false;
    };
  }, [packageScope]);
  const summaryItems: DataMetricCard[] = [
    {
      label: "数据包",
      value: currentPackage ? 1 : 0,
      hint: "当前有效数据包",
      tone: currentPackage ? "success" : "neutral",
      icon: "包",
    },
    {
      label: "数据资源",
      value: currentPackage?.resourceCount ?? 0,
      hint: "当前数据包",
      tone: currentPackage ? "success" : "neutral",
      icon: "源",
    },
    {
      label: "参与方",
      value: currentPackage?.partyCount ?? 0,
      hint: "当前数据包",
      tone: currentPackage ? "success" : "neutral",
      icon: "方",
    },
    {
      label: "校验状态",
      value: currentPackage?.status ?? "待导入",
      hint: currentPackage?.receivedAt ?? "等待上传",
      tone: currentPackage?.active ? "success" : currentPackage ? "warning" : "neutral",
      icon: "验",
    },
    {
      label: "导入状态",
      value: uploadProgress.label,
      hint: `${uploadProgress.percent}% · ${uploadProgress.hint}`,
      tone: uploadProgress.tone,
      icon: "进",
      progress: uploadProgress.percent,
    },
  ];

  useEffect(() => {
    if (!pendingUploadFileName) {
      return;
    }
    const uploadedPackage = dataPackages.find(
      (item) => item.fileName === pendingUploadFileName,
    );
    if (!uploadedPackage) {
      return;
    }
    setUploadState(
      uploadedPackage.active
        ? `${pendingUploadFileName} 校验通过，数据包已生成。`
        : `${pendingUploadFileName} 校验失败，请查看失败详情。`,
    );
    setPendingUploadFileName("");
  }, [dataPackages, pendingUploadFileName]);

  function openPackageDrawer(nextDrawer: "preview" | "failure", item: PackageListItem) {
    setSelectedPackageId(item.packageId);
    if (nextDrawer === "preview") {
      onAction(actionRegistry["DATA-007"]);
    } else {
      onAction(actionRegistry["DATA-008"]);
    }
    setDrawer(nextDrawer);
  }

  function deletePackage(item: PackageListItem) {
    if (!item.packageId) {
      return;
    }
    setSelectedPackageId(item.packageId);
    onAction(actionRegistry["DATA-009"], {
      kind: "data-package-delete",
      packageId: item.packageId,
      packageName: item.name,
    });
  }

  function backendConnectionMessage(fileName: string) {
    return `${fileName} 未提交：系统未连接，前端不会进入本地校验中状态或伪造上传成功。`;
  }

  async function handleFile(file?: File) {
    if (!file) {
      return;
    }
    if (!file.name.endsWith(".json")) {
      setUploadState("上传失败：仅支持 .json 文件，未生成有效数据包。");
      setDrawer("failure");
      return;
    }
    if (!snapshot.backend?.connected) {
      setPendingUploadFileName("");
      setUploadState(backendConnectionMessage(file.name));
      setDrawer("failure");
      return;
    }
    try {
      setPendingUploadFileName(file.name);
      setUploadState(`${file.name} 已提交校验，等待系统返回校验结果。`);
      await onAction(actionRegistry["DATA-003"], {
        kind: "data-package-upload",
        file,
        fileName: file.name,
      });
      setPendingUploadFileName("");
      setUploadState(`${file.name} 系统已返回，请查看当前数据包和页面提示。`);
    } catch (error) {
      setPendingUploadFileName("");
      setUploadState(
        `${file.name} 解析失败：${error instanceof Error ? error.message : "JSON 格式错误"}`,
      );
      setDrawer("failure");
    }
  }

  async function handleTemplateFile(templateType: "CSV" | "XLSX", file?: File) {
    if (!file) {
      return;
    }
    const expectedSuffix = templateType === "CSV" ? ".csv" : ".xlsx";
    if (!file.name.toLowerCase().endsWith(expectedSuffix)) {
      setUploadState(`上传失败：${templateType} 导入仅支持 ${expectedSuffix} 文件。`);
      setDrawer("failure");
      return;
    }
    if (!snapshot.backend?.connected) {
      setPendingUploadFileName("");
      setUploadState(backendConnectionMessage(file.name));
      setDrawer("failure");
      return;
    }
    setPendingUploadFileName(file.name);
    setUploadState(`${file.name} 已提交模板导入，等待系统返回校验结果。`);
    try {
      await onAction(actionRegistry["DATA-012"], {
        kind: "data-package-template-import",
        file,
        fileName: file.name,
        templateType,
      });
      setPendingUploadFileName("");
      setUploadState(`${file.name} 系统已返回，请查看当前数据包和页面提示。`);
    } catch (error) {
      setPendingUploadFileName("");
      setUploadState(
        `${file.name} 导入失败：${error instanceof Error ? error.message : "系统未返回有效结果"}`,
      );
      setDrawer("failure");
    }
  }

  return (
    <div className="pageWorkspace leanPage dataPackagesPage">
      <CompactPageHeader
        title="导入数据"
        description="上传 JSON 文件，或使用 CSV/XLSX 模板导入数据包并生成输入快照。"
        primaryAction={
          <button className="actionButton primary" type="button" onClick={() => fileInputRef.current?.click()}>
            上传 JSON
          </button>
        }
        secondaryActions={
          <>
            <button className="actionButton secondary" type="button" onClick={() => onAction(actionRegistry["DATA-010"])}>
              下载 CSV 模板
            </button>
            <button className="actionButton secondary" type="button" onClick={() => onAction(actionRegistry["DATA-011"])}>
              下载 XLSX 模板
            </button>
            <button className="actionButton secondary" type="button" onClick={() => csvInputRef.current?.click()}>
              导入 CSV
            </button>
            <button className="actionButton secondary" type="button" onClick={() => xlsxInputRef.current?.click()}>
              导入 XLSX
            </button>
            <button className="actionButton secondary" type="button" onClick={() => onAction(actionRegistry["DATA-002"])}>
              使用示例数据
            </button>
          </>
        }
      />
      <input
        ref={fileInputRef}
        accept="application/json,.json"
        hidden
        type="file"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      <input
        ref={csvInputRef}
        accept=".csv,text/csv"
        hidden
        type="file"
        onChange={(event) => handleTemplateFile("CSV", event.target.files?.[0])}
      />
      <input
        ref={xlsxInputRef}
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        hidden
        type="file"
        onChange={(event) => handleTemplateFile("XLSX", event.target.files?.[0])}
      />

      <WorkflowStepper steps={workflowStepsForState(currentPackage, pendingUploadFileName)} />

      <DataMetricStrip items={summaryItems} />

      <section className="ingestionInfoGrid">
        <article className="infoCard">
          <div className="infoCardHead">
            <h2>接入结果</h2>
          </div>
          {currentPackage ? (
            <dl className="businessDetail compact">
              <div><dt>当前数据包</dt><dd>{currentPackage.name}</dd></div>
              <div><dt>数据资源</dt><dd>{currentPackage.resourceCount}</dd></div>
              <div><dt>参与方</dt><dd>{currentPackage.partyCount}</dd></div>
              <div><dt>校验状态</dt><dd><StatusBadge value={currentPackage.status} tone={currentPackage.active ? "success" : "warning"} /></dd></div>
            </dl>
          ) : (
            <EmptyGuide title="等待数据包" description="上传 JSON 或使用示例数据后生成接入结果。" />
          )}
        </article>

        <article className="infoCard uploadGuideCard">
          <div className="infoCardHead">
            <h2>上传指引 / 支持格式</h2>
          </div>
          <dl className="businessDetail compact">
            <div><dt>上传方式</dt><dd>multipart/form-data</dd></div>
            <div><dt>字段名</dt><dd><code>file</code></dd></div>
            <div><dt>P1 模板</dt><dd>CSV / XLSX 模板导入后同样生成数据包与输入快照</dd></div>
            <div>
              <dt>推荐 JSON 顶层字段</dt>
              <dd className="tokenList">
                {["project_name", "participants", "data_units", "revenue_pool"].map((item) => (
                  <code key={item}>{item}</code>
                ))}
              </dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="leanTableSection">
        <div className="leanSectionHead">
          <div>
            <h2>当前数据包</h2>
            <p>查看接入记录、校验状态和安全摘要。</p>
          </div>
          <div className="packageTableTools">
            <div className="scopeToggle" aria-label="数据包范围">
              <button
                className={packageScope === "permitted" ? "active" : ""}
                type="button"
                onClick={() => setPackageScope("permitted")}
              >
                全部有权限数据包
              </button>
              <button
                className={packageScope === "mine" ? "active" : ""}
                type="button"
                onClick={() => setPackageScope("mine")}
              >
                我上传的
              </button>
            </div>
            <label>
              搜索数据包
              <input
                placeholder="名称 / 文件名 / 状态"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>
            <span>{filteredPackages.length} / {visiblePackages.length} 条</span>
          </div>
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
              {filteredPackages.length ? filteredPackages.map((item) => (
                <tr key={item.packageId || item.name}>
                  <td><strong>{item.name}</strong></td>
                  <td>{item.source}</td>
                  <td><StatusBadge value={item.status} tone={item.active ? "success" : "warning"} /></td>
                  <td><span className="fileNameCell" title={item.fileName}>{item.fileName}</span></td>
                  <td>{item.fileSize}</td>
                  <td>{item.receivedAt}</td>
                  <td>
                    <div className="tableActions">
                      <button type="button" onClick={() => openPackageDrawer("preview", item)}>预览</button>
                      <button
                        disabled={item.active}
                        title={item.active ? "当前数据包校验通过，无失败记录。" : "查看校验失败详情"}
                        type="button"
                        onClick={() => openPackageDrawer("failure", item)}
                      >
                        失败详情
                      </button>
                      <button className="dangerAction" type="button" onClick={() => deletePackage(item)}>删除</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7}>
                    <EmptyGuide
                      title={visiblePackages.length ? "未找到匹配数据包" : "当前范围暂无数据包"}
                      description={visiblePackages.length ? "请调整名称、文件名或状态关键词。" : "切换范围或完成上传后会在此展示。"}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`validationOutcome ${currentIssues.length ? "warning" : "success"}`}>
        <div>
          <h2>失败详情</h2>
          {currentIssues.length ? (
            <div className="issueList">
              {currentIssues.map((issue) => (
                <article key={`${issue.problem}-${issue.location}`}>
                  <strong>{issue.problem}</strong>
                  <p>{issue.location} / {issue.type} / {issue.suggestion}</p>
                </article>
              ))}
            </div>
          ) : (
            <p>当前数据包校验通过，无失败记录。</p>
          )}
        </div>
      </section>

      <NextStepStrip
        title="下一步建议"
        description="建议按以下顺序完成后续步骤，以确保计算结果准确可靠。"
        steps={[
          { title: "查看数据资源", description: "确认已识别的数据资源", route: "/data/resources", active: true },
          { title: "维护参与方", description: "完善主体信息与权重规则", route: "/data/parties" },
          { title: "启动质量评估", description: "进行数据质量检测", route: "/metering/quality" },
        ]}
        statusTitle={currentPackage?.active ? "当前数据包校验通过" : "当前数据包待处理"}
        statusDescription={currentPackage?.active ? "可以进入数据资源管理。" : currentUploadState}
        onNavigate={onNavigate}
      />

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
        statusTag={drawerIssues.length ? "校验失败" : "无失败记录"}
        title="上传失败详情"
        variant={drawerIssues.length ? "risk" : "detail"}
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="失败原因与修复建议">
          {drawerIssues.length ? (
            <div className="issueList">
              {drawerIssues.map((issue) => (
                <article key={`${issue.problem}-${issue.location}`}>
                  <strong>{issue.problem}</strong>
                  <dl className="businessDetail compact">
                    <div><dt>error_code</dt><dd>{issue.problem}</dd></div>
                    <div><dt>error_field</dt><dd>{issue.location}</dd></div>
                    <div><dt>error_message</dt><dd>{issue.suggestion}</dd></div>
                    <div><dt>detail_json</dt><dd>{issue.detail}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <EmptyGuide
              title="当前数据包校验通过"
              description="无失败记录；上传接口返回字段级错误后才展示失败详情。"
            />
          )}
        </DrawerSection>
      </DetailDrawer>
    </div>
  );
}

function isPassedStatus(value: string) {
  return /通过|有效|接入|完成|PASS|ACTIVE|VALID/i.test(value);
}
