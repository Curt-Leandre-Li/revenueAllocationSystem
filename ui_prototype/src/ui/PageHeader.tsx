import type { AppRoute, WorkbenchSnapshot } from "../domain/types";
import { userFacingText } from "./displayText";

interface PageHeaderProps {
  route: AppRoute;
  snapshot: WorkbenchSnapshot;
}

export function PageHeader({ route, snapshot }: PageHeaderProps) {
  void snapshot;
  return (
    <header className="pageHeader compactPageHeader">
      <div>
        <h1>{userFacingText(route.label)}</h1>
        <p className="pageSummary">{userFacingText(route.responsibility)}</p>
      </div>
    </header>
  );
}
