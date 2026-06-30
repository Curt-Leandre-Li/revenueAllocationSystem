import { useEffect, useRef, useState } from "react";
import {
  canonicalLocationForPathname,
  getRoute,
  resolveRoute,
  routeComponents,
  sectionIdForRoute,
} from "./routes";
import { getSideNavNodes, type MenuNode } from "./menu";
import { fieldLabels } from "../domain/fieldMap";
import {
  dvasApi,
  formatApiError,
  getStoredAuthToken,
  type BackendNavigationMenuDto,
} from "../domain/api";
import { dispatchWorkbenchAction } from "../domain/services";
import { projectStatusLabels } from "../domain/status";
import { simulationDisclaimer } from "../domain/stateGuards";
import {
  createWorkbenchStore,
  loadBackendWorkbenchStore,
  shouldAttemptBackendSync,
} from "../domain/store";
import type { WorkbenchStore } from "../domain/store";
import type { ActionDefinition, ActionPayload, DataRow, RoutePath } from "../domain/types";
import {
  BackendUnavailableState,
  ConfirmModal,
  DetailDrawer,
  SideNav,
  StatusStepper,
  TraceDrawer,
} from "../ui";
import { userFacingText } from "../ui/displayText";
import { WorkbenchPage } from "../pages/WorkbenchPage";

interface RowDetail {
  title: string;
  row: DataRow;
}

interface PendingConfirmation {
  action: ActionDefinition;
  payload?: ActionPayload;
}

const profileQuickLinks: Array<{ label: string; hint: string; path: RoutePath }> = [
  { label: "我的账号", hint: "密码与安全", path: "/system/users" },
  { label: "我的项目", hint: "系统首页", path: "/dashboard" },
  { label: "数据接入", hint: "上传与快照", path: "/data/ingestion" },
  { label: "计算任务", hint: "MD-DShap", path: "/allocation/md-dshap" },
  { label: "报告导出", hint: "Markdown / CSV / JSON", path: "/reports" },
  { label: "审计追溯", hint: "日志与快照", path: "/system/audit" },
];

