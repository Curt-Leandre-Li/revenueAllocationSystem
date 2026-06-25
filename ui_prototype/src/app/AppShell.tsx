import { useEffect, useState } from "react";
import {
  canonicalLocationForPathname,
  getRoute,
  resolveRoute,
  routeComponents,
  sectionIdForRoute,
} from "./routes";
import { getSideNavNodes, type MenuNode } from "./menu";
import { fieldLabels } from "../domain/fieldMap";
import { dvasApi, formatApiError, type BackendNavigationMenuDto } from "../domain/api";
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
  const [sideNavNodes, setSideNavNodes] = useState<MenuNode[]>(() => getSideNavNodes());

  useEffect(() => {
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
          setSideNavNodes(navigationResult.nodes);
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
  }, [shouldSyncBackend]);

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

  const route = getRoute(activePath);
  const RoutePage = routeComponents[route.path] ?? WorkbenchPage;
  const pageData = store.snapshot.pages[route.path];
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
    store.snapshot.operator === "local_operator"
      ? "本地演示用户"
      : store.snapshot.operator;
  const leanWorkspace =
    route.path === "/data/ingestion" ||
    route.path === "/metering/quality" ||
    route.path === "/allocation/simulation";

  function navigate(path: RoutePath) {
    const resolvedPath = resolveRoute(path);
    const sectionId = sectionIdForRoute(path);
    const targetLocation = sectionId ? `${resolvedPath}#${sectionId}` : resolvedPath;
    setActivePath(resolvedPath);
    window.history.pushState({}, "", targetLocation);
    window.dispatchEvent(new Event("hashchange"));
  }

  function handleAction(action: ActionDefinition, payload?: ActionPayload) {
    if (action.requiresConfirmation) {
      setConfirmAction({ action, payload });
      return;
    }

    executeAction(action, payload);
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
      void result
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
        <section className={`topbar${dashboardTopbar ? " dashboardTopbar" : ""}`} aria-label="项目状态栏">
          <button
            className="mobileMenuButton"
            type="button"
            onClick={() => setMobileNavOpen(true)}
          >
            菜单
          </button>
          <div className="topbarSystem">
            <span>系统</span>
            <strong>数据收益分配系统 V1.2</strong>
          </div>
          <div>
            <span>当前项目</span>
            <strong>{topbarProjectName}</strong>
            <span>{topbarScenarioName}</span>
          </div>
          <div>
            <span>当前状态</span>
            <strong>{projectStatusLabels[store.snapshot.status]}</strong>
          </div>
          <div>
            <span>操作员</span>
            <strong>{topbarOperator}</strong>
          </div>
          <div>
            <span>系统状态</span>
            <strong>{store.dataSource.mode === "backend" ? "已连接" : "未连接"}</strong>
          </div>
          <button
            className="topbarInfoButton dashboardInteractiveTip"
            data-tooltip={simulationDisclaimer}
            type="button"
            title={simulationDisclaimer}
          >
            风险说明
          </button>
          <button
            className="topbarInfoButton dashboardInteractiveTip"
            data-tooltip="查看最近操作记录与审计追溯。"
            type="button"
            onClick={() => navigate("/system/audit")}
          >
            {dashboardTopbar ? "查看记录" : "审计追溯"}
          </button>
        </section>

        <section className="globalStatusRail" aria-label="项目状态条">
          <StatusStepper current={store.snapshot.status} />
        </section>

        <p className="operationMessage">{userFacingText(store.lastMessage)}</p>

        {store.dataSource.mode !== "backend" ? (
          <BackendUnavailableState
            apiBaseUrl={store.snapshot.backend?.apiBaseUrl ?? "http://127.0.0.1:8000/api/v1"}
            error={store.dataSource.lastError}
            modeLabel={backendChecked ? "系统未连接" : "正在连接系统"}
          />
        ) : null}

        <RoutePage
          route={route}
          snapshot={store.snapshot}
          onAction={handleAction}
          onNavigate={navigate}
          onOpenDetail={(title, row) => setRowDetail({ title, row })}
          onOpenTrace={() => setTraceOpen(true)}
        />
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
  const children = (item.children ?? [])
    .map(mapBackendMenuNode)
    .filter((node) => node.visibleInSideNav !== false)
    .sort((left, right) => left.sortNo - right.sortNo);
  const menuCode = String(item.menu_code);
  return {
    menuCode,
    moduleCode: String(item.module_code) as MenuNode["moduleCode"],
    label: String(item.menu_name),
    routePath: resolveRoute(String(item.route_path || "/dashboard")),
    icon: iconForMenuCode(menuCode),
    p1Only: Boolean(item.p1_only),
    phase: item.p1_only ? "P1" : "P0",
    sortNo: Number(item.sort_no) || 0,
    visibleInSideNav: item.status !== "DISABLED",
    children,
  };
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

function isAsyncActionResult(
  value: ReturnType<typeof dispatchWorkbenchAction>,
): value is Promise<WorkbenchStore> {
  return Boolean(
    value &&
      typeof (value as unknown as { then?: unknown }).then === "function",
  );
}
