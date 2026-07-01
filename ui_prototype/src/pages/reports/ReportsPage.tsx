import { useEffect, useMemo, useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import { dvasApi } from "../../domain/api";
import {
  ChartArea,
  CompactPageHeader,
  DetailDrawer,
  DrawerSection,
  EmptyGuide,
  ProductBarChart,
  ProductTimeline,
  SummaryStrip,
} from "../../ui";
import { cellText, numericCellValue, pageMetrics, pageRows } from "../backendPageData";
import type { PageProps } from "../pageTypes";

interface ReportDownloadFile {
  exportFileId: string;
  name: string;
  type: string;
}

interface DownloadedReportFile {
  fileName: string;
  contentBase64: string;
  mimeType: string;
}

interface ReportDownloadRow extends ReportDownloadFile {
  key: string;
  reportId: string;
  reportName: string;
  reportStatus: string;
  createdAt: string;
  checksum: string;
}

export function ReportsPage({ route, snapshot, onAction }: PageProps) {
  const [drawer, setDrawer] = useState<"" | "record">("");
  const [selectedReportId, setSelectedReportId] = useState("");
  const [selectedDownloadTypes, setSelectedDownloadTypes] = useState<Set<string>>(() => new Set());
  const [selectedFileKeys, setSelectedFileKeys] = useState<Set<string>>(() => new Set());
  const [downloading, setDownloading] = useState(false);
  const pageData = snapshot.pages[route.path];
  const reportRows = pageRows(pageData);
  const reportFileRows = useMemo(() => buildReportFileRows(reportRows), [reportRows]);
  const availableDownloadTypes = useMemo(() => buildDownloadTypes(reportFileRows), [reportFileRows]);
  const visibleReportRows = reportRows;
  const visibleDownloadFiles = useMemo(
    () => selectedDownloadTypes.size
      ? reportFileRows.filter((file) => selectedDownloadTypes.has(file.type))
      : reportFileRows,
    [reportFileRows, selectedDownloadTypes],
  );
  const visibleFileKeys = useMemo(
    () => new Set(visibleDownloadFiles.map((file) => file.key)),
    [visibleDownloadFiles],
  );
  const selectedVisibleFileCount = visibleDownloadFiles.filter((file) => selectedFileKeys.has(file.key)).length;
  const allVisibleFilesSelected = visibleDownloadFiles.length > 0 && selectedVisibleFileCount === visibleDownloadFiles.length;
  const downloadTargets = visibleDownloadFiles
    .filter((file) => selectedFileKeys.has(file.key))
    .map((file) => ({ reportId: file.reportId, exportFileId: file.exportFileId }));
  const metrics = pageMetrics(pageData);
  const latestReport = visibleReportRows[0];
  const selectedReport =
    visibleReportRows.find((row) => cellText(row, "report_id") === selectedReportId) ?? latestReport;
  const hasReports = visibleReportRows.length > 0;
  const metricMap = new Map(metrics.map((item) => [item.label, item]));
  const summaryItems = [
    {
      label: "报告数量",
      value: String(visibleReportRows.length),
      hint: "全部报告",
      tone: "neutral" as const,
    },
    metricMap.get("导出文件数") ?? { label: "导出文件数", value: cellText(pageData.technicalDetails, "export_file_count", "暂无"), hint: "系统摘要", tone: "neutral" as const },
    metricMap.get("最近生成时间") ?? { label: "最近生成时间", value: cellText(latestReport, "created_at", "暂无"), hint: "系统字段", tone: "neutral" as const },
    metricMap.get("已确认方案") ?? { label: "已确认方案", value: cellText(pageData.technicalDetails, "confirmed_allocation_count", "暂无"), hint: "系统摘要", tone: "neutral" as const },
    metricMap.get("checksum 记录") ?? { label: "checksum 记录", value: cellText(pageData.technicalDetails, "checksum_count", "暂无"), hint: "系统摘要", tone: "neutral" as const },
  ];
  const exportedFilePoints = buildExportedFilePoints(visibleReportRows);
  const timelineItems = visibleReportRows.map((row) => ({
    label: cellText(row, "report_name"),
    value: cellText(row, "created_at"),
    numeric: null,
    meta: cellText(row, "report_status"),
  }));

  useEffect(() => {
    setSelectedFileKeys((current) => {
      const next = new Set(Array.from(current).filter((key) => visibleFileKeys.has(key)));
      return next.size === current.size ? current : next;
    });
  }, [visibleFileKeys]);

  function toggleDownloadType(type: string) {
    setSelectedDownloadTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  function toggleFileSelection(fileKey: string) {
    setSelectedFileKeys((current) => {
      const next = new Set(current);
      if (next.has(fileKey)) {
        next.delete(fileKey);
      } else {
        next.add(fileKey);
      }
      return next;
    });
  }

  function selectAllVisibleFiles() {
    setSelectedFileKeys((current) => {
      const next = new Set(current);
      visibleDownloadFiles.forEach((file) => next.add(file.key));
      return next;
    });
  }

  function clearSelectedFiles() {
    setSelectedFileKeys(new Set());
  }

  async function downloadSingleFile(file: ReportDownloadRow) {
    if (downloading) {
      return;
    }
    setDownloading(true);
    try {
      const downloadedFile = await dvasApi.downloadReport(file.reportId, file.exportFileId || undefined);
      downloadBase64File(
        downloadedFile.file_name,
        downloadedFile.content_base64,
        downloadedFile.mime_type ?? "application/octet-stream",
      );
    } finally {
      setDownloading(false);
    }
  }

  async function downloadSelectedTypes() {
    if (!downloadTargets.length || downloading) {
      return;
    }
    setDownloading(true);
    try {
      const files: DownloadedReportFile[] = [];
      for (const target of downloadTargets) {
        const file = await dvasApi.downloadReport(target.reportId, target.exportFileId || undefined);
        files.push({
          fileName: file.file_name,
          contentBase64: file.content_base64,
          mimeType: file.mime_type ?? "application/octet-stream",
        });
      }
      if (files.length === 1) {
        downloadBase64File(files[0].fileName, files[0].contentBase64, files[0].mimeType);
        return;
      }
      downloadBlob(downloadName("dvas_selected_reports", "zip"), createZipBlob(files));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="pageWorkspace leanPage reportsPage">
      <CompactPageHeader
        title="报告导出"
        description="生成说明报告，披露合同比例划分与数据源收益池分配的模拟参考口径。"
      />

      <SummaryStrip items={summaryItems} />

      <section className="resultChartGrid secondary">
        <ChartArea title="导出文件统计" source={exportedFilePoints.length ? "export_files" : undefined}>
          <ProductBarChart points={exportedFilePoints} unit="次" emptyText="暂无导出文件记录" />
        </ChartArea>
        <ChartArea title="报告生成时间线" source={hasReports ? "rows" : undefined}>
          <ProductTimeline items={timelineItems} />
        </ChartArea>
      </section>

      <section className="leanTableSection">
        <div className="leanSectionHead">
          <div>
            <h2>报告列表</h2>
            <p>报告编号、校验摘要和生成时间以系统记录为准。</p>
          </div>
          <div className="reportDownloadFilters" aria-label="批量下载类型筛选">
            <div className="downloadTypeOptions">
              {availableDownloadTypes.map((type) => (
                <label className={selectedDownloadTypes.has(type) ? "active" : ""} key={type}>
                  <input
                    checked={selectedDownloadTypes.has(type)}
                    type="checkbox"
                    onChange={() => toggleDownloadType(type)}
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
            <div className="downloadFilterActions">
              <span className="downloadSelectionCount">
                已选 {selectedVisibleFileCount} / {visibleDownloadFiles.length} 个文件
              </span>
              <button
                disabled={!visibleDownloadFiles.length || allVisibleFilesSelected}
                type="button"
                onClick={selectAllVisibleFiles}
              >
                全选
              </button>
              <button
                disabled={!selectedFileKeys.size}
                type="button"
                onClick={clearSelectedFiles}
              >
                清空
              </button>
              <button
                className="actionButton primary"
                disabled={!downloadTargets.length || downloading}
                type="button"
                onClick={() => void downloadSelectedTypes()}
              >
                {downloading ? "下载中" : "下载"}
              </button>
            </div>
          </div>
        </div>
        {visibleDownloadFiles.length ? (
          <div className="tableWrap">
            <table className="dataTable phase2Table">
              <thead>
                <tr>
                  <th className="reportSelectionHead">
                    <input
                      aria-label="全选当前列表文件"
                      checked={allVisibleFilesSelected}
                      type="checkbox"
                      onChange={(event) => {
                        if (event.target.checked) {
                          selectAllVisibleFiles();
                        } else {
                          clearSelectedFiles();
                        }
                      }}
                    />
                  </th>
                  <th>文件名称</th>
                  <th>类型</th>
                  <th>状态</th>
                  <th>生成时间</th>
                  <th>report_id</th>
                  <th>checksum</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {visibleDownloadFiles.map((item) => (
                  <tr className={selectedFileKeys.has(item.key) ? "selectedFile" : ""} key={item.key}>
                    <td className="reportSelectionCell">
                      <input
                        aria-label={`选择 ${item.name}`}
                        checked={selectedFileKeys.has(item.key)}
                        type="checkbox"
                        onChange={() => toggleFileSelection(item.key)}
                      />
                    </td>
                    <td>
                      <strong>{item.name}</strong>
                      <small>{item.reportName}</small>
                    </td>
                    <td>{item.type}</td>
                    <td>{item.reportStatus}</td>
                    <td>{item.createdAt}</td>
                    <td>{item.reportId}</td>
                    <td>{item.checksum}</td>
                    <td>
                      <div className="tableActions">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedReportId(item.reportId);
                            setDrawer("record");
                          }}
                        >
                          详情
                        </button>
                        <button
                          type="button"
                          onClick={() => void downloadSingleFile(item)}
                        >
                          下载
                        </button>
                        <button
                          className="dangerAction"
                          type="button"
                          onClick={() => onAction(actionRegistry["REP-012"], {
                            kind: "download-file",
                            reportId: item.reportId,
                          })}
                        >
                          归档
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : hasReports ? (
          <EmptyGuide
            title="当前类型暂无文件"
            description="取消上方文件类型筛选，或选择其他文件类型后再勾选下载。"
          />
        ) : (
          <EmptyGuide
            title="暂无报告记录"
            description="完成收益分配模拟后，可生成 Markdown、CSV、JSON 或 JSONL 报告。"
          />
        )}
      </section>

      <DetailDrawer
        footerNote="历史报告文件不静默覆盖，重复导出会生成新记录。"
        objectType="导出记录"
        open={drawer === "record"}
        size="md"
        title="导出记录详情"
        variant="detail"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="文件说明">
          {selectedReport ? (
            <dl className="businessDetail compact">
              <div><dt>文件名称</dt><dd>{cellText(selectedReport, "report_name")}</dd></div>
              <div><dt>文件类型</dt><dd>{cellText(selectedReport, "report_type")}</dd></div>
              <div><dt>状态</dt><dd>{cellText(selectedReport, "report_status")}</dd></div>
              <div><dt>生成时间</dt><dd>{cellText(selectedReport, "created_at")}</dd></div>
              <div><dt>report_id</dt><dd>{cellText(selectedReport, "report_id")}</dd></div>
              <div><dt>checksum</dt><dd>{cellText(selectedReport, "checksum")}</dd></div>
            </dl>
          ) : (
            <EmptyGuide title="暂无导出记录" description="页面不会用默认文件名或已生成状态伪造导出成功。" />
          )}
        </DrawerSection>
      </DetailDrawer>
    </div>
  );
}

function buildExportedFilePoints(rows: ReturnType<typeof pageRows>) {
  const stats = new Map<string, { count: number; types: Set<string> }>();
  for (const row of rows) {
    const files = exportFilesFromRow(row);
    for (const file of files) {
      const current = stats.get(file.name) ?? { count: 0, types: new Set<string>() };
      current.count += 1;
      if (file.type) {
        current.types.add(file.type);
      }
      stats.set(file.name, current);
    }
  }
  return Array.from(stats.entries())
    .sort((left, right) => right[1].count - left[1].count || left[0].localeCompare(right[0], "zh-CN"))
    .map(([name, item]) => ({
      label: name,
      value: String(item.count),
      numeric: numericCellValue(item.count),
      meta: Array.from(item.types).join(" / "),
    }));
}

function buildDownloadTypes(files: ReportDownloadRow[]) {
  return Array.from(new Set(files.map((file) => file.type).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, "zh-CN"));
}

function buildReportFileRows(rows: ReturnType<typeof pageRows>): ReportDownloadRow[] {
  const files: ReportDownloadRow[] = [];
  for (const row of rows) {
    const reportId = cellText(row, "report_id");
    if (!reportId || reportId === "暂无") {
      continue;
    }
    const reportName = cellText(row, "report_name");
    const reportStatus = cellText(row, "report_status");
    const createdAt = cellText(row, "created_at");
    const checksum = cellText(row, "checksum");
    exportFilesFromRow(row).forEach((file, index) => {
      files.push({
        ...file,
        key: `${reportId}:${file.exportFileId || file.name}:${index}`,
        reportId,
        reportName,
        reportStatus,
        createdAt,
        checksum,
      });
    });
  }
  return files;
}

function exportFilesFromRow(row: ReturnType<typeof pageRows>[number]): ReportDownloadFile[] {
  const parsed = parseExportFiles(cellText(row, "export_files_json"));
  if (parsed.length) {
    return parsed;
  }
  const fallbackName = cellText(row, "report_name");
  const fallbackType = cellText(row, "report_type", "");
  return fallbackName === "暂无"
    ? []
    : [{ exportFileId: "", name: fallbackName, type: fallbackType }];
}

function parseExportFiles(raw: string): ReportDownloadFile[] {
  if (!raw || raw === "暂无") {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const record = item as Record<string, unknown>;
        const exportFileId = typeof record.export_file_id === "string" ? record.export_file_id : "";
        const name = typeof record.file_name === "string" ? record.file_name : "";
        const type = typeof record.file_type === "string" ? record.file_type : "";
        return name ? { exportFileId, name, type } : null;
      })
      .filter((item): item is ReportDownloadFile => Boolean(item));
  } catch {
    return [];
  }
}

function downloadBase64File(fileName: string, contentBase64: string, mimeType: string) {
  downloadBlob(fileName, new Blob([bytesToBlobPart(base64ToBytes(contentBase64))], { type: mimeType }));
}

function downloadBlob(fileName: string, blob: Blob) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

function downloadName(prefix: string, extension: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}_${stamp}.${extension}`;
}

function base64ToBytes(contentBase64: string) {
  const binary = window.atob(contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function createZipBlob(files: DownloadedReportFile[]) {
  const encoder = new TextEncoder();
  const usedNames = new Set<string>();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  files.forEach((file, index) => {
    const entryName = uniqueZipEntryName(file.fileName || `report_${index + 1}.bin`, usedNames);
    const nameBytes = encoder.encode(entryName);
    const data = base64ToBytes(file.contentBase64);
    const checksum = crc32(data);
    const localHeader = zipLocalHeader(nameBytes, data.length, checksum);
    const centralHeader = zipCentralHeader(nameBytes, data.length, checksum, offset);
    localParts.push(localHeader, data);
    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  });

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = zipEndRecord(files.length, centralSize, centralOffset);
  const zipParts = [...localParts, ...centralParts, end].map(bytesToBlobPart);
  return new Blob(zipParts, { type: "application/zip" });
}

function bytesToBlobPart(bytes: Uint8Array) {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

function uniqueZipEntryName(fileName: string, usedNames: Set<string>) {
  const safeName = fileName.replace(/^[/\\]+/, "") || "report.bin";
  if (!usedNames.has(safeName)) {
    usedNames.add(safeName);
    return safeName;
  }

  const dotIndex = safeName.lastIndexOf(".");
  const base = dotIndex > 0 ? safeName.slice(0, dotIndex) : safeName;
  const extension = dotIndex > 0 ? safeName.slice(dotIndex) : "";
  let suffix = 2;
  let candidate = `${base}_${suffix}${extension}`;
  while (usedNames.has(candidate)) {
    suffix += 1;
    candidate = `${base}_${suffix}${extension}`;
  }
  usedNames.add(candidate);
  return candidate;
}

function zipLocalHeader(nameBytes: Uint8Array, size: number, checksum: number) {
  const header = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint32(14, checksum, true);
  view.setUint32(18, size, true);
  view.setUint32(22, size, true);
  view.setUint16(26, nameBytes.length, true);
  view.setUint16(28, 0, true);
  header.set(nameBytes, 30);
  return header;
}

function zipCentralHeader(nameBytes: Uint8Array, size: number, checksum: number, offset: number) {
  const header = new Uint8Array(46 + nameBytes.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint16(14, 0, true);
  view.setUint32(16, checksum, true);
  view.setUint32(20, size, true);
  view.setUint32(24, size, true);
  view.setUint16(28, nameBytes.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, offset, true);
  header.set(nameBytes, 46);
  return header;
}

function zipEndRecord(fileCount: number, centralSize: number, centralOffset: number) {
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, fileCount, true);
  view.setUint16(10, fileCount, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  view.setUint16(20, 0, true);
  return end;
}

const CRC32_TABLE = buildCrc32Table();

function buildCrc32Table() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

function crc32(bytes: Uint8Array) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value = CRC32_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}
