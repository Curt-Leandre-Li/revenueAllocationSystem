import type { MockDomainService } from "./serviceTypes";
import { readPageFromStore } from "./serviceTypes";
import { dvasApi } from "../api";
import {
  backendUnavailableStore,
  mutateBackendAndRefresh,
  refreshStoreFromBackend,
} from "./backendWorkspace";

export const UserService: MockDomainService = {
  readPage: readPageFromStore,
  handleAction(store, action, payload) {
    if (action.id === "USER-001") {
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.listUsers(),
        "用户列表已从后端刷新。",
        "user list",
      );
    }
    if (action.id === "USER-002") {
      if (payload?.kind !== "user-update" || !payload.username) {
        return refreshStoreFromBackend(store, "请提供用户名后再新增用户。");
      }
      return mutateBackendAndRefresh(
        store,
        () =>
          dvasApi.createUser({
            username: payload.username,
            display_name: payload.displayName,
            roles: payload.roles,
            initial_password: payload.password,
          }),
        "用户已创建，用户与角色列表已刷新。",
        "user create",
      );
    }
    if (action.id === "USER-003") {
      if (payload?.kind !== "user-update" || !payload.userId) {
        return refreshStoreFromBackend(store, "请选择需要编辑的用户。");
      }
      return mutateBackendAndRefresh(
        store,
        () =>
          dvasApi.updateUser(payload.userId!, {
            display_name: payload.displayName,
            status: payload.status,
            roles: payload.roles,
          }),
        "用户信息已更新。",
        "user update",
      );
    }
    if (action.id === "USER-004" || action.id === "USER-005") {
      if (payload?.kind !== "user-update" || !payload.userId) {
        return refreshStoreFromBackend(store, "请选择需要禁用的用户。");
      }
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.disableUser(payload.userId!),
        "用户已禁用。",
        "user disable",
      );
    }
    if (action.id === "USER-007") {
      if (payload?.kind !== "user-update" || !payload.userId) {
        return refreshStoreFromBackend(store, "请选择需要重置密码的用户。");
      }
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.resetUserPassword(payload.userId!, payload.password),
        "用户密码已重置。",
        "user password reset",
      );
    }
    if (action.id === "USER-008") {
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.listRoles(),
        "角色列表已从后端刷新。",
        "role list",
      );
    }
    if (action.id === "USER-009") {
      return mutateBackendAndRefresh(
        store,
        () => dvasApi.listPermissions(),
        "权限矩阵已从后端刷新。",
        "permission list",
      );
    }
    return backendUnavailableStore(store, action.label, "user P1 action");
  },
};