export function AppShell() {
  const shouldSyncBackend = shouldAttemptBackendSync(window.location.search);
  const [activePath, setActivePath] = useState<RoutePath>(() =>
    resolveRoute(window.location.pathname),
  );
  const [store, setStore] = useState(createWorkbenchStore);
  const [backendChecked, setBackendChecked] = useState(!shouldSyncBackend);
  const [confirmAction, setConfirmAction] = useState<PendingConfirmation | null>(null);
  const [traceOpen, setTraceOpen] = useState(false);
  const [rowDetail, setRowDetail] = useState<RowDetail | null>(null);
  const [sideNavCollapsed, setSideNavCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [uploadSpecOpen, setUploadSpecOpen] = useState(true);
  const [sideNavNodes, setSideNavNodes] = useState<MenuNode[]>(() => getSideNavNodes());
  const [authChecked, setAuthChecked] = useState(!shouldSyncBackend);
  const [authenticated, setAuthenticated] = useState(!shouldSyncBackend);
  const [currentUserName, setCurrentUserName] = useState("");
  const [currentUserRoles, setCurrentUserRoles] = useState<string[]>([]);
  const [currentMenuCodes, setCurrentMenuCodes] = useState<string[]>([]);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shouldSyncBackend) {
      return undefined;
    }
    const token = getStoredAuthToken();
    if (!token) {
      setAuthChecked(true);
      setAuthenticated(false);
      return undefined;
    }
    let mounted = true;
    void dvasApi.getCurrentUser().then(
      (response) => {
        if (!mounted) {
          return;
        }
        setCurrentUserName(String(response.user.display_name || response.user.username || ""));
        setCurrentUserRoles(response.roles ?? []);
        setCurrentMenuCodes(response.permissions?.menu_codes ?? []);
        setAuthenticated(true);
        setAuthChecked(true);
      },
      () => {
        if (mounted) {
          setAuthenticated(false);
          setAuthChecked(true);
        }
      },
    );
    return () => {
      mounted = false;
    };
  }, [shouldSyncBackend]);

  useEffect(() => {
    if (!authChecked || !authenticated) {
      return undefined;
    }
    if (!shouldSyncBackend) {
      setStore((current) => ({
        ...current,
        lastMessage:
          "系统同步已关闭，当前不会伪造成业务成功。请启用系统连接后刷新。",
        dataSource: {
          ...current.dataSource,
          mode: "backend_unavailable",
          backendAvailable: false,
        },
      }));
      return undefined;
    }

    let mounted = true;
    setStore((current) => ({
      ...current,
      lastMessage: "正在读取系统工作区数据。",
    }));
    void Promise.all([loadBackendWorkbenchStore(), loadBackendSideNavNodes()]).then(
      ([nextStore, navigationResult]) => {
        if (mounted) {
          setSideNavNodes(filterMenuNodesByPermissions(navigationResult.nodes, currentMenuCodes));
          setStore({
            ...nextStore,
            lastMessage: navigationResult.fallbackMessage
              ? `${nextStore.lastMessage} ${navigationResult.fallbackMessage}`
              : nextStore.lastMessage,
          });
          setBackendChecked(true);
        }
      },
      () => {
        if (mounted) {
          setBackendChecked(true);
        }
      },
    );
    return () => {
      mounted = false;
    };
  }, [authChecked, authenticated, currentMenuCodes, shouldSyncBackend]);

  useEffect(() => {
    const canonicalLocation = canonicalLocationForPathname(window.location.pathname);
    const currentLocation = `${window.location.pathname}${window.location.hash}`;
    const isDashboardSectionHash =
      window.location.pathname === "/dashboard" &&
      ["#overview", "#process", "#risk", "#one-click"].includes(window.location.hash);
    if (currentLocation !== canonicalLocation && !isDashboardSectionHash) {
      window.history.replaceState({}, "", canonicalLocation);
    }
  }, []);

  useEffect(() => {
    const syncActivePath = () => {
      setActivePath(resolveRoute(window.location.pathname));
    };
    window.addEventListener("popstate", syncActivePath);
    window.addEventListener("hashchange", syncActivePath);
    return () => {
      window.removeEventListener("popstate", syncActivePath);
      window.removeEventListener("hashchange", syncActivePath);
    };
  }, []);

  useEffect(() => {
    if (!userMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [userMenuOpen]);

  const route = getRoute(activePath);
  const RoutePage = routeComponents[route.path] ?? WorkbenchPage;
  const pageData = store.snapshot.pages[route.path];
  const routeAllowed =
    !shouldSyncBackend ||
    route.path === "/system/users" ||
    currentMenuCodes.length === 0 ||
    currentMenuCodes.includes(route.menuCode);
  const dashboardTopbar = route.path === "/dashboard";
  const topbarProjectName =
    dashboardTopbar && store.dataSource.mode !== "backend"
      ? "等待系统连接"
      : store.snapshot.projectName;
  const topbarScenarioName =
    dashboardTopbar && store.dataSource.mode !== "backend"
      ? "等待数据同步"
      : store.snapshot.scenarioName;
  const topbarOperator =
    currentUserName ||
    (store.snapshot.operator === "local_operator"
      ? "本地演示用户"
      : store.snapshot.operator);
  const userRoleLabel = currentUserRoles.length
    ? roleDisplay(currentUserRoles)
    : store.snapshot.operator === "local_operator"
      ? "本地操作员"
      : "未分配角色";
  const userAvatarLabel = getAvatarLabel(topbarOperator);
  const connectionLabel = store.dataSource.mode === "backend" ? "已连接" : "未连接";
  const connectionTone = store.dataSource.mode === "backend" ? "connected" : "disconnected";
  const leanWorkspace =
    route.path === "/data/ingestion" ||
    route.path === "/metering/quality" ||
    route.path === "/allocation/simulation";
  const optionalReadIssues = store.snapshot.backend?.optionalReadIssues ?? [];
  const optionalIssuePreview = optionalReadIssues
    .slice(0, 3)
    .map((item) => `${item.label}: ${item.errorCode}`)
    .join("；");

  function navigate(path: RoutePath) {
    const resolvedPath = resolveRoute(path);
    const sectionId = sectionIdForRoute(path);
    const targetLocation = sectionId ? `${resolvedPath}#${sectionId}` : resolvedPath;
    setActivePath(resolvedPath);
    window.history.pushState({}, "", targetLocation);
    window.dispatchEvent(new Event("hashchange"));
  }

  function navigateFromUserMenu(path: RoutePath) {
    setUserMenuOpen(false);
    navigate(path);
  }

  function handleAction(action: ActionDefinition, payload?: ActionPayload) {
    if (action.requiresConfirmation) {
      setConfirmAction({ action, payload });
      return;
    }

    return executeAction(action, payload);
  }

  function confirm(action: ActionDefinition) {
    const payload = confirmAction?.payload;
    setConfirmAction(null);
    executeAction(action, payload);
  }

  function executeAction(action: ActionDefinition, payload?: ActionPayload) {
    const result = dispatchWorkbenchAction(store, action, payload);
    if (isAsyncActionResult(result)) {
      setStore((current) => ({
        ...current,
        lastMessage: `${action.label} 执行中，正在同步系统结果。`,
      }));
      return result
        .then((nextStore) => setStore(nextStore))
        .catch((error) =>
          setStore((latest) => ({
            ...latest,
            lastMessage: `${action.label} 未执行：${formatApiError(error)}`,
          })),
        );
      return;
    }

    setStore(result);
  }

  async function handleLogin(username: string, password: string) {
    setLoginSubmitting(true);
    setLoginError("");
    try {
      const response = await dvasApi.login(username, password);
      setCurrentUserName(String(response.user.display_name || response.user.username || username));
      setCurrentUserRoles(response.roles ?? []);
      setCurrentMenuCodes((response.permissions?.menu_codes as string[] | undefined) ?? []);
      setAuthenticated(true);
      setAuthChecked(true);
    } catch (error) {
      setLoginError(formatApiError(error));
    } finally {
      setLoginSubmitting(false);
    }
  }

  async function handleLogout() {
    try {
      await dvasApi.logout();
    } catch {
      // Local token is cleared by logout only on success; force UI reset even if session already expired.
    }
    window.localStorage.removeItem("dvas_auth_token");
    setAuthenticated(false);
    setCurrentUserName("");
    setCurrentUserRoles([]);
    setCurrentMenuCodes([]);
    setUserMenuOpen(false);
  }

  if (!authChecked) {
    return <div className="loginShell"><p>正在校验登录状态。</p></div>;
  }

  if (!authenticated) {
    return (
      <LoginPage
        error={loginError}
        submitting={loginSubmitting}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <div className={`appShell${sideNavCollapsed ? " sideNavCollapsed" : ""}`}>
      <SideNav
        activePath={activePath}
        collapsed={sideNavCollapsed}
        mobileOpen={mobileNavOpen}
        nodes={sideNavNodes}
        onCollapseChange={setSideNavCollapsed}
        onMobileOpenChange={setMobileNavOpen}
        onNavigate={navigate}
      />
      <main className={`workspace${leanWorkspace ? " leanWorkspace" : ""}`}>
        <section className="workspaceChrome" aria-label="用户与快捷操作">
          <button
            className="mobileMenuButton"
            type="button"
            onClick={() => setMobileNavOpen(true)}
          >
            菜单
          </button>
          <div className="profileControl" ref={userMenuRef}>
            <button
              aria-expanded={userMenuOpen}
              aria-haspopup="dialog"
              aria-label={`${topbarOperator}的账户菜单`}
              className="profileAvatarButton"
              type="button"
              onClick={() => setUserMenuOpen((open) => !open)}
            >
              <span aria-hidden="true">{userAvatarLabel}</span>
            </button>
            {userMenuOpen ? (
              <div className="profileMenuDropdown" aria-label="当前用户信息和功能">
                <div className="profileMenuIdentity">
                  <span className="profileAvatarLarge" aria-hidden="true">
                    {userAvatarLabel}
                  </span>
                  <div>
                    <strong>{topbarOperator}</strong>
                    <span>{userRoleLabel}</span>
                  </div>
                </div>
                <dl className="profileMenuContext">
                  <div>
                    <dt>当前项目</dt>
                    <dd>{topbarProjectName}</dd>
                  </div>
                  <div>
                    <dt>项目场景</dt>
                    <dd>{topbarScenarioName}</dd>
                  </div>
                  <div>
                    <dt>当前状态</dt>
                    <dd>{projectStatusLabels[store.snapshot.status]}</dd>
                  </div>
                  <div>
                    <dt>系统状态</dt>
                    <dd className={`profileConnection ${connectionTone}`}>
                      <span aria-hidden="true" />
                      {connectionLabel}
                    </dd>
                  </div>
                </dl>
                <div className="profileBoundaryNotice">{simulationDisclaimer}</div>
                <div className="profileMenuActions">
                  {profileQuickLinks.map((item) => (
                    <button
                      className="profileMenuLink"
                      key={item.path}
                      type="button"
                      onClick={() => navigateFromUserMenu(item.path)}
                    >
                      <strong>{item.label}</strong>
                      <span>{item.hint}</span>
                    </button>
                  ))}
                </div>
                {shouldSyncBackend ? (
                  <button className="profileLogoutButton" type="button" onClick={handleLogout}>
                    退出登录
                  </button>
                ) : (
                  <span className="profileLocalMode">本地操作员模式</span>
                )}
              </div>
            ) : null}
          </div>
        </section>

        <section className="globalStatusRail" aria-label="项目状态条">
          <StatusStepper current={store.snapshot.status} />
        </section>

        {store.lastMessage ? (
          <p className="operationMessage" role="status">{userFacingText(store.lastMessage)}</p>
        ) : null}

        {store.dataSource.mode === "backend" && optionalReadIssues.length ? (
          <div className="optionalReadWarning" role="status">
            <strong>次要接口读取失败 {optionalReadIssues.length} 项</strong>
            <span>{optionalIssuePreview}</span>
          </div>
        ) : null}

        {store.dataSource.mode !== "backend" ? (
          <BackendUnavailableState
            apiBaseUrl={store.snapshot.backend?.apiBaseUrl ?? "http://127.0.0.1:8000/api/v1"}
            error={store.dataSource.lastError}
            modeLabel={backendChecked ? "系统未连接" : "正在连接系统"}
          />
        ) : null}

        {routeAllowed ? (
          <RoutePage
            route={route}
            snapshot={store.snapshot}
            onAction={handleAction}
            onNavigate={navigate}
            onOpenDetail={(title, row) => setRowDetail({ title, row })}
            onOpenTrace={() => setTraceOpen(true)}
          />
        ) : (
          <ForbiddenPage routeLabel={route.label} onNavigate={navigate} />
        )}
      </main>

      <DetailDrawer
        footerNote="仅展示主业务字段；工程字段通过追溯抽屉查看。"
        objectType="业务记录"
        open={Boolean(rowDetail)}
        size="md"
        subtitle={route.label}
        title={rowDetail?.title ?? "详情"}
        variant="detail"
        onClose={() => setRowDetail(null)}
      >
        <dl className="businessDetail">
          {rowDetail
            ? Object.entries(rowDetail.row).map(([key, value]) => (
                <div key={key}>
                  <dt>{fieldLabels[key] ?? key}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))
            : null}
        </dl>
      </DetailDrawer>

      <TraceDrawer
        details={pageData.technicalDetails}
        footerNote="工程字段默认折叠，仅用于审计追溯和问题定位。"
        objectType="审计追溯"
        open={traceOpen}
        summary="当前页面的输入、参数、输出和工程标识只用于审计追溯，不在主业务界面展示。"
        title={`${route.label}追溯`}
        onClose={() => setTraceOpen(false)}
      />

      <ConfirmModal
        action={confirmAction?.action ?? null}
        onCancel={() => setConfirmAction(null)}
        onConfirm={confirm}
      />
      {uploadSpecOpen ? (
        <DataUploadSpecModal onClose={() => setUploadSpecOpen(false)} />
      ) : null}
    </div>
  );
}

function DataUploadSpecModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modalBackdrop uploadSpecBackdrop" role="presentation">
      <section
        aria-label="上传数据包字段要求"
        aria-modal="true"
        className="uploadSpecModal"
        role="dialog"
      >
        <div className="uploadSpecHead">
          <div>
            <p>正式测试前请先确认</p>
            <h2>上传数据包字段要求</h2>
          </div>
          <span>UTF-8 JSON</span>
        </div>

        <div className="uploadSpecGrid">
          <section>
            <h3>传输要求</h3>
            <ul>
              <li>上传文件必须是 `.json`，内容为合法 UTF-8 JSON object。</li>
              <li>前端使用 `multipart/form-data` 上传，文件字段名固定为 `file`。</li>
              <li>后端会记录 `filename`、`content_length`、`sha256` 和顶层 `json_keys`。</li>
            </ul>
          </section>

          <section>
            <h3>顶层字段</h3>
            <ul>
              <li>`project_name`：推荐，作为数据包名称；兼容 `package_name`。</li>
              <li>`participants[]`：推荐，参与方数组；兼容 `parties[]`。</li>
              <li>`data_units[]`：推荐，数据资源数组；兼容 `resources[]`。</li>
              <li>`source_note`、`revenue_pool` 可保留作为输入快照说明。</li>
            </ul>
          </section>

          <section>
            <h3>participants[]</h3>
            <ul>
              <li>`party_id`：上传包内业务 ID，用于 `data_units[].party_id` 关联。</li>
              <li>`party_name`：必填，参与方展示名称。</li>
              <li>`party_type`：数据源主体使用 `DATA_PROVIDER`；非数据主体可用 `OPERATOR`、`TECH_SERVICE` 等。</li>
              <li>`is_data_provider`：数据源主体为 `true`，非数据主体为 `false`。</li>
              <li>`include_in_md_dshap`：仅数据源主体为 `true`，非数据主体必须为 `false`。</li>
            </ul>
          </section>

          <section>
            <h3>data_units[]</h3>
            <ul>
              <li>`resource_name`：必填，数据资源名称。</li>
              <li>`party_id`：推荐，必须能匹配 `participants[].party_id`；也兼容直接提供 `provider_party_name`。</li>
              <li>`modality`：如 `STRUCTURED`、`TEXT`、`IMAGE`、`MEDICAL_IMAGE`。</li>
              <li>`field_count`、`sample_count`、`missing_rate`、`sensitive_field_count` 会进入资源识别和质量评估展示。</li>
              <li>`valid_units`、`quality_score`、`call_count`、`usage_weight`、`coverage_weight`、`scarcity_weight` 可保留在输入快照中。</li>
            </ul>
          </section>
        </div>

        <div className="uploadSpecRule">
          <strong>算法边界</strong>
          <span>
            MD-DShap 只接收 `DATA_PROVIDER + include_in_md_dshap=true` 的主体。运营方、技术服务方等非数据主体不进入权重池，后续通过合同比例方案处理。
          </span>
        </div>

        <div className="modalActions uploadSpecActions">
          <button className="primary" type="button" autoFocus onClick={onClose}>
            我已了解，进入系统
          </button>
        </div>
      </section>
    </div>
  );
}

