import type { ActionDefinition, PermissionCode, Phase, StatusCode } from "./types";
import { isLockedStatus } from "./status";

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

export function isP1Only(phase: Phase) {
  return phase === "P1";
}

export function getActionDisabledReason(
  action: ActionDefinition,
  projectStatus: StatusCode,
  backendDisabledActions: Array<{ button_code: string; reason: string }> = [],
) {
  if (isP1Only(action.phase)) {
    return "P1 能力，当前 P0 阶段仅展示规划";
  }

  if (!localOperatorPermissions.includes(action.permission)) {
    return "本地操作员无此按钮权限";
  }

  if (
    isLockedStatus(projectStatus) &&
    ["CREATE", "UPDATE", "DELETE_DISABLE", "CALCULATE", "CONFIRM"].includes(
      action.permission,
    )
  ) {
    return "方案已锁定或已导出，请复制新版本后再修改";
  }

  const backendDisabled = backendDisabledActions.find(
    (item) => item.button_code === action.id,
  );
  if (backendDisabled) {
    return backendDisabled.reason;
  }

  return "";
}
