import type {
  ActionDefinition,
  ActionPayload,
  AppRoute,
  DataRow,
  RoutePath,
  WorkbenchSnapshot,
} from "../domain/types";

export interface PageProps {
  route: AppRoute;
  snapshot: WorkbenchSnapshot;
  onAction: (action: ActionDefinition, payload?: ActionPayload) => void | Promise<void>;
  onNavigate: (path: RoutePath) => void;
  onOpenDetail: (title: string, row: DataRow) => void;
  onOpenTrace: () => void;
}