function ForbiddenPage({
  routeLabel,
  onNavigate,
}: {
  routeLabel: string;
  onNavigate: (path: RoutePath) => void;
}) {
  return (
    <section className="forbiddenPanel" aria-label="无权限访问">
      <div>
        <p>403</p>
        <h1>当前用户无权访问{routeLabel}</h1>
        <span>如果需要访问该页面，请联系系统管理员调整角色或权限。</span>
      </div>
      <button className="primary" type="button" onClick={() => onNavigate("/dashboard")}>
        返回我的工作台
      </button>
    </section>
  );
}

function LoginPage({
  error,
  submitting,
  onLogin,
}: {
  error: string;
  submitting: boolean;
  onLogin: (username: string, password: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="loginShell">
      <section className="loginPanel" aria-label="登录">
        <div>
          <p>数据收益分配系统 V1.2</p>
          <h1>登录</h1>
          <span>登录后按角色权限进入数据接入、计算、报告和审计功能。</span>
          <span>如需账号，请联系系统管理员。</span>
        </div>
        <label>
          用户名
          <input
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label>
          密码
          <input
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? <p className="loginError">{error}</p> : null}
        <button
          className="actionButton primary"
          disabled={submitting}
          type="button"
          onClick={() => onLogin(username, password)}
        >
          {submitting ? "登录中" : "登录"}
        </button>
      </section>
    </div>
  );
}

