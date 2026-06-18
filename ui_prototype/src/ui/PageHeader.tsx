import { projectStatusLabels } from "../domain/status";
import type { AppRoute, WorkbenchSnapshot } from "../domain/types";

interface PageHeaderProps {
  route: AppRoute;
  snapshot: WorkbenchSnapshot;
}

export function PageHeader({ route, snapshot }: PageHeaderProps) {
  return (
    <header className="pageHeader">
      <div>
        <p className="breadcrumb">数据收益分配系统 / {route.label}</p>
        <h1>{route.label}</h1>
        <p className="pageSummary">{route.responsibility}</p>
      </div>
      <div className="projectContext">
        <span>{snapshot.projectName}</span>
        <strong>{projectStatusLabels[snapshot.status]}</strong>
        <small>{snapshot.scenarioName}</small>
      </div>
    </header>
  );
}
