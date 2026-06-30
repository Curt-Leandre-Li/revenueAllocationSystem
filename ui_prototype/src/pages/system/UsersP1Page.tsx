import { useEffect, useMemo, useState } from "react";
import { dvasApi, formatApiError } from "../../domain/api";
import {
  CompactPageHeader,
  ConfirmModal,
  DetailDrawer,
  DrawerSection,
  EmptyGuide,
  SummaryStrip,
} from "../../ui";
import type { PageProps } from "../pageTypes";

interface UserRow {
  user_id: string;
  username: string;
  display_name: string;
  email: string;
  status: string;
  roles: string[];
  created_at?: string;
  last_login_at?: string;
  password_updated_at?: string;
  must_change_password?: boolean;
  disabled_by?: string;
  disabled_at?: string;
}

interface RoleRow {
  role_id: string;
  role_code: string;
  role_name: string;
  status: string;
  permission_codes?: string[];
}

interface PermissionRow {
  permission_code: string;
  permission_name: string;
  permission_type: string;
  resource_code: string;
  action: string;
}

interface CurrentUser {
  user_id: string;
  username: string;
  display_name: string;
  email: string;
  status: string;
  roles: string[];
  password_updated_at?: string;
  must_change_password?: boolean;
}

interface OneTimeSecret {
  title: string;
  username: string;
  password: string;
}

const emptyUserForm = {
  username: "",
  display_name: "",
  email: "",
  status: "ENABLED",
  roles: ["VIEWER"],
  initial_password: "",
  auto_password: true,
};