async function loadBackendSideNavNodes(): Promise<{
  nodes: MenuNode[];
  fallbackMessage?: string;
}> {
  try {
    const response = await dvasApi.getNavigationMenus();
    return { nodes: mapBackendMenuNodes(response.items) };
  } catch (error) {
    return {
      nodes: getSideNavNodes(),
      fallbackMessage: `导航菜单使用本地 fallback：${formatApiError(error)}`,
    };
  }
}

function mapBackendMenuNodes(items: BackendNavigationMenuDto[]): MenuNode[] {
  return items
    .map(mapBackendMenuNode)
    .filter((node) => node.visibleInSideNav !== false)
    .sort((left, right) => left.sortNo - right.sortNo);
}

function mapBackendMenuNode(item: BackendNavigationMenuDto): MenuNode {
  const menuCode = String(item.menu_code);
  const p1Only = menuCode === "NAV_SYSTEM_USER" ? false : Boolean(item.p1_only);
  const children = normalizeBackendMenuChildren(menuCode, (item.children ?? [])
    .map(mapBackendMenuNode)
    .filter((node) => node.visibleInSideNav !== false)
    .sort((left, right) => left.sortNo - right.sortNo));
  return {
    menuCode,
    moduleCode: String(item.module_code) as MenuNode["moduleCode"],
    label: stripUserMenuP1Suffix(menuCode, String(item.menu_name)),
    routePath: resolveRoute(String(item.route_path || "/dashboard")),
    icon: iconForMenuCode(menuCode),
    p1Only,
    phase: item.p1_only ? "P1" : "P0",
    sortNo: Number(item.sort_no) || 0,
    visibleInSideNav: item.status !== "DISABLED",
    children,
  };
}

