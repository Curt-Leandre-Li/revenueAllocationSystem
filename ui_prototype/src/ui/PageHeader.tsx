import type { AppRoute, WorkbenchSnapshot } from "../domain/types";
import { PageTitleHint } from "./PageTitleHint";

interface PageHeaderProps {
  route: AppRoute;
  snapshot: WorkbenchSnapshot;
}

export function PageHeader({ route, snapshot }: PageHeaderProps) {
  void snapshot;
  return (
    <header className="pageHeader compactPageHeader">
      <div>
        <PageTitleHint title={route.label} description={route.responsibility} />
      </div>
    </header>
  );
}
