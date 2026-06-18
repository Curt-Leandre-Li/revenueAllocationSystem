import { useEffect, useState } from "react";
import { menuGroups } from "./menu";
import { getRoute, resolveRoute, routeComponents } from "./routes";
import { fieldLabels } from "../domain/fieldMap";
import { dispatchWorkbenchAction } from "../domain/services";
import { projectStatusLabels } from "../domain/status";
import {
  createWorkbenchStore,
  loadBackendWorkbenchStore,
} from "../domain/store";
import type { ActionDefinition, ActionPayload, DataRow, RoutePath } from "../domain/types";
import { ConfirmModal, DetailDrawer, TraceDrawer } from "../ui";
import { WorkbenchPage } from "../pages/WorkbenchPage";

interface RowDetail {
  title: string;
  row: DataRow;
}

export function AppShell() {
  const [activePath, setActivePath] = useState<RoutePath>(() =>
    resolveRoute(window.location.pathname),
  );
  const [store, setStore] = useState(createWorkbenchStore);
  const [confirmAction, setConfirmAction] = useState<ActionDefinition | null>(null);
  const [traceOpen, setTraceOpen] = useState(false);
  const [rowDetail, setRowDetail] = useState<RowDetail | null>(null);

  useEffect(() => {
    let mounted = true;
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
    const resolvedPath = resolveRoute(window.location.pathname);
    if (window.location.pathname !== resolvedPath) {
      window.history.replaceState({}, "", resolvedPath);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setActivePath(resolveRoute(window.location.pathname));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const route = getRoute(activePath);
  const RoutePage = routeComponents[route.path] ?? WorkbenchPage;
  const pageData = store.snapshot.pages[route.path];

  function navigate(path: RoutePath) {
    const resolvedPath = resolveRoute(path);
    setActivePath(resolvedPath);
    window.history.pushState({}, "", resolvedPath);
  }

  function handleAction(action: ActionDefinition, payload?: ActionPayload) {
    if (action.requiresConfirmation) {
      setConfirmAction(action);
      return;
    }

    executeAction(action, payload);
  }

  function confirm(action: ActionDefinition) {
    setConfirmAction(null);
    executeAction(action);
  }

  function executeAction(action: ActionDefinition, payload?: ActionPayload) {
    setStore((current) => dispatchWorkbenchAction(current, action, payload));
  }

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brandBlock">
          <div className="brandMark">DV</div>
          <div>
            <strong>数据收益分配系统</strong>
            <span>模拟与审计说明工作区</span>
          </div>
        </div>

        <nav className="navTree" aria-label="左侧导航">
          {menuGroups.map((group) => (
            <section className="navGroup" key={group.label}>
              <h2>{group.label}</h2>
              <div className="navItems">
                {group.items.map((item) => (
                  <button
                    className={item.path === activePath ? "active" : ""}
                    key={item.path}
                    type="button"
                    onClick={() => navigate(item.path)}
                  >
                    <span>{item.label}</span>
                    {item.phase === "P1" ? <small>P1</small> : null}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </nav>
      </aside>

      <main className="workspace">
        <section className="topbar" aria-label="项目状态栏">
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
          <button type="button" onClick={() => navigate("/dashboard/risk")}>
            风险提示
          </button>
          <button type="button" onClick={() => setTraceOpen(true)}>
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
        open={Boolean(rowDetail)}
        title={rowDetail?.title ?? "详情"}
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
        open={traceOpen}
        title={`${route.label}追溯`}
        onClose={() => setTraceOpen(false)}
      />

      <ConfirmModal
        action={confirmAction}
        onCancel={() => setConfirmAction(null)}
        onConfirm={confirm}
      />
    </div>
  );
}