function stripUserMenuP1Suffix(menuCode: string, menuName: string) {
  if (menuCode !== "NAV_SYSTEM_USER") {
    return menuName;
  }
  return menuName.replace(/\s*[（(]\s*P1\s*[）)]\s*$/i, "");
}

function normalizeBackendMenuChildren(parentMenuCode: string, children: MenuNode[]) {
  if (parentMenuCode !== "NAV_GROUP_ALLOCATION") {
    return children;
  }
  const allocationOrder: Record<string, number> = {
    NAV_ALLOC_MDS: 1,
    NAV_ALLOC_CONSTRAINT: 2,
    NAV_ALLOC_SIMULATION: 3,
  };
  return [...children].sort((left, right) => {
    const leftOrder = allocationOrder[left.menuCode] ?? left.sortNo;
    const rightOrder = allocationOrder[right.menuCode] ?? right.sortNo;
    return leftOrder - rightOrder;
  });
}

function iconForMenuCode(menuCode: string): MenuNode["icon"] {
  if (menuCode.includes("SYS_HOME")) {
    return "home";
  }
  if (menuCode.includes("DATA")) {
    return "data";
  }
  if (menuCode.includes("MEASURE")) {
    return "measure";
  }
  if (menuCode.includes("ALLOC")) {
    return "allocation";
  }
  if (menuCode.includes("REPORT")) {
    return "report";
  }
  if (menuCode.includes("SYSTEM")) {
    return "system";
  }
  return undefined;
}

