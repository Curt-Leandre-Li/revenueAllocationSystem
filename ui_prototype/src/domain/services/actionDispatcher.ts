import { getActionRegistryIntegrityReport } from "../actionRegistry";
import { getActionDisabledReason } from "../permissions";
import type { ActionDefinition, ActionHandlerName, ActionPayload } from "../types";
import type { WorkbenchStore } from "../store";
import { AllocationService } from "./AllocationService";
import { AuditService } from "./AuditService";
import { ConstraintService } from "./ConstraintService";
import { DashboardService } from "./DashboardService";
import { DataPackageService } from "./DataPackageService";
import { MDDShapService } from "./MDDShapService";
import { ParameterService } from "./ParameterService";
import { PartyService } from "./PartyService";
import { QualityService } from "./QualityService";
import { ReportService } from "./ReportService";
import { ResourceService } from "./ResourceService";
import { ShuyuanService } from "./ShuyuanService";
import type { ServiceActionHandler } from "./serviceTypes";
import { UserService } from "./UserService";
import { UtilityService } from "./UtilityService";

export const actionHandlerRegistry: Record<ActionHandlerName, ServiceActionHandler> = {
  "DashboardService.handleAction": DashboardService.handleAction,
  "DataPackageService.handleAction": DataPackageService.handleAction,
  "ResourceService.handleAction": ResourceService.handleAction,
  "PartyService.handleAction": PartyService.handleAction,
  "QualityService.handleAction": QualityService.handleAction,
  "ShuyuanService.handleAction": ShuyuanService.handleAction,
  "UtilityService.handleAction": UtilityService.handleAction,
  "MDDShapService.handleAction": MDDShapService.handleAction,
  "AllocationService.handleAction": AllocationService.handleAction,
  "ConstraintService.handleAction": ConstraintService.handleAction,
  "ReportService.handleAction": ReportService.handleAction,
  "ParameterService.handleAction": ParameterService.handleAction,
  "UserService.handleAction": UserService.handleAction,
  "AuditService.handleAction": AuditService.handleAction,
};

export const knownActionHandlers = new Set<ActionHandlerName>(
  Object.keys(actionHandlerRegistry) as ActionHandlerName[],
);

const silentDisabledActionIds = new Set(["REP-009"]);

export function dispatchWorkbenchAction(
  store: WorkbenchStore,
  action: ActionDefinition,
  payload?: ActionPayload,
): WorkbenchStore | Promise<WorkbenchStore> {
  if (store.dataSource.mode !== "backend") {
    return {
      ...store,
      lastMessage: `${action.label} 未执行：后端未连接，前端不会使用 mock 或 fallback 伪造成业务成功。`,
    };
  }

  const disabledReason = getActionDisabledReason(
    action,
    store.snapshot.status,
    store.snapshot.backend?.disabledActions,
  );
  if (disabledReason) {
    if (silentDisabledActionIds.has(action.id)) {
      return {
        ...store,
        lastMessage: "",
      };
    }
    return {
      ...store,
      lastMessage: `${action.label} 未执行：${disabledReason}`,
    };
  }

  return actionHandlerRegistry[action.handlerName](store, action, payload);
}

export function getDispatcherIntegrityReport() {
  return getActionRegistryIntegrityReport(knownActionHandlers);
}
