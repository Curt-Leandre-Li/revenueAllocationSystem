import { useMemo, useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import type { DataRow } from "../../domain/types";
import {
  ActionButton,
  ChartArea,
  CompactPageHeader,
  DetailDrawer,
  DrawerSection,
  EmptyGuide,
  ExportFieldList,
  ProductBarChart,
  SummaryStrip,
  TechnicalDetails,
} from "../../ui";
import {
  cellText,
  hasBackendRows,
  numberCell,
  numericCellValue,
  pageMetrics,
  pageRows,
} from "../backendPageData";
import type { PageProps } from "../pageTypes";

export function DataResourcesPage({ route, snapshot, onAction }: PageProps) {
  const pageData = snapshot.pages[route.path];
  const rows = pageRows(pageData);
  const metrics = pageMetrics(pageData);
  const [keyword, setKeyword] = useState("");
  const [modality, setModality] = useState("全部");
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const [bindingOpen, setBindingOpen] = useState(false);

  const modalities = useMemo(() => {
    const values = rows.map((row) => cellText(row, "modality", "")).filter(Boolean);
    return ["全部", ...Array.from(new Set(values))];
  }, [rows]);
  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const modalityMatched = modality === "全部" || cellText(row, "modality", "") === modality;
        const keywordMatched =
          !keyword.trim() ||
          cellText(row, "resource_name", "").includes(keyword.trim()) ||
          cellText(row, "provider_party", "").includes(keyword.trim());
        return modalityMatched && keywordMatched;
      }),
    [rows, modality, keyword],
  );
  const selectedRow = detailIndex === null ? undefined : filteredRows[detailIndex];
  const metricMap = new Map(metrics.map((item) => [item.label, item]));
  const summaryItems = [
    metricMap.get("数据资源") ?? { label: "数据资源", value: "暂无", hint: "待生成", tone: "neutral" as const },
    metricMap.get("字段数量") ?? { label: "字段数量", value: cellText(pageData?.technicalDetails, "field_count_total", "暂无"), hint: "系统摘要", tone: "neutral" as const },
    metricMap.get("样本数量") ?? { label: "样本数量", value: cellText(pageData?.technicalDetails, "sample_count_total", "暂无"), hint: "系统摘要", tone: "neutral" as const },
    metricMap.get("关联主体") ?? { label: "关联主体", value: cellText(pageData?.technicalDetails, "provider_party_count", "暂无"), hint: "系统摘要", tone: "neutral" as const },
    metricMap.get("敏感字段") ?? { label: "敏感字段", value: cellText(pageData?.technicalDetails, "sensitive_field_count", "暂无"), hint: "系统摘要", tone: "neutral" as const },
  ];
  const missingRatePoints = rows.map((row) => ({
    label: cellText(row, "resource_name"),
    value: cellText(row, "missing_rate"),
    numeric: numericCellValue(row.missing_rate),
    meta: cellText(row, "modality"),
  }));

  return (
    <div className="pageWorkspace leanPage resourcesPage">
      <CompactPageHeader
        title="数据资源"
        description="查看资源列表、字段数量、样本数量、缺失率和关联主体。"
      />

      <SummaryStrip items={summaryItems} />

      <section className="leanFilterBar">
        <div className="filterBar">
          <label>
            资源/主体搜索
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} />
          </label>
          <label>
            模态
            <select value={modality} onChange={(event) => setModality(event.target.value)}>
              {modalities.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <ActionButton
            action={actionRegistry["RES-007"]}
            disabledReason="暂未启用"
            onClick={(action) => onAction(action)}
          />
        </div>
      </section>

      <section className="resultChartGrid secondary">
        <ChartArea title="资源类型分布" source={pageData.chart?.chart_id} />
        <ChartArea title="缺失率排行" source={hasBackendRows(pageData) ? "rows" : undefined}>
          <ProductBarChart points={missingRatePoints} unit="缺失率" />
        </ChartArea>
      </section>

      <section className="leanTableSection">
        <div className="leanSectionHead">
          <div>
            <h2>资源列表</h2>
            <p>字段数、样本数、缺失率、模态和关联主体只展示系统字段。</p>
          </div>
        </div>
        {hasBackendRows(pageData) ? (
          <div className="tableWrap">
            <table className="dataTable phase2Table">
              <thead>
                <tr>
                  <th>资源名称</th>
                  <th>模态</th>
                  <th>字段数</th>
                  <th>样本数</th>
                  <th>缺失率</th>
                  <th>是否进入计算</th>
                  <th>关联主体</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr key={`${cellText(row, "resource_id", "resource")}-${index}`}>
                    <td>
                      <strong>{cellText(row, "resource_name")}</strong>
                      <small className="cellHint">{cellText(row, "status")}</small>
                    </td>
                    <td>{cellText(row, "modality")}</td>
                    <td>{numberCell(row, "field_count")}</td>
                    <td>{numberCell(row, "sample_count")}</td>
                    <td><span className="tag">{cellText(row, "missing_rate")}</span></td>
                    <td>{cellText(row, "include_in_calculation")}</td>
                    <td><span className="tag">{cellText(row, "provider_party")}</span></td>
                    <td>
                      <div className="tableActions">
                        <button
                          type="button"
                          onClick={() => {
                            onAction(actionRegistry["RES-002"], {
                              kind: "resource-detail",
                              resourceKey: cellText(row, "resource_id", ""),
                            });
                            setDetailIndex(index);
                          }}
                        >
                          详情
                        </button>
                        <button
                          disabled
                          title="暂未启用"
                          type="button"
                          onClick={() => setBindingOpen(true)}
                        >
                          关联主体
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyGuide
            title="暂无资源列表"
            description="请先选择示例数据或上传 JSON；页面不会展示内置资源样例。"
          />
        )}
      </section>

      <DetailDrawer
        footerNote="详情抽屉只展示系统字段；不展示页面生成的统计或预览。"
        objectType="数据资源"
        open={Boolean(selectedRow)}
        size="lg"
        statusTag={selectedRow ? cellText(selectedRow, "status") : undefined}
        subtitle={selectedRow ? cellText(selectedRow, "modality") : undefined}
        technicalDetails={selectedRow ? <TechnicalDetails details={selectedRow} /> : null}
        title="数据资源详情"
        variant="detail"
        onClose={() => setDetailIndex(null)}
      >
        {selectedRow ? (
          <DrawerSection title="资源概览">
            <dl className="businessDetail">
              {resourceDetailFields.map((field) => (
                <div key={field.key}>
                  <dt>{field.label}</dt>
                  <dd>{cellText(selectedRow, field.key)}</dd>
                </div>
              ))}
            </dl>
          </DrawerSection>
        ) : null}
      </DetailDrawer>

      <DetailDrawer
        footerNote="保存主体关系必须走系统接口并返回审计记录。"
        objectType="主体归属配置"
        open={bindingOpen}
        size="lg"
        statusTag="未启用"
        title="绑定数据源主体"
        variant="form"
        onClose={() => setBindingOpen(false)}
      >
        <DrawerSection title="暂未启用">
          <EmptyGuide
            title="主体绑定暂未接入"
            description="需要资源、参与方和分成比例输入后再提交；当前不做本地绑定成功。"
          />
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="缺少导出结果时不显示已生成文件。"
        objectType="导出说明"
        open={false}
        size="md"
        statusTag="未启用"
        title="资源摘要导出"
        variant="export"
        onClose={() => undefined}
      >
        <DrawerSection title="导出字段">
          <ExportFieldList
            fields={[
              "resource_name",
              "modality",
              "field_count",
              "sample_count",
              "missing_rate",
              "provider_party",
              "include_in_calculation",
            ]}
            note="字段范围仅为契约说明；当前没有系统导出结果。"
          />
        </DrawerSection>
      </DetailDrawer>
    </div>
  );
}

const resourceDetailFields: Array<{ key: keyof DataRow & string; label: string }> = [
  { key: "resource_name", label: "资源名称" },
  { key: "modality", label: "模态" },
  { key: "field_count", label: "字段数" },
  { key: "sample_count", label: "样本数" },
  { key: "missing_rate", label: "缺失率" },
  { key: "sensitive_field_count", label: "涉敏字段" },
  { key: "include_in_calculation", label: "是否进入计算" },
  { key: "provider_party", label: "关联主体" },
];