function filterMenuNodesByPermissions(nodes: MenuNode[], allowedMenuCodes: string[]): MenuNode[] {
  if (!allowedMenuCodes.length) {
    return nodes;
  }
  const allowed = new Set(allowedMenuCodes);
  return nodes.reduce<MenuNode[]>((filtered, node) => {
      const children: MenuNode[] = filterMenuNodesByPermissions(node.children ?? [], allowedMenuCodes);
      if (!allowed.has(node.menuCode) && children.length === 0) {
        return filtered;
      }
      filtered.push({
        ...node,
        children,
        routePath: children[0]?.routePath ?? node.routePath,
      });
      return filtered;
    }, []);
}

function roleDisplay(roles: string[]) {
  const labels: Record<string, string> = {
    SYSTEM_ADMIN: "系统管理员",
    BUSINESS_ADMIN: "业务管理员",
    ALGORITHM_REVIEWER: "算法审核员",
    CONTRACT_REVIEWER: "合同审核员",
    AUDITOR: "审计员",
    VIEWER: "普通查看用户",
  };
  return roles.map((role) => labels[role] ?? role).join(" / ") || "未分配角色";
}

function getAvatarLabel(name: string) {
  const normalized = name.trim();
  return normalized ? normalized.slice(0, 1).toUpperCase() : "用";
}

function isAsyncActionResult(
  value: ReturnType<typeof dispatchWorkbenchAction>,
): value is Promise<WorkbenchStore> {
  return Boolean(
    value &&
      typeof (value as unknown as { then?: unknown }).then === "function",
  );
}
