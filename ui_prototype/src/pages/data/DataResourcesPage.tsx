import { useMemo, useState } from "react";
import { actionRegistry } from "../../domain/actionRegistry";
import type { DataRow } from "../../domain/types";
import {
  ActionButton,
  ChartPanel,
  DetailDrawer,
  DrawerSection,
  EmptyGuide,
  ExportFieldList,
  MetricCard,
  PageHeader,
  TechnicalDetails,
  WorkbenchCard,
} from "../../ui";
import { cellText, hasBackendRows, pageMetrics, pageRows } from "../backendPageData";
import type { PageProps } from "../pageTypes";

export function DataResourcesPage({ route, snapshot, onAction }: PageProps) {
  const pageData = snapshot.pages["/data/resources"];
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

  return (
    <div className="pageWorkspace phase2Page resourcesPage">
      <PageHeader
        route={{
          ...route,
          label: "资源盘点和主体归属确认工作台",
          responsibility: "盘点资源、筛选风险、确认主体归属，并控制是否进入后续计算。",
        }}
        snapshot={snapshot}
      />

      <div className="metricGrid five">
        {metrics.map((item) => (
          <MetricCard item={item} key={item.label} />
        ))}
      </div>

      <WorkbenchCard
        title="资源筛选"
        description="筛选只影响表格浏览，不生成业务摘要或前置条件结论。"
        actions={
          <ActionButton
            action={actionRegistry["RES-007"]}
            disabledReason="缺少资源摘要导出端点"
            onClick={(action) => onAction(action)}
          />
        }
      >
        <div className="filterBar">
          <label>
            资源/主体搜索
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </label>
          <label>
            模态
            <select value={modality} onChange={(event) => setModality(event.target.value)}>
              {modalities.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
      </WorkbenchCard>

      <div className="phase2bTwoCol">
        <section className="resourceTableCard">
          <div className="sectionHead">
            <h2>资源列表</h2>
            <p>字段数、样本数、缺失率、模态和关联主体只展示后端字段。</p>
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
                    <th>是否进入后续计算</th>
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
                      <td>{cellText(row, "field_count")}</td>
                      <td>{cellText(row, "sample_count")}</td>
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
                            title="页面缺少 party relation 写入 DTO；本阶段不做前端假绑定。"
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
              title="后端未返回资源列表"
              description="请先选择演示数据或上传 JSON；页面不会展示内置资源样例。"
            />
          )}
        </section>

        <ChartPanel
          title="资源图表"
          description="模态分布、缺失率条形图和资源主体关系图需要后端 chart DTO。"
          source={pageData.chart?.chart_id}
        />
      </div>

      <DetailDrawer
        footerNote="详情抽屉只展示后端字段；不展示前端生成的统计或预览。"
        objectType="数据资源"
        open={Boolean(selectedRow)}
        size="lg"
        statusTag={selectedRow ? cellText(selectedRow, "status") : undefined}
        subtitle={selectedRow ? cellText(selectedRow, "modality") : undefined}
        technicalDetails={
          selectedRow ? <TechnicalDetails details={selectedRow} /> : null
        }
        title="数据资源详情"
        variant="detail"
        onClose={() => setDetailIndex(null)}
      >
        {selectedRow ? (
          <div className="resourceDetail">
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
          </div>
        ) : null}
      </DetailDrawer>

      <DetailDrawer
        footerNote="保存主体关系必须走后端接口并返回审计记录。"
        objectType="主体归属配置"
        open={bindingOpen}
        size="lg"
        statusTag="未启用"
        title="绑定数据源主体"
        variant="form"
        onClose={() => setBindingOpen(false)}
      >
        <DrawerSection title="后端缺口">
          <EmptyGuide
            title="主体绑定 payload 未接入"
            description="需要页面获得资源 ID、参与方 ID 和 split_ratio 输入后调用后端 party-relations；当前不做本地绑定成功。"
          />
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="缺少导出端点时不显示已生成文件。"
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
            note="字段范围仅为契约说明；当前没有后端导出结果。"
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
  { key: "include_in_calculation", label: "是否进入后续计算" },
  { key: "provider_party", label: "关联主体" },
];