export function UsersP1Page({ onNavigate }: PageProps) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [buttonCodes, setButtonCodes] = useState<string[]>([]);
  const [drawer, setDrawer] = useState<"" | "roles" | "permissions" | "create" | "edit" | "reset" | "password">("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetAutoPassword, setResetAutoPassword] = useState(true);
  const [pendingDisable, setPendingDisable] = useState<UserRow | null>(null);
  const [oneTimeSecret, setOneTimeSecret] = useState<OneTimeSecret | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    void loadData();
  }, []);

  const isSystemAdmin = currentUser?.roles.includes("SYSTEM_ADMIN") ?? false;
  const canCreateUser = hasUserPermission(isSystemAdmin, buttonCodes, "USER_CREATE");
  const canUpdateUser = hasUserPermission(isSystemAdmin, buttonCodes, "USER_UPDATE");
  const canDisableUser = hasUserPermission(isSystemAdmin, buttonCodes, "USER_DISABLE");
  const canResetPassword = hasUserPermission(isSystemAdmin, buttonCodes, "USER_RESET_PASSWORD");
  const canConfigurePermissions = isSystemAdmin || buttonCodes.includes("USER_UPDATE");
  const canManageUsers = canCreateUser || canUpdateUser || canDisableUser || canResetPassword;
  const enabledAdminCount = users.filter((user) => user.status === "ENABLED" && user.roles.includes("SYSTEM_ADMIN")).length;
  const activeUsers = users.filter((user) => user.status === "ENABLED").length;
  const permissionCounts = useMemo(() => {
    return permissions.reduce<Record<string, number>>((accumulator, permission) => {
      accumulator[permission.permission_type] = (accumulator[permission.permission_type] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [permissions]);

  async function loadData() {
    setBusy(true);
    try {
      const me = await dvasApi.getCurrentUser();
      const current = asCurrentUser(me.user as Record<string, unknown>);
      const nextButtonCodes = Array.isArray(me.permissions?.button_codes)
        ? me.permissions.button_codes.map(String)
        : [];
      setCurrentUser({ ...current, roles: me.roles ?? current.roles });
      setButtonCodes(nextButtonCodes);
      const adminVisible =
        (me.roles ?? current.roles).includes("SYSTEM_ADMIN") ||
        ["USER_CREATE", "USER_UPDATE", "USER_DISABLE", "USER_RESET_PASSWORD"].some((code) => nextButtonCodes.includes(code));
      if (!adminVisible) {
        setUsers([]);
        setRoles([]);
        setPermissions([]);
        setMessage("当前账号只能查看本人账号安全信息；用户管理写操作由后端权限拦截。");
        return;
      }
      const [userPage, rolePage, permissionPage] = await Promise.all([
        dvasApi.listUsers(),
        dvasApi.listRoles(),
        dvasApi.listPermissions(),
      ]);
      setUsers(userPage.items.map(asUserRow));
      setRoles(rolePage.items.map(asRoleRow));
      setPermissions(permissionPage.items.map(asPermissionRow));
    } catch (error) {
      setMessage(`读取失败：${formatApiError(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function createUser() {
    if (!userForm.username.trim()) {
      setMessage("请先填写用户名。");
      return;
    }
    if (!userForm.roles.length) {
      setMessage("请至少选择一个角色。");
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        username: userForm.username.trim(),
        display_name: userForm.display_name.trim() || userForm.username.trim(),
        email: userForm.email.trim(),
        status: userForm.status,
        roles: userForm.roles,
      };
      if (!userForm.auto_password) {
        payload.initial_password = userForm.initial_password;
      }
      const created = await dvasApi.createUser(payload);
      setOneTimeSecret({
        title: "初始密码只显示一次",
        username: String(created.username ?? userForm.username),
        password: String(created.one_time_initial_password ?? ""),
      });
      setDrawer("");
      setUserForm(emptyUserForm);
      await loadData();
      setMessage("用户已创建。请复制保存一次性初始密码，关闭后无法再次查看。");
    } catch (error) {
      setMessage(`新增用户失败：${formatApiError(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function updateUser() {
    if (!editingUser) {
      return;
    }
    if (!userForm.roles.length) {
      setMessage("请至少选择一个角色。");
      return;
    }
    setBusy(true);
    try {
      await dvasApi.updateUser(editingUser.user_id, {
        display_name: userForm.display_name.trim() || editingUser.username,
        email: userForm.email.trim(),
        status: userForm.status,
        roles: userForm.roles,
      });
      setDrawer("");
      setEditingUser(null);
      await loadData();
      setMessage("用户信息已更新。");
    } catch (error) {
      setMessage(`编辑用户失败：${formatApiError(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function disableUser() {
    if (!pendingDisable) {
      return;
    }
    setBusy(true);
    try {
      await dvasApi.disableUser(pendingDisable.user_id);
      setPendingDisable(null);
      await loadData();
      setMessage("用户已禁用，后端会拒绝该用户后续登录和受保护接口访问。");
    } catch (error) {
      setMessage(`禁用用户失败：${formatApiError(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function enableUser(user: UserRow) {
    setBusy(true);
    try {
      await dvasApi.updateUser(user.user_id, { status: "ENABLED" });
      await loadData();
      setMessage("用户已启用。");
    } catch (error) {
      setMessage(`启用用户失败：${formatApiError(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function resetUserPassword() {
    if (!resetUser) {
      return;
    }
    setBusy(true);
    try {
      const payloadPassword = resetAutoPassword ? undefined : resetPassword;
      const result = await dvasApi.resetUserPassword(resetUser.user_id, payloadPassword);
      setOneTimeSecret({
        title: "临时密码只显示一次",
        username: resetUser.username,
        password: String(result.one_time_temporary_password ?? ""),
      });
      setDrawer("");
      setResetUser(null);
      setResetPassword("");
      setResetAutoPassword(true);
      await loadData();
      setMessage("用户密码已重置。请复制保存一次性临时密码，关闭后无法再次查看。");
    } catch (error) {
      setMessage(`重置密码失败：${formatApiError(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function changeOwnPassword() {
    setBusy(true);
    try {
      await dvasApi.changeOwnPassword(passwordForm);
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
      setDrawer("");
      await loadData();
      setMessage("本人密码已修改；页面不会显示或保存旧密码。");
    } catch (error) {
      setMessage(`修改密码失败：${formatApiError(error)}`);
    } finally {
      setBusy(false);
    }
  }

  function openEdit(user: UserRow) {
    setEditingUser(user);
    setUserForm({
      username: user.username,
      display_name: user.display_name,
      email: user.email,
      status: user.status,
      roles: user.roles.length ? user.roles : ["VIEWER"],
      initial_password: "",
      auto_password: true,
    });
    setDrawer("edit");
  }

  function openReset(user: UserRow) {
    setResetUser(user);
    setResetPassword("");
    setResetAutoPassword(true);
    setDrawer("reset");
  }

  return (
    <div className="pageWorkspace phase2Page leanPage usersPage">
      <CompactPageHeader
        title="用户与权限"
        description="用户禁用、密码管理和角色授权均以后端当前登录用户权限为准。"
        primaryAction={
          canCreateUser ? (
            <button className="actionButton primary" type="button" onClick={() => setDrawer("create")}>
              新增用户
            </button>
          ) : (
            <button className="actionButton secondary" type="button" onClick={() => setDrawer("password")}>
              修改密码
            </button>
          )
        }
        secondaryActions={
          <>
            <button className="actionButton secondary" disabled={busy} type="button" onClick={loadData}>
              刷新用户
            </button>
            <button className="actionButton secondary" type="button" onClick={() => setDrawer("password")}>
              我的账号
            </button>
            {canConfigurePermissions ? (
              <>
                <button className="actionButton secondary" type="button" onClick={() => setDrawer("roles")}>
                  角色管理
                </button>
                <button className="actionButton secondary" type="button" onClick={() => setDrawer("permissions")}>
                  配置权限
                </button>
              </>
            ) : null}
            <button className="actionButton secondary" type="button" onClick={() => onNavigate("/system/audit")}>
              审计追溯
            </button>
          </>
        }
      />

      <SummaryStrip
        items={[
          { label: "用户", value: String(users.length || (currentUser ? 1 : 0)), hint: canManageUsers ? `${activeUsers} 个启用` : "本人账号", tone: activeUsers ? "success" : "neutral" },
          { label: "角色", value: String(roles.length || currentUser?.roles.length || 0), hint: canManageUsers ? "系统角色表" : "当前角色", tone: "neutral" },
          { label: "菜单权限", value: String(permissionCounts.MENU ?? 0), hint: "MENU", tone: "neutral" },
          { label: "按钮权限", value: String(permissionCounts.BUTTON ?? buttonCodes.length), hint: "BUTTON", tone: "neutral" },
          { label: "接口权限", value: String(permissionCounts.API ?? 0), hint: "API", tone: "neutral" },
        ]}
      />

      {message ? <p className="operationMessage">{message}</p> : null}

      <section className="leanTableSection">
        <div className="leanSectionHead">
          <div>
            <h2>我的账号安全信息</h2>
            <p>页面不展示已有密码；修改密码必须提交当前密码、新密码和确认新密码。</p>
          </div>
          <button className="actionButton secondary" type="button" onClick={() => setDrawer("password")}>
            修改密码
          </button>
        </div>
        {currentUser ? (
          <div className="tableWrap">
            <table className="dataTable phase2Table">
              <thead>
                <tr>
                  <th>账号</th>
                  <th>姓名</th>
                  <th>邮箱</th>
                  <th>角色</th>
                  <th>状态</th>
                  <th>密码更新时间</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>{currentUser.username}</strong></td>
                  <td>{currentUser.display_name}</td>
                  <td>{currentUser.email || "-"}</td>
                  <td>{currentUser.roles.join(" / ")}</td>
                  <td><span className={currentUser.status === "ENABLED" ? "tag success" : "p1Tag"}>{currentUser.status}</span></td>
                  <td>{displayDate(currentUser.password_updated_at)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyGuide title="未读取到当前账号" description="登录状态校验成功后会展示账号安全信息。" />
        )}
      </section>

      {canManageUsers ? (
        <section className="leanTableSection">
          <div className="leanSectionHead">
            <div>
              <h2>用户列表</h2>
              <p>管理员可新增、编辑、启用、禁用和重置密码；后端仍会逐次校验权限。</p>
            </div>
          </div>
          <div className="tableWrap">
            <table className="dataTable phase2Table">
              <thead>
                <tr>
                  <th>用户名</th>
                  <th>显示名称</th>
                  <th>邮箱</th>
                  <th>角色</th>
                  <th>状态</th>
                  <th>创建时间</th>
                  <th>最近登录</th>
                  <th>密码更新时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.length ? users.map((user) => {
                  const disableReason = getDisableReason(user, currentUser?.user_id ?? "", enabledAdminCount);
                  return (
                    <tr key={user.user_id}>
                      <td><strong>{user.username}</strong></td>
                      <td>{user.display_name}</td>
                      <td>{user.email || "-"}</td>
                      <td>{user.roles.join(" / ")}</td>
                      <td><span className={user.status === "ENABLED" ? "tag success" : "p1Tag"}>{user.status}</span></td>
                      <td>{displayDate(user.created_at)}</td>
                      <td>{displayDate(user.last_login_at)}</td>
                      <td>{displayDate(user.password_updated_at)}</td>
                      <td>
                        <div className="tableActions">
                          {canUpdateUser ? (
                            <button type="button" onClick={() => openEdit(user)}>
                              编辑
                            </button>
                          ) : null}
                          {canResetPassword ? (
                            <button type="button" onClick={() => openReset(user)}>
                              重置密码
                            </button>
                          ) : null}
                          {user.status === "DISABLED" && canUpdateUser ? (
                            <button type="button" onClick={() => enableUser(user)}>
                              启用
                            </button>
                          ) : null}
                          {canDisableUser && user.status === "ENABLED" ? (
                            <button
                              className="dangerAction"
                              disabled={Boolean(disableReason)}
                              title={disableReason}
                              type="button"
                              onClick={() => setPendingDisable(user)}
                            >
                              禁用
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={9}>
                      <EmptyGuide title="暂无用户数据" description="后端返回用户列表后会在此展示。" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <DetailDrawer
        footerNote="初始密码只会在保存成功后展示一次，关闭后无法再次查看。"
        objectType="用户"
        open={drawer === "create"}
        size="md"
        title="新增用户"
        variant="detail"
        onClose={() => setDrawer("")}
      >
        <UserForm
          form={userForm}
          roles={roles}
          showInitialPassword
          onChange={setUserForm}
        />
        <div className="modalActions">
          <button className="primary" disabled={busy} type="button" onClick={createUser}>创建用户</button>
        </div>
      </DetailDrawer>

      <DetailDrawer
        footerNote="编辑角色和状态仍以后端权限校验为准。"
        objectType="用户"
        open={drawer === "edit"}
        size="md"
        title="编辑用户"
        variant="detail"
        onClose={() => setDrawer("")}
      >
        <UserForm form={userForm} roles={roles} onChange={setUserForm} />
        <div className="modalActions">
          <button className="primary" disabled={busy} type="button" onClick={updateUser}>保存</button>
        </div>
      </DetailDrawer>

      <DetailDrawer
        footerNote="临时密码只会在保存成功后展示一次，关闭后无法再次查看。"
        objectType="密码"
        open={drawer === "reset"}
        size="md"
        title={`重置密码：${resetUser?.username ?? ""}`}
        variant="detail"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="临时密码">
          <label className="checkboxLine">
            <input
              checked={resetAutoPassword}
              type="checkbox"
              onChange={(event) => setResetAutoPassword(event.target.checked)}
            />
            自动生成临时密码
          </label>
          {!resetAutoPassword ? (
            <label>
              手动输入临时密码
              <input
                autoComplete="new-password"
                type="password"
                value={resetPassword}
                onChange={(event) => setResetPassword(event.target.value)}
              />
            </label>
          ) : null}
        </DrawerSection>
        <div className="modalActions">
          <button className="primary" disabled={busy} type="button" onClick={resetUserPassword}>重置密码</button>
        </div>
      </DetailDrawer>

      <DetailDrawer
        footerNote="不会从后端读取或展示已有密码。"
        objectType="本人密码"
        open={drawer === "password"}
        size="md"
        title="修改本人密码"
        variant="detail"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="账号安全">
          <div className="formGrid">
            <PasswordInput
              label="当前密码"
              show={showPassword}
              value={passwordForm.current_password}
              onChange={(value) => setPasswordForm((form) => ({ ...form, current_password: value }))}
            />
            <PasswordInput
              label="新密码"
              show={showPassword}
              value={passwordForm.new_password}
              onChange={(value) => setPasswordForm((form) => ({ ...form, new_password: value }))}
            />
            <PasswordInput
              label="确认新密码"
              show={showPassword}
              value={passwordForm.confirm_password}
              onChange={(value) => setPasswordForm((form) => ({ ...form, confirm_password: value }))}
            />
          </div>
          <button className="actionButton secondary" type="button" onClick={() => setShowPassword((show) => !show)}>
            {showPassword ? "隐藏输入" : "显示输入"}
          </button>
        </DrawerSection>
        <div className="modalActions">
          <button className="primary" disabled={busy} type="button" onClick={changeOwnPassword}>修改密码</button>
        </div>
      </DetailDrawer>

      <DetailDrawer
        footerNote="角色权限由后端 role_permissions 返回。"
        objectType="角色"
        open={drawer === "roles"}
        size="lg"
        title="角色管理"
        variant="detail"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="角色列表">
          <div className="tableWrap">
            <table className="dataTable phase2Table">
              <thead>
                <tr>
                  <th>角色</th>
                  <th>状态</th>
                  <th>权限数量</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.role_id}>
                    <td>{role.role_name}</td>
                    <td>{role.status}</td>
                    <td>{role.permission_codes?.length ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="权限矩阵覆盖 MENU、BUTTON、API 和 EXPORT。"
        objectType="权限"
        open={drawer === "permissions"}
        size="lg"
        title="权限矩阵"
        variant="detail"
        onClose={() => setDrawer("")}
      >
        <DrawerSection title="权限列表">
          <div className="tableWrap">
            <table className="dataTable phase2Table">
              <thead>
                <tr>
                  <th>权限编码</th>
                  <th>类型</th>
                  <th>资源</th>
                  <th>动作</th>
                </tr>
              </thead>
              <tbody>
                {permissions.slice(0, 120).map((permission) => (
                  <tr key={permission.permission_code}>
                    <td>{permission.permission_code}</td>
                    <td>{permission.permission_type}</td>
                    <td>{permission.resource_code}</td>
                    <td>{permission.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DrawerSection>
      </DetailDrawer>

      <DetailDrawer
        footerNote="请复制保存，关闭后无法再次查看。"
        objectType="一次性密码"
        open={Boolean(oneTimeSecret)}
        size="md"
        title={oneTimeSecret?.title ?? "一次性密码"}
        variant="detail"
        onClose={() => setOneTimeSecret(null)}
      >
        <DrawerSection title="一次性凭据">
          <dl className="businessDetail">
            <div>
              <dt>用户名</dt>
              <dd>{oneTimeSecret?.username}</dd>
            </div>
            <div>
              <dt>一次性密码</dt>
              <dd>{oneTimeSecret?.password}</dd>
            </div>
          </dl>
        </DrawerSection>
      </DetailDrawer>

      <ConfirmModal
        open={Boolean(pendingDisable)}
        title="确认禁用用户"
        description={`禁用后，${pendingDisable?.username ?? "该用户"} 将无法登录或访问受保护接口。`}
        effect="后端会写入用户状态和审计日志；不会删除历史审计记录。"
        risk="禁止禁用当前登录用户，也禁止禁用最后一个启用的系统管理员。"
        confirmLabel="确认禁用"
        confirmType="danger"
        onCancel={() => setPendingDisable(null)}
        onConfirmGeneric={disableUser}
      />
    </div>
  );
}

function UserForm({
  form,
  roles,
  showInitialPassword = false,
  onChange,
}: {
  form: typeof emptyUserForm;
  roles: RoleRow[];
  showInitialPassword?: boolean;
  onChange: (next: typeof emptyUserForm) => void;
}) {
  return (
    <DrawerSection title="基础信息">
      <div className="formGrid">
        <label>
          用户名
          <input
            disabled={!showInitialPassword}
            value={form.username}
            onChange={(event) => onChange({ ...form, username: event.target.value })}
          />
        </label>
        <label>
          显示名称
          <input value={form.display_name} onChange={(event) => onChange({ ...form, display_name: event.target.value })} />
        </label>
        <label>
          邮箱
          <input value={form.email} onChange={(event) => onChange({ ...form, email: event.target.value })} />
        </label>
        <label>
          状态
          <select value={form.status} onChange={(event) => onChange({ ...form, status: event.target.value })}>
            <option value="ENABLED">ENABLED</option>
            <option value="DISABLED">DISABLED</option>
          </select>
        </label>
      </div>
      <div className="formGrid">
        {roles.map((role) => (
          <label className="checkboxLine" key={role.role_id}>
            <input
              checked={form.roles.includes(role.role_id)}
              type="checkbox"
              onChange={(event) => {
                const nextRoles = event.target.checked
                  ? [...form.roles, role.role_id]
                  : form.roles.filter((roleId) => roleId !== role.role_id);
                onChange({ ...form, roles: Array.from(new Set(nextRoles)) });
              }}
            />
            {role.role_name}
          </label>
        ))}
      </div>
      {showInitialPassword ? (
        <>
          <label className="checkboxLine">
            <input
              checked={form.auto_password}
              type="checkbox"
              onChange={(event) => onChange({ ...form, auto_password: event.target.checked })}
            />
            自动生成初始密码
          </label>
          {!form.auto_password ? (
            <label>
              初始密码
              <input
                autoComplete="new-password"
                type="password"
                value={form.initial_password}
                onChange={(event) => onChange({ ...form, initial_password: event.target.value })}
              />
            </label>
          ) : null}
        </>
      ) : null}
    </DrawerSection>
  );
}

function PasswordInput({
  label,
  show,
  value,
  onChange,
}: {
  label: string;
  show: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <input
        autoComplete={label === "当前密码" ? "current-password" : "new-password"}
        type={show ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function hasUserPermission(isSystemAdmin: boolean, buttonCodes: string[], permissionCode: string) {
  return isSystemAdmin || buttonCodes.includes(permissionCode);
}

function getDisableReason(user: UserRow, currentUserId: string, enabledAdminCount: number) {
  if (user.user_id === currentUserId) {
    return "不能禁用当前登录用户";
  }
  if (user.roles.includes("SYSTEM_ADMIN") && enabledAdminCount <= 1) {
    return "不能禁用最后一个启用的系统管理员";
  }
  return "";
}

function displayDate(value?: string) {
  return value || "-";
}

function asUserRow(row: Record<string, unknown>): UserRow {
  return {
    user_id: String(row.user_id ?? ""),
    username: String(row.username ?? ""),
    display_name: String(row.display_name ?? row.username ?? ""),
    email: String(row.email ?? ""),
    status: String(row.status ?? ""),
    roles: Array.isArray(row.roles) ? row.roles.map(String) : [],
    created_at: row.created_at ? String(row.created_at) : undefined,
    last_login_at: row.last_login_at ? String(row.last_login_at) : undefined,
    password_updated_at: row.password_updated_at ? String(row.password_updated_at) : undefined,
    must_change_password: Boolean(row.must_change_password),
    disabled_by: row.disabled_by ? String(row.disabled_by) : undefined,
    disabled_at: row.disabled_at ? String(row.disabled_at) : undefined,
  };
}

function asCurrentUser(row: Record<string, unknown>): CurrentUser {
  return {
    user_id: String(row.user_id ?? ""),
    username: String(row.username ?? ""),
    display_name: String(row.display_name ?? row.username ?? ""),
    email: String(row.email ?? ""),
    status: String(row.status ?? ""),
    roles: Array.isArray(row.roles) ? row.roles.map(String) : [],
    password_updated_at: row.password_updated_at ? String(row.password_updated_at) : undefined,
    must_change_password: Boolean(row.must_change_password),
  };
}

function asRoleRow(row: Record<string, unknown>): RoleRow {
  return {
    role_id: String(row.role_id ?? ""),
    role_code: String(row.role_code ?? row.role_id ?? ""),
    role_name: String(row.role_name ?? row.role_id ?? ""),
    status: String(row.status ?? ""),
    permission_codes: Array.isArray(row.permission_codes)
      ? row.permission_codes.map(String)
      : [],
  };
}

function asPermissionRow(row: Record<string, unknown>): PermissionRow {
  return {
    permission_code: String(row.permission_code ?? ""),
    permission_name: String(row.permission_name ?? ""),
    permission_type: String(row.permission_type ?? ""),
    resource_code: String(row.resource_code ?? ""),
    action: String(row.action ?? ""),
  };
}
