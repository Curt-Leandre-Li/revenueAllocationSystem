import { getActions } from "../domain/actionRegistry";
import {
  fieldLabels,
  getRouteFieldMapping,
  getVisibleTableFields,
} from "../domain/fieldMap";
import { getActionDisabledReason } from "../domain/permissions";
import type { ActionDefinition, AppRoute, DataRow, RoutePath, WorkbenchSnapshot } from "../domain/types";
import {
  ActionButton,
  ChartPanel,
  DataTable,
  MetricCard,
  PageHeader,
  PreconditionPanel,
  RiskNotice,
  SectionCard,
  StatusStepper,
  TechnicalDetails,
  WorkbenchCard,
} from "../ui";

interface ModulePageScaffoldProps {
  route: AppRoute;
  snapshot: WorkbenchSnapshot;
  title: string;
  subtitle: string;
  bodyTitle: string;
  bodyPlaceholder: string;
  onAction: (action: ActionDefinition) => void;
  onNavigate: (path: RoutePath) => void;
  onOpenDetail: (title: string, row: DataRow) => void;
  onOpenTrace: () => void;
}

export function ModulePageScaffold({
  route,
  snapshot,
  title,
  subtitle,
  bodyTitle,
  bodyPlaceholder,
  onAction,
  onNavigate,
  onOpenDetail,
  onOpenTrace,
}: ModulePageScaffoldProps) {
  const mapping = getRouteFieldMapping(route.path);
  const pageData = snapshot.pages[route.path];

  if (!mapping || !pageData) {
    return null;
  }

  const actions = getActions(route.actionIds);
  const visibleFields = getVisibleTableFields(mapping);

  return (
    <div className="pageWorkspace">
      <PageHeader route={{ ...route, label: title, responsibility: subtitle }} snapshot={snapshot} />
      <RiskNotice compact />
      <StatusStepper current={snapshot.status} />

      <div className="metricsGrid">
        {pageData.metrics.map((metric) => (
          <MetricCard item={metric} key={metric.label} />
        ))}
      </div>

      <div className="workspaceGrid">
        <WorkbenchCard
          title={bodyTitle}
          description={bodyPlaceholder}
          actions={
            <>
              {actions.map((action) => (
                <ActionButton
                  action={action}
                  disabledReason={getActionDisabledReason(
                    action,
                    snapshot.status,
                    snapshot.backend?.disabledActions,
                  )}
                  key={action.id}
                  onClick={onAction}
                />
              ))}
            </>
          }
        >
          <div className="primaryTask">
            <span>当前任务</span>
            <strong>{pageData.primaryTask}</strong>
          </div>
          <DataTable
            columns={visibleFields}
            rows={pageData.rows}
            onSelectRow={(row) => onOpenDetail(`${title}详情`, row)}
          />
        </WorkbenchCard>

        <aside className="sideRail">
          <ChartPanel
            title="可视化数据源"
            description="图表只消费后端字段或 chart DTO。"
            source={pageData.chart?.source?.snapshot_id ?? pageData.chart?.source?.result_id}
          />

          <SectionCard title="前置条件" description="按钮执行前必须满足的业务检查。">
            <PreconditionPanel items={pageData.preconditions} onNavigate={onNavigate} />
          </SectionCard>

          <SectionCard title="追溯入口" description="工程字段默认隐藏，只在技术详情中查看。">
            <button className="traceButton" type="button" onClick={onOpenTrace}>
              打开追溯抽屉
            </button>
            <TechnicalDetails details={pageData.technicalDetails} />
          </SectionCard>

          <SectionCard title="字段映射" description={`主表：${mapping.mainTable}`}>
            <ul className="fieldList">
              {visibleFields.slice(0, 6).map((field) => (
                <li key={field.key}>{fieldLabels[field.key] ?? field.label}</li>
              ))}
            </ul>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}
