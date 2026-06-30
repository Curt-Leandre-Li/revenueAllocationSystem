import type { ActionDefinition, PermissionCode, StatusCode } from "./types";
import {
  getContractDisabledReason,
  getReadOnlyDisabledReason,
} from "./stateGuards";

export const permissionLabels: Record<PermissionCode, string> = {
  VIEW: "查看",
  CREATE: "创建",
  UPDATE: "更新",
  DELETE_DISABLE: "停用",
  CALCULATE: "计算",
  CONFIRM: "确认",
  EXPORT: "导出",
};

export const localOperatorPermissions: PermissionCode[] = [
  "VIEW",
  "CREATE",
  "UPDATE",
  "DELETE_DISABLE",
  "CALCULATE",
  "CONFIRM",
  "EXPORT",
];

export function getActionDisabledReason(
  action: ActionDefinition,
  projectStatus: StatusCode,
  backendDisabledActions: Array<{ button_code: string; reason: string }> = [],
) {
  const contractReason = getContractDisabledReason(action);
  if (contractReason) {
    return contractReason;
  }

  if (!localOperatorPermissions.includes(action.permission)) {
    return "本地操作员无此按钮权限";
  }

  const readOnlyReason = getReadOnlyDisabledReason(action, projectStatus);
  if (readOnlyReason) {
    return readOnlyReason;
  }

  const backendDisabled = backendDisabledActions.find(
    (item) => item.button_code === action.id,
  );
  if (backendDisabled) {
    return backendDisabled.reason;
  }

  return "";
}
