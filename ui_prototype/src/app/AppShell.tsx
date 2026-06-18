import { useEffect, useState } from "react";
import {
  canonicalLocationForPathname,
  getRoute,
  resolveRoute,
  routeComponents,
  sectionIdForRoute,
} from "./routes";
import { fieldLabels } from "../domain/fieldMap";
import { formatApiError } from "../domain/api";
import { dispatchWorkbenchAction } from "../domain/services";
import { projectStatusLabels } from "../domain/status";
import {
  createWorkbenchStore,
  loadBackendWorkbenchStore,
  shouldAttemptBackendSync,
} from "../domain/store";
import type { WorkbenchStore } from "../domain/store";
import type { ActionDefinition, ActionPayload, DataRow, RoutePath } from "../domain/types";
import { ConfirmModal, DetailDrawer, SideNav, TraceDrawer } from "../ui";
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
  const [activePath, setActivePath] = useState<RoutePath>(() =>
    resolveRoute(window.location.pathname),
  );
  const [store, setStore] = useState(createWorkbenchStore);
  const [confirmAction, setConfirmAction] = useState<PendingConfirmation | null>(null);
  const [traceOpen, setTraceOpen] = useState(false);
  const [rowDetail, setRowDetail] = useState<RowDetail | null>(null);
  const [sideNavCollapsed, setSideNavCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!shouldAttemptBackendSync(window.location.search)) {
      return undefined;
    }

    let mounted = true;
    setStore((current) => ({
      ...current,
      lastMessage: "正在读取后端工作区数据。",
    }));
    void loadBackendWorkbenchStore().then((nextStore) => {
      if (mounted) {
        setStore(nextStore);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

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
        lastMessage: `${action.label} 执行中，正在同步后端结果。`,
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
        onCollapseChange={setSideNavCollapsed}
        onMobileOpenChange={setMobileNavOpen}
        onNavigate={navigate}
      />
      <main className="workspace">
        <section className="topbar" aria-label="项目状态栏">
          <button
            className="mobileMenuButton"
            type="button"
            onClick={() => setMobileNavOpen(true)}
          >
            菜单
          </button>
          <div>
            <strong>{store.snapshot.projectName}</strong>
            <span>{store.snapshot.scenarioName}</span>
          </div>
          <div>
            <span>当前状态</span>
            <strong>{projectStatusLabels[store.snapshot.status]}</strong>
          </div>
          <div>
            <span>操作员</span>
            <strong>{store.snapshot.operator}</strong>
          </div>
          <button type="button" onClick={() => navigate("/dashboard")}>
            风险提示
          </button>
          <button type="button" onClick={() => navigate("/system/audit")}>
            审计追溯
          </button>
        </section>

        <p className="operationMessage">{store.lastMessage}</p>

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

function isAsyncActionResult(
  value: ReturnType<typeof dispatchWorkbenchAction>,
): value is Promise<WorkbenchStore> {
  return Boolean(
    value &&
      typeof (value as unknown as { then?: unknown }).then === "function",
  );
}
