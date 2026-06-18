import { ModulePageScaffold } from "../ModulePageScaffold";
import type { PageProps } from "../pageTypes";

export function UsersP1Page(props: PageProps) {
  return (
    <ModulePageScaffold
      {...props}
      title="用户与权限管理（P1）"
      subtitle="只读展示 P1 用户、角色、权限和密码重置规划，P0 不启用登录或 RBAC。"
      bodyTitle="P1 权限规划工作台"
      bodyPlaceholder="这里承载用户、角色、菜单权限、按钮权限和 P1 禁用说明。"
    />
  );
}
